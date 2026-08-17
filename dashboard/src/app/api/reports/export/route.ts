import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { getSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { recalculateUserRange } from "@/app/actions";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // 1. Verify admin authentication
  const session = await getSession();
  if (!session || !session.adminId) {
    return new NextResponse("Unauthorized access. Admin session is required.", { status: 401 });
  }

  const canViewSalaries = session?.adminId === "admin" || session?.permissions?.canViewSalaries === true;

  // 2. Parse query parameters
  const { searchParams } = new URL(request.url);
  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");
  const artisanId = searchParams.get("artisanId");

  if (!startDateStr || !endDateStr) {
    return new NextResponse("Missing required query parameters: startDate and endDate.", { status: 400 });
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return new NextResponse("Format des dates invalide.", { status: 400 });
  }

  const isSingleDay = startDateStr === endDateStr;

  // 3. Trigger live recalculation from raw punches to ensure 100% fresh data with 15-min tolerance
  if (artisanId && artisanId !== "all") {
    await recalculateUserRange(artisanId, startDate, endDate);
  } else {
    const activeUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true }
    });
    for (const u of activeUsers) {
      await recalculateUserRange(u.id, startDate, endDate);
    }
  }

  // 4. Query settings
  const settings = await prisma.systemSettings.findFirst({
    select: { otRate1: true, otRate2: true, contractTypes: true }
  });
  const rate1Percent = settings ? Math.round(settings.otRate1 * 100) : 150;
  const rate2Percent = settings ? Math.round(settings.otRate2 * 100) : 200;
  const otRate1 = settings?.otRate1 ?? 1.5;
  const otRate2 = settings?.otRate2 ?? 2.0;

  const parseContractTypes = (rawJson: string) => {
    try { return JSON.parse(rawJson || '[]'); } catch { return []; }
  };
  const parsedContracts = parseContractTypes(settings?.contractTypes || "[]");

  // 5. Query daily reports
  const whereClause: any = {
    date: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (artisanId && artisanId !== "all") {
    whereClause.userId = artisanId;
  }

  const reports = await prisma.calculatedDailyReport.findMany({
    where: whereClause,
    include: {
      user: {
        include: {
          shift: true
        }
      }
    },
    orderBy: [
      { user: { lastName: 'asc' } },
      { date: 'asc' }
    ]
  });

  // Name formatter helper
  const formatFullName = (firstName: string, lastName: string) => {
    const fn = (firstName || "").replace(/_/g, " ").replace(/\./g, " ").trim();
    const ln = (lastName || "").replace(/_/g, " ").replace(/\./g, " ").trim();
    if (ln && fn) {
      return `${ln.toUpperCase()} ${fn}`;
    }
    return (ln || fn).toUpperCase();
  };

  // 6. Aggregate reports by employee
  const artisanMap = new Map<string, {
    userId: string;
    fullName: string;
    firstName: string;
    lastName: string;
    zktecoUserId: string;
    shiftName: string;
    daysWorked: number;
    regularHours: number;
    overtime150Hours: number;
    overtime200Hours: number;
    totalCost: number;
  }>();

  for (const report of reports) {
    const userId = report.userId;
    let data = artisanMap.get(userId);
    if (!data) {
      data = {
        userId,
        fullName: formatFullName(report.user.firstName, report.user.lastName),
        firstName: report.user.firstName,
        lastName: report.user.lastName,
        zktecoUserId: report.user.zktecoUserId,
        shiftName: report.user.shift?.name || "Sans Shift (Par Défaut)",
        daysWorked: 0,
        regularHours: 0,
        overtime150Hours: 0,
        overtime200Hours: 0,
        totalCost: 0,
      };
      artisanMap.set(userId, data);
    }

    if (report.firstPunchIn) {
      data.daysWorked += 1;
    }
    data.regularHours += report.regularHours;
    data.overtime150Hours += report.overtime150Hours;
    data.overtime200Hours += report.overtime200Hours;

    const userContract = parsedContracts.find((c: any) => c.name === report.user.contractType);
    const hasOvertime = userContract ? userContract.hasOvertime : true;

    let reg = report.regularHours;
    let ot150 = report.overtime150Hours;
    let ot200 = report.overtime200Hours;

    if (!hasOvertime) {
      reg = reg + ot150 + ot200;
      ot150 = 0;
      ot200 = 0;
    }

    const hourlyRate = report.user.hourlyRate || 0;
    const cost = (reg * hourlyRate) + (ot150 * hourlyRate * otRate1) + (ot200 * hourlyRate * otRate2);
    data.totalCost += cost;
  }

  const aggregatedData = Array.from(artisanMap.values());

  if (aggregatedData.length === 0) {
    return new NextResponse("Aucune donnée disponible pour la période sélectionnée.", { status: 404 });
  }

  // Determine single user record if applicable
  const isSinglePerson = artisanId && artisanId !== "all" && aggregatedData.length === 1;
  const singleUser = isSinglePerson ? aggregatedData[0] : null;

  // Build clean dynamic filename
  const startFmt = startDateStr.replace(/-/g, "");
  const endFmt = endDateStr.replace(/-/g, "");
  let fileBaseName = "";

  if (singleUser) {
    const cleanUserSlug = singleUser.fullName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    fileBaseName = isSingleDay 
      ? `rapport_${cleanUserSlug}_${startFmt}` 
      : `rapport_${cleanUserSlug}_${startFmt}_au_${endFmt}`;
  } else {
    fileBaseName = isSingleDay 
      ? `rapport_equipe_${startFmt}` 
      : `rapport_equipe_${startFmt}_au_${endFmt}`;
  }

  // 7. CSV Export Format
  const format = searchParams.get("format");
  if (format === "csv") {
    const csvHeaders = [
      "ID ZKTeco", 
      "Employé (Nom & Prénom)", 
      "Shift Assigné", 
      "Jours Présents", 
      "Heures Normales (Hrs)", 
      `Heures Sup. ${rate1Percent}% (Hrs)`, 
      `Heures Sup. ${rate2Percent}% (Hrs)`, 
      "Total Heures"
    ];
    if (canViewSalaries) csvHeaders.push("Coût Est. (DH)");

    const csvRows = [csvHeaders.map(h => `"${h}"`).join(";")];

    for (const row of aggregatedData) {
      const total = row.regularHours + row.overtime150Hours + row.overtime200Hours;
      const csvRow = [
        `"${row.zktecoUserId}"`,
        `"${row.fullName}"`,
        `"${row.shiftName}"`,
        row.daysWorked,
        row.regularHours.toFixed(2),
        row.overtime150Hours.toFixed(2),
        row.overtime200Hours.toFixed(2),
        total.toFixed(2)
      ];
      if (canViewSalaries) {
        csvRow.push(row.totalCost.toFixed(2));
      }
      csvRows.push(csvRow.join(";"));
    }

    // Add totals row
    const totalRegularVal = aggregatedData.reduce((sum, r) => sum + r.regularHours, 0);
    const total150Val = aggregatedData.reduce((sum, r) => sum + r.overtime150Hours, 0);
    const total200Val = aggregatedData.reduce((sum, r) => sum + r.overtime200Hours, 0);
    const totalHoursVal = totalRegularVal + total150Val + total200Val;
    const totalCostVal = aggregatedData.reduce((sum, r) => sum + r.totalCost, 0);

    const totalsRow = [
      `"TOTAL"`,
      `""`,
      `""`,
      aggregatedData.reduce((sum, r) => sum + r.daysWorked, 0),
      totalRegularVal.toFixed(2),
      total150Val.toFixed(2),
      total200Val.toFixed(2),
      totalHoursVal.toFixed(2)
    ];
    if (canViewSalaries) {
      totalsRow.push(totalCostVal.toFixed(2));
    }
    csvRows.push(totalsRow.join(";"));

    const csvContent = "\uFEFF" + csvRows.join("\n");

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileBaseName}.csv"`,
        "Cache-Control": "no-store, max-age=0"
      }
    });
  }

  // 8. Excel Workbook generation
  const workbook = new ExcelJS.Workbook();

  // Style helper constants
  const primaryColor = "2563EB"; // Royal Blue
  const darkNavyColor = "1E293B"; // Slate 800
  const zebraColor = "F8FAFC"; // Slate 50
  const borderColor = "CBD5E1"; // Slate 300
  const successColor = "16A34A"; // Emerald 600

  // ==========================================
  // WORKSHEET 1: "Rapport de Paie" (Synthèse)
  // ==========================================
  const worksheet = workbook.addWorksheet("Rapport de Paie");

  const totalColsCount = canViewSalaries ? 9 : 8;
  const lastColLetter = canViewSalaries ? "I" : "H";

  // Title block
  worksheet.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = worksheet.getCell("A1");
  titleCell.value = isSingleDay 
    ? `RAPPORT DE PAIE ET SUIVI DES HEURES (${formatDate(startDate)})` 
    : "RAPPORT DE PAIE ET SUIVI DES HEURES";
  titleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: primaryColor }
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 36;

  // Metadata block (Row 2 & 3)
  worksheet.getCell("A2").value = isSingleDay ? "Date :" : "Période :";
  worksheet.getCell("A2").font = { bold: true, size: 10 };
  worksheet.getCell("B2").value = isSingleDay ? formatDate(startDate) : `${formatDate(startDate)} au ${formatDate(endDate)}`;
  worksheet.getCell("B2").font = { size: 10 };

  worksheet.getCell("D2").value = "Généré le :";
  worksheet.getCell("D2").font = { bold: true, size: 10 };
  worksheet.getCell("E2").value = formatDate(new Date());
  worksheet.getCell("E2").font = { size: 10 };
  worksheet.getRow(2).height = 18;

  if (singleUser) {
    worksheet.getCell("A3").value = "Salarié :";
    worksheet.getCell("A3").font = { bold: true, size: 10 };
    worksheet.getCell("B3").value = `${singleUser.fullName} (ID: ${singleUser.zktecoUserId})`;
    worksheet.getCell("B3").font = { size: 10, bold: true };

    worksheet.getCell("D3").value = "Shift :";
    worksheet.getCell("D3").font = { bold: true, size: 10 };
    worksheet.getCell("E3").value = singleUser.shiftName;
    worksheet.getCell("E3").font = { size: 10 };
  } else {
    worksheet.getCell("A3").value = "Périmètre :";
    worksheet.getCell("A3").font = { bold: true, size: 10 };
    worksheet.getCell("B3").value = `Tout le personnel (${aggregatedData.length} collaborateurs)`;
    worksheet.getCell("B3").font = { size: 10 };
  }
  worksheet.getRow(3).height = 18;

  worksheet.addRow([]); // Blank separator row (Row 4)

  // Table Headers (Row 5)
  const headerCols = [
    "ID ZKTeco",
    "Employé (Nom & Prénom)",
    "Shift Assigné",
    "Jours Présents",
    "Heures Normales (Hrs)",
    `Heures Sup. ${rate1Percent}% (Hrs)`,
    `Heures Sup. ${rate2Percent}% (Hrs)`,
    "Total Heures"
  ];
  if (canViewSalaries) headerCols.push("Coût Est. (DH)");

  const headerRow = worksheet.addRow(headerCols);
  headerRow.height = 26;

  headerRow.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: primaryColor }
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: borderColor } },
      bottom: { style: "medium", color: { argb: borderColor } },
      left: { style: "thin", color: { argb: borderColor } },
      right: { style: "thin", color: { argb: borderColor } }
    };
  });

  // Populate data rows (Row 6+)
  let currentRawRow = 5;
  aggregatedData.forEach((row, index) => {
    currentRawRow = 6 + index;
    const rowData: any[] = [
      parseInt(row.zktecoUserId) || row.zktecoUserId,
      row.fullName,
      row.shiftName,
      row.daysWorked,
      row.regularHours,
      row.overtime150Hours,
      row.overtime200Hours,
      { formula: `=E${currentRawRow}+F${currentRawRow}+G${currentRawRow}` }
    ];
    if (canViewSalaries) {
      rowData.push(row.totalCost);
    }

    const addedRow = worksheet.addRow(rowData);
    addedRow.height = 22;

    const isEven = index % 2 === 1;
    addedRow.eachCell((cell, colNumber) => {
      cell.font = { name: "Calibri", size: 11 };
      
      // Zebra background
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isEven ? zebraColor : "FFFFFF" }
      };

      cell.border = {
        top: { style: "thin", color: { argb: borderColor } },
        bottom: { style: "thin", color: { argb: borderColor } },
        left: { style: "thin", color: { argb: borderColor } },
        right: { style: "thin", color: { argb: borderColor } }
      };

      // Alignment and formats
      if (colNumber === 1 || colNumber === 4) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.numFmt = "0";
      } else if (colNumber === 2 || colNumber === 3) {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      } else if (colNumber >= 5 && colNumber <= 8) {
        cell.alignment = { horizontal: "right", vertical: "middle" };
        cell.numFmt = "0.00";
      } else if (colNumber === 9) {
        cell.alignment = { horizontal: "right", vertical: "middle" };
        cell.numFmt = "#,##0.00\" DH\"";
        cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: successColor } };
      }
    });
  });

  // Summary totals footer row
  const totalsRowIndex = currentRawRow + 1;
  const totalsRowCols: any[] = [
    "TOTAL",
    "",
    "",
    { formula: `=SUM(D6:D${currentRawRow})` },
    { formula: `=SUM(E6:E${currentRawRow})` },
    { formula: `=SUM(F6:F${currentRawRow})` },
    { formula: `=SUM(G6:G${currentRawRow})` },
    { formula: `=SUM(H6:H${currentRawRow})` }
  ];
  if (canViewSalaries) {
    totalsRowCols.push({ formula: `=SUM(I6:I${currentRawRow})` });
  }

  const totalsRow = worksheet.addRow(totalsRowCols);
  totalsRow.height = 24;

  totalsRow.eachCell((cell, colNumber) => {
    cell.font = { name: "Calibri", size: 11, bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "F1F5F9" }
    };
    cell.border = {
      top: { style: "medium", color: { argb: borderColor } },
      bottom: { style: "double", color: { argb: "000000" } },
      left: { style: "thin", color: { argb: borderColor } },
      right: { style: "thin", color: { argb: borderColor } }
    };

    if (colNumber === 1) {
      cell.alignment = { horizontal: "left", vertical: "middle" };
    } else if (colNumber === 4) {
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.numFmt = "0";
    } else if (colNumber >= 5 && colNumber <= 8) {
      cell.alignment = { horizontal: "right", vertical: "middle" };
      cell.numFmt = "0.00";
    } else if (colNumber === 9) {
      cell.alignment = { horizontal: "right", vertical: "middle" };
      cell.numFmt = "#,##0.00\" DH\"";
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: successColor } };
    }
  });

  // Adjust column widths automatically for Sheet 1
  worksheet.columns.forEach((column) => {
    let maxLen = 12;
    column.eachCell && column.eachCell({ includeEmpty: false }, (cell) => {
      let val = String(cell.value || "");
      if (cell.value && typeof cell.value === "object" && "formula" in cell.value) {
        val = "000.00";
      }
      if (val.length > maxLen) maxLen = val.length;
    });
    column.width = maxLen + 4;
  });


  // ==========================================
  // WORKSHEET 2: "Détail Journalier" (Audit)
  // ==========================================
  const detailSheet = workbook.addWorksheet("Détail Journalier");

  const detailHeaders = [
    "ID ZKTeco",
    "Employé (Nom & Prénom)",
    "Date",
    "Jour",
    "1ère Entrée",
    "Dernière Sortie",
    "Pointages Enregistrés",
    "Heures Normales (Hrs)",
    `Heures Sup. ${rate1Percent}% (Hrs)`,
    `Heures Sup. ${rate2Percent}% (Hrs)`,
    "Total Heures"
  ];
  if (canViewSalaries) {
    detailHeaders.push("Coût Estimé (DH)");
  }
  detailHeaders.push("Statut");

  const detailLastColLetter = canViewSalaries ? "M" : "L";

  // Title for detail sheet
  detailSheet.mergeCells(`A1:${detailLastColLetter}1`);
  const detailTitleCell = detailSheet.getCell("A1");
  detailTitleCell.value = isSingleDay 
    ? `DÉTAIL JOURNALIER DES POINTAGES (${formatDate(startDate)})`
    : `DÉTAIL JOURNALIER DES POINTAGES (${formatDate(startDate)} au ${formatDate(endDate)})`;
  detailTitleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFF" } };
  detailTitleCell.alignment = { horizontal: "center", vertical: "middle" };
  detailTitleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: primaryColor }
  };
  detailSheet.getRow(1).height = 36;

  // Header Row for detail sheet (Row 2)
  const detailHeaderRow = detailSheet.addRow(detailHeaders);
  detailHeaderRow.height = 26;
  detailHeaderRow.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: darkNavyColor }
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: borderColor } },
      bottom: { style: "medium", color: { argb: borderColor } },
      left: { style: "thin", color: { argb: borderColor } },
      right: { style: "thin", color: { argb: borderColor } }
    };
  });

  // Fetch all raw punches in date range
  const punchWhereClause: any = {
    recordTime: {
      gte: startDate,
      lte: endDate
    }
  };
  if (artisanId && artisanId !== "all") {
    const artisanUser = await prisma.user.findUnique({ where: { id: artisanId } });
    if (artisanUser) {
      punchWhereClause.zktecoUserId = artisanUser.zktecoUserId;
    }
  }

  const rawPunches = await prisma.rawPunch.findMany({
    where: punchWhereClause,
    orderBy: { recordTime: 'asc' }
  });

  const punchesMap = new Map<string, typeof rawPunches>();
  for (const p of rawPunches) {
    const dStr = new Date(p.recordTime).toISOString().split("T")[0];
    const key = `${p.zktecoUserId}_${dStr}`;
    if (!punchesMap.has(key)) punchesMap.set(key, []);
    punchesMap.get(key)!.push(p);
  }

  const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  let detailRowCount = 2;

  // Distinct targeted users
  const distinctUsers = Array.from(new Set(reports.map(r => r.userId))).map(uid => {
    const rep = reports.find(r => r.userId === uid);
    return rep!.user;
  });

  for (const user of distinctUsers) {
    const userContract = parsedContracts.find((c: any) => c.name === user.contractType);
    const hasOvertime = userContract ? userContract.hasOvertime : true;
    const hourlyRate = user.hourlyRate || 0;
    const fullName = formatFullName(user.firstName, user.lastName);

    const cur = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

    while (cur <= end) {
      const dStr = cur.toISOString().split("T")[0];
      const dayOfWeek = cur.getUTCDay();
      const isSunday = dayOfWeek === 0;

      const report = reports.find(r => r.userId === user.id && r.date.toISOString().split("T")[0] === dStr);
      const key = `${user.zktecoUserId}_${dStr}`;
      const dayPunches = punchesMap.get(key) || [];
      const punchTimes = dayPunches.map(p => 
        new Date(p.recordTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" })
      );

      let reg = report?.regularHours || 0;
      let ot150 = report?.overtime150Hours || 0;
      let ot200 = report?.overtime200Hours || 0;

      if (!hasOvertime) {
        reg = reg + ot150 + ot200;
        ot150 = 0;
        ot200 = 0;
      }

      const totHours = reg + ot150 + ot200;
      const dayCost = (reg * hourlyRate) + (ot150 * hourlyRate * otRate1) + (ot200 * hourlyRate * otRate2);

      let dayStatus: string = report?.status || "OK";
      if (dayPunches.length === 0) {
        if (isSunday) {
          dayStatus = "REPOS";
        } else {
          dayStatus = "ABSENT";
        }
      }

      const dd = String(cur.getUTCDate()).padStart(2, "0");
      const mm = String(cur.getUTCMonth() + 1).padStart(2, "0");
      const yyyy = cur.getUTCFullYear();

      const rowValues = [
        user.zktecoUserId,
        fullName,
        `${dd}/${mm}/${yyyy}`,
        dayNames[dayOfWeek],
        report?.firstPunchIn ? new Date(report.firstPunchIn).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" }) : (punchTimes[0] || "-"),
        report?.lastPunchOut ? new Date(report.lastPunchOut).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" }) : (punchTimes.length > 1 ? punchTimes[punchTimes.length - 1] : "-"),
        punchTimes.length > 0 ? punchTimes.join(" | ") : "-",
        reg,
        ot150,
        ot200,
        totHours
      ];

      if (canViewSalaries) {
        rowValues.push(dayCost);
      }
      rowValues.push(dayStatus);

      detailRowCount++;
      const addedRow = detailSheet.addRow(rowValues);
      addedRow.height = 20;

      const isEven = detailRowCount % 2 === 0;
      addedRow.eachCell((cell, colNum) => {
        cell.font = { name: "Calibri", size: 10 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isEven ? zebraColor : "FFFFFF" }
        };
        cell.border = {
          top: { style: "thin", color: { argb: borderColor } },
          bottom: { style: "thin", color: { argb: borderColor } },
          left: { style: "thin", color: { argb: borderColor } },
          right: { style: "thin", color: { argb: borderColor } }
        };

        if (colNum === 1 || colNum === 3 || colNum === 4 || colNum === 5 || colNum === 6) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else if (colNum === 2 || colNum === 7) {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        } else if (colNum >= 8 && colNum <= 11) {
          cell.alignment = { horizontal: "right", vertical: "middle" };
          cell.numFmt = "0.00";
        } else if (canViewSalaries && colNum === 12) {
          cell.alignment = { horizontal: "right", vertical: "middle" };
          cell.numFmt = "#,##0.00\" DH\"";
          cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: successColor } };
        } else {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
      });

      cur.setDate(cur.getDate() + 1);
    }
  }

  // Summary Totals Footer Row for Detail Sheet
  if (detailRowCount > 2) {
    const detailTotalsCols: any[] = [
      "TOTAL",
      "",
      "",
      "",
      "",
      "",
      "",
      { formula: `=SUM(H3:H${detailRowCount})` },
      { formula: `=SUM(I3:I${detailRowCount})` },
      { formula: `=SUM(J3:J${detailRowCount})` },
      { formula: `=SUM(K3:K${detailRowCount})` }
    ];
    if (canViewSalaries) {
      detailTotalsCols.push({ formula: `=SUM(L3:L${detailRowCount})` });
    }
    detailTotalsCols.push("");

    const detailTotalsRow = detailSheet.addRow(detailTotalsCols);
    detailTotalsRow.height = 24;

    detailTotalsRow.eachCell((cell, colNum) => {
      cell.font = { name: "Calibri", size: 10, bold: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "F1F5F9" }
      };
      cell.border = {
        top: { style: "medium", color: { argb: borderColor } },
        bottom: { style: "double", color: { argb: "000000" } },
        left: { style: "thin", color: { argb: borderColor } },
        right: { style: "thin", color: { argb: borderColor } }
      };

      if (colNum >= 8 && colNum <= 11) {
        cell.alignment = { horizontal: "right", vertical: "middle" };
        cell.numFmt = "0.00";
      } else if (canViewSalaries && colNum === 12) {
        cell.alignment = { horizontal: "right", vertical: "middle" };
        cell.numFmt = "#,##0.00\" DH\"";
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: successColor } };
      }
    });
  }

  // Adjust detail sheet column widths
  detailSheet.columns.forEach((column) => {
    let maxLen = 12;
    column.eachCell && column.eachCell({ includeEmpty: false }, (cell) => {
      let val = String(cell.value || "");
      if (cell.value && typeof cell.value === "object" && "formula" in cell.value) {
        val = "000.00";
      }
      if (val.length > maxLen) maxLen = val.length;
    });
    column.width = Math.min(50, maxLen + 4);
  });

  // 9. Generate buffer and return XLSX file
  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileBaseName}.xlsx"`,
      "Cache-Control": "no-store, max-age=0"
    }
  });
}
