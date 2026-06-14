import { syncService } from '../services/sync.service';
import { calculationService } from '../services/calculation.service';
import { ZKTecoRecord, ZKTecoUser } from '../types/zkteco.types';
// @ts-ignore
import Zkteco from 'zkteco-js';

import { prisma } from '../config/database';

const pullFromZKTeco = async (): Promise<{ records: ZKTecoRecord[], users: ZKTecoUser[] }> => {
  const settings = await prisma.systemSettings.findFirst();
  const deviceIp = settings?.deviceIp || '192.168.11.201';
  const devicePort = settings?.devicePort || 4370;
  const deviceTimeout = settings?.deviceTimeout || 15000;

  const device = new Zkteco(deviceIp, devicePort, deviceTimeout, 4000);
  try {
    console.log(`[ManualSync] Connecting to K14 firmware at ${deviceIp}:${devicePort}...`);
    await device.createSocket();
    
    console.log('[ManualSync] Fetching device users...');
    const usersResponse = await device.getUsers();
    const usersArray = usersResponse.data ? usersResponse.data : [];

    const logCount = await device.getAttendanceSize();
    console.log(`[ManualSync] Logs stored on hardware: ${logCount}`);

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
    console.error('[ManualSync] Device Data Error:', error);
    return { records: [], users: [] };
  } finally {
    try {
      await device.disconnect();
    } catch (e) {}
  }
};

async function execute() {
  console.log(`[ManualSync] Executing manual sync at ${new Date().toISOString()}`);
  try {
    const { records, users } = await pullFromZKTeco();
    console.log(`[ManualSync] Pulled ${records.length} raw records and ${users.length} users from device.`);

    if (records.length > 0) {
      await syncService.processIncomingRecords(records, users);
      await calculationService.calculateDailyReports(new Date());
      console.log(`[ManualSync] Sync and calculation completed successfully.`);
    }
    process.exit(0);
  } catch (error) {
    console.error('[ManualSync] Error during execution:', error);
    process.exit(1);
  }
}

execute();
