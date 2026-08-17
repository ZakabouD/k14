"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { getSession, createSession, deleteSession } from "@/lib/session";
import bcrypt from "bcrypt";
import { parseContractTypes, parseLeaveTypes } from "../lib/tags";

const execAsync = promisify(exec);

// Helper to verify that the administrator is authenticated
async function verifyAuth() {
  const session = await getSession();
  if (!session || !session.adminId) {
    throw new Error("Unauthorized access. Admin session is required.");
  }
  return session;
}

// Input validation helpers
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateIpAddress(ip: string): boolean {
  const ipRegex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
}

export async function triggerDeviceSync() {
  await verifyAuth();
  
  try {
    // Set syncRequested to true and syncStatus to PENDING in SystemSettings
    await prisma.systemSettings.update({
      where: { id: "singleton" },
      data: {
        syncRequested: true,
        syncStatus: "PENDING",
        syncError: null
      }
    });

    // Poll the database for the status to change from PENDING/RUNNING to SUCCESS/ERROR
    const timeoutMs = 120000; // 120 seconds timeout (2 minutes) to allow complete device data transfer over WAN
    const start = Date.now();
    
    while (Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const settings = await prisma.systemSettings.findFirst({
        select: { syncStatus: true, syncError: true }
      });
      
      if (settings) {
        if (settings.syncStatus === "SUCCESS") {
          revalidatePath("/");
          revalidatePath("/artisans");
          revalidatePath("/anomalies");
          revalidatePath("/reports");
          revalidatePath("/salaries");
          return { success: true };
        }
        if (settings.syncStatus === "ERROR") {
          return { success: false, error: settings.syncError || "Échec de la synchronisation sur la passerelle." };
        }
      }
    }
    
    // If we timeout, reset the sync request to IDLE
    await prisma.systemSettings.update({
      where: { id: "singleton" },
      data: {
        syncRequested: false,
        syncStatus: "IDLE",
        syncError: "Délai de synchronisation dépassé."
      }
    });
    
    return { success: false, error: "La synchronisation prend plus de temps que prévu. Veuillez réessayer." };
  } catch (error) {
    console.error("Failed to sync:", error);
    return { success: false, error: String(error) };
  }
}


export async function createShift(formData: FormData) {
  await verifyAuth();

  const name = formData.get("name") as string;
  const startTime = formData.get("startTime") as string;
  const endTime = formData.get("endTime") as string;
  const baseHoursRaw = formData.get("baseHours") as string;

  if (!name || name.trim().length === 0) {
    return { success: false, error: "Shift name is required" };
  }
  
  const timeRegex = /^([0-1]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    return { success: false, error: "Start and end times must be in HH:MM format" };
  }

  const baseHours = parseFloat(baseHoursRaw);
  if (isNaN(baseHours) || baseHours < 0 || baseHours > 24) {
    return { success: false, error: "Base hours must be a valid number between 0 and 24" };
  }

  const lunchBreak = parseInt(formData.get("lunchBreak") as string || "0", 10);
  const gracePeriod = parseInt(formData.get("gracePeriod") as string || "15", 10);
  const saturdayHours = parseFloat(formData.get("saturdayHours") as string || "4.0");

  if (isNaN(lunchBreak) || lunchBreak < 0 || lunchBreak > 240) {
    return { success: false, error: "La pause déjeuner doit être comprise entre 0 et 240 minutes." };
  }
  if (isNaN(gracePeriod) || gracePeriod < 0 || gracePeriod > 60) {
    return { success: false, error: "La marge de retard doit être comprise entre 0 et 60 minutes." };
  }
  if (isNaN(saturdayHours) || saturdayHours < 0 || saturdayHours > 24) {
    return { success: false, error: "Les heures du samedi doivent être un nombre entre 0 et 24." };
  }

  const autoClose = formData.get("autoClose") === "on" || formData.get("autoClose") === "true";

  await prisma.shift.create({
    data: { 
      name: name.trim(), 
      startTime, 
      endTime, 
      baseHours,
      lunchBreak,
      gracePeriod,
      saturdayHours,
      autoClose
    }
  });


  revalidatePath("/shifts");
  return { success: true };
}

export async function updateShift(shiftId: string, formData: FormData) {
  await verifyAuth();

  if (!shiftId || typeof shiftId !== "string") {
    return { success: false, error: "Invalid shift identifier" };
  }

  const name = formData.get("name") as string;
  const startTime = formData.get("startTime") as string;
  const endTime = formData.get("endTime") as string;
  const baseHoursRaw = formData.get("baseHours") as string;

  if (!name || name.trim().length === 0) {
    return { success: false, error: "Shift name is required" };
  }
  
  const timeRegex = /^([0-1]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    return { success: false, error: "Start and end times must be in HH:MM format" };
  }

  const baseHours = parseFloat(baseHoursRaw);
  if (isNaN(baseHours) || baseHours < 0 || baseHours > 24) {
    return { success: false, error: "Base hours must be a valid number between 0 and 24" };
  }

  const lunchBreak = parseInt(formData.get("lunchBreak") as string || "0", 10);
  const gracePeriod = parseInt(formData.get("gracePeriod") as string || "15", 10);
  const saturdayHours = parseFloat(formData.get("saturdayHours") as string || "4.0");

  if (isNaN(lunchBreak) || lunchBreak < 0 || lunchBreak > 240) {
    return { success: false, error: "La pause déjeuner doit être comprise entre 0 et 240 minutes." };
  }
  if (isNaN(gracePeriod) || gracePeriod < 0 || gracePeriod > 60) {
    return { success: false, error: "La marge de retard doit être comprise entre 0 et 60 minutes." };
  }
  if (isNaN(saturdayHours) || saturdayHours < 0 || saturdayHours > 24) {
    return { success: false, error: "Les heures du samedi doivent être un nombre entre 0 et 24." };
  }

  const shiftExists = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shiftExists) {
    return { success: false, error: "Shift not found" };
  }

  const autoClose = formData.get("autoClose") === "on" || formData.get("autoClose") === "true";

  await prisma.shift.update({
    where: { id: shiftId },
    data: { 
      name: name.trim(), 
      startTime, 
      endTime, 
      baseHours,
      lunchBreak,
      gracePeriod,
      saturdayHours,
      autoClose
    }
  });

  revalidatePath("/shifts");
  revalidatePath("/artisans");
  return { success: true };
}

export async function deleteShift(shiftId: string) {
  await verifyAuth();

  if (!shiftId || typeof shiftId !== "string") {
    return { success: false, error: "Invalid shift identifier" };
  }

  const shiftExists = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shiftExists) {
    return { success: false, error: "Shift not found" };
  }

  // Disassociate any users assigned to this shift first to prevent foreign key errors
  await prisma.user.updateMany({
    where: { shiftId },
    data: { shiftId: null }
  });

  await prisma.shift.delete({
    where: { id: shiftId }
  });

  revalidatePath("/shifts");
  revalidatePath("/artisans");
  return { success: true };
}

export async function updateEmployeeProfile(formData: FormData) {
  await verifyAuth();

  const userId = formData.get("userId") as string;
  const shiftId = formData.get("shiftId") as string;
  const hourlyRateRaw = formData.get("hourlyRate") as string;
  const monthlySalaryRaw = formData.get("monthlySalary") as string;
  const paymentFrequency = formData.get("paymentFrequency") as string || "MONTHLY";
  const phone = formData.get("phone") as string || null;
  const cin = formData.get("cin") as string || null;
  const cnss = formData.get("cnss") as string || null;
  const hireDateRaw = formData.get("hireDate") as string;
  const exitDateRaw = formData.get("exitDate") as string;
  const exitReason = formData.get("exitReason") as string || null;
  const statusMode = formData.get("statusMode") as string; // "ACTIVE" | "ARCHIVED"
  const contractType = formData.get("contractType") as string || null;
  const bankName = formData.get("bankName") as string || null;
  const rib = formData.get("rib") as string || null;
  const maritalStatus = formData.get("maritalStatus") as string || null;
  const childrenCountRaw = formData.get("childrenCount") as string;
  const address = formData.get("address") as string || null;

  if (!userId || typeof userId !== "string") {
    return { success: false, error: "Identifiant de l'employé invalide." };
  }

  const session = await verifyAuth();
  const canViewSalaries = session.adminId === "admin" || session.permissions?.canViewSalaries === true;

  const childrenCount = parseInt(childrenCountRaw || "0", 10);
  if (isNaN(childrenCount) || childrenCount < 0) {
    return { success: false, error: "Le nombre d'enfants doit être un nombre positif ou nul." };
  }

  let hireDate: Date | null = null;
  if (hireDateRaw) {
    hireDate = new Date(hireDateRaw);
    if (isNaN(hireDate.getTime())) {
      return { success: false, error: "Format de la date d'embauche invalide." };
    }
  }

  let exitDate: Date | null = null;
  if (exitDateRaw) {
    exitDate = new Date(exitDateRaw);
    if (isNaN(exitDate.getTime())) {
      return { success: false, error: "Format de la date de sortie invalide." };
    }
  }

  const moroccoNowStr = new Date().toLocaleString("en-US", { timeZone: "Africa/Casablanca" });
  const localNow = new Date(moroccoNowStr);
  const todayUtc = new Date(Date.UTC(localNow.getFullYear(), localNow.getMonth(), localNow.getDate()));

  let isActive = true;
  if (statusMode === "ARCHIVED") {
    isActive = false;
    if (!exitDate) {
      exitDate = todayUtc;
    }
  } else if (statusMode === "ACTIVE") {
    isActive = true;
    exitDate = null;
  } else if (exitDate) {
    if (exitDate.getTime() <= todayUtc.getTime()) {
      isActive = false;
    }
  }

  // Validate shiftId if provided
  if (shiftId) {
    const shiftExists = await prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shiftExists) {
      return { success: false, error: "Le shift sélectionné n'existe pas." };
    }
  }

  const isExempt = formData.get("isExempt") === "true" || formData.get("isExempt") === "on";

  const dataToUpdate: any = {
    isExempt,
    isActive,
    shiftId: shiftId || null,
    phone,
    cin,
    cnss,
    hireDate,
    exitDate,
    exitReason: isActive ? null : exitReason,
    contractType,
    bankName,
    rib,
    maritalStatus,
    childrenCount,
    address
  };

  if (canViewSalaries) {
    const hourlyRate = parseFloat(hourlyRateRaw || "0");
    if (isNaN(hourlyRate) || hourlyRate < 0) {
      return { success: false, error: "Le taux horaire doit être un nombre positif." };
    }

    const monthlySalary = parseFloat(monthlySalaryRaw || "0");
    if (isNaN(monthlySalary) || monthlySalary < 0) {
      return { success: false, error: "Le salaire doit être un nombre positif." };
    }

    dataToUpdate.hourlyRate = hourlyRate;
    dataToUpdate.monthlySalary = monthlySalary;
    dataToUpdate.paymentFrequency = paymentFrequency;
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate
    });

    revalidatePath("/artisans");
    revalidatePath("/salaries");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to update employee profile:", error);
    return { success: false, error: String(error) };
  }
}

export async function getEmployeeStats(userId: string, startDateStr: string, endDateStr: string) {
  await verifyAuth();

  if (!userId || !startDateStr || !endDateStr) {
    return { success: false, error: "Paramètres requis manquants." };
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { success: false, error: "Format des dates invalide." };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { shift: true }
    });

    if (!user) {
      return { success: false, error: "Employé introuvable." };
    }

    // Always recalculate daily reports from raw punches for the requested date range
    await recalculateUserRange(userId, startDate, endDate);

    const reports = await prisma.calculatedDailyReport.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { date: "asc" }
    });

    const settings = await prisma.systemSettings.findFirst({
      select: { otRate1: true, otRate2: true, contractTypes: true }
    });

    const otRate1 = settings?.otRate1 ?? 1.5;
    const otRate2 = settings?.otRate2 ?? 2.0;

    const parsedContracts = parseContractTypes(settings?.contractTypes || "[]");
    const userContract = parsedContracts.find(c => c.name === user.contractType);
    const hasOvertime = userContract ? userContract.hasOvertime : true;

    let daysWorked = 0;
    let daysLeave = 0;
    let daysAbsent = 0;
    let totalRegularHours = 0;
    let totalOvertime150 = 0;
    let totalOvertime200 = 0;

    for (const r of reports) {
      if (r.firstPunchIn) {
        daysWorked++;
      } else if (r.status === 'LEAVE') {
        daysLeave++;
      } else {
        const day = new Date(r.date).getDay();
        const isWeekend = day === 0;
        const isHoliday = r.status === 'HOLIDAY';
        if (!isWeekend && !isHoliday) {
          daysAbsent++;
        }
      }

      if (hasOvertime) {
        totalRegularHours += r.regularHours;
        totalOvertime150 += r.overtime150Hours;
        totalOvertime200 += r.overtime200Hours;
      } else {
        totalRegularHours += (r.regularHours + r.overtime150Hours + r.overtime200Hours);
      }
    }

    // Payout calculations (DH)
    const baseHourlyWage = user.hourlyRate;
    const baseWages = totalRegularHours * baseHourlyWage;
    const overtime150Wages = totalOvertime150 * baseHourlyWage * otRate1;
    const overtime200Wages = totalOvertime200 * baseHourlyWage * otRate2;
    const totalOvertimeWages = overtime150Wages + overtime200Wages;
    const totalPayout = baseWages + totalOvertimeWages;

    // Generate daily breakdown array for every day in [startDate, endDate]
    const dayMs = 24 * 3600 * 1000;
    const numDays = Math.min(62, Math.max(1, Math.round((endDate.getTime() - startDate.getTime() + 1000) / dayMs)));
    const dailyBreakdown: any[] = [];

    for (let i = 0; i < numDays; i++) {
      const curD = new Date(startDate.getTime() + (i * dayMs));
      const curUtc = new Date(Date.UTC(curD.getUTCFullYear(), curD.getUTCMonth(), curD.getUTCDate()));

      const r = reports.find(report => {
        const rUtc = new Date(Date.UTC(report.date.getUTCFullYear(), report.date.getUTCMonth(), report.date.getUTCDate()));
        return rUtc.getTime() === curUtc.getTime();
      });

      const dayOfWeek = curUtc.getUTCDay();
      const dayName = curUtc.toLocaleDateString("fr-FR", { weekday: 'short' });
      const dayNumStr = curUtc.toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit' });

      let reg = 0;
      let o150 = 0;
      let o200 = 0;
      let cost = 0;
      let firstPunchStr: string | null = null;
      let lastPunchStr: string | null = null;
      let status = "SUNDAY";

      if (r) {
        if (hasOvertime) {
          reg = r.regularHours;
          o150 = r.overtime150Hours;
          o200 = r.overtime200Hours;
        } else {
          reg = r.regularHours + r.overtime150Hours + r.overtime200Hours;
        }

        cost = (reg * baseHourlyWage) + (o150 * baseHourlyWage * otRate1) + (o200 * baseHourlyWage * otRate2);

        if (r.firstPunchIn) {
          firstPunchStr = new Date(r.firstPunchIn).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' });
        }
        if (r.lastPunchOut) {
          lastPunchStr = new Date(r.lastPunchOut).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' });
        }

        status = r.status;
      } else {
        status = dayOfWeek === 0 ? "SUNDAY" : "ABSENT";
      }

      const totalHours = reg + o150 + o200;

      dailyBreakdown.push({
        label: numDays <= 7 ? `${dayName}. ${dayNumStr}` : dayNumStr,
        fullDate: curUtc.toISOString().split("T")[0],
        dayName,
        dayNumStr,
        regHours: Number(reg.toFixed(2)),
        ot150Hours: Number(o150.toFixed(2)),
        ot200Hours: Number(o200.toFixed(2)),
        totalHours: Number(totalHours.toFixed(2)),
        cost: Number(cost.toFixed(2)),
        firstPunchStr,
        lastPunchStr,
        status
      });
    }

    return {
      success: true,
      stats: {
        personal: {
          firstName: user.firstName,
          lastName: user.lastName,
          zktecoUserId: user.zktecoUserId,
          phone: user.phone,
          cin: user.cin,
          cnss: user.cnss,
          hireDate: user.hireDate ? user.hireDate.toISOString().split("T")[0] : null,
          shiftName: user.shift?.name || "Sans Shift (Par Défaut)",
          hourlyRate: user.hourlyRate,
          monthlySalary: user.monthlySalary,
          paymentFrequency: user.paymentFrequency,
          contractType: user.contractType,
          bankName: user.bankName,
          rib: user.rib,
          maritalStatus: user.maritalStatus,
          childrenCount: user.childrenCount,
          address: user.address
        },
        attendance: {
          daysWorked,
          daysLeave,
          daysAbsent
        },
        hours: {
          regular: totalRegularHours,
          overtime150: totalOvertime150,
          overtime200: totalOvertime200,
          total: totalRegularHours + totalOvertime150 + totalOvertime200
        },
        financials: {
          baseWages,
          overtime150Wages,
          overtime200Wages,
          totalOvertimeWages,
          totalPayout,
          otRate1,
          otRate2
        },
        dailyBreakdown
      }
    };
  } catch (error) {
    console.error("Failed to fetch employee stats:", error);
    return { success: false, error: String(error) };
  }
}

export async function resolveAnomaly(
  reportId: string, 
  manualPunchOutTime?: string,
  manualPunchInTime?: string
) {
  await verifyAuth();

  if (!reportId || typeof reportId !== "string") {
    return { success: false, error: "Invalid report identifier" };
  }

  const timeRegex = /^([0-1]\d|2[0-3]):([0-5]\d)$/;
  if (manualPunchOutTime && !timeRegex.test(manualPunchOutTime)) {
    return { success: false, error: "Format d'heure de sortie invalide. Utiliser HH:MM" };
  }
  if (manualPunchInTime && !timeRegex.test(manualPunchInTime)) {
    return { success: false, error: "Format d'heure d'entrée invalide. Utiliser HH:MM" };
  }

  // 1. Get the existing report
  const report = await prisma.calculatedDailyReport.findUnique({
    where: { id: reportId },
    include: { user: { include: { shift: true } } }
  });

  if (!report) return { success: false, error: "Rapport journalier introuvable" };

  // 2. Parse punch-in date
  let punchInDate = report.firstPunchIn;
  if (manualPunchInTime) {
    const [inH, inM] = manualPunchInTime.split(":").map(Number);
    punchInDate = new Date(Date.UTC(
      report.date.getUTCFullYear(),
      report.date.getUTCMonth(),
      report.date.getUTCDate(),
      inH,
      inM,
      0,
      0
    ));
  } else if (!punchInDate) {
    const defaultStart = report.user.shift?.startTime || "08:00";
    const [inH, inM] = defaultStart.split(":").map(Number);
    punchInDate = new Date(Date.UTC(
      report.date.getUTCFullYear(),
      report.date.getUTCMonth(),
      report.date.getUTCDate(),
      inH,
      inM,
      0,
      0
    ));
  }

  // 3. Parse punch-out date
  let punchOutDate = report.lastPunchOut;
  if (manualPunchOutTime) {
    const [outH, outM] = manualPunchOutTime.split(":").map(Number);
    punchOutDate = new Date(Date.UTC(
      report.date.getUTCFullYear(),
      report.date.getUTCMonth(),
      report.date.getUTCDate(),
      outH,
      outM,
      0,
      0
    ));
  } else if (!punchOutDate) {
    const defaultEnd = report.user.shift?.endTime || "17:00";
    const [outH, outM] = defaultEnd.split(":").map(Number);
    punchOutDate = new Date(Date.UTC(
      report.date.getUTCFullYear(),
      report.date.getUTCMonth(),
      report.date.getUTCDate(),
      outH,
      outM,
      0,
      0
    ));
  }

  // 4. Calculate hours and load overtime threshold settings
  const settings = await prisma.systemSettings.findFirst({
    select: { otThresholdLimit: true }
  });
  const threshold = settings?.otThresholdLimit ?? 2.0;

  const diffMs = Math.max(0, punchOutDate.getTime() - punchInDate.getTime());
  const rawHours = diffMs / (1000 * 60 * 60);
  const lunchBreakMinutes = report.user.shift?.lunchBreak ?? 0;
  const totalHours = (rawHours > 5.0 && lunchBreakMinutes > 0)
    ? Math.max(0, rawHours - (lunchBreakMinutes / 60))
    : rawHours;

  let baseHours = report.user.shift?.baseHours || 8;
  if (report.date.getUTCDay() === 6) {
    baseHours = report.user.shift ? report.user.shift.saturdayHours : (baseHours / 2);
  }
  const regularHours = Math.min(totalHours, baseHours);
  
  const extraHours = Math.max(0, totalHours - baseHours);
  const overtime150Hours = Math.min(extraHours, threshold);
  const overtime200Hours = Math.max(0, extraHours - threshold);

  // 5. Update the report to RESOLVED
  await prisma.calculatedDailyReport.update({
    where: { id: reportId },
    data: {
      firstPunchIn: punchInDate,
      lastPunchOut: punchOutDate,
      regularHours: Number(regularHours.toFixed(2)),
      overtime150Hours: Number(overtime150Hours.toFixed(2)),
      overtime200Hours: Number(overtime200Hours.toFixed(2)),
      status: 'RESOLVED',
      anomalyReason: null
    }
  });

  // 6. Record synthetic admin correction punches in RawPunch so raw punches history modal reflects the resolution
  try {
    if (manualPunchInTime && punchInDate) {
      await prisma.rawPunch.upsert({
        where: {
          zktecoUserId_recordTime: {
            zktecoUserId: report.user.zktecoUserId,
            recordTime: punchInDate
          }
        },
        create: {
          sn: 9999,
          zktecoUserId: report.user.zktecoUserId,
          recordTime: punchInDate,
          type: 0,
          state: 0,
          ip: "CORRECTION_ADMIN"
        },
        update: {}
      });
    }

    if (manualPunchOutTime && punchOutDate) {
      await prisma.rawPunch.upsert({
        where: {
          zktecoUserId_recordTime: {
            zktecoUserId: report.user.zktecoUserId,
            recordTime: punchOutDate
          }
        },
        create: {
          sn: 9999,
          zktecoUserId: report.user.zktecoUserId,
          recordTime: punchOutDate,
          type: 1,
          state: 1,
          ip: "CORRECTION_ADMIN"
        },
        update: {}
      });
    }
  } catch (err) {
    console.error("Failed to record synthetic admin raw punches:", err);
  }

  revalidatePath("/");
  revalidatePath("/anomalies");
  revalidatePath("/reports");
  revalidatePath("/salaries");
  return { success: true };
}

// =======================
// SYSTEM SETTINGS & AUTH
// =======================

export async function loginAdmin(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password || email.trim().length === 0 || password.length === 0) {
    return { success: false, error: "Email and password are required" };
  }

  if (!validateEmail(email)) {
    return { success: false, error: "Invalid email format" };
  }

  const settings = await prisma.systemSettings.findFirst();
  
  // 1. Check master Superadmin account
  if (settings && settings.adminEmail === email) {
    const isMatch = await bcrypt.compare(password, settings.adminPasswordHash);
    if (!isMatch) {
      return { success: false, error: "Invalid credentials" };
    }

    await createSession("admin", {
      email: settings.adminEmail,
      name: "Administrateur Système",
      role: "SUPERADMIN",
      permissions: {
        canManagePersonnel: true,
        canManageShifts: true,
        canManageLeaves: true,
        canViewSalaries: true,
        canManageSettings: true
      }
    });
    return { success: true };
  }

  // 2. Check custom DashboardUser accounts
  const dashboardUser = await prisma.dashboardUser.findUnique({
    where: { email }
  });

  if (!dashboardUser) {
    return { success: false, error: "Invalid credentials" };
  }

  const isUserMatch = await bcrypt.compare(password, dashboardUser.passwordHash);
  if (!isUserMatch) {
    return { success: false, error: "Invalid credentials" };
  }

  await createSession(dashboardUser.id, {
    email: dashboardUser.email,
    name: dashboardUser.name,
    role: dashboardUser.role,
    permissions: {
      canManagePersonnel: dashboardUser.canManagePersonnel,
      canManageShifts: dashboardUser.canManageShifts,
      canManageLeaves: dashboardUser.canManageLeaves,
      canViewSalaries: dashboardUser.canViewSalaries,
      canManageSettings: dashboardUser.canManageSettings
    }
  });

  return { success: true };
}

export async function logoutAdmin() {
  await deleteSession();
  return { success: true };
}

export async function updateConnectionSettings(formData: FormData) {
  await verifyAuth();

  const deviceIp = formData.get("deviceIp") as string;
  const devicePortRaw = formData.get("devicePort") as string;
  const deviceTimeoutRaw = formData.get("deviceTimeout") as string;

  if (!deviceIp || !validateIpAddress(deviceIp)) {
    return { success: false, error: "Invalid IP Address format" };
  }

  const devicePort = parseInt(devicePortRaw);
  if (isNaN(devicePort) || devicePort < 1 || devicePort > 65535) {
    return { success: false, error: "Port must be a valid number between 1 and 65535" };
  }

  const deviceTimeout = parseInt(deviceTimeoutRaw);
  if (isNaN(deviceTimeout) || deviceTimeout < 500 || deviceTimeout > 60000) {
    return { success: false, error: "Timeout must be a valid number between 500 and 60000 ms" };
  }

  await prisma.systemSettings.update({
    where: { id: "singleton" },
    data: { deviceIp, devicePort, deviceTimeout }
  });

  revalidatePath("/settings");
  return { success: true };
}

export async function updateAdminCredentials(formData: FormData) {
  await verifyAuth();

  const adminEmail = formData.get("adminEmail") as string;
  const newPassword = formData.get("newPassword") as string;

  if (!adminEmail || !validateEmail(adminEmail)) {
    return { success: false, error: "Invalid admin email format" };
  }

  const updateData: any = { adminEmail };
  if (newPassword && newPassword.trim().length > 0) {
    if (newPassword.length < 8) {
      return { success: false, error: "Password must be at least 8 characters long" };
    }
    updateData.adminPasswordHash = await bcrypt.hash(newPassword, 10);
  }

  await prisma.systemSettings.update({
    where: { id: "singleton" },
    data: updateData
  });

  revalidatePath("/settings");
  return { success: true };
}

export async function updateHrTagsSettings(formData: FormData) {
  await verifyAuth();

  const contractTypes = formData.get("contractTypes") as string || "[]";
  const maritalStatuses = formData.get("maritalStatuses") as string || "[]";
  const leaveTypes = formData.get("leaveTypes") as string || "[]";

  try {
    await prisma.systemSettings.update({
      where: { id: "singleton" },
      data: {
        contractTypes,
        maritalStatuses,
        leaveTypes
      }
    });

    revalidatePath("/settings");
    revalidatePath("/artisans");
    revalidatePath("/leaves");
    return { success: true };
  } catch (error) {
    console.error("Failed to update HR tags settings:", error);
    return { success: false, error: String(error) };
  }
}

export async function getPunchesForAnomaly(reportId: string) {
  await verifyAuth();

  try {
    const report = await prisma.calculatedDailyReport.findUnique({
      where: { id: reportId },
      include: { user: true }
    });

    if (!report) {
      return { success: false, error: "Report not found" };
    }

    const startOfDay = new Date(report.date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(report.date);
    endOfDay.setHours(23, 59, 59, 999);

    const punches = await prisma.rawPunch.findMany({
      where: {
        zktecoUserId: report.user.zktecoUserId,
        recordTime: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      orderBy: {
        recordTime: 'asc'
      }
    });

    return { success: true, punches };
  } catch (error) {
    console.error("Failed to get punches for anomaly:", error);
    return { success: false, error: String(error) };
  }
}

export async function getArtisanHistory(artisanId: string) {
  await verifyAuth();

  try {
    const artisan = await prisma.user.findUnique({
      where: { id: artisanId }
    });

    if (!artisan) {
      return { success: false, error: "Artisan not found" };
    }

    const punches = await prisma.rawPunch.findMany({
      where: { zktecoUserId: artisan.zktecoUserId },
      orderBy: { recordTime: 'desc' },
      take: 50
    });

    return { success: true, punches };
  } catch (error) {
    console.error("Failed to get artisan history:", error);
    return { success: false, error: String(error) };
  }
}

export async function getReportsPreview(startDateStr: string, endDateStr: string, artisanId: string) {
  await verifyAuth();

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { success: false, error: "Format des dates invalide." };
  }

  // 1. Trigger live recalculation from raw punches to guarantee 100% up-to-date data
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

  const settings = await prisma.systemSettings.findFirst({
    select: { otRate1: true, otRate2: true, contractTypes: true }
  });
  const otRate1 = settings?.otRate1 ?? 1.5;
  const otRate2 = settings?.otRate2 ?? 2.0;
  const parsedContracts = parseContractTypes(settings?.contractTypes || "[]");

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

  const punches = await prisma.rawPunch.findMany({
    where: punchWhereClause,
    orderBy: { recordTime: 'asc' }
  });

  // Map punches by zktecoUserId and UTC date (YYYY-MM-DD)
  const punchesByUserAndDate = new Map<string, typeof punches>();
  for (const p of punches) {
    const pDate = new Date(p.recordTime);
    const dStr = pDate.toISOString().split("T")[0];
    const key = `${p.zktecoUserId}_${dStr}`;
    if (!punchesByUserAndDate.has(key)) {
      punchesByUserAndDate.set(key, []);
    }
    punchesByUserAndDate.get(key)!.push(p);
  }

  // Pre-fetch all leaves and holidays in range
  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: startDate, lte: endDate } }
  });
  const holidayDates = new Set(holidays.map(h => h.date.toISOString().split("T")[0]));

  const leaves = await prisma.leave.findMany({
    where: {
      status: 'APPROVED',
      startDate: { lte: endDate },
      endDate: { gte: startDate }
    }
  });

  // Find all targeted users
  let targetUsers: any[] = [];
  if (artisanId && artisanId !== "all") {
    const singleUser = await prisma.user.findUnique({
      where: { id: artisanId },
      include: { shift: true }
    });
    if (singleUser) targetUsers.push(singleUser);
  } else {
    targetUsers = await prisma.user.findMany({
      where: { isActive: true },
      include: { shift: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    });
  }

  const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const userMap = new Map<string, any>();

  for (const user of targetUsers) {
    const userContract = parsedContracts.find(c => c.name === user.contractType);
    const hasOvertime = userContract ? userContract.hasOvertime : true;
    const hourlyRate = user.hourlyRate || 0;

    const userData = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      zktecoUserId: user.zktecoUserId,
      shiftName: user.shift?.name || "Standard Shift",
      hourlyRate: user.hourlyRate,
      monthlySalary: user.monthlySalary,
      contractType: user.contractType,
      shiftStartTime: user.shift?.startTime || "08:00",
      shiftEndTime: user.shift?.endTime || "17:00",
      daysWorked: 0,
      daysAbsent: 0,
      daysLeave: 0,
      daysHoliday: 0,
      daysAnomaly: 0,
      regularHours: 0,
      overtime150Hours: 0,
      overtime200Hours: 0,
      totalHours: 0,
      totalCost: 0,
      dailyBreakdown: [] as any[]
    };

    const cur = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

    while (cur <= end) {
      const dStr = cur.toISOString().split("T")[0];
      const dayOfWeek = cur.getUTCDay();
      const isSunday = dayOfWeek === 0;
      const isHoliday = holidayDates.has(dStr);

      const isLeave = leaves.some(l => 
        l.userId === user.id && 
        new Date(l.startDate) <= cur && 
        new Date(l.endDate) >= cur
      );

      const report = reports.find(r => 
        r.userId === user.id && 
        r.date.toISOString().split("T")[0] === dStr
      );

      const key = `${user.zktecoUserId}_${dStr}`;
      const dayPunches = punchesByUserAndDate.get(key) || [];
      const punchTimes = dayPunches.map(p => 
        new Date(p.recordTime).toLocaleTimeString("fr-FR", { 
          hour: "2-digit", 
          minute: "2-digit", 
          timeZone: "Africa/Casablanca" 
        })
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
        if (isLeave) {
          dayStatus = "LEAVE";
          userData.daysLeave++;
        } else if (isHoliday) {
          dayStatus = "HOLIDAY";
          userData.daysHoliday++;
        } else if (isSunday) {
          dayStatus = "REST";
        } else {
          dayStatus = "ABSENT";
          userData.daysAbsent++;
        }
      } else {
        userData.daysWorked++;
        if (dayStatus === "ANOMALY") {
          userData.daysAnomaly++;
        }
      }

      userData.regularHours += reg;
      userData.overtime150Hours += ot150;
      userData.overtime200Hours += ot200;
      userData.totalCost += dayCost;

      const dd = String(cur.getUTCDate()).padStart(2, "0");
      const mm = String(cur.getUTCMonth() + 1).padStart(2, "0");
      const yyyy = cur.getUTCFullYear();

      userData.dailyBreakdown.push({
        date: dStr,
        formattedDate: `${dd}/${mm}/${yyyy}`,
        dayName: dayNames[dayOfWeek],
        dayOfWeek,
        isSunday,
        firstPunchIn: report?.firstPunchIn ? new Date(report.firstPunchIn).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" }) : (punchTimes[0] || null),
        lastPunchOut: report?.lastPunchOut ? new Date(report.lastPunchOut).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" }) : (punchTimes.length > 1 ? punchTimes[punchTimes.length - 1] : null),
        punches: punchTimes,
        regularHours: Number(reg.toFixed(2)),
        overtime150Hours: Number(ot150.toFixed(2)),
        overtime200Hours: Number(ot200.toFixed(2)),
        totalHours: Number(totHours.toFixed(2)),
        cost: Number(dayCost.toFixed(2)),
        status: dayStatus,
        anomalyReason: report?.anomalyReason || null
      });

      cur.setDate(cur.getDate() + 1);
    }

    userData.regularHours = Number(userData.regularHours.toFixed(2));
    userData.overtime150Hours = Number(userData.overtime150Hours.toFixed(2));
    userData.overtime200Hours = Number(userData.overtime200Hours.toFixed(2));
    userData.totalHours = Number((userData.regularHours + userData.overtime150Hours + userData.overtime200Hours).toFixed(2));
    userData.totalCost = Number(userData.totalCost.toFixed(2));

    userMap.set(user.id, userData);
  }

  const list = Array.from(userMap.values());

  // Dynamic daily timeline for the selected date range
  const dailyTimelineMap = new Map<string, any>();
  const curD = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const endD = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

  while (curD <= endD) {
    const dStr = curD.toISOString().split("T")[0];
    const dd = String(curD.getUTCDate()).padStart(2, "0");
    const mm = String(curD.getUTCMonth() + 1).padStart(2, "0");
    const dayOfWeek = curD.getUTCDay();
    const dayName = dayNames[dayOfWeek];
    const label = `${dayName.slice(0, 3)}. ${dd}/${mm}`;

    dailyTimelineMap.set(dStr, {
      date: dStr,
      label,
      dayName,
      regularHours: 0,
      overtime150: 0,
      overtime200: 0,
      totalHours: 0,
      cost: 0,
      workersCount: 0
    });

    curD.setDate(curD.getDate() + 1);
  }

  for (const user of list) {
    for (const day of user.dailyBreakdown) {
      const item = dailyTimelineMap.get(day.date);
      if (item) {
        item.regularHours += day.regularHours;
        item.overtime150 += day.overtime150Hours;
        item.overtime200 += day.overtime200Hours;
        item.totalHours += day.totalHours;
        item.cost += day.cost;
        if (day.punches.length > 0) {
          item.workersCount += 1;
        }
      }
    }
  }

  const dailyTimeline = Array.from(dailyTimelineMap.values()).map(d => ({
    ...d,
    regularHours: Number(d.regularHours.toFixed(2)),
    overtime150: Number(d.overtime150.toFixed(2)),
    overtime200: Number(d.overtime200.toFixed(2)),
    totalHours: Number(d.totalHours.toFixed(2)),
    cost: Number(d.cost.toFixed(2))
  }));

  // Weekly Overtime summary
  const getWeekLabel = (dStr: string) => {
    const date = new Date(dStr);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    const dd = String(monday.getDate()).padStart(2, '0');
    const mm = String(monday.getMonth() + 1).padStart(2, '0');
    return `Sem. du ${dd}/${mm}`;
  };

  const weeklyMap = new Map<string, { overtime150: number; overtime200: number; sortKey: number }>();
  for (const d of dailyTimeline) {
    const label = getWeekLabel(d.date);
    let item = weeklyMap.get(label);
    if (!item) {
      const mon = new Date(d.date);
      const day = mon.getDay();
      const diff = mon.getDate() - day + (mon.getDay() === 0 ? -6 : 1);
      mon.setDate(diff);
      mon.setHours(0, 0, 0, 0);

      item = { overtime150: 0, overtime200: 0, sortKey: mon.getTime() };
      weeklyMap.set(label, item);
    }
    item.overtime150 += d.overtime150;
    item.overtime200 += d.overtime200;
  }

  const weeklyOvertime = Array.from(weeklyMap.entries())
    .sort((a, b) => a[1].sortKey - b[1].sortKey)
    .map(([label, val]) => ({
      label,
      overtime150: Number(val.overtime150.toFixed(2)),
      overtime200: Number(val.overtime200.toFixed(2))
    }));

  // Working days count excluding Sundays
  let workingDaysCount = 0;
  const countCur = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const countEnd = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
  while (countCur <= countEnd) {
    if (countCur.getUTCDay() !== 0) {
      workingDaysCount++;
    }
    countCur.setDate(countCur.getDate() + 1);
  }

  const potentialCapacityDays = Math.max(1, workingDaysCount * list.length);
  const actualDaysWorked = list.reduce((sum, r) => sum + r.daysWorked, 0);
  const presenceRate = Number(Math.min(100, (actualDaysWorked / potentialCapacityDays) * 100).toFixed(1));

  const totalAnomalies = list.reduce((sum, r) => sum + r.daysAnomaly, 0);
  const totalLogs = list.reduce((sum, r) => sum + r.dailyBreakdown.length, 0);
  const anomalyRate = totalLogs > 0 ? Number(((totalAnomalies / totalLogs) * 100).toFixed(1)) : 0;

  // Peak activity hours in Morocco timezone
  const hourlyBins = Array(24).fill(0);
  for (const p of punches) {
    const moroccoStr = p.recordTime.toLocaleString("en-US", { timeZone: "Africa/Casablanca" });
    const hr = new Date(moroccoStr).getHours();
    hourlyBins[hr] += 1;
  }

  const peakHours = hourlyBins.map((count, hour) => ({
    hour: `${String(hour).padStart(2, '0')}h`,
    count
  }));

  const selectedUser = (artisanId && artisanId !== "all" && list.length > 0) ? list[0] : null;

  return { 
    success: true, 
    isSingleUser: artisanId !== "all",
    selectedUser,
    reports: list,
    analytics: {
      dailyTimeline,
      weeklyOvertime,
      presenceRate,
      anomalyRate,
      totalAnomalies,
      totalWorkingDays: workingDaysCount,
      peakHours
    }
  };
}

// Recalculation engine helper for user/date ranges
export async function recalculateUserRange(userId: string, startDate: Date, endDate: Date) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { shift: true }
  });
  if (!user) return;

  const settings = await prisma.systemSettings.findFirst({
    select: { otThresholdLimit: true, gracePeriod: true }
  });
  const threshold = settings?.otThresholdLimit ?? 2.0;
  const gracePeriod = user.shift ? user.shift.gracePeriod : (settings?.gracePeriod ?? 15);

  const current = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

  while (current <= end) {
    const startOfDay = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate(), 23, 59, 59, 999));

    // A. Check for approved leave (takes precedence over previous manual overrides)
    const approvedLeave = await prisma.leave.findFirst({
      where: {
        userId,
        status: 'APPROVED',
        startDate: { lte: startOfDay },
        endDate: { gte: startOfDay }
      }
    });

    if (approvedLeave) {
      await prisma.calculatedDailyReport.upsert({
        where: { userId_date: { userId, date: startOfDay } },
        update: {
          firstPunchIn: null,
          lastPunchOut: null,
          regularHours: 0,
          overtime150Hours: 0,
          overtime200Hours: 0,
          status: 'LEAVE',
          anomalyReason: null
        },
        create: {
          userId,
          date: startOfDay,
          firstPunchIn: null,
          lastPunchOut: null,
          regularHours: 0,
          overtime150Hours: 0,
          overtime200Hours: 0,
          status: 'LEAVE',
          anomalyReason: null
        }
      });
      current.setDate(current.getDate() + 1);
      continue;
    }

    // Skip manual overrides if no leave is assigned
    const existing = await prisma.calculatedDailyReport.findUnique({
      where: { userId_date: { userId, date: startOfDay } }
    });
    if (existing && existing.status === 'RESOLVED') {
      current.setDate(current.getDate() + 1);
      continue;
    }

    // B. Check for public holiday
    const holiday = await prisma.holiday.findFirst({
      where: { date: startOfDay }
    });

    // C. Get punches
    const punches = await prisma.rawPunch.findMany({
      where: {
        zktecoUserId: user.zktecoUserId,
        recordTime: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      orderBy: { recordTime: 'asc' }
    });

    // Check anomalies
    let isAnomaly = false;
    let anomalyReason: string | null = null;
    let firstPunchIn = punches.length > 0 ? punches[0]!.recordTime : null;
    let lastPunchOut = punches.length > 0 ? punches[punches.length - 1]!.recordTime : null;
    let virtualPunchOut = false;

    if (punches.length > 0) {
      if (user.shift?.autoClose && punches.length > 0 && firstPunchIn) {
        let baseHours = user.shift.baseHours;
        if (startOfDay.getUTCDay() === 6) {
          baseHours = user.shift.saturdayHours;
        }
        lastPunchOut = new Date(firstPunchIn.getTime() + baseHours * 60 * 60 * 1000);
        virtualPunchOut = true;
      } else if (punches.length % 2 !== 0) {
        isAnomaly = true;
        anomalyReason = 'Odd number of punches. Missing punch out or extra punch in.';
      } else {
        const first = punches[0]!;
        const last = punches[punches.length - 1]!;
        const hrs = (last.recordTime.getTime() - first.recordTime.getTime()) / (1000 * 60 * 60);
        if (hrs > 16) {
          isAnomaly = true;
          anomalyReason = `Exceedingly long shift duration detected: ${hrs.toFixed(2)} hours.`;
        } else if (hrs === 0 && punches.length > 1) {
          isAnomaly = true;
          anomalyReason = 'Multiple punches recorded at the exact same time.';
        }
      }
    }

    if (firstPunchIn && user.shift) {
      const moroccoPunchStr = firstPunchIn.toLocaleString("en-US", { timeZone: "Africa/Casablanca" });
      const localPunch = new Date(moroccoPunchStr);
      const punchMinutes = localPunch.getHours() * 60 + localPunch.getMinutes();
      
      const [shiftHrs, shiftMins] = user.shift.startTime.split(":").map(Number);
      const shiftMinutes = shiftHrs * 60 + shiftMins;
      
      const diff = punchMinutes - shiftMinutes;
      if (diff <= gracePeriod) {
        // Tolerated delay or early arrival: start time is exactly the shift start time
        const adjustedPunch = new Date(localPunch);
        adjustedPunch.setHours(shiftHrs, shiftMins, 0, 0);
        const diffMs = localPunch.getTime() - adjustedPunch.getTime();
        firstPunchIn = new Date(firstPunchIn.getTime() - diffMs);
      } else {
        // Penalized delay: lose the first hour(s)
        const hoursLate = Math.floor(diff / 60);
        const minutesOfHour = diff % 60;
        
        let penaltyHours = hoursLate;
        if (minutesOfHour > gracePeriod) {
          penaltyHours += 1;
        }
        
        const adjustedPunch = new Date(localPunch);
        adjustedPunch.setHours(shiftHrs + penaltyHours, shiftMins, 0, 0);
        const diffMs = localPunch.getTime() - adjustedPunch.getTime();
        firstPunchIn = new Date(firstPunchIn.getTime() - diffMs);
      }
    }

    // Exits ("OUT") are not adjusted, ensuring employees get paid for exact minutes worked

    let regularHours = 0;
    let overtime150Hours = 0;
    let overtime200Hours = 0;
    let status: 'OK' | 'ANOMALY' | 'PENDING' | 'LEAVE' | 'HOLIDAY' = isAnomaly ? 'ANOMALY' : 'OK';

    // If the report date is today and they have an odd number of punches, it is not an anomaly (they are currently working)
    const moroccoTodayStr = new Date().toLocaleString("en-US", { timeZone: "Africa/Casablanca" });
    const localToday = new Date(moroccoTodayStr);
    const utcToday = new Date(Date.UTC(localToday.getFullYear(), localToday.getMonth(), localToday.getDate()));
    const isReportToday = startOfDay.getTime() === utcToday.getTime();

    if (isReportToday && isAnomaly && punches.length % 2 !== 0) {
      status = 'PENDING';
      anomalyReason = null;
    }

    if (punches.length === 0 && holiday) {
      status = 'HOLIDAY';
      regularHours = 0;
      overtime150Hours = 0;
      overtime200Hours = 0;
    }

    if (!isAnomaly && firstPunchIn && lastPunchOut && firstPunchIn !== lastPunchOut) {
      let totalHours = 0;
      if (virtualPunchOut && user.shift) {
        totalHours = startOfDay.getUTCDay() === 6 ? user.shift.saturdayHours : user.shift.baseHours;
      } else {
        let sumMs = 0;
        for (let i = 0; i < punches.length; i += 2) {
          if (punches[i] && punches[i + 1]) {
            let pStart = punches[i].recordTime.getTime();
            let pEnd = punches[i + 1].recordTime.getTime();
            if (i === 0 && firstPunchIn) {
              pStart = firstPunchIn.getTime();
            }
            sumMs += Math.max(0, pEnd - pStart);
          }
        }
        const rawHours = sumMs / (1000 * 60 * 60);
        const lunchBreakMinutes = user.shift?.lunchBreak ?? 0;
        totalHours = (punches.length === 2 && rawHours > 5.0 && lunchBreakMinutes > 0)
          ? Math.max(0, rawHours - (lunchBreakMinutes / 60))
          : rawHours;
      }

      let baseHours = user.shift?.baseHours || 8.0;
      
      // Saturday is a half working day (half standard base hours)
      if (startOfDay.getUTCDay() === 6) {
        baseHours = user.shift ? user.shift.saturdayHours : (baseHours / 2);
      }

      const isSunday = startOfDay.getUTCDay() === 0;

      if (isSunday) {
        // Sunday is rest day -> All worked hours on Sunday are 200% overtime
        overtime200Hours = totalHours;
        regularHours = 0;
        overtime150Hours = 0;
        if (holiday) {
          status = 'HOLIDAY';
        }
      } else if (holiday) {
        // Weekday Public Holiday (e.g. Fête du Trône): Worked hours on holiday are 150% overtime
        status = 'HOLIDAY';
        regularHours = 0;
        overtime150Hours = totalHours;
        overtime200Hours = 0;
      } else {
        // Normal Working Day
        if (totalHours <= baseHours) {
          regularHours = totalHours;
        } else {
          regularHours = baseHours;
          const overtime = totalHours - baseHours;
          if (overtime <= threshold) {
            overtime150Hours = overtime;
          } else {
            overtime150Hours = threshold;
            overtime200Hours = overtime - threshold;
          }
        }
      }
    }

    await prisma.calculatedDailyReport.upsert({
      where: { userId_date: { userId, date: startOfDay } },
      update: {
        firstPunchIn,
        lastPunchOut,
        regularHours,
        overtime150Hours,
        overtime200Hours,
        status,
        anomalyReason
      },
      create: {
        userId,
        date: startOfDay,
        firstPunchIn,
        lastPunchOut,
        regularHours,
        overtime150Hours,
        overtime200Hours,
        status,
        anomalyReason
      }
    });

    current.setDate(current.getDate() + 1);
  }
}

// Leaves CRUD Actions
export async function getLeaves() {
  await verifyAuth();
  return prisma.leave.findMany({
    include: { user: true },
    orderBy: { startDate: 'desc' }
  });
}

export async function createLeave(formData: FormData) {
  await verifyAuth();

  const userId = formData.get("userId") as string;
  const startDateStr = formData.get("startDate") as string;
  const endDateStr = formData.get("endDate") as string;
  const typeStr = formData.get("type") as string;
  const comment = formData.get("comment") as string;

  if (!userId || !startDateStr || !endDateStr || !typeStr) {
    return { success: false, error: "Veuillez renseigner tous les champs obligatoires." };
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { success: false, error: "Format de date invalide." };
  }

  if (startDate > endDate) {
    return { success: false, error: "La date de début ne peut pas être supérieure à la date de fin." };
  }

  const leave = await prisma.leave.create({
    data: {
      userId,
      startDate,
      endDate,
      type: typeStr as any,
      status: 'APPROVED',
      comment: comment || null
    }
  });

  // Recalculate daily reports
  await recalculateUserRange(userId, startDate, endDate);

  revalidatePath("/leaves");
  revalidatePath("/");
  revalidatePath("/reports");
  
  return { success: true, leave };
}

export async function deleteLeave(leaveId: string) {
  await verifyAuth();

  const leave = await prisma.leave.findUnique({
    where: { id: leaveId }
  });
  if (!leave) {
    return { success: false, error: "Congé introuvable." };
  }

  await prisma.leave.delete({
    where: { id: leaveId }
  });

  // Recalculate to restore normal status
  await recalculateUserRange(leave.userId, leave.startDate, leave.endDate);

  revalidatePath("/leaves");
  revalidatePath("/");
  revalidatePath("/reports");

  return { success: true };
}

// Holidays CRUD Actions
export async function getHolidays() {
  await verifyAuth();
  return prisma.holiday.findMany({
    orderBy: { date: 'asc' }
  });
}

export async function createHoliday(formData: FormData) {
  await verifyAuth();

  const dateStr = formData.get("date") as string;
  const name = formData.get("name") as string;

  if (!dateStr || !name) {
    return { success: false, error: "Date et libellé requis." };
  }

  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  if (isNaN(date.getTime())) {
    return { success: false, error: "Format de date invalide." };
  }

  const existing = await prisma.holiday.findUnique({
    where: { date }
  });
  if (existing) {
    return { success: false, error: "Un jour férié existe déjà à cette date." };
  }

  const holiday = await prisma.holiday.create({
    data: { date, name }
  });

  // Recalculate for active users
  const users = await prisma.user.findMany({ where: { isActive: true } });
  for (const user of users) {
    await recalculateUserRange(user.id, date, date);
  }

  revalidatePath("/holidays");
  revalidatePath("/");
  revalidatePath("/reports");

  return { success: true, holiday };
}

export async function deleteHoliday(holidayId: string) {
  await verifyAuth();

  const holiday = await prisma.holiday.findUnique({
    where: { id: holidayId }
  });
  if (!holiday) {
    return { success: false, error: "Jour férié introuvable." };
  }

  await prisma.holiday.delete({
    where: { id: holidayId }
  });

  // Recalculate for active users
  const users = await prisma.user.findMany({ where: { isActive: true } });
  for (const user of users) {
    await recalculateUserRange(user.id, holiday.date, holiday.date);
  }

  revalidatePath("/holidays");
  revalidatePath("/");
  revalidatePath("/reports");

  return { success: true };
}

function getIslamicHolidays(year: number): { date: string; name: string }[] {
  const list: { date: string; name: string }[] = [];
  const fmt = new Intl.DateTimeFormat('en-US-u-ca-islamic-civil', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });

  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const str = fmt.format(d);
    const [monthStr, dayStr] = str.split('/');
    if (!monthStr || !dayStr) continue;
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    const dateStr = d.toISOString().split('T')[0]!;

    if (month === 10 && day === 1) {
      list.push({ date: dateStr, name: "Aïd Al-Fitr (1er jour)" });
    } else if (month === 10 && day === 2) {
      list.push({ date: dateStr, name: "Aïd Al-Fitr (2ème jour)" });
    } else if (month === 12 && day === 10) {
      list.push({ date: dateStr, name: "Aïd Al-Adha (1er jour)" });
    } else if (month === 12 && day === 11) {
      list.push({ date: dateStr, name: "Aïd Al-Adha (2ème jour)" });
    } else if (month === 1 && day === 1) {
      list.push({ date: dateStr, name: "1er Moharram" });
    } else if (month === 3 && day === 12) {
      list.push({ date: dateStr, name: "Aïd Al Mawlid (1er jour)" });
    } else if (month === 3 && day === 13) {
      list.push({ date: dateStr, name: "Aïd Al Mawlid (2ème jour)" });
    }
  }

  return list;
}

const holidayNameMap: Record<string, string> = {
  "Ras l' âm": "Jour de l'An",
  "Takdim watikat al-istiqlal": "Manifeste de l'Indépendance",
  "Id Yennayer": "Nouvel An Amazigh",
  "Eid Ash-Shughl": "Fête du Travail",
  "Eid Al-Ârch": "Fête du Trône",
  "Oued Ed-Dahab Day": "Allégeance Oued Ed-Dahab",
  "Thawrat al malik wa shâab": "Révolution du Roi et du Peuple",
  "Eid Al Chabab": "Fête de la Jeunesse",
  "Eid Al Massira Al Khadra": "Anniversaire de la Marche Verte",
  "Eid Al Istiqulal": "Fête de l'Indépendance",
  "New Year's Day": "Jour de l'An",
  "Proclamation of Independence": "Manifeste de l'Indépendance",
  "Amazigh New Year": "Nouvel An Amazigh",
  "Labour Day": "Fête du Travail",
  "Enthronement": "Fête du Trône",
  "Zikra Oued Ed-Dahab": "Allégeance Oued Ed-Dahab",
  "Revolution of the King and the People": "Révolution du Roi et du Peuple",
  "Youth Day": "Fête de la Jeunesse",
  "Green March": "Anniversaire de la Marche Verte",
  "Independence Day": "Fête de l'Indépendance"
};

export async function importPublicHolidays() {
  await verifyAuth();

  // 1. Fetch all existing holidays to know what dates need recalculation
  const oldHolidays = await prisma.holiday.findMany();

  // 2. Delete all existing holidays
  await prisma.holiday.deleteMany({});

  const users = await prisma.user.findMany({ where: { isActive: true } });

  // 3. Recalculate all affected dates to restore standard states
  for (const h of oldHolidays) {
    for (const user of users) {
      await recalculateUserRange(user.id, h.date, h.date);
    }
  }

  // 4. Determine current year in Morocco
  const moroccoDateStr = new Date().toLocaleString("en-US", { timeZone: "Africa/Casablanca" });
  const year = new Date(moroccoDateStr).getFullYear();

  let holidays: { date: string; name: string }[] = [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/MA`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        holidays = data.map((item: any) => {
          const rawName = item.localName || item.name;
          const mappedName = holidayNameMap[rawName] || rawName;
          return {
            date: item.date,
            name: mappedName
          };
        });
      }
    }
  } catch (error) {
    console.error("Failed to fetch holidays from API, falling back:", error);
  }

  // If API failed or returned empty, use fallback list for fixed holidays
  if (holidays.length === 0) {
    holidays = [
      { date: `${year}-01-01`, name: "Jour de l'An" },
      { date: `${year}-01-11`, name: "Manifeste de l'Indépendance" },
      { date: `${year}-01-14`, name: "Nouvel An Amazigh" },
      { date: `${year}-05-01`, name: "Fête du Travail" },
      { date: `${year}-07-30`, name: "Fête du Trône" },
      { date: `${year}-08-14`, name: "Allégeance Oued Ed-Dahab" },
      { date: `${year}-08-20`, name: "Révolution du Roi et du Peuple" },
      { date: `${year}-08-21`, name: "Fête de la Jeunesse" },
      { date: `${year}-11-06`, name: "Anniversaire de la Marche Verte" },
      { date: `${year}-11-18`, name: "Fête de l'Indépendance" }
    ];
  }

  // 5. Generate and append dynamic Hijri/religious holidays
  const religiousHolidays = getIslamicHolidays(year);
  
  // Create a combined list preventing duplicate dates
  const holidayMap = new Map<string, string>();
  for (const h of holidays) {
    holidayMap.set(h.date, h.name);
  }
  for (const h of religiousHolidays) {
    holidayMap.set(h.date, h.name);
  }

  const finalHolidays = Array.from(holidayMap.entries()).map(([date, name]) => ({
    date,
    name
  }));

  // Sort by date chronologically
  finalHolidays.sort((a, b) => a.date.localeCompare(b.date));

  let importedCount = 0;

  for (const h of finalHolidays) {
    const date = new Date(h.date);
    date.setHours(0, 0, 0, 0);

    const existing = await prisma.holiday.findUnique({
      where: { date }
    });
    if (!existing) {
      await prisma.holiday.create({
        data: { date, name: h.name }
      });
      importedCount++;

      for (const user of users) {
        await recalculateUserRange(user.id, date, date);
      }
    }
  }

  revalidatePath("/holidays");
  revalidatePath("/");
  revalidatePath("/reports");

  return { success: true, importedCount };
}

export async function getSystemStatus() {
  await verifyAuth();

  try {
    const settings = await prisma.systemSettings.findFirst({
      select: {
        lastHeartbeat: true,
        deviceOnline: true,
        syncStatus: true,
        syncError: true,
        otThresholdLimit: true,
        otRate1: true,
        otRate2: true
      }
    });

    if (!settings) {
      return {
        success: false,
        error: "System settings not initialized."
      };
    }

    const now = new Date();
    const heartbeatLimit = 30 * 1000; // 30 seconds
    const bridgeOnline = settings.lastHeartbeat
      ? (now.getTime() - new Date(settings.lastHeartbeat).getTime()) < heartbeatLimit
      : false;

    return {
      success: true,
      bridgeOnline,
      deviceOnline: bridgeOnline ? settings.deviceOnline : false,
      syncStatus: settings.syncStatus,
      syncError: settings.syncError,
      otThresholdLimit: settings.otThresholdLimit,
      otRate1: settings.otRate1,
      otRate2: settings.otRate2
    };
  } catch (error) {
    console.error("Failed to get system status:", error);
    return {
      success: false,
      error: String(error)
    };
  }
}

export async function updateOvertimeSettings(formData: FormData) {
  await verifyAuth();

  const otThresholdLimitRaw = formData.get("otThresholdLimit") as string;
  const otRate1Raw = formData.get("otRate1") as string;
  const otRate2Raw = formData.get("otRate2") as string;
  const gracePeriodRaw = formData.get("gracePeriod") as string;

  const otThresholdLimit = parseFloat(otThresholdLimitRaw);
  const otRate1Percent = parseFloat(otRate1Raw);
  const otRate2Percent = parseFloat(otRate2Raw);
  const gracePeriod = parseInt(gracePeriodRaw, 10);

  if (isNaN(otThresholdLimit) || otThresholdLimit < 0 || otThresholdLimit > 24) {
    return { success: false, error: "Le seuil d'heures supplémentaires doit être compris entre 0 et 24." };
  }

  if (isNaN(otRate1Percent) || otRate1Percent < 100 || otRate1Percent > 500) {
    return { success: false, error: "Le taux Tier 1 doit être un pourcentage valide (ex: 150)." };
  }

  if (isNaN(otRate2Percent) || otRate2Percent < 100 || otRate2Percent > 500) {
    return { success: false, error: "Le taux Tier 2 doit être un pourcentage valide (ex: 200)." };
  }

  if (isNaN(gracePeriod) || gracePeriod < 0 || gracePeriod > 60) {
    return { success: false, error: "La marge de tolérance doit être comprise entre 0 et 60 minutes." };
  }

  const otRate1 = otRate1Percent / 100;
  const otRate2 = otRate2Percent / 100;

  try {
    await prisma.systemSettings.update({
      where: { id: "singleton" },
      data: {
        otThresholdLimit,
        otRate1,
        otRate2,
        gracePeriod
      }
    });

    revalidatePath("/settings");
    revalidatePath("/");
    revalidatePath("/reports");

    // Recalculate the last 30 days of daily reports to apply the new rules
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date();

    const users = await prisma.user.findMany({ select: { id: true } });
    for (const u of users) {
      await recalculateUserRange(u.id, startDate, endDate);
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to update overtime settings:", error);
    return { success: false, error: String(error) };
  }
}

export async function saveAllSystemSettings(formData: FormData) {
  await verifyAuth();

  // 1. ZKTeco Hardware Connection parameters
  const deviceIp = formData.get("deviceIp") as string;
  const devicePortRaw = formData.get("devicePort") as string;
  const deviceTimeoutRaw = formData.get("deviceTimeout") as string;

  if (!deviceIp || !validateIpAddress(deviceIp)) {
    return { success: false, error: "Format de l'adresse IP invalide." };
  }
  const devicePort = parseInt(devicePortRaw);
  if (isNaN(devicePort) || devicePort < 1 || devicePort > 65535) {
    return { success: false, error: "Le port doit être un nombre valide entre 1 et 65535." };
  }
  const deviceTimeout = parseInt(deviceTimeoutRaw);
  if (isNaN(deviceTimeout) || deviceTimeout < 500 || deviceTimeout > 60000) {
    return { success: false, error: "Le timeout doit être compris entre 500 et 60000 ms." };
  }

  // 2. Overtime & Calculation Rules parameters
  const otThresholdLimitRaw = formData.get("otThresholdLimit") as string;
  const otRate1Raw = formData.get("otRate1") as string;
  const otRate2Raw = formData.get("otRate2") as string;
  const gracePeriodRaw = formData.get("gracePeriod") as string;

  const otThresholdLimit = parseFloat(otThresholdLimitRaw);
  const otRate1Percent = parseFloat(otRate1Raw);
  const otRate2Percent = parseFloat(otRate2Raw);
  const gracePeriod = parseInt(gracePeriodRaw, 10);

  if (isNaN(otThresholdLimit) || otThresholdLimit < 0 || otThresholdLimit > 24) {
    return { success: false, error: "Le seuil d'heures supplémentaires doit être compris entre 0 et 24." };
  }
  if (isNaN(otRate1Percent) || otRate1Percent < 100 || otRate1Percent > 500) {
    return { success: false, error: "Le taux Tier 1 doit être un pourcentage valide (ex: 150)." };
  }
  if (isNaN(otRate2Percent) || otRate2Percent < 100 || otRate2Percent > 500) {
    return { success: false, error: "Le taux Tier 2 doit être un pourcentage valide (ex: 200)." };
  }
  if (isNaN(gracePeriod) || gracePeriod < 0 || gracePeriod > 60) {
    return { success: false, error: "La marge de tolérance doit être comprise entre 0 et 60 minutes." };
  }

  const otRate1 = otRate1Percent / 100;
  const otRate2 = otRate2Percent / 100;

  // 3. HR Tags & Lists parameters
  const contractTypes = formData.get("contractTypes") as string || "[]";
  const maritalStatuses = formData.get("maritalStatuses") as string || "[]";
  const leaveTypes = formData.get("leaveTypes") as string || "[]";

  try {
    await prisma.systemSettings.update({
      where: { id: "singleton" },
      data: {
        deviceIp,
        devicePort,
        deviceTimeout,
        otThresholdLimit,
        otRate1,
        otRate2,
        gracePeriod,
        contractTypes,
        maritalStatuses,
        leaveTypes
      }
    });

    revalidatePath("/settings");
    revalidatePath("/artisans");
    revalidatePath("/leaves");
    revalidatePath("/");
    revalidatePath("/reports");

    // Recalculate the last 30 days of daily reports to apply the new rules
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date();

    const users = await prisma.user.findMany({ select: { id: true } });
    for (const u of users) {
      await recalculateUserRange(u.id, startDate, endDate);
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to save all system settings:", error);
    return { success: false, error: String(error) };
  }
}

export async function getSidebarSession() {
  const session = await getSession();
  if (!session) return null;
  
  if (session.adminId === "admin") {
    return {
      role: "SUPERADMIN",
      name: "Administrateur Système",
      email: session.email || "admin@ecutsolutions.com",
      permissions: {
        canManagePersonnel: true,
        canManageShifts: true,
        canManageLeaves: true,
        canViewSalaries: true,
        canManageSettings: true
      }
    };
  }

  return {
    role: session.role,
    name: session.name,
    email: session.email,
    permissions: session.permissions
  };
}

export async function getDashboardUsers() {
  const session = await verifyAuth();
  // Only SUPERADMIN or users with canManageSettings can list/manage users
  if (session.role !== "SUPERADMIN" && !session.permissions?.canManageSettings) {
    throw new Error("Forbidden: Access Denied");
  }

  return await prisma.dashboardUser.findMany({
    orderBy: { createdAt: "desc" }
  });
}

export async function createDashboardUser(formData: FormData) {
  const session = await verifyAuth();
  if (session.role !== "SUPERADMIN" && !session.permissions?.canManageSettings) {
    return { success: false, error: "Accès Refusé." };
  }

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as string || "MANAGER";

  const canManagePersonnel = formData.get("canManagePersonnel") === "true";
  const canManageShifts = formData.get("canManageShifts") === "true";
  const canManageLeaves = formData.get("canManageLeaves") === "true";
  const canViewSalaries = formData.get("canViewSalaries") === "true";
  const canManageSettings = formData.get("canManageSettings") === "true";

  if (!name || !email || !password || name.trim().length === 0 || email.trim().length === 0 || password.length === 0) {
    return { success: false, error: "Tous les champs sont requis." };
  }

  if (!validateEmail(email)) {
    return { success: false, error: "Format de l'adresse email invalide." };
  }

  // Check if master email conflicts
  const settings = await prisma.systemSettings.findFirst();
  if (settings && settings.adminEmail.toLowerCase() === email.toLowerCase()) {
    return { success: false, error: "Cette adresse email est déjà réservée pour le compte Superadmin principal." };
  }

  // Check if email already exists
  const existing = await prisma.dashboardUser.findUnique({
    where: { email: email.toLowerCase() }
  });
  if (existing) {
    return { success: false, error: "Un utilisateur avec cette adresse email existe déjà." };
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.dashboardUser.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role,
        canManagePersonnel,
        canManageShifts,
        canManageLeaves,
        canViewSalaries,
        canManageSettings
      }
    });

    revalidatePath("/users");
    return { success: true };
  } catch (err) {
    console.error("Failed to create dashboard user:", err);
    return { success: false, error: String(err) };
  }
}

export async function updateDashboardUser(formData: FormData) {
  const session = await verifyAuth();
  if (session.role !== "SUPERADMIN" && !session.permissions?.canManageSettings) {
    return { success: false, error: "Accès Refusé." };
  }

  const userId = formData.get("userId") as string;
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as string || "MANAGER";

  const canManagePersonnel = formData.get("canManagePersonnel") === "true";
  const canManageShifts = formData.get("canManageShifts") === "true";
  const canManageLeaves = formData.get("canManageLeaves") === "true";
  const canViewSalaries = formData.get("canViewSalaries") === "true";
  const canManageSettings = formData.get("canManageSettings") === "true";

  if (!userId || !name || !email || name.trim().length === 0 || email.trim().length === 0) {
    return { success: false, error: "L'identifiant, le nom et l'email sont requis." };
  }

  if (!validateEmail(email)) {
    return { success: false, error: "Format de l'adresse email invalide." };
  }

  // Check if email already exists on another user
  const existing = await prisma.dashboardUser.findFirst({
    where: {
      email: email.toLowerCase(),
      NOT: { id: userId }
    }
  });
  if (existing) {
    return { success: false, error: "Un autre utilisateur utilise déjà cette adresse email." };
  }

  try {
    const dataToUpdate: any = {
      name,
      email: email.toLowerCase(),
      role,
      canManagePersonnel,
      canManageShifts,
      canManageLeaves,
      canViewSalaries,
      canManageSettings
    };

    if (password && password.length > 0) {
      dataToUpdate.passwordHash = await bcrypt.hash(password, 10);
    }

    await prisma.dashboardUser.update({
      where: { id: userId },
      data: dataToUpdate
    });

    revalidatePath("/users");
    return { success: true };
  } catch (err) {
    console.error("Failed to update dashboard user:", err);
    return { success: false, error: String(err) };
  }
}

// ==========================================
// DASHBOARD DYNAMIC PERIOD DATA ACTIONS
// ==========================================

export async function getDashboardData(
  periodFilter: "TODAY" | "YESTERDAY" | "THIS_WEEK" | "LAST_WEEK" | "THIS_MONTH" | "LAST_MONTH" | "CUSTOM" = "TODAY",
  startDateStr?: string,
  endDateStr?: string
) {
  await verifyAuth();

  const moroccoNowStr = new Date().toLocaleString("en-US", { timeZone: "Africa/Casablanca" });
  const localNow = new Date(moroccoNowStr);
  const todayUtc = new Date(Date.UTC(localNow.getFullYear(), localNow.getMonth(), localNow.getDate()));

  let startDate: Date;
  let endDate: Date;
  let periodLabel = "";

  if (periodFilter === "CUSTOM") {
    const sDate = startDateStr ? new Date(startDateStr) : new Date(todayUtc);
    const eDate = endDateStr ? new Date(endDateStr) : new Date(sDate);
    const validS = !isNaN(sDate.getTime()) ? sDate : todayUtc;
    const validE = !isNaN(eDate.getTime()) ? eDate : validS;

    startDate = new Date(Date.UTC(validS.getUTCFullYear(), validS.getUTCMonth(), validS.getUTCDate(), 0, 0, 0, 0));
    endDate = new Date(Date.UTC(validE.getUTCFullYear(), validE.getUTCMonth(), validE.getUTCDate(), 23, 59, 59, 999));

    const startFmt = startDate.toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit', year: 'numeric' });
    const endFmt = endDate.toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit', year: 'numeric' });
    periodLabel = `du ${startFmt} au ${endFmt}`;
  } else if (periodFilter === "YESTERDAY") {
    const yest = new Date(todayUtc);
    yest.setDate(yest.getDate() - 1);
    startDate = new Date(Date.UTC(yest.getUTCFullYear(), yest.getUTCMonth(), yest.getUTCDate(), 0, 0, 0, 0));
    endDate = new Date(Date.UTC(yest.getUTCFullYear(), yest.getUTCMonth(), yest.getUTCDate(), 23, 59, 59, 999));
    const dayFmt = startDate.toLocaleDateString("fr-FR", { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    periodLabel = `Hier (${dayFmt})`;
  } else if (periodFilter === "THIS_WEEK") {
    const day = todayUtc.getUTCDay();
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    startDate = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate() + diffToMonday, 0, 0, 0, 0));
    endDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate() + 6, 23, 59, 59, 999));
    const startFmt = startDate.toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit' });
    const endFmt = endDate.toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit', year: 'numeric' });
    periodLabel = `Cette Semaine (du ${startFmt} au ${endFmt})`;
  } else if (periodFilter === "LAST_WEEK") {
    const day = todayUtc.getUTCDay();
    const diffToMonday = (day === 0 ? -6 : 1 - day) - 7;
    startDate = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate() + diffToMonday, 0, 0, 0, 0));
    endDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate() + 6, 23, 59, 59, 999));
    const startFmt = startDate.toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit' });
    const endFmt = endDate.toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit', year: 'numeric' });
    periodLabel = `Semaine Dernière (du ${startFmt} au ${endFmt})`;
  } else if (periodFilter === "THIS_MONTH") {
    startDate = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), 1, 0, 0, 0, 0));
    endDate = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    periodLabel = `Ce Mois-ci (${startDate.toLocaleDateString("fr-FR", { month: 'long', year: 'numeric' })})`;
  } else if (periodFilter === "LAST_MONTH") {
    startDate = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth() - 1, 1, 0, 0, 0, 0));
    endDate = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), 0, 23, 59, 59, 999));
    periodLabel = `Le Mois Dernier (${startDate.toLocaleDateString("fr-FR", { month: 'long', year: 'numeric' })})`;
  } else {
    // TODAY
    startDate = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate(), 0, 0, 0, 0));
    endDate = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate(), 23, 59, 59, 999));
    const dayFmt = startDate.toLocaleDateString("fr-FR", { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    periodLabel = `Aujourd'hui (${dayFmt})`;
  }

  const settings = await prisma.systemSettings.findFirst();
  const otRate1 = settings?.otRate1 ?? 1.5;
  const otRate2 = settings?.otRate2 ?? 2.0;
  const parsedContracts = parseContractTypes(settings?.contractTypes || "[]");

  // Load all active users
  const allActiveUsers = await prisma.user.findMany({
    where: { isActive: true },
    include: { shift: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
  });

  // Fetch calculated daily reports for this filtered period
  const periodReports = await prisma.calculatedDailyReport.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate
      }
    },
    include: { user: true }
  });

  // Fetch approved leaves for this period
  const periodLeaves = await prisma.leave.findMany({
    where: {
      status: 'APPROVED',
      startDate: { lte: endDate },
      endDate: { gte: startDate }
    }
  });

  // Calculate period KPIs
  let expectedDaysCount = 0;
  let presentDaysCount = 0;
  let totalHoursWorked = 0;
  let totalOt150 = 0;
  let totalOt200 = 0;
  let estimatedPayrollCost = 0;
  let anomalyCount = 0;

  periodReports.forEach(r => {
    if (r.status === 'ANOMALY') anomalyCount++;

    const day = r.date.getUTCDay();
    const isWeekend = day === 0;
    const isHoliday = r.status === 'HOLIDAY';
    const isLeave = r.status === 'LEAVE';

    if (!isWeekend && !isHoliday && !isLeave) {
      expectedDaysCount++;
      if (r.firstPunchIn !== null) {
        presentDaysCount++;
      }
    }

    const userContract = parsedContracts.find(c => c.name === r.user.contractType);
    const hasOvertime = userContract ? userContract.hasOvertime : true;

    let reg = r.regularHours;
    let o150 = r.overtime150Hours;
    let o200 = r.overtime200Hours;

    if (!hasOvertime) {
      reg = reg + o150 + o200;
      o150 = 0;
      o200 = 0;
    }

    totalOt150 += o150;
    totalOt200 += o200;
    totalHoursWorked += (reg + o150 + o200);

    const hourlyRate = r.user.hourlyRate || 0;
    const cost = (reg * hourlyRate) + (o150 * hourlyRate * otRate1) + (o200 * hourlyRate * otRate2);
    estimatedPayrollCost += cost;
  });

  const presenceRate = expectedDaysCount > 0 ? Math.round((presentDaysCount / expectedDaysCount) * 100) : 0;

  // Chart Data: Group reports by day within period
  const dayMs = 24 * 3600 * 1000;
  const numDays = Math.min(62, Math.max(1, Math.round((endDate.getTime() - startDate.getTime() + 1000) / dayMs)));
  
  const chartDays: { label: string; fullDate: string; cost: number; hours: number }[] = [];
  
  for (let i = 0; i < numDays; i++) {
    const curD = new Date(startDate.getTime() + (i * dayMs));
    const curUtc = new Date(Date.UTC(curD.getUTCFullYear(), curD.getUTCMonth(), curD.getUTCDate()));
    
    const dayReports = periodReports.filter(r => {
      const rUtc = new Date(Date.UTC(r.date.getUTCFullYear(), r.date.getUTCMonth(), r.date.getUTCDate()));
      return rUtc.getTime() === curUtc.getTime();
    });

    let dayCost = 0;
    let dayHours = 0;

    dayReports.forEach(r => {
      const userContract = parsedContracts.find(c => c.name === r.user.contractType);
      const hasOvertime = userContract ? userContract.hasOvertime : true;

      let reg = r.regularHours;
      let o150 = r.overtime150Hours;
      let o200 = r.overtime200Hours;

      if (!hasOvertime) {
        reg += o150 + o200;
        o150 = 0;
        o200 = 0;
      }

      dayHours += (reg + o150 + o200);
      const hRate = r.user.hourlyRate || 0;
      dayCost += (reg * hRate) + (o150 * hRate * otRate1) + (o200 * hRate * otRate2);
    });

    const dayName = curUtc.toLocaleDateString("fr-FR", { weekday: 'short' });
    const dayNum = curUtc.toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit' });

    chartDays.push({
      label: numDays <= 7 ? `${dayName}. ${dayNum}` : dayNum,
      fullDate: curUtc.toISOString().split("T")[0],
      cost: Number(dayCost.toFixed(2)),
      hours: Number(dayHours.toFixed(2))
    });
  }

  // Fetch holidays for the period
  const periodHolidays = await prisma.holiday.findMany({
    where: {
      date: { gte: startDate, lte: endDate }
    }
  });

  // Employee breakdown table for this period
  const nonExemptUsers = allActiveUsers.filter(u => !((u as any).isExempt === true || u.contractType?.toLowerCase().includes("direction") || u.contractType?.toLowerCase().includes("propriétaire")));

  const defaultMaxCalcDate = new Date(Math.min(endDate.getTime(), todayUtc.getTime()));

  const employeeRows = allActiveUsers.map(u => {
    const isExemptUser = (u as any).isExempt === true || u.contractType?.toLowerCase().includes("direction") || u.contractType?.toLowerCase().includes("propriétaire");
    const uReports = periodReports.filter(r => r.userId === u.id);
    const uLeaves = periodLeaves.filter(l => l.userId === u.id);

    let userReg = 0;
    let userOt150 = 0;
    let userOt200 = 0;

    uReports.forEach(r => {
      const userContract = parsedContracts.find(c => c.name === u.contractType);
      const hasOvertime = userContract ? userContract.hasOvertime : true;

      let reg = r.regularHours;
      let o150 = r.overtime150Hours;
      let o200 = r.overtime200Hours;

      if (!hasOvertime) {
        reg += o150 + o200;
        o150 = 0;
        o200 = 0;
      }

      userReg += reg;
      userOt150 += o150;
      userOt200 += o200;
    });

    // Cap expected vs absent calculation to todayUtc AND exitDate if user has departed
    const userExitDate = (u as any).exitDate ? new Date((u as any).exitDate) : null;
    const userMaxCalcDate = userExitDate
      ? new Date(Math.min(endDate.getTime(), todayUtc.getTime(), userExitDate.getTime()))
      : defaultMaxCalcDate;

    let daysExpected = 0;
    let daysPresent = 0;

    for (let d = new Date(startDate.getTime()); d.getTime() <= userMaxCalcDate.getTime(); d.setTime(d.getTime() + dayMs)) {
      const curUtc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const dayOfWeek = curUtc.getUTCDay();
      const isSunday = dayOfWeek === 0;

      const isHoliday = periodHolidays.some(h => {
        const hUtc = new Date(Date.UTC(h.date.getUTCFullYear(), h.date.getUTCMonth(), h.date.getUTCDate()));
        return hUtc.getTime() === curUtc.getTime();
      });

      const isUserLeave = uLeaves.some(l => {
        const lStart = new Date(Date.UTC(l.startDate.getUTCFullYear(), l.startDate.getUTCMonth(), l.startDate.getUTCDate()));
        const lEnd = new Date(Date.UTC(l.endDate.getUTCFullYear(), l.endDate.getUTCMonth(), l.endDate.getUTCDate()));
        return curUtc.getTime() >= lStart.getTime() && curUtc.getTime() <= lEnd.getTime();
      });

      if (!isSunday && !isHoliday && !isUserLeave) {
        daysExpected++;
        const hasPunch = uReports.some(r => {
          const rUtc = new Date(Date.UTC(r.date.getUTCFullYear(), r.date.getUTCMonth(), r.date.getUTCDate()));
          return rUtc.getTime() === curUtc.getTime() && r.firstPunchIn !== null;
        });
        if (hasPunch) {
          daysPresent++;
        }
      }
    }

    const daysAbsent = isExemptUser ? 0 : Math.max(0, daysExpected - daysPresent);
    const presenceRate = daysExpected > 0 ? Math.round((daysPresent / daysExpected) * 100) : 0;

    const hourlyRate = u.hourlyRate || 0;
    const earnedCost = (userReg * hourlyRate) + (userOt150 * hourlyRate * otRate1) + (userOt200 * hourlyRate * otRate2);

    let firstPunchInStr: string | null = null;
    const reportWithPunch = uReports.find(r => r.firstPunchIn !== null);
    if (reportWithPunch && reportWithPunch.firstPunchIn) {
      firstPunchInStr = new Date(reportWithPunch.firstPunchIn).toLocaleTimeString("fr-FR", {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Casablanca'
      });
    }

    const isSingleDay = numDays <= 1;
    let statusCategory: "PRESENT" | "ABSENT" | "LEAVE" | "EXEMPT" = "ABSENT";
    let statusLabel = "";
    let detailStr = "";

    if (isExemptUser) {
      statusCategory = "EXEMPT";
      statusLabel = "Direction / Exonéré";
      detailStr = "Direction / Non soumis au pointage";
    } else if (isSingleDay) {
      if (daysPresent > 0) {
        statusCategory = "PRESENT";
        statusLabel = "Présent";
        detailStr = firstPunchInStr ? `Entrée à ${firstPunchInStr}` : "Présent";
      } else if (uLeaves.length > 0) {
        statusCategory = "LEAVE";
        statusLabel = `En Congé (${uLeaves[0].type})`;
        detailStr = `Absence autorisée (${uLeaves[0].type})`;
      } else {
        statusCategory = "ABSENT";
        statusLabel = "Non arrivé / Absent";
        detailStr = "Aucun pointage aujourd'hui";
      }
    } else {
      // Multi-day range (week/month/custom)
      if (daysAbsent > 0) {
        statusCategory = "ABSENT";
        statusLabel = `${daysAbsent} jrs d'absence`;
        detailStr = `${daysPresent}/${daysExpected} jrs présents · ${daysAbsent} jrs d'absence (${presenceRate}% présence)`;
      } else {
        statusCategory = "PRESENT";
        statusLabel = `100% Présent (${daysPresent}/${daysExpected} jrs)`;
        detailStr = `Présence parfaite : ${daysPresent}/${daysExpected} jours ouvrables travaillés`;
      }
    }

    return {
      id: u.id,
      zktecoUserId: u.zktecoUserId,
      firstName: u.firstName,
      lastName: u.lastName,
      contractType: u.contractType || "Standard",
      shiftName: isExemptUser ? "Direction / Propriétaire" : (u.shift?.name || "Standard (08:00 - 17:00)"),
      hourlyRate,
      isExempt: isExemptUser,
      daysExpected,
      daysPresent,
      daysAbsent,
      presenceRate,
      hasAbsences: daysAbsent > 0,
      regHours: Number(userReg.toFixed(2)),
      ot150Hours: Number(userOt150.toFixed(2)),
      ot200Hours: Number(userOt200.toFixed(2)),
      totalHours: Number((userReg + userOt150 + userOt200).toFixed(2)),
      earnedCost: Number(earnedCost.toFixed(2)),
      statusCategory,
      statusLabel,
      detailStr,
      firstPunchInStr
    };
  });

  const isMultiDay = numDays > 1;

  return {
    success: true,
    periodFilter,
    startDateStr: startDate.toISOString().split("T")[0],
    endDateStr: endDate.toISOString().split("T")[0],
    periodLabel,
    isMultiDay,
    kpis: {
      presenceRate,
      totalHoursWorked: Number(totalHoursWorked.toFixed(2)),
      estimatedPayrollCost: Number(estimatedPayrollCost.toFixed(2)),
      anomalyCount,
      totalArtisans: nonExemptUsers.length,
      presentCount: employeeRows.filter(r => !r.isExempt && r.daysPresent > 0).length,
      absentCount: employeeRows.filter(r => !r.isExempt && r.daysAbsent > 0).length,
      fullyAbsentCount: employeeRows.filter(r => !r.isExempt && r.daysPresent === 0).length,
      totalOtHours: Number((totalOt150 + totalOt200).toFixed(2))
    },
    chartDays,
    employeeRows
  };
}

// ==========================================
// SALARIES & ADVANCES MANAGEMENT ACTIONS
// ==========================================

export async function getSalaryOverview(
  periodMode: "MONTHLY" | "WEEKLY" | "CUSTOM" = "MONTHLY",
  selectedDateStr?: string,
  customEndDateStr?: string
) {
  await verifyAuth();

  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  let periodLabel = "";
  let dateValue = selectedDateStr || "";

  if (periodMode === "CUSTOM") {
    const sDate = selectedDateStr ? new Date(selectedDateStr) : new Date();
    const eDate = customEndDateStr ? new Date(customEndDateStr) : new Date(sDate);
    if (isNaN(sDate.getTime())) sDate.setTime(now.getTime());
    if (isNaN(eDate.getTime())) eDate.setTime(sDate.getTime());

    startDate = new Date(Date.UTC(sDate.getUTCFullYear(), sDate.getUTCMonth(), sDate.getUTCDate(), 0, 0, 0, 0));
    endDate = new Date(Date.UTC(eDate.getUTCFullYear(), eDate.getUTCMonth(), eDate.getUTCDate(), 23, 59, 59, 999));

    const startFmt = startDate.toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit', year: 'numeric' });
    const endFmt = endDate.toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit', year: 'numeric' });
    periodLabel = `du ${startFmt} au ${endFmt}`;
    dateValue = selectedDateStr || "";
  } else if (periodMode === "WEEKLY") {
    const baseDate = selectedDateStr ? new Date(selectedDateStr) : new Date();
    if (isNaN(baseDate.getTime())) {
      baseDate.setTime(now.getTime());
    }
    const day = baseDate.getUTCDay();
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    startDate = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate() + diffToMonday, 0, 0, 0, 0));
    endDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate() + 6, 23, 59, 59, 999));
    
    const startFmt = startDate.toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit' });
    const endFmt = endDate.toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit', year: 'numeric' });
    periodLabel = `Semaine du ${startFmt} au ${endFmt}`;
    dateValue = startDate.toISOString().split("T")[0]!;
  } else {
    const monthStr = selectedDateStr || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [yearStr, mStr] = monthStr.split("-");
    const year = parseInt(yearStr || String(now.getFullYear()));
    const monthIdx = parseInt(mStr || String(now.getMonth() + 1)) - 1;

    startDate = new Date(Date.UTC(year, monthIdx, 1, 0, 0, 0, 0));
    endDate = new Date(Date.UTC(year, monthIdx + 1, 0, 23, 59, 59, 999));
    periodLabel = startDate.toLocaleDateString("fr-FR", { month: 'long', year: 'numeric' });
    dateValue = monthStr;
  }

  const settings = await prisma.systemSettings.findFirst();
  const otRate1 = settings?.otRate1 ?? 1.5;
  const otRate2 = settings?.otRate2 ?? 2.0;
  const parsedContracts = parseContractTypes(settings?.contractTypes || "[]");

  // Load all active non-exempt users (excluding Direction / Owners)
  const users = await prisma.user.findMany({
    where: { 
      isActive: true,
      isExempt: false 
    } as any,
    include: { shift: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
  });

  // Load reports for this period
  const reports = await prisma.calculatedDailyReport.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate
      }
    }
  });

  // Load salary transactions for this period (by periodDate if present, or fallback to date)
  const transactions = await (prisma.salaryTransaction as any).findMany({
    where: {
      OR: [
        {
          periodDate: {
            gte: startDate,
            lte: endDate
          }
        },
        {
          periodDate: null,
          date: {
            gte: startDate,
            lte: endDate
          }
        }
      ]
    },
    orderBy: { date: 'desc' }
  });

  const salaryData = users.map(user => {
    const userReports = reports.filter(r => r.userId === user.id);
    const userTxns = transactions.filter((t: any) => t.userId === user.id);

    const userContract = parsedContracts.find(c => c.name === user.contractType);
    const hasOvertime = userContract ? userContract.hasOvertime : true;

    let regularHours = 0;
    let ot150 = 0;
    let ot200 = 0;
    let daysWorked = 0;

    userReports.forEach(r => {
      if (r.firstPunchIn) daysWorked += 1;

      let reg = r.regularHours;
      let o150 = r.overtime150Hours;
      let o200 = r.overtime200Hours;

      if (!hasOvertime) {
        reg += o150 + o200;
        o150 = 0;
        o200 = 0;
      }

      regularHours += reg;
      ot150 += o150;
      ot200 += o200;
    });

    const hourlyRate = user.hourlyRate || 0;
    const earnedSalary = (regularHours * hourlyRate) + (ot150 * hourlyRate * otRate1) + (ot200 * hourlyRate * otRate2);

    let advances = 0;
    let bonuses = 0;
    let deductions = 0;
    let finalPaid = 0;

    userTxns.forEach((t: any) => {
      if (t.type === 'ADVANCE' || t.type === 'ACOMPTE') advances += t.amount;
      else if (t.type === 'BONUS') bonuses += t.amount;
      else if (t.type === 'DEDUCTION') deductions += t.amount;
      else if (t.type === 'FINAL_PAY') finalPaid += t.amount;
    });

    const netPayable = (earnedSalary + bonuses) - deductions - advances - finalPaid;

    let status = 'EN_ATTENTE';
    if (netPayable <= 0.01 && (earnedSalary > 0 || finalPaid > 0)) {
      status = 'PAYE';
    } else if (finalPaid > 0 || advances > 0) {
      status = 'PARTIEL';
    }

    return {
      userId: user.id,
      zktecoUserId: user.zktecoUserId,
      firstName: user.firstName,
      lastName: user.lastName,
      hourlyRate: user.hourlyRate,
      cin: user.cin || null,
      cnss: user.cnss || null,
      rib: user.rib || null,
      bankName: user.bankName || null,
      phone: user.phone || null,
      paymentFrequency: user.paymentFrequency || "MONTHLY",
      contractType: user.contractType || "Non spécifié",
      shiftName: user.shift?.name || "Sans Shift",
      daysWorked,
      regularHours: Number(regularHours.toFixed(2)),
      ot150: Number(ot150.toFixed(2)),
      ot200: Number(ot200.toFixed(2)),
      totalHours: Number((regularHours + ot150 + ot200).toFixed(2)),
      earnedSalary: Number(earnedSalary.toFixed(2)),
      advances: Number(advances.toFixed(2)),
      bonuses: Number(bonuses.toFixed(2)),
      deductions: Number(deductions.toFixed(2)),
      finalPaid: Number(finalPaid.toFixed(2)),
      netPayable: Number(netPayable.toFixed(2)),
      status,
      transactionsCount: userTxns.length
    };
  });

  const kpis = {
    totalEarned: Number(salaryData.reduce((acc, u) => acc + u.earnedSalary, 0).toFixed(2)),
    totalAdvances: Number(salaryData.reduce((acc, u) => acc + u.advances, 0).toFixed(2)),
    totalBonuses: Number(salaryData.reduce((acc, u) => acc + u.bonuses, 0).toFixed(2)),
    totalFinalPaid: Number(salaryData.reduce((acc, u) => acc + u.finalPaid, 0).toFixed(2)),
    totalRemaining: Number(salaryData.reduce((acc, u) => acc + Math.max(0, u.netPayable), 0).toFixed(2))
  };

  return {
    success: true,
    periodMode,
    dateValue,
    periodLabel,
    data: salaryData,
    kpis
  };
}

export async function addSalaryTransaction(data: {
  userId: string;
  type: "ADVANCE" | "ACOMPTE" | "BONUS" | "DEDUCTION" | "FINAL_PAY";
  amount: number;
  dateStr?: string;
  periodDateStr?: string;
  periodStartDateStr?: string;
  periodEndDateStr?: string;
  method: "CASH" | "BANK_TRANSFER" | "CHECK";
  reference?: string;
  notes?: string;
}) {
  await verifyAuth();

  if (!data.userId || !data.amount || data.amount <= 0 || !data.type) {
    return { success: false, error: "Veuillez renseigner tous les champs obligatoires avec un montant valide." };
  }

  const session = await getSession();
  const date = data.dateStr ? new Date(data.dateStr) : new Date();

  let periodDate: Date | null = null;
  if (data.periodDateStr) {
    const pDate = new Date(data.periodDateStr);
    if (!isNaN(pDate.getTime())) {
      periodDate = pDate;
    }
  }
  if (!periodDate) {
    periodDate = date;
  }

  let periodStartDate: Date | null = null;
  if (data.periodStartDateStr) {
    const psDate = new Date(data.periodStartDateStr);
    if (!isNaN(psDate.getTime())) periodStartDate = psDate;
  }

  let periodEndDate: Date | null = null;
  if (data.periodEndDateStr) {
    const peDate = new Date(data.periodEndDateStr);
    if (!isNaN(peDate.getTime())) periodEndDate = peDate;
  }

  try {
    const txn = await (prisma.salaryTransaction as any).create({
      data: {
        userId: data.userId,
        type: data.type,
        amount: data.amount,
        date,
        periodDate,
        periodStartDate,
        periodEndDate,
        method: data.method || "CASH",
        reference: data.reference || null,
        notes: data.notes || null,
        createdBy: session?.adminName || session?.adminId || "Admin"
      }
    });

    revalidatePath("/salaries");
    revalidatePath("/reports");
    return { success: true, txn };
  } catch (err) {
    console.error("Failed to add salary transaction:", err);
    return { success: false, error: String(err) };
  }
}

export async function deleteSalaryTransaction(transactionId: string) {
  await verifyAuth();

  try {
    await prisma.salaryTransaction.delete({
      where: { id: transactionId }
    });

    revalidatePath("/salaries");
    return { success: true };
  } catch (err) {
    console.error("Failed to delete salary transaction:", err);
    return { success: false, error: String(err) };
  }
}

export async function getSalaryUserHistory(userId: string, monthStr?: string) {
  await verifyAuth();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { shift: true }
  });

  if (!user) {
    return { success: false, error: "Employé introuvable." };
  }

  // Fetch all transactions for this user so history modal displays complete payment log
  const transactions = await (prisma.salaryTransaction as any).findMany({
    where: { userId },
    orderBy: { date: 'desc' }
  });

  return {
    success: true,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      zktecoUserId: user.zktecoUserId,
      hourlyRate: user.hourlyRate,
      cin: user.cin,
      rib: user.rib,
      shiftName: user.shift?.name || "Sans Shift"
    },
    transactions
  };
}

export async function deleteDashboardUser(userId: string) {
  const session = await verifyAuth();
  if (session.role !== "SUPERADMIN" && !session.permissions?.canManageSettings) {
    return { success: false, error: "Accès Refusé." };
  }

  if (session.adminId === userId) {
    return { success: false, error: "Vous ne pouvez pas supprimer votre propre compte actif." };
  }

  try {
    await prisma.dashboardUser.delete({
      where: { id: userId }
    });

    revalidatePath("/users");
    return { success: true };
  } catch (err) {
    console.error("Failed to delete dashboard user:", err);
    return { success: false, error: String(err) };
  }
}




