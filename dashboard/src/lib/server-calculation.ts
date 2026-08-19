import { prisma } from "./prisma";

export interface RawPunchData {
  id: string;
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
   * Recalculates reports for all active users across an array of distinct dates.
   */
  async calculateDailyReportsForDates(dates: Date[]) {
    const uniqueDayTimestamps = new Set(
      dates.map(d => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).getTime())
    );

    for (const ts of uniqueDayTimestamps) {
      await this.calculateDailyReports(new Date(ts));
    }
  }

  async calculateDailyReports(date: Date) {
    const startOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));

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
      await this.processUserDailyReport(user as UserWithShift, userPunches, startOfDay);
    }
  }

  private async processUserDailyReport(
    user: UserWithShift,
    punches: RawPunchData[],
    startOfDay: Date
  ) {
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

    // 1. Check for approved leave
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

    // 2. Check for public holiday
    const holiday = await prisma.holiday.findFirst({
      where: {
        date: startOfDay
      }
    });

    let anomaly = serverAnomalyService.detectAnomalies(punches);

    const settings = await prisma.systemSettings.findFirst({
      select: { gracePeriod: true, timezone: true, otThresholdLimit: true }
    });
    const timezone = settings?.timezone || process.env.TIMEZONE || "Africa/Casablanca";
    const gracePeriod = user.shift ? user.shift.gracePeriod : (settings?.gracePeriod ?? 15);

    let firstPunchIn = punches.length > 0 ? punches[0]!.recordTime : null;
    let lastPunchOut = punches.length > 0 ? punches[punches.length - 1]!.recordTime : null;
    let virtualPunchOut = false;

    if (user.shift?.autoClose && punches.length > 0 && firstPunchIn) {
      let baseHours = user.shift.baseHours;
      if (startOfDay.getDay() === 6) {
        baseHours = user.shift.saturdayHours;
      }
      lastPunchOut = new Date(firstPunchIn.getTime() + baseHours * 60 * 60 * 1000);
      virtualPunchOut = true;
      anomaly = { isAnomaly: false, reason: null };
    }

    if (firstPunchIn && user.shift) {
      const localStr = firstPunchIn.toLocaleString("en-US", { timeZone: timezone });
      const localPunch = new Date(localStr);
      const punchMinutes = localPunch.getHours() * 60 + localPunch.getMinutes();

      const [shiftHrs, shiftMins] = user.shift.startTime.split(":").map(Number);
      const shiftMinutes = shiftHrs * 60 + shiftMins;

      const diff = punchMinutes - shiftMinutes;
      if (diff <= gracePeriod) {
        const adjustedPunch = new Date(localPunch);
        adjustedPunch.setHours(shiftHrs, shiftMins, 0, 0);
        const diffMs = localPunch.getTime() - adjustedPunch.getTime();
        firstPunchIn = new Date(firstPunchIn.getTime() - diffMs);
      } else {
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

    let regularHours = 0;
    let overtime150Hours = 0;
    let overtime200Hours = 0;
    let status = anomaly.isAnomaly ? "ANOMALY" : "OK";
    let anomalyReason = anomaly.reason;

    const todayStr = new Date().toLocaleString("en-US", { timeZone: timezone });
    const localToday = new Date(todayStr);
    const utcToday = new Date(Date.UTC(localToday.getFullYear(), localToday.getMonth(), localToday.getDate()));
    const isReportToday = startOfDay.getTime() === utcToday.getTime();

    if (isReportToday && anomaly.isAnomaly && punches.length % 2 !== 0) {
      status = "PENDING";
      anomalyReason = null;
    }

    if (punches.length === 0 && holiday) {
      status = "HOLIDAY";
    }

    if (!anomaly.isAnomaly && firstPunchIn && lastPunchOut && firstPunchIn !== lastPunchOut) {
      let totalHours = 0;
      if (virtualPunchOut && user.shift) {
        totalHours = startOfDay.getDay() === 6 ? user.shift.saturdayHours : user.shift.baseHours;
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
      if (startOfDay.getDay() === 6) {
        baseHours = user.shift ? user.shift.saturdayHours : (baseHours / 2);
      }

      const isRestDay = startOfDay.getDay() === 0 || !!holiday;

      if (isRestDay) {
        overtime200Hours = totalHours;
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
