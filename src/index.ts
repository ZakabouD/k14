import { syncWorker } from './jobs/sync.worker';
import { prisma } from './config/database';

async function main() {
  console.log('Starting ZKTeco Attendance & Payroll System...');

  // Start the background synchronization worker
  syncWorker.start();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    syncWorker.stop();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
