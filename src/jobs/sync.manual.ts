import { deviceApiClient } from '../services/api-client';
import { ZKTecoRecord, ZKTecoUser } from '../types/zkteco.types';
// @ts-ignore
import Zkteco from 'zkteco-js';

const pullFromZKTeco = async (): Promise<{ records: ZKTecoRecord[], users: ZKTecoUser[] }> => {
  const deviceIp = process.env.ZKTECO_IP || "192.168.1.201";
  const devicePort = process.env.ZKTECO_PORT ? parseInt(process.env.ZKTECO_PORT, 10) : 4370;
  const deviceTimeout = process.env.ZKTECO_TIMEOUT ? parseInt(process.env.ZKTECO_TIMEOUT, 10) : 10000;

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
  const deviceIp = process.env.ZKTECO_IP || "192.168.1.201";

  try {
    const { records, users } = await pullFromZKTeco();
    console.log(`[ManualSync] Pulled ${records.length} raw records and ${users.length} users from device.`);

    const syncResult = await deviceApiClient.syncRecords(records, users, deviceIp);
    console.log(`[ManualSync] Sync complete: received=${syncResult.received}, inserted=${syncResult.inserted}, duplicates=${syncResult.duplicates}`);
    process.exit(0);
  } catch (error) {
    console.error('[ManualSync] Error during execution:', error);
    process.exit(1);
  }
}

execute();
