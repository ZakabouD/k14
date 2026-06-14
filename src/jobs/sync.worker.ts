import { CronJob } from 'cron';
import { syncService } from '../services/sync.service';
import { calculationService } from '../services/calculation.service';
import { ZKTecoRecord, ZKTecoUser } from '../types/zkteco.types';
// @ts-ignore
import Zkteco from 'zkteco-js';
import { prisma } from '../config/database';

const DEVICE_IP = '192.168.11.201';
const DEVICE_PORT = 4370;
const DEVICE_TIMEOUT = 10000; // 10 seconds timeout
const MAX_CONNECTION_RETRIES = 3;

const pullFromZKTecoWithRetry = async (
  retries = MAX_CONNECTION_RETRIES
): Promise<{ records: ZKTecoRecord[]; users: ZKTecoUser[] }> => {
  const device = new Zkteco(DEVICE_IP, DEVICE_PORT, DEVICE_TIMEOUT, 4000);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[ZKTeco] Connecting to K14 firmware at ${DEVICE_IP}:${DEVICE_PORT} (Attempt ${attempt}/${retries})...`);
      await device.createSocket();
      
      console.log('[ZKTeco] Fetching device users...');
      const usersResponse = await device.getUsers();
      const usersArray = usersResponse.data ? usersResponse.data : [];

      const logCount = await device.getAttendanceSize();
      console.log(`[ZKTeco] Logs stored on hardware: ${logCount}`);

      let recordsArray: ZKTecoRecord[] = [];
      if (logCount > 0) {
        const response = await device.getAttendances();
        const rawRecords = response.data ? response.data : response;

        if (rawRecords && Array.isArray(rawRecords)) {
          recordsArray = rawRecords as ZKTecoRecord[];
        }
      }
      return { records: recordsArray, users: usersArray as ZKTecoUser[] };
    } catch (error) {
      console.error(`[ZKTeco] Connection attempt ${attempt} failed:`, error);
      if (attempt === retries) {
        throw new Error(`Failed to connect to K14 biometric device after ${retries} attempts.`);
      }
      // Wait before retrying (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
    } finally {
      try {
        await device.disconnect();
      } catch (e) {}
    }
  }
  return { records: [], users: [] };
};

export class SyncWorker {
  private job: CronJob;
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Run every 15 minutes
    this.job = new CronJob('*/15 * * * *', () => this.execute(false));
  }

  start() {
    console.log('[SyncWorker] Starting sync cron job (running every 15 minutes)...');
    this.job.start();
    
    // Start polling database for manual sync requests every 5 seconds
    this.startManualSyncPolling();

    // Force an immediate execution on boot!
    this.execute(false);
  }

  stop() {
    console.log('[SyncWorker] Stopping sync cron job...');
    this.job.stop();
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  startManualSyncPolling() {
    console.log('[SyncWorker] Starting manual sync requests polling (every 5 seconds)...');
    this.pollInterval = setInterval(async () => {
      if (this.isRunning) return;

      try {
        const settings = await prisma.systemSettings.findFirst({
          select: { id: true, syncRequested: true }
        });

        if (settings?.syncRequested) {
          console.log('[SyncWorker] Manual sync request detected!');
          await this.execute(true);
        }
      } catch (error) {
        console.error('[SyncWorker] Error polling manual sync requests:', error);
      }
    }, 5000);
  }

  async execute(isManual = false) {
    if (this.isRunning) {
      console.warn('[SyncWorker] A sync iteration is already in progress. Skipping to prevent overlapping execution.');
      return;
    }

    this.isRunning = true;
    console.log(`[SyncWorker] Executing ${isManual ? 'manual ' : ''}sync at ${new Date().toISOString()}`);

    if (isManual) {
      try {
        await prisma.systemSettings.update({
          where: { id: "singleton" },
          data: {
            syncRequested: false, // Consume request immediately
            syncStatus: "RUNNING"
          }
        });
      } catch (e) {
        console.error('[SyncWorker] Failed to update sync status to RUNNING:', e);
      }
    }

    try {
      // 1. Pull data from device with retry logic
      const { records, users } = await pullFromZKTecoWithRetry();
      console.log(`[SyncWorker] Pulled ${records.length} raw records and ${users.length} users from device.`);

      // 2. Safely sync to postgres
      if (records.length > 0) {
        await syncService.processIncomingRecords(records, users);
      }
      
      // 3. Trigger recalculation for the current day
      await calculationService.calculateDailyReports(new Date());
      console.log(`[SyncWorker] Sync and calculation completed successfully.`);

      if (isManual) {
        await prisma.systemSettings.update({
          where: { id: "singleton" },
          data: {
            syncStatus: "SUCCESS",
            syncError: null
          }
        });
      }
    } catch (error: any) {
      console.error('[SyncWorker] Error during execution:', error);
      if (isManual) {
        try {
          await prisma.systemSettings.update({
            where: { id: "singleton" },
            data: {
              syncStatus: "ERROR",
              syncError: error.message || String(error)
            }
          });
        } catch (e) {
          console.error('[SyncWorker] Failed to report manual sync error to database:', e);
        }
      }
    } finally {
      this.isRunning = false;
    }
  }
}

export const syncWorker = new SyncWorker();


