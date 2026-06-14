import { ZKTecoRecord, ZKTecoUser } from '../types/zkteco.types';
import { punchRepository } from '../repositories/punch.repository';
import { userRepository } from '../repositories/user.repository';

export class SyncService {
  /**
   * Processes an incoming array of raw records and users from the ZKTeco device
   */
  async processIncomingRecords(records: ZKTecoRecord[], users: ZKTecoUser[] = []) {
    console.log(`[SyncService] Received ${records.length} records and ${users.length} users to process.`);

    if (!records || records.length === 0) return { count: 0 };

    // 1. Ensure all users exist in the database and their names are synced
    const uniqueUserIds = [...new Set(records.map((r) => r.user_id))];
    for (const zktecoUserId of uniqueUserIds) {
      // Find the user data from the device payload if available
      const zktecoData = users.find(u => String(u.userId) === zktecoUserId);
      await userRepository.ensureUserExists(zktecoUserId, zktecoData);
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
      const result = await punchRepository.upsertPunches(mappedPunches);
      console.log(`[SyncService] Successfully synced ${result.count} new punches.`);
      return result;
    } catch (error) {
      console.error('[SyncService] Failed to sync punches:', error);
      throw error;
    }
  }
}

export const syncService = new SyncService();
