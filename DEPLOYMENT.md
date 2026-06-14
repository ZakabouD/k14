# ZKTeco Sync Bridge - Raspberry Pi 4 Deployment Log

This document serves as the official operational guide and record of the standalone TypeScript daemon deployment on the headless Raspberry Pi 4 Model B bridge.

---

## 1. Node & System Context
* **Raspberry Pi IP Address**: `192.168.11.175`
* **Headless Deployment Path**: `/home/pi/zkteco-sync-worker`
* **ZKTeco K14 Hardware IP**: `192.168.11.201` (Port `4370`)
* **Active Node.js Version**: `v20.20.2`
* **Active NPM Version**: `10.8.2`

---

## 2. Daemon Process Control (PM2)
The sync bridge is managed by the PM2 process manager to ensure automatic restart on failures and persistence across system reboots.

* **Process Name**: `zkteco-sync-worker`
* **Startup File**: `dist/index.js`
* **Daemon Executable Mode**: Fork Mode

### Diagnostic Commands (To run on the Raspberry Pi)
```bash
# View real-time output and error logs
pm2 logs zkteco-sync-worker

# Check status, memory footprint, and restarts
pm2 status

# Restart the synchronization daemon
pm2 restart zkteco-sync-worker

# Stop the daemon
pm2 stop zkteco-sync-worker

# Make PM2 restart at boot time (if configuration changes)
pm2 startup
pm2 save
```

---

## 3. Deployment Exclusions & Optimizations
To maintain the required minimal footprint on the Raspberry Pi, the bridge has been configured with the following optimizations:

1. **Frontend Exclusion**: The Next.js frontend code and the large `dashboard/` directory are completely excluded from the Pi.
2. **Production Dependency Loading**: The app installs Node.js packages using `npm install --omit=dev`. This filters out development modules, saving disk space and speeding up memory execution.
3. **Compilation Scope Restructuring**: `tsconfig.json` has been updated to exclude `src/scripts/**/*` (the database seed script). Because the seed script depends on `bcrypt` (which requires `@types/bcrypt` to compile), excluding it enables TypeScript to compile successfully in a production environment where devDependencies are absent.

---

## 4. Troubleshooting Checklist
If the synchronization logs in PM2 show failures:
* **Verify Router Connectivity**: Run `ping 192.168.11.201` from the Raspberry Pi to verify that the router is bridging traffic to the K14 biometric terminal.
* **Database Logs**: Verify that the `.env` file in `/home/pi/zkteco-sync-worker/.env` contains the correct remote PostgreSQL database connection string (including valid credentials and SSL flags for WAN connection).
* **Process Status**: If the process is continually restarting, run `pm2 logs` to see any runtime startup exceptions.
