import { CronJob } from 'cron';
import { deviceApiClient } from '../services/api-client';
import { ZKTecoRecord, ZKTecoUser } from '../types/zkteco.types';
// @ts-ignore
import Zkteco from 'zkteco-js';
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

const getDeviceConfig = () => {
  const ip = process.env.ZKTECO_IP || "192.168.1.201";
  const port = process.env.ZKTECO_PORT ? parseInt(process.env.ZKTECO_PORT, 10) : 4370;
  const timeout = process.env.ZKTECO_TIMEOUT ? parseInt(process.env.ZKTECO_TIMEOUT, 10) : 10000;

  return { ip, port, timeout };
};

const MAX_CONNECTION_RETRIES = 3;

const pullFromZKTecoWithRetry = async (
  retries = MAX_CONNECTION_RETRIES
): Promise<{ records: ZKTecoRecord[]; users: ZKTecoUser[] }> => {
  const { ip, port, timeout } = getDeviceConfig();
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
    const cronExpression = process.env.SYNC_INTERVAL_CRON || '*/15 * * * *';
    this.job = new CronJob(cronExpression, () => this.execute(false));
  }

  start() {
    console.log('[SyncWorker] Starting sync cron job on Raspberry Pi bridge...');
    this.job.start();
    
    // Start polling API for manual sync requests & sending heartbeat every 5 seconds
    this.startManualSyncPolling();

    // Trigger an initial execution on startup
    this.execute(false);
  }

  stop() {
    console.log('[SyncWorker] Stopping sync worker...');
    this.job.stop();
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  startManualSyncPolling() {
    console.log('[SyncWorker] Starting API command polling & heartbeat monitor (every 5s)...');
    this.pollInterval = setInterval(async () => {
      const now = Date.now();
      const { ip, port } = getDeviceConfig();

      // 1. Send periodic Heartbeat to central server (every 10s)
      try {
        if (now - this.lastHeartbeatTime >= 10000) {
          this.lastHeartbeatTime = now;

          // Check device network reachability every 20 seconds
          if (now - this.lastDeviceCheckTime >= 20000) {
            this.lastDeviceCheckTime = now;
            this.isDeviceOnlineCached = await checkDeviceReachable(ip, port, 3000);
          }

          await deviceApiClient.sendHeartbeat(this.isDeviceOnlineCached, ip);
        }
      } catch (error) {
        console.warn('[SyncWorker] Heartbeat transmission error:', error);
      }

      // 2. Poll API for pending manual sync requests
      if (this.isRunning) return;

      try {
        const commands = await deviceApiClient.getCommands();
        if (commands.syncRequested) {
          console.log('[SyncWorker] Manual sync request received from central API!');
          await this.execute(true);
        }
      } catch (error) {
        console.warn('[SyncWorker] Error polling manual sync commands:', error);
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

    const { ip } = getDeviceConfig();

    try {
      // 1. Pull data from hardware device with retry logic
      const { records, users } = await pullFromZKTecoWithRetry();
      console.log(`[SyncWorker] Read ${records.length} punch records and ${users.length} users from hardware.`);

      // 2. Synchronize to central API over HTTPS in safe chunks
      const syncResult = await deviceApiClient.syncRecords(records, users, ip);
      console.log(`[SyncWorker] Sync complete! Stats: Received ${syncResult.received}, Inserted ${syncResult.inserted}, Duplicates ${syncResult.duplicates}`);

      if (isManual) {
        await deviceApiClient.acknowledgeCommand('SYNC', 'SUCCESS');
      }
    } catch (error: any) {
      console.error('[SyncWorker] Error during sync execution:', error);
      if (isManual) {
        await deviceApiClient.acknowledgeCommand('SYNC', 'ERROR', error.message || String(error));
      }
      // Note: Records remain stored on ZKTeco hardware memory and will be retried automatically on next cycle
    } finally {
      this.isRunning = false;
    }
  }
}

export const syncWorker = new SyncWorker();
