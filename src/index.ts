import { syncWorker } from './jobs/sync.worker';

async function main() {
  console.log('Starting ZKTeco Raspberry Pi Sync Bridge...');
  console.log(`Device ID: ${process.env.DEVICE_ID || 'FACTORY-01'}`);
  console.log(`API URL:   ${process.env.API_BASE_URL || 'http://localhost:3000'}`);

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
  console.error('Fatal error starting sync bridge:', e);
  process.exit(1);
});
