import { punchRepository } from '../repositories/punch.repository';
import { userRepository } from '../repositories/user.repository';
import { reportRepository } from '../repositories/report.repository';
import { anomalyService } from './anomaly.service';
import { RawPunch, User, Shift } from '@prisma/client';

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
    // Basic Anomaly Checks
    const anomaly = anomalyService.detectAnomalies(punches);
    
    let firstPunchIn = punches.length > 0 ? punches[0]!.recordTime : null;
    let lastPunchOut = punches.length > 0 ? punches[punches.length - 1]!.recordTime : null;

    let regularHours = 0;
    let overtime150Hours = 0;
    let overtime200Hours = 0;
    let status: 'OK' | 'ANOMALY' | 'PENDING' = anomaly.isAnomaly ? 'ANOMALY' : 'OK';

    // If there's an anomaly or no punches, we just log it as is and skip calculation
    if (!anomaly.isAnomaly && firstPunchIn && lastPunchOut && firstPunchIn !== lastPunchOut) {
      const totalHours = (lastPunchOut.getTime() - firstPunchIn.getTime()) / (1000 * 60 * 60);
      const baseHours = user.shift?.baseHours || 8.0;

      // Business Logic: Multi-Tier Overtime
      // 1. If weekend/holiday -> all hours are 200% (simplified implementation)
      const isRestDay = this.isRestDay(date);

      if (isRestDay) {
        overtime200Hours = totalHours;
      } else {
        if (totalHours <= baseHours) {
          regularHours = totalHours;
        } else {
          regularHours = baseHours;
          const overtime = totalHours - baseHours;
          
          // Simplified: first 2 hours of overtime at 150%, rest at 200%
          // Adjust based on specific local laws.
          if (overtime <= 2) {
            overtime150Hours = overtime;
          } else {
            overtime150Hours = 2;
            overtime200Hours = overtime - 2;
          }
        }
      }
    }

    await reportRepository.upsertReport({
      userId: user.id,
      date,
      firstPunchIn,
      lastPunchOut,
      regularHours,
      overtime150Hours,
      overtime200Hours,
      status,
      anomalyReason: anomaly.reason,
    });
  }

  private isRestDay(date: Date) {
    const day = date.getDay();
    // 0 = Sunday, 6 = Saturday
    return day === 0 || day === 6;
  }
}

export const calculationService = new CalculationService();
