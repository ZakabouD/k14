# 10 — TROUBLESHOOTING
# Symptom-Based Field Operations & Maintenance Runbook

This guide provides fast, deterministic troubleshooting workflows for issues encountered during deployment and ongoing operations.

---

## Quick Diagnostic Matrix

```
┌──────────────────────────────┐     ┌──────────────────────────────┐     ┌──────────────────────────────┐
│ ISSUE ON CLOUD DASHBOARD     │     │ ISSUE ON LOCAL BRIDGE        │     │ ISSUE ON BIOMETRIC TERMINAL  │
│ 1. 502 Bad Gateway / TLS     │     │ 3. Pi Offline / Unreachable  │     │ 4. K14 Unreachable from Pi   │
│ 2. DB Disconnected (503)     │     │ 5. Heartbeat Stopped         │     │ 12. K14 IP Changed / Reset   │
│ 8. Timezone Offset Error     │     │ 9. PM2 Crash-Looping         │     │ 6. Punches Not Syncing       │
└──────────────────────────────┘     └──────────────────────────────┘     └──────────────────────────────┘
```

---

### Symptom 1: Dashboard Unavailable / Caddy 502 Bad Gateway

* **Likely Causes:** Next.js container `zk_dashboard` is starting, crashing, or unhealthy; internal port 3000 not responding.
* **Safe Diagnostic Checks:**
  ```bash
  cd /opt/attendance/zk-k14-commercial
  docker compose --env-file .env.docker ps
  docker compose --env-file .env.docker logs dashboard --tail 50
  ```
* **Strict DO NOT DO:** Do not reinstall Docker or delete database volumes.
* **Remediation:** If `dashboard` exited, inspect memory limits and restart: `docker compose --env-file .env.docker restart dashboard`.

---

### Symptom 2: `/api/health` Returns Database Disconnected / HTTP 503

* **Likely Causes:** PostgreSQL container `zk_postgres` is stopped or unhealthy; invalid database credentials in `.env.docker`.
* **Safe Diagnostic Checks:**
  ```bash
  cd /opt/attendance/zk-k14-commercial
  docker compose --env-file .env.docker logs postgres --tail 50
  ```
* **Remediation:** Verify disk space with `df -h`. If PostgreSQL exited due to disk pressure, investigate large files in `/var/log` (do not run unselective prune commands). Restart database: `docker compose --env-file .env.docker restart postgres`.

---

### Symptom 3: Raspberry Pi Bridge Offline / Unpingable on Site

* **Likely Causes:** Site Wi-Fi router rebooted/changed; power disconnected; IP changed via DHCP.
* **Safe Diagnostic Checks:**
  ```bash
  # Check mDNS reachability from local workstation on site:
  ping attendance-<CLIENT_SLUG>-pi.local
  ```
* **Remediation:** Inspect physical LED indicators on Pi (Red = Power, Green = MicroSD activity). Power cycle Pi if unresponsive.

---

### Symptom 4: ZKTeco K14 Unreachable from Pi (`connect ENETUNREACH` / Timeout)

* **Likely Causes:** Direct RJ45 cable unplugged; static IP on `<PI_K14_INTERFACE>` missing; K14 IP mismatch.
* **Safe Diagnostic Checks (from Pi):**
  ```bash
  cat /sys/class/net/<PI_K14_INTERFACE>/carrier   # Must return 1
  ip addr show <PI_K14_INTERFACE>                 # Must show <PI_K14_IP>/<K14_NETMASK>
  ping -c 3 <K14_IP>                              # Must return 0% packet loss
  nc -zv <K14_IP> 4370                            # Must succeed
  ```
* **Strict DO NOT DO:** Do not connect K14 to the office Wi-Fi router. Keep it directly connected to the Pi.
* **Remediation:** Re-seat RJ45 cable clips. On K14 menu, verify `Comm.` $\rightarrow$ `Ethernet` shows `<K14_IP>`, `<K14_NETMASK>`, `Gateway: 0.0.0.0`, `Port: 4370`.

---

### Symptom 5: Terminal Shows "Connecté: Non" / Heartbeat Stopped on Cloud

* **Likely Causes:** PM2 worker crashed; `DEVICE_TOKEN` mismatched; Pi lost Internet connection.
* **Safe Diagnostic Checks:**
  ```bash
  # Check Pi Internet connection
  curl -I https://<APP_DOMAIN>/api/health

  # Check PM2 worker status on Pi
  pm2 status
  pm2 logs zkteco-sync-worker --err --lines 30 --nostream
  ```
* **Remediation:** If PM2 shows errored, restart with `pm2 restart zkteco-sync-worker --update-env`. Verify `API_BASE_URL` in `/opt/attendance-bridge/.env`.

---

### Symptom 6: Punches Created on K14 Do Not Appear on Cloud Dashboard

* **Likely Causes:** Sync interval not reached; network dropped during batch sync; user not enrolled in database.
* **Safe Diagnostic Checks:**
  1. Inspect PM2 logs on Pi to verify batch transmission:
     ```bash
     pm2 logs zkteco-sync-worker --lines 30 --nostream
     ```
  2. *(Exceptional administrative recovery procedure)* Trigger an immediate sync request directly via database state update:
     ```bash
     docker compose --env-file .env.docker exec postgres psql -U attendance_user -d attendance -c \
       "UPDATE \"Device\" SET \"syncRequested\" = true WHERE \"deviceId\" = 'DEV-<CLIENT_SLUG>-K14-01';"
     ```
* **Remediation:** If API returns `401 Unauthorized`, re-provision `DEVICE_TOKEN` on VPS using canonical `npm run docker:device:create` and update `/opt/attendance-bridge/.env`.

---

### Symptom 7: Suspicion of Duplicate Punches

* **Likely Causes:** Multiple synchronizations executed on same hardware logs.
* **Safe Diagnostic Checks:**
  ```bash
  docker compose --env-file .env.docker exec postgres psql -U attendance_user -d attendance -c "
  SELECT \"zktecoUserId\", \"recordTime\", count(*) FROM \"RawPunch\" 
  GROUP BY \"zktecoUserId\", \"recordTime\" HAVING count(*) > 1;
  "
  ```
* **Result:** PostgreSQL enforces unique compound index on `(zktecoUserId, recordTime)`. Duplicates are skipped at database level automatically (`Duplicates: X`).

---

### Symptom 8: Timezone Offset Error (+1h / -1h on Punch Display)

* **Likely Causes:** Raspberry Pi system timezone not set to `Africa/Casablanca`; K14 clock drifted; `SystemSettings` timezone incorrect.
* **Safe Diagnostic Checks:**
  ```bash
  # On Pi:
  timedatectl

  # On Cloud VPS:
  docker compose --env-file .env.docker exec postgres psql -U attendance_user -d attendance -c \
    "SELECT timezone FROM \"SystemSettings\";"
  ```
* **Remediation:** On Pi, execute `sudo timedatectl set-timezone Africa/Casablanca`. On K14 terminal menu, verify hardware clock matches local time.

---

### Symptom 9: PM2 Worker Stopped or Crash-Looping

* **Likely Causes:** Malformed `.env` file; invalid JSON in response; missing compiled build output.
* **Safe Diagnostic Checks:**
  ```bash
  pm2 logs zkteco-sync-worker --err --lines 50 --nostream
  ```
* **Remediation:** Review error stack trace. Ensure `.env` contains valid `API_BASE_URL` with `https://` and exact variable names (`SYNC_INTERVAL_CRON`). If build output is missing, rebuild with `cd /opt/attendance-bridge && npm run build`.

---

### Symptom 10: Raspberry Pi Rebooted and Worker Did Not Auto-Start

* **Likely Causes:** `pm2 startup` systemd service was not enabled or privileged registration command was not executed.
* **Safe Diagnostic Checks:**
  ```bash
  systemctl is-enabled pm2-<PI_USER>.service
  ls -la ~/.pm2/dump.pm2
  ```
* **Remediation:**
  ```bash
  pm2 startup systemd
  # Execute the privileged sudo command returned by pm2 startup (e.g. sudo env PATH=$PATH:... pm2 startup systemd -u <PI_USER> --hp /home/<PI_USER>)
  pm2 save
  ```

---

### Symptom 11: Client Site Wi-Fi Network Credentials Changed

* **Likely Causes:** Router replaced or SSID/password updated on site.
* **Remediation:** Connect to Pi via Ethernet or console and update Wi-Fi credentials interactively (never pass password in command arguments):
  ```bash
  # Prompts silently/interactively for password without shell history exposure:
  sudo nmcli --ask dev wifi connect "<NEW_SSID>"
  ```

---

### Symptom 12: K14 IP Address Accidentally Changed / Reset

* **Likely Causes:** Terminal factory reset or changed via physical menu.
* **Remediation:** On physical K14 keypad: Press `[ M/OK ]` $\rightarrow$ `Comm.` $\rightarrow$ `Ethernet` $\rightarrow$ Set IP to `<K14_IP>`, Mask to `<K14_NETMASK>`, Gateway to `0.0.0.0`, Port to `4370`.

---

### Symptom 13: Automated Daily Backup Failed / Lock Issue

* **Likely Causes:** Active backup holding lock or interrupted process; disk space full; network timeout to R2.
* **Safe Diagnostic Checks:**
  ```bash
  # Check systemd journal logs (Option A) or crontab log (Option B):
  journalctl -u zk-commercial-backup.service -n 50 --no-pager 2>/dev/null || tail -n 50 /var/log/attendance-backup.log

  # Check if an active process holds the flock file:
  fuser /tmp/zk_commercial_backup.lock 2>/dev/null || lsof /tmp/zk_commercial_backup.lock 2>/dev/null || true

  # Check fallback directory lock PID and validate exact script path identity:
  if [ -f /tmp/zk_commercial_backup.lock.d/pid ]; then
    LOCK_PID=$(cat /tmp/zk_commercial_backup.lock.d/pid)
    if ps -p "$LOCK_PID" -o pid,comm,args | grep -E 'scripts/backup-full\.sh'; then
      echo "Active backup pipeline process $LOCK_PID holds the lock."
    else
      echo "PID $LOCK_PID exists but is NOT the backup-full.sh script (PID collision or stale lock)."
    fi
  fi
  ```
* **Remediation:**
  * If a verified backup process is actively holding the lock, allow the backup to complete.
  * If no process holds the lock, check disk space (`df -h`) and run manually:
    `/opt/attendance/zk-k14-commercial/scripts/backup-full.sh`

---

### Symptom 14: Cloudflare R2 Off-Site Upload Failed

* **Likely Causes:** Expired R2 credentials; invalid bucket name; network timeout to Cloudflare API.
* **Safe Diagnostic Checks:**
  ```bash
  # Test R2 reachability from VPS using repository tool:
  ./scripts/list-remote-backups.sh
  ```
* **Remediation:** Check credentials in `/opt/attendance/zk-k14-commercial/.env.backup`. Verify R2 bucket permissions in Cloudflare dashboard.
