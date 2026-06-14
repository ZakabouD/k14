"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculationService = exports.CalculationService = void 0;
const punch_repository_1 = require("../repositories/punch.repository");
const user_repository_1 = require("../repositories/user.repository");
const report_repository_1 = require("../repositories/report.repository");
const anomaly_service_1 = require("./anomaly.service");
class CalculationService {
    /**
     * Processes the daily punches for all users and calculates reports.
     * Typically called at the end of the day or iteratively.
     */
    async calculateDailyReports(date) {
        const punches = await punch_repository_1.punchRepository.getPunchesByDate(date);
        const users = await user_repository_1.userRepository.getAllUsersWithShifts();
        // Group punches by user
        const punchesByUser = this.groupPunchesByUser(punches);
        for (const user of users) {
            const userPunches = punchesByUser.get(user.zktecoUserId) || [];
            await this.processUserDailyReport(user, userPunches, date);
        }
    }
    groupPunchesByUser(punches) {
        const map = new Map();
        for (const punch of punches) {
            const arr = map.get(punch.zktecoUserId) || [];
            arr.push(punch);
            map.set(punch.zktecoUserId, arr);
        }
        return map;
    }
    async processUserDailyReport(user, punches, date) {
        // Basic Anomaly Checks
        const anomaly = anomaly_service_1.anomalyService.detectAnomalies(punches);
        let firstPunchIn = punches.length > 0 ? punches[0].recordTime : null;
        let lastPunchOut = punches.length > 0 ? punches[punches.length - 1].recordTime : null;
        let regularHours = 0;
        let overtime150Hours = 0;
        let overtime200Hours = 0;
        let status = anomaly.isAnomaly ? 'ANOMALY' : 'OK';
        // If there's an anomaly or no punches, we just log it as is and skip calculation
        if (!anomaly.isAnomaly && firstPunchIn && lastPunchOut && firstPunchIn !== lastPunchOut) {
            const totalHours = (lastPunchOut.getTime() - firstPunchIn.getTime()) / (1000 * 60 * 60);
            const baseHours = user.shift?.baseHours || 8.0;
            // Business Logic: Multi-Tier Overtime
            // 1. If weekend/holiday -> all hours are 200% (simplified implementation)
            const isRestDay = this.isRestDay(date);
            if (isRestDay) {
                overtime200Hours = totalHours;
            }
            else {
                if (totalHours <= baseHours) {
                    regularHours = totalHours;
                }
                else {
                    regularHours = baseHours;
                    const overtime = totalHours - baseHours;
                    // Simplified: first 2 hours of overtime at 150%, rest at 200%
                    // Adjust based on specific local laws.
                    if (overtime <= 2) {
                        overtime150Hours = overtime;
                    }
                    else {
                        overtime150Hours = 2;
                        overtime200Hours = overtime - 2;
                    }
                }
            }
        }
        await report_repository_1.reportRepository.upsertReport({
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
    isRestDay(date) {
        const day = date.getDay();
        // 0 = Sunday, 6 = Saturday
        return day === 0 || day === 6;
    }
}
exports.CalculationService = CalculationService;
exports.calculationService = new CalculationService();
