"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncWorker = exports.SyncWorker = void 0;
const cron_1 = require("cron");
const sync_service_1 = require("../services/sync.service");
const calculation_service_1 = require("../services/calculation.service");
// @ts-ignore
const zkteco_js_1 = __importDefault(require("zkteco-js"));
const DEVICE_IP = '192.168.11.201';
const DEVICE_PORT = 4370;
const DEVICE_TIMEOUT = 10000; // 10 seconds timeout
const MAX_CONNECTION_RETRIES = 3;
const pullFromZKTecoWithRetry = async (retries = MAX_CONNECTION_RETRIES) => {
    const device = new zkteco_js_1.default(DEVICE_IP, DEVICE_PORT, DEVICE_TIMEOUT, 4000);
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`[ZKTeco] Connecting to K14 firmware at ${DEVICE_IP}:${DEVICE_PORT} (Attempt ${attempt}/${retries})...`);
            await device.createSocket();
            console.log('[ZKTeco] Fetching device users...');
            const usersResponse = await device.getUsers();
            const usersArray = usersResponse.data ? usersResponse.data : [];
            const logCount = await device.getAttendanceSize();
            console.log(`[ZKTeco] Logs stored on hardware: ${logCount}`);
            let recordsArray = [];
            if (logCount > 0) {
                const response = await device.getAttendances();
                const rawRecords = response.data ? response.data : response;
                if (rawRecords && Array.isArray(rawRecords)) {
                    recordsArray = rawRecords;
                }
            }
            return { records: recordsArray, users: usersArray };
        }
        catch (error) {
            console.error(`[ZKTeco] Connection attempt ${attempt} failed:`, error);
            if (attempt === retries) {
                throw new Error(`Failed to connect to K14 biometric device after ${retries} attempts.`);
            }
            // Wait before retrying (exponential backoff)
            await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
        }
        finally {
            try {
                await device.disconnect();
            }
            catch (e) { }
        }
    }
    return { records: [], users: [] };
};
class SyncWorker {
    job;
    isRunning = false;
    constructor() {
        // Run every 15 minutes
        this.job = new cron_1.CronJob('*/15 * * * *', this.execute.bind(this));
    }
    start() {
        console.log('[SyncWorker] Starting sync cron job (running every 15 minutes)...');
        this.job.start();
        // Force an immediate execution on boot!
        this.execute();
    }
    stop() {
        console.log('[SyncWorker] Stopping sync cron job...');
        this.job.stop();
    }
    async execute() {
        if (this.isRunning) {
            console.warn('[SyncWorker] A sync iteration is already in progress. Skipping to prevent overlapping execution.');
            return;
        }
        this.isRunning = true;
        console.log(`[SyncWorker] Executing sync at ${new Date().toISOString()}`);
        try {
            // 1. Pull data from device with retry logic
            const { records, users } = await pullFromZKTecoWithRetry();
            console.log(`[SyncWorker] Pulled ${records.length} raw records and ${users.length} users from device.`);
            if (records.length > 0) {
                // 2. Safely sync to postgres
                await sync_service_1.syncService.processIncomingRecords(records, users);
                // 3. Trigger recalculation for the current day
                await calculation_service_1.calculationService.calculateDailyReports(new Date());
                console.log(`[SyncWorker] Sync and calculation completed successfully.`);
            }
            else {
                console.log('[SyncWorker] No new records to sync from the device.');
            }
        }
        catch (error) {
            console.error('[SyncWorker] Error during execution:', error);
        }
        finally {
            this.isRunning = false;
        }
    }
}
exports.SyncWorker = SyncWorker;
exports.syncWorker = new SyncWorker();
