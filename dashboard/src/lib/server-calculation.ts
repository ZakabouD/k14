import { prisma } from "./prisma";
import {
  getCompanyTimezone,
  getCompanyDayStart,
  getCompanyDayEnd,
  isCompanySunday,
  isCompanySaturday,
  getCompanyTimeMinutes,
} from "./date-utils";

export interface RawPunchData {
  id?: string;
  sn: number;
  zktecoUserId: string;
  recordTime: Date;
  type: number;
  state: number;
  ip: string;
}

export interface UserWithShift {
  id: string;
  zktecoUserId: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  shiftId: string | null;
  shift: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    baseHours: number;
    gracePeriod: number;
    lunchBreak: number;
    autoClose: boolean;
    saturdayHours: number;
  } | null;
}

export interface PayrollCalculationInput {
  date: Date;
  firstPunchIn: Date | null;
  lastPunchOut: Date | null;
  punchesCount?: number;
  rawDurationHours?: number;
  shift: UserWithShift["shift"] | null;
  holiday: any | null;
  timezone: string;
  settings: {
    otThresholdLimit?: number | null;
    gracePeriod?: number | null;
  } | null;
  virtualPunchOut?: boolean;
}

export interface PayrollCalculationOutput {
  regularHours: number;
  overtime150Hours: number;
  overtime200Hours: number;
  totalHours: number;
  status: string;
}

/**
 * Canonical pure payroll calculation function.
 * Single source of truth for:
 * 1. Automated daily report generation from sync
 * 2. Manual date-range recalculations
 * 3. Administrative anomaly resolutions
 */
export function calculateCanonicalPayroll(input: PayrollCalculationInput): PayrollCalculationOutput {
  const {
    date,
    firstPunchIn,
    lastPunchOut,
    punchesCount = 2,
    rawDurationHours,
    shift,
    holiday,
    timezone,
    settings,
    virtualPunchOut = false
  } = input;

  let totalHours = 0;
  if (virtualPunchOut && shift) {
    totalHours = isCompanySaturday(date, timezone) ? shift.saturdayHours : shift.baseHours;
  } else if (firstPunchIn && lastPunchOut && firstPunchIn.getTime() !== lastPunchOut.getTime()) {
    let rawHours = rawDurationHours;
    if (rawHours === undefined) {
      rawHours = Math.max(0, lastPunchOut.getTime() - firstPunchIn.getTime()) / (1000 * 60 * 60);
    }
    const lunchBreakMinutes = shift?.lunchBreak ?? 0;
    totalHours = (punchesCount === 2 && rawHours > 5.0 && lunchBreakMinutes > 0)
      ? Math.max(0, rawHours - (lunchBreakMinutes / 60))
      : rawHours;
  }

  let regularHours = 0;
  let overtime150Hours = 0;
  let overtime200Hours = 0;
  let status = holiday ? "HOLIDAY" : "OK";

  let baseHours = shift?.baseHours || 8.0;
  if (isCompanySaturday(date, timezone)) {
    baseHours = shift ? shift.saturdayHours : (baseHours / 2);
  }

  // Preserved Business Rule: Sundays & Public Holidays are 200% overtime
  const isRestDayOrHoliday = isCompanySunday(date, timezone) || !!holiday;

  if (isRestDayOrHoliday) {
    overtime200Hours = totalHours;
    regularHours = 0;
    overtime150Hours = 0;
    if (holiday) {
      status = "HOLIDAY";
    }
  } else {
    if (totalHours <= baseHours) {
      regularHours = totalHours;
    } else {
      regularHours = baseHours;
      const threshold = settings?.otThresholdLimit ?? 2.0;
      const overtime = totalHours - baseHours;
      if (overtime <= threshold) {
        overtime150Hours = overtime;
      } else {
        overtime150Hours = threshold;
        overtime200Hours = overtime - threshold;
      }
    }
  }

  return {
    regularHours: Number(regularHours.toFixed(2)),
    overtime150Hours: Number(overtime150Hours.toFixed(2)),
    overtime200Hours: Number(overtime200Hours.toFixed(2)),
    totalHours: Number(totalHours.toFixed(2)),
    status
  };
}

export class ServerAnomalyService {
  detectAnomalies(punches: RawPunchData[]): { isAnomaly: boolean; reason: string | null } {
    if (punches.length === 0) {
      return { isAnomaly: false, reason: null };
    }

    if (punches.length % 2 !== 0) {
      return {
        isAnomaly: true,
        reason: "Odd number of punches. Missing punch out or extra punch in.",
      };
    }

    const firstPunch = punches[0];
    const lastPunch = punches[punches.length - 1];

    if (!firstPunch || !lastPunch) {
      return { isAnomaly: true, reason: "Missing punch data despite array length." };
    }

    const hours = (lastPunch.recordTime.getTime() - firstPunch.recordTime.getTime()) / (1000 * 60 * 60);

    if (hours > 16) {
      return {
        isAnomaly: true,
        reason: `Exceedingly long shift duration detected: ${hours.toFixed(2)} hours.`,
      };
    }

    if (hours === 0 && punches.length > 1) {
      return {
        isAnomaly: true,
        reason: "Multiple punches recorded at the exact same time.",
      };
    }

    return { isAnomaly: false, reason: null };
  }
}

export const serverAnomalyService = new ServerAnomalyService();

export class ServerCalculationService {
  /**
   * Recalculates reports for all active users across an array of distinct dates (e.g. from punch sync).
   */
  async calculateDailyReportsForDates(dates: Date[]) {
    const settings = await prisma.systemSettings.findFirst({
      select: { timezone: true }
    });
    const timezone = getCompanyTimezone(settings?.timezone);

    // Group dates into unique company-local midnight timestamps
    const uniqueDayTimestamps = new Set(
      dates.map(d => getCompanyDayStart(d, timezone).getTime())
    );

    for (const ts of uniqueDayTimestamps) {
      await this.calculateDailyReports(new Date(ts));
    }
  }

  /**
   * Calculates daily reports for all active users for a single company-local date.
   */
  async calculateDailyReports(date: Date) {
    const settings = await prisma.systemSettings.findFirst({
      select: { timezone: true, gracePeriod: true, otThresholdLimit: true }
    });
    const timezone = getCompanyTimezone(settings?.timezone);

    const startOfDay = getCompanyDayStart(date, timezone);
    const endOfDay = getCompanyDayEnd(date, timezone);

    const punches = await prisma.rawPunch.findMany({
      where: {
        recordTime: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      orderBy: { recordTime: "asc" }
    });

    const users = await prisma.user.findMany({
      where: { isActive: true },
      include: { shift: true }
    });

    const punchesByUser = new Map<string, RawPunchData[]>();
    for (const p of punches) {
      const arr = punchesByUser.get(p.zktecoUserId) || [];
      arr.push(p);
      punchesByUser.set(p.zktecoUserId, arr);
    }

    for (const user of users) {
      const userPunches = punchesByUser.get(user.zktecoUserId) || [];
      await this.processUserDailyReport(user as UserWithShift, userPunches, startOfDay, timezone, settings);
    }
  }

  /**
   * Recalculates daily reports for a single artisan across a date range.
   * Preserves RESOLVED reports and updates leaves/holidays/anomalies/overtime consistently.
   */
  async recalculateUserRange(userId: string, startDate: Date, endDate: Date) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { shift: true }
    });
    if (!user) return;

    const settings = await prisma.systemSettings.findFirst({
      select: { timezone: true, gracePeriod: true, otThresholdLimit: true }
    });
    const timezone = getCompanyTimezone(settings?.timezone);

    const startLocal = getCompanyDayStart(startDate, timezone);
    const endLocal = getCompanyDayStart(endDate, timezone);

    const current = new Date(startLocal.getTime());

    while (current.getTime() <= endLocal.getTime()) {
      const dayStart = new Date(current.getTime());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

      const punches = await prisma.rawPunch.findMany({
        where: {
          zktecoUserId: user.zktecoUserId,
          recordTime: {
            gte: dayStart,
            lte: dayEnd
          }
        },
        orderBy: { recordTime: "asc" }
      });

      await this.processUserDailyReport(user as UserWithShift, punches, dayStart, timezone, settings);

      // Advance one day (24 hours UTC)
      current.setUTCDate(current.getUTCDate() + 1);
    }
  }

  private async processUserDailyReport(
    user: UserWithShift,
    punches: RawPunchData[],
    startOfDay: Date,
    timezone: string,
    settings: any
  ) {
    // 1. Check for manual resolution override
    const existingReport = await prisma.calculatedDailyReport.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date: startOfDay
        }
      }
    });

    if (existingReport && (existingReport.status === "RESOLVED" || (existingReport.status as string) === "RESOLVED")) {
      return;
    }

    // 2. Check for approved leave (takes precedence)
    const approvedLeave = await prisma.leave.findFirst({
      where: {
        userId: user.id,
        status: "APPROVED",
        startDate: { lte: startOfDay },
        endDate: { gte: startOfDay }
      }
    });

    if (approvedLeave) {
      await prisma.calculatedDailyReport.upsert({
        where: {
          userId_date: {
            userId: user.id,
            date: startOfDay
          }
        },
        update: {
          firstPunchIn: null,
          lastPunchOut: null,
          regularHours: 0,
          overtime150Hours: 0,
          overtime200Hours: 0,
          status: "LEAVE",
          anomalyReason: null
        },
        create: {
          userId: user.id,
          date: startOfDay,
          firstPunchIn: null,
          lastPunchOut: null,
          regularHours: 0,
          overtime150Hours: 0,
          overtime200Hours: 0,
          status: "LEAVE",
          anomalyReason: null
        }
      });
      return;
    }

    // 3. Check for public holiday
    const holiday = await prisma.holiday.findFirst({
      where: {
        date: startOfDay
      }
    });

    let anomaly = serverAnomalyService.detectAnomalies(punches);
    const gracePeriod = user.shift ? user.shift.gracePeriod : (settings?.gracePeriod ?? 15);

    let firstPunchIn = punches.length > 0 ? punches[0]!.recordTime : null;
    let lastPunchOut = punches.length > 0 ? punches[punches.length - 1]!.recordTime : null;
    let virtualPunchOut = false;

    // Auto-close shift handling
    if (user.shift?.autoClose && punches.length > 0 && firstPunchIn) {
      let baseHours = user.shift.baseHours;
      if (isCompanySaturday(startOfDay, timezone)) {
        baseHours = user.shift.saturdayHours;
      }
      lastPunchOut = new Date(firstPunchIn.getTime() + baseHours * 60 * 60 * 1000);
      virtualPunchOut = true;
      anomaly = { isAnomaly: false, reason: null };
    }

    // Shift start grace period and delay adjustment
    if (firstPunchIn && user.shift) {
      const punchMinutes = getCompanyTimeMinutes(firstPunchIn, timezone);
      const [shiftHrs, shiftMins] = user.shift.startTime.split(":").map(Number);
      const shiftMinutes = (shiftHrs || 0) * 60 + (shiftMins || 0);

      const diff = punchMinutes - shiftMinutes;
      if (diff <= gracePeriod) {
        // Tolerated arrival: align first punch exactly to shift start time
        firstPunchIn = new Date(firstPunchIn.getTime() - diff * 60 * 1000);
      } else {
        // Penalized delay: deduct integer penalty hours
        const hoursLate = Math.floor(diff / 60);
        const minutesOfHour = diff % 60;
        let penaltyHours = hoursLate;
        if (minutesOfHour > gracePeriod) {
          penaltyHours += 1;
        }
        const penaltyMinutes = penaltyHours * 60;
        const adjustedDiff = diff - penaltyMinutes;
        firstPunchIn = new Date(firstPunchIn.getTime() - adjustedDiff * 60 * 1000);
      }
    }

    let regularHours = 0;
    let overtime150Hours = 0;
    let overtime200Hours = 0;
    let status = anomaly.isAnomaly ? "ANOMALY" : "OK";
    let anomalyReason = anomaly.reason;

    // Ongoing work check for today
    const now = new Date();
    const todayStart = getCompanyDayStart(now, timezone);
    const isReportToday = startOfDay.getTime() === todayStart.getTime();

    if (isReportToday && anomaly.isAnomaly && punches.length % 2 !== 0) {
      status = "PENDING";
      anomalyReason = null;
    }

    // Holiday absence check
    if (punches.length === 0 && holiday) {
      status = "HOLIDAY";
    }

    // Working hours calculation using canonical pure payroll function
    if (!anomaly.isAnomaly && firstPunchIn && lastPunchOut && firstPunchIn !== lastPunchOut) {
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

      const payroll = calculateCanonicalPayroll({
        date: startOfDay,
        firstPunchIn,
        lastPunchOut,
        punchesCount: punches.length,
        rawDurationHours: rawHours,
        shift: user.shift,
        holiday,
        timezone,
        settings,
        virtualPunchOut
      });

      regularHours = payroll.regularHours;
      overtime150Hours = payroll.overtime150Hours;
      overtime200Hours = payroll.overtime200Hours;
      if (!anomaly.isAnomaly && holiday) {
        status = payroll.status;
      }
    }

    await prisma.calculatedDailyReport.upsert({
      where: {
        userId_date: {
          userId: user.id,
          date: startOfDay
        }
      },
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
        userId: user.id,
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
  }
}

export const serverCalculationService = new ServerCalculationService();
