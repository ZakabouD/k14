"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.anomalyService = exports.AnomalyService = void 0;
class AnomalyService {
    /**
     * Evaluates a daily set of punches for edge cases and anomalies
     */
    detectAnomalies(punches) {
        if (punches.length === 0) {
            return { isAnomaly: false, reason: null }; // Absence, handled elsewhere if needed
        }
        if (punches.length % 2 !== 0) {
            return {
                isAnomaly: true,
                reason: 'Odd number of punches. Missing punch out or extra punch in.',
            };
        }
        const firstPunch = punches[0];
        const lastPunch = punches[punches.length - 1];
        if (!firstPunch || !lastPunch) {
            return { isAnomaly: true, reason: 'Missing punch data despite array length.' };
        }
        const hours = (lastPunch.recordTime.getTime() - firstPunch.recordTime.getTime()) / (1000 * 60 * 60);
        // Safeguard for extreme durations (e.g. forgot to check out and checked out next day by mistake)
        if (hours > 16) {
            return {
                isAnomaly: true,
                reason: `Exceedingly long shift duration detected: ${hours.toFixed(2)} hours.`,
            };
        }
        if (hours === 0 && punches.length > 1) {
            return {
                isAnomaly: true,
                reason: 'Multiple punches recorded at the exact same time.',
            };
        }
        return { isAnomaly: false, reason: null };
    }
}
exports.AnomalyService = AnomalyService;
exports.anomalyService = new AnomalyService();
