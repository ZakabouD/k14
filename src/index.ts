import 'dotenv/config';
import { assertRuntimeTimezone } from './config/timezone';
import { assertWorkerConfig } from './config/worker-config';
import { syncWorker } from './jobs/sync.worker';

async function main() {
  console.log('============================================================');
  console.log(' Starting ZKTeco Raspberry Pi Sync Bridge...');
  console.log('============================================================');

  // Pre-flight validation 1: Enforce strict Morocco IANA timezone
  assertRuntimeTimezone();

  // Pre-flight validation 2: Enforce complete worker environment configuration
  const config = assertWorkerConfig();

  console.log(` Device ID:    ${config.deviceId}`);
  console.log(` API Endpoint: ${config.apiBaseUrl}`);
  console.log(` Terminal IP:  ${config.zktecoIp}:${config.zktecoPort}`);
  console.log(` Sync Cron:    ${config.syncIntervalCron}`);
  console.log('============================================================\n');

  // Start the background synchronization worker
  syncWorker.start();

  // Handle graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down ZKTeco Sync Bridge...');
    syncWorker.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('Fatal error starting sync bridge:', e.message || e);
  process.exit(1);
});
