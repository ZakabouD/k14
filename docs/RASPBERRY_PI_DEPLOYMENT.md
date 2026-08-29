# Raspberry Pi Hardware Bridge Deployment Runbook

**ZKTeco K14 Commercial Attendance Solution — On-Premise Bridge**

This runbook provides the step-by-step procedure for field technicians to deploy and configure the **Commercial Attendance Sync Bridge** on a clean Raspberry Pi connected to on-premise ZKTeco K14 biometric terminal(s).

---

## 1. System Architecture

The Raspberry Pi acts as a secure on-premise hardware bridge. It communicates with local ZKTeco K14 biometric terminals over the local area network (LAN) and pushes encrypted attendance data to the central cloud VPS exclusively over **outbound HTTPS**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Client On-Premise Local Area Network (LAN)                                  │
│                                                                             │
│  ┌───────────────────────┐                    ┌──────────────────────────┐  │
│  │   ZKTeco K14 Terminal │                    │    Raspberry Pi Bridge   │  │
│  │   192.168.1.201       │ ── UDP/TCP :4370 ──► │    (Debian 64-bit / Node)│  │
│  │   (Fixed IP / DHCP)   │                    │    SyncWorker (PM2)      │  │
│  └───────────────────────┘                    └────────────┬─────────────┘  │
└────────────────────────────────────────────────────────────┼────────────────┘
                                                             │
                                                             ▼ Outbound HTTPS :443
                                                ┌─────────────────────────────┐
                                                │ Central Commercial VPS      │
                                                │ https://pointage.client.ma  │
                                                │ (Caddy + Next.js + Postgres)│
                                                └─────────────────────────────┘
```

### Key Security & Operational Properties
- **No Inbound Ports on Pi:** The Raspberry Pi requires **zero** inbound open ports from the internet. All communication to the central VPS is outbound HTTPS (TCP 443).
- **Non-Destructive Ingestion:** Attendance logs remain stored in the ZKTeco K14 terminal flash memory. The worker never clears or deletes hardware attendance records.
- **Fail-Safe Offline Recovery:** If the internet connection or central VPS is temporarily unavailable, punches accumulate safely on the K14 hardware and sync automatically upon reconnection with idempotent duplicate suppression (`skipDuplicates`).

---

## 2. Hardware & OS Prerequisites

| Component | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **Hardware** | Raspberry Pi 3B+ / Zero 2W (512MB RAM) | **Raspberry Pi 4 Model B (2GB/4GB)** or **Pi 5** |
| **Architecture**| ARM64 (aarch64) — 64-bit required | ARM64 (aarch64) |
| **Operating System** | Raspberry Pi OS Lite (64-bit) / Debian 12 (Bookworm) | **Raspberry Pi OS Lite 64-bit (Debian 12/13)** |
| **Storage** | 16 GB Class 10 / High Endurance MicroSD | 32 GB SanDisk Industrial MicroSD or USB SSD |
| **Power Supply** | Official 5V / 2.5A Power Adapter | Official 5V / 3A (Pi 4) or 5V / 5A (Pi 5) Adapter |
| **Network** | 2.4GHz Wi-Fi 802.11n | **Gigabit Ethernet (RJ45)** or 5GHz Wi-Fi 802.11ac |

---

## 3. Step-by-Step Installation Procedure

---

### STAGE 1: Flash OS & Initial System Access
1. Use **Raspberry Pi Imager** to flash **Raspberry Pi OS Lite (64-bit)** onto the MicroSD card.
2. In Imager settings (*Advanced options*):
   - Set hostname (e.g. `attendance-bridge-01`).
   - Create system user (e.g. `pi`).
   - Configure Wi-Fi credentials (if not using wired Ethernet).
   - Enable SSH with public-key authentication.
3. Insert MicroSD card into the Raspberry Pi and power on.
4. Connect via SSH:
   ```bash
   ssh pi@<PI_IP_ADDRESS>
   ```

---

### STAGE 2: System Update & Essential Packages
Update all base operating system packages:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git ufw htop net-tools
```

---

### STAGE 3: Production-Critical Timezone Configuration

> [!IMPORTANT]
> **WHY THIS IS PRODUCTION-CRITICAL:**
> The `zkteco-js` hardware communication library parses raw date fields (`year, month, day, hour, min, sec`) from the K14 terminal using the Node.js process's **local operating system timezone**.
> If the Raspberry Pi is left in `UTC` or an unaligned timezone, attendance punches will suffer a **silent 1-hour shift**.
> The commercial worker features a fail-fast startup guard that will refuse to start if the runtime timezone does not match `Africa/Casablanca`.

1. Set the official timezone:
   ```bash
   sudo timedatectl set-timezone Africa/Casablanca
   ```

2. Verify timezone and clock synchronization:
   ```bash
   timedatectl
   ```
   **Mandatory Expected Output:**
   ```text
                  Local time: Sat 2026-08-29 15:30:00 +01
              Universal time: Sat 2026-08-29 14:30:00 UTC
                   Time zone: Africa/Casablanca (+01, +0100)
   System clock synchronized: yes
                 NTP service: active
   ```

---

### STAGE 4: Node.js & PM2 Installation
Install Node.js 20 LTS and PM2 process manager:
```bash
# 1. Install Node.js 20 LTS via official NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Verify Node.js and npm versions
node -v   # Must be >= v20.0.0
npm -v    # Must be >= v10.0.0

# 3. Install PM2 globally
sudo npm install -g pm2
```

---

### STAGE 5: Deploy Commercial Worker Application
1. Create the application directory:
   ```bash
   sudo mkdir -p /opt/attendance-bridge
   sudo chown -R pi:pi /opt/attendance-bridge
   cd /opt/attendance-bridge
   ```

2. Clone the commercial repository (or copy pre-built bundle):
   ```bash
   git clone https://github.com/ZakabouD/k14.git .
   git checkout commercial
   ```

3. Install production dependencies and build:
   ```bash
   npm ci
   npm run build
   ```
   *Verify that `dist/index.js` and `dist/jobs/sync.worker.js` exist.*

---

### STAGE 6: Environment Configuration (`.env`)
1. Create the worker environment file from template:
   ```bash
   cp .env.worker.example .env
   chmod 600 .env
   ```

2. Edit `.env` with the specific client credentials:
   ```bash
   nano .env
   ```

   **Authoritative Configuration Contract:**
   ```env
   # ============================================================
   # ZKTeco Hardware Terminal Configuration
   # ============================================================
   ZKTECO_IP="192.168.1.201"
   ZKTECO_PORT=4370
   ZKTECO_TIMEOUT=10000

   # ============================================================
   # Central Dashboard HTTPS API Connection
   # (Provisioned via: npm run docker:device:create on VPS)
   # ============================================================
   API_BASE_URL="https://pointage.client-domain.ma"
   DEVICE_ID="DEV-CASABLANCA-01"
   DEVICE_TOKEN="<PASTE_PROVISIONED_DEVICE_TOKEN_HERE>"

   # ============================================================
   # Operational Settings
   # ============================================================
   SYNC_INTERVAL_CRON="*/15 * * * *"
   SYNC_CHUNK_SIZE=500
   ```

> [!CAUTION]
> **SECRET HANDLING:**
> - `DEVICE_TOKEN` is a high-entropy secret.
> - Never commit `.env` to Git (it is ignored by `.gitignore`).
> - Keep `.env` permissions strictly restricted (`chmod 600 .env`).

---

### STAGE 7: Pre-Flight Non-Destructive Connectivity Tests

Before launching the background worker, verify network reachability:

1. **Test ICMP Ping to ZKTeco K14:**
   ```bash
   ping -c 3 192.168.1.201
   # Must return 0% packet loss
   ```

2. **Test TCP Port 4370 on K14:**
   ```bash
   nc -z -v -w 3 192.168.1.201 4370
   # Must return: Connection to 192.168.1.201 4370 port [tcp/*] succeeded!
   ```

3. **Test Central Cloud API Health:**
   ```bash
   curl -i https://pointage.client-domain.ma/api/health
   # Must return: HTTP/2 200 OK {"status":"ok","database":"connected"}
   ```

---

### STAGE 8: Start PM2 Process & Enable Boot Persistence
1. Start the worker process under PM2:
   ```bash
   pm2 start dist/index.js --name "zkteco-sync-worker"
   ```

2. Configure PM2 to restart automatically on system boot:
   ```bash
   pm2 startup
   # Copy and execute the sudo env PATH=... command printed by PM2
   ```

3. Save the active process list:
   ```bash
   pm2 save
   ```

---

### STAGE 9: Configure Automated Log Rotation
To protect the MicroSD card from filling up over months of continuous operation, install and configure `pm2-logrotate`:
```bash
# 1. Install logrotate module
pm2 install pm2-logrotate

# 2. Configure rotation parameters
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
```

---

## 4. Monitoring & Operational Commands

```bash
# View live sync worker logs
pm2 logs zkteco-sync-worker

# View process status & memory usage
pm2 status

# Restart worker
pm2 restart zkteco-sync-worker

# Stop worker
pm2 stop zkteco-sync-worker
```

---

## 5. Troubleshooting Guide

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| `FATAL TIMEZONE CONFIGURATION ERROR` | Pi OS timezone is not `Africa/Casablanca` | Run `sudo timedatectl set-timezone Africa/Casablanca` and restart PM2. |
| `Failed to connect to biometric device at ...:4370` | K14 IP changed, cable unplugged, or terminal powered off | Check physical ethernet connection, verify K14 IP screen menu, test with `ping <ZKTECO_IP>`. |
| `Sync batch rejected with non-retryable status 401` | Invalid or rotated `DEVICE_TOKEN` | Re-provision token on VPS via `npm run docker:device:create` and update `.env`. |
| `Sync batch rejected with non-retryable status 403` | Device marked `isActive: false` on server | Reactivate device in central dashboard or database. |
| `Transient HTTP 502 / 503 / 504` | Central VPS temporarily undergoing restart | No action required; worker will retry with exponential backoff and resume automatically. |
| `System clock synchronized: no` | Local network blocking UDP 123 (NTP) | Allow NTP port 123 in router firewall; check `sudo systemctl restart systemd-timesyncd`. |

---

## 6. Field Technician Acceptance Checklist

Before leaving the client installation site, verify every item:

- [ ] **Timezone Verified:** `timedatectl` confirms `Time zone: Africa/Casablanca (+01, +0100)`.
- [ ] **NTP Synchronized:** `timedatectl` confirms `System clock synchronized: yes`.
- [ ] **K14 Reachable:** `nc -z -w 3 <ZKTECO_IP> 4370` succeeds.
- [ ] **Central API Reachable:** `curl -i https://<CLIENT_DOMAIN>/api/health` returns HTTP 200.
- [ ] **Environment File Secured:** `/opt/attendance-bridge/.env` has permissions `600`.
- [ ] **PM2 Online:** `pm2 status` shows `zkteco-sync-worker` with status `online` (0 restarts).
- [ ] **Boot Persistence Enabled:** `pm2 startup` and `pm2 save` executed.
- [ ] **Log Rotation Configured:** `pm2-logrotate` installed and active.
- [ ] **Heartbeat Reflected:** Central dashboard indicates `deviceOnline: true`.
- [ ] **Zero Secrets in Logs:** `pm2 logs` contains no exposed token or password values.
