"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncService = exports.SyncService = void 0;
const punch_repository_1 = require("../repositories/punch.repository");
const user_repository_1 = require("../repositories/user.repository");
class SyncService {
    /**
     * Processes an incoming array of raw records and users from the ZKTeco device
     */
    async processIncomingRecords(records, users = []) {
        console.log(`[SyncService] Received ${records.length} records and ${users.length} users to process.`);
        if (!records || records.length === 0)
            return { count: 0 };
        // 1. Ensure all users exist in the database and their names are synced
        const uniqueUserIds = [...new Set(records.map((r) => r.user_id))];
        for (const zktecoUserId of uniqueUserIds) {
            // Find the user data from the device payload if available
            const zktecoData = users.find(u => String(u.userId) === zktecoUserId);
            await user_repository_1.userRepository.ensureUserExists(zktecoUserId, zktecoData);
        }
        // 2. Map ZKTeco records to Prisma RawPunch payload
        const mappedPunches = records.map((record) => {
            // Safely parse the date. Assumes 'record_time' is a valid ISO string or parseable format from the device.
            const recordTime = new Date(record.record_time);
            return {
                sn: record.sn,
                zktecoUserId: record.user_id,
                recordTime,
                type: record.type,
                state: record.state,
                ip: record.ip,
            };
        });
        // 3. Upsert / Create many skip duplicates
        try {
            const result = await punch_repository_1.punchRepository.upsertPunches(mappedPunches);
            console.log(`[SyncService] Successfully synced ${result.count} new punches.`);
            return result;
        }
        catch (error) {
            console.error('[SyncService] Failed to sync punches:', error);
            throw error;
        }
    }
}
exports.SyncService = SyncService;
exports.syncService = new SyncService();
