import { prisma } from '../config/database';

export class PunchRepository {
  async upsertPunches(punches: any[]) {
    // We can use createManySkipDuplicates in Postgres for performance
    // or upsert if we need to update data.
    // For raw punches, createManySkipDuplicates is great to avoid clearing device memory.
    const result = await prisma.rawPunch.createMany({
      data: punches,
      skipDuplicates: true,
    });
    return result;
  }

  async getPunchesByDate(date: Date) {
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));
    
    return prisma.rawPunch.findMany({
      where: {
        recordTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: {
        recordTime: 'asc',
      },
    });
  }
}

export const punchRepository = new PunchRepository();
