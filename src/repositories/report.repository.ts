import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';

export class ReportRepository {
  async upsertReport(data: Prisma.CalculatedDailyReportUncheckedCreateInput) {
    return prisma.calculatedDailyReport.upsert({
      where: {
        userId_date: {
          userId: data.userId,
          date: data.date,
        },
      },
      update: {
        firstPunchIn: data.firstPunchIn,
        lastPunchOut: data.lastPunchOut,
        regularHours: data.regularHours,
        overtime150Hours: data.overtime150Hours,
        overtime200Hours: data.overtime200Hours,
        status: data.status,
        anomalyReason: data.anomalyReason,
      },
      create: data,
    });
  }

  async getReportsByDate(date: Date) {
    return prisma.calculatedDailyReport.findMany({
      where: { date },
      include: { user: true },
    });
  }
}

export const reportRepository = new ReportRepository();
