"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.punchRepository = exports.PunchRepository = void 0;
const database_1 = require("../config/database");
class PunchRepository {
    async upsertPunches(punches) {
        // We can use createManySkipDuplicates in Postgres for performance
        // or upsert if we need to update data.
        // For raw punches, createManySkipDuplicates is great to avoid clearing device memory.
        const result = await database_1.prisma.rawPunch.createMany({
            data: punches,
            skipDuplicates: true,
        });
        return result;
    }
    async getPunchesByDate(date) {
        const startOfDay = new Date(date.setHours(0, 0, 0, 0));
        const endOfDay = new Date(date.setHours(23, 59, 59, 999));
        return database_1.prisma.rawPunch.findMany({
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
exports.PunchRepository = PunchRepository;
exports.punchRepository = new PunchRepository();
