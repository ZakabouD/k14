"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportRepository = exports.ReportRepository = void 0;
const database_1 = require("../config/database");
class ReportRepository {
    async upsertReport(data) {
        return database_1.prisma.calculatedDailyReport.upsert({
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
    async getReportsByDate(date) {
        return database_1.prisma.calculatedDailyReport.findMany({
            where: { date },
            include: { user: true },
        });
    }
}
exports.ReportRepository = ReportRepository;
exports.reportRepository = new ReportRepository();
