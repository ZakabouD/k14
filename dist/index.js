"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sync_worker_1 = require("./jobs/sync.worker");
const database_1 = require("./config/database");
async function main() {
    console.log('Starting ZKTeco Attendance & Payroll System...');
    // Start the background synchronization worker
    sync_worker_1.syncWorker.start();
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('Shutting down...');
        sync_worker_1.syncWorker.stop();
        await database_1.prisma.$disconnect();
        process.exit(0);
    });
}
main().catch((e) => {
    console.error(e);
    database_1.prisma.$disconnect();
    process.exit(1);
});
