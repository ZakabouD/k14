import { punchRepository } from '../repositories/punch.repository';
import { userRepository } from '../repositories/user.repository';
import { reportRepository } from '../repositories/report.repository';
import { anomalyService } from './anomaly.service';
import { RawPunch, User, Shift } from '@prisma/client';
import { prisma } from '../config/database';

export class CalculationService {
  /**
   * Processes the daily punches for all users and calculates reports.
   * Typically called at the end of the day or iteratively.
   */
  async calculateDailyReports(date: Date) {
    const punches = await punchRepository.getPunchesByDate(date);
    const users = await userRepository.getAllUsersWithShifts();

    // Group punches by user
    const punchesByUser = this.groupPunchesByUser(punches);

    for (const user of users) {
      const userPunches = punchesByUser.get(user.zktecoUserId) || [];
      await this.processUserDailyReport(user, userPunches, date);
    }
  }

  /**
   * Recalculates daily reports for a specific artisan and a date range.
   * Useful when leaves are created/updated/deleted or settings changed.
   */
  async recalculateReportsForUserAndRange(userId: string, startDate: Date, endDate: Date) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { shift: true }
    });
    if (!user) return;

    const current = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

    while (current <= end) {
      const startOfDay = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate(), 0, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate(), 23, 59, 59, 999));

      // Fetch punches for this day
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

      await this.processUserDailyReport(user, punches, startOfDay);

      // Advance one day
      current.setDate(current.getDate() + 1);
    }
  }

  private groupPunchesByUser(punches: RawPunch[]) {
    const map = new Map<string, RawPunch[]>();
    for (const punch of punches) {
      const arr = map.get(punch.zktecoUserId) || [];
      arr.push(punch);
      map.set(punch.zktecoUserId, arr);
    }
    return map;
  }

  private async processUserDailyReport(
    user: User & { shift: Shift | null },
    punches: RawPunch[],
    date: Date
  ) {
    const startOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));

    // Check if the report has already been manually RESOLVED by the administrator
    const existingReport = await reportRepository.getReport(user.id, startOfDay);
    if (existingReport && (existingReport.status === 'RESOLVED' || existingReport.status as string === 'RESOLVED')) {
      return;
    }

    // 1. Check for approved leave
    const approvedLeave = await prisma.leave.findFirst({
      where: {
        userId: user.id,
        status: 'APPROVED',
        startDate: { lte: startOfDay },
        endDate: { gte: startOfDay }
      }
    });

    if (approvedLeave) {
      await reportRepository.upsertReport({
        userId: user.id,
        date: startOfDay,
        firstPunchIn: null,
        lastPunchOut: null,
        regularHours: 0,
        overtime150Hours: 0,
        overtime200Hours: 0,
        status: 'LEAVE',
        anomalyReason: null
      });
      return;
    }

    // 2. Check for public holiday
    const holiday = await prisma.holiday.findFirst({
      where: {
        date: startOfDay
      }
    });

    // Basic Anomaly Checks
    let anomaly = anomalyService.detectAnomalies(punches);
    
    const settings = await prisma.systemSettings.findFirst({ select: { gracePeriod: true, timezone: true } });
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
      const moroccoPunchStr = firstPunchIn.toLocaleString("en-US", { timeZone: timezone });
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
    let status: 'OK' | 'ANOMALY' | 'PENDING' | 'LEAVE' | 'HOLIDAY' = anomaly.isAnomaly ? 'ANOMALY' : 'OK';
    let anomalyReason = anomaly.reason;

    // If the report date is today and they have an odd number of punches, it is not an anomaly (they are currently working)
    const moroccoTodayStr = new Date().toLocaleString("en-US", { timeZone: timezone });
    const localToday = new Date(moroccoTodayStr);
    const utcToday = new Date(Date.UTC(localToday.getFullYear(), localToday.getMonth(), localToday.getDate()));
    const isReportToday = startOfDay.getTime() === utcToday.getTime();

    if (isReportToday && anomaly.isAnomaly && punches.length % 2 !== 0) {
      status = 'PENDING';
      anomalyReason = null;
    }

    // If no punches and it is a holiday, save as HOLIDAY
    if (punches.length === 0 && holiday) {
      status = 'HOLIDAY';
    }

    // If there's no anomaly and we have punches, calculate hours
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

      // Saturday hours configuration
      if (startOfDay.getDay() === 6) {
        baseHours = user.shift ? user.shift.saturdayHours : (baseHours / 2);
      }

      // Business Logic: Multi-Tier Overtime
      // 1. If Sunday or public holiday -> all hours are 200%
      const isRestDay = this.isRestDay(startOfDay) || !!holiday;

      if (isRestDay) {
        overtime200Hours = totalHours;
        if (holiday) {
          status = 'HOLIDAY';
        }
      } else {
        if (totalHours <= baseHours) {
          regularHours = totalHours;
        } else {
          regularHours = baseHours;
          const settings = await prisma.systemSettings.findFirst({
            select: { otThresholdLimit: true }
          });
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

    await reportRepository.upsertReport({
      userId: user.id,
      date: startOfDay,
      firstPunchIn,
      lastPunchOut,
      regularHours,
      overtime150Hours,
      overtime200Hours,
      status,
      anomalyReason,
    });
  }

  private isRestDay(date: Date) {
    const day = date.getDay();
    // 0 = Sunday (Weekly rest day in Morocco)
    return day === 0;
  }
}

export const calculationService = new CalculationService();
