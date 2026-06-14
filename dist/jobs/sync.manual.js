"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sync_service_1 = require("../services/sync.service");
const calculation_service_1 = require("../services/calculation.service");
// @ts-ignore
const zkteco_js_1 = __importDefault(require("zkteco-js"));
const database_1 = require("../config/database");
const pullFromZKTeco = async () => {
    const settings = await database_1.prisma.systemSettings.findFirst();
    const deviceIp = settings?.deviceIp || '192.168.11.201';
    const devicePort = settings?.devicePort || 4370;
    const deviceTimeout = settings?.deviceTimeout || 15000;
    const device = new zkteco_js_1.default(deviceIp, devicePort, deviceTimeout, 4000);
    try {
        console.log(`[ManualSync] Connecting to K14 firmware at ${deviceIp}:${devicePort}...`);
        await device.createSocket();
        console.log('[ManualSync] Fetching device users...');
        const usersResponse = await device.getUsers();
        const usersArray = usersResponse.data ? usersResponse.data : [];
        const logCount = await device.getAttendanceSize();
        console.log(`[ManualSync] Logs stored on hardware: ${logCount}`);
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
        console.error('[ManualSync] Device Data Error:', error);
        return { records: [], users: [] };
    }
    finally {
        try {
            await device.disconnect();
        }
        catch (e) { }
    }
};
async function execute() {
    console.log(`[ManualSync] Executing manual sync at ${new Date().toISOString()}`);
    try {
        const { records, users } = await pullFromZKTeco();
        console.log(`[ManualSync] Pulled ${records.length} raw records and ${users.length} users from device.`);
        if (records.length > 0) {
            await sync_service_1.syncService.processIncomingRecords(records, users);
            await calculation_service_1.calculationService.calculateDailyReports(new Date());
            console.log(`[ManualSync] Sync and calculation completed successfully.`);
        }
        process.exit(0);
    }
    catch (error) {
        console.error('[ManualSync] Error during execution:', error);
        process.exit(1);
    }
}
execute();
