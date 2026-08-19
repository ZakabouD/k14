import { CronJob } from 'cron';
import { syncService } from '../services/sync.service';
import { calculationService } from '../services/calculation.service';
import { ZKTecoRecord, ZKTecoUser } from '../types/zkteco.types';
// @ts-ignore
import Zkteco from 'zkteco-js';
import { prisma } from '../config/database';
import net from 'net';

function checkDeviceReachable(ip: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    socket.setTimeout(timeoutMs);

    socket.connect(port, ip, () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(true);
      }
    });

    const handleFailure = () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(false);
      }
    };

    socket.on('error', handleFailure);
    socket.on('timeout', handleFailure);
  });
}

const getDeviceConfig = async () => {
  const envIp = process.env.ZKTECO_IP;
  const envPort = process.env.ZKTECO_PORT ? parseInt(process.env.ZKTECO_PORT, 10) : undefined;
  const envTimeout = process.env.ZKTECO_TIMEOUT ? parseInt(process.env.ZKTECO_TIMEOUT, 10) : undefined;

  let dbIp: string | undefined;
  let dbPort: number | undefined;
  let dbTimeout: number | undefined;

  try {
    const settings = await prisma.systemSettings.findFirst({
      select: { deviceIp: true, devicePort: true, deviceTimeout: true }
    });
    if (settings) {
      dbIp = settings.deviceIp;
      dbPort = settings.devicePort;
      dbTimeout = settings.deviceTimeout;
    }
  } catch (e) {}

  return {
    ip: envIp || dbIp || "192.168.1.201",
    port: envPort || dbPort || 4370,
    timeout: envTimeout || dbTimeout || 10000
  };
};

const MAX_CONNECTION_RETRIES = 3;

const pullFromZKTecoWithRetry = async (
  retries = MAX_CONNECTION_RETRIES
): Promise<{ records: ZKTecoRecord[]; users: ZKTecoUser[] }> => {
  const { ip, port, timeout } = await getDeviceConfig();
  const device = new Zkteco(ip, port, timeout, 4000);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[ZKTeco] Connecting to terminal at ${ip}:${port} (Attempt ${attempt}/${retries})...`);
      await device.createSocket();
      
      console.log("[ZKTeco] Fetching device users...");
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
        throw new Error(`Failed to connect to biometric device at ${ip}:${port} after ${retries} attempts.`);
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
  
  private lastHeartbeatTime = 0;
  private lastDeviceCheckTime = 0;
  private isDeviceOnlineCached = false;

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
    console.log('[SyncWorker] Starting manual sync requests polling, heartbeat & device connection checks (every 5 seconds)...');
    this.pollInterval = setInterval(async () => {
      // 1. Database Heartbeat & ZKTeco device connection checks
      try {
        const now = Date.now();
        if (now - this.lastHeartbeatTime >= 10000) {
          this.lastHeartbeatTime = now;

          // Test device connection status every 20 seconds
          if (now - this.lastDeviceCheckTime >= 20000) {
            this.lastDeviceCheckTime = now;

            const { ip, port } = await getDeviceConfig();
            this.isDeviceOnlineCached = await checkDeviceReachable(ip, port, 3000);
          }

          await prisma.systemSettings.update({
            where: { id: "singleton" },
            data: {
              lastHeartbeat: new Date(),
              deviceOnline: this.isDeviceOnlineCached
            }
          });
        }
      } catch (error) {
        console.error('[SyncWorker] Error in heartbeat/device check:', error);
      }

      // 2. Poll for manual sync requests
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


