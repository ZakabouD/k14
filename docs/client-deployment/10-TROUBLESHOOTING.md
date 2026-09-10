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
* **Startup Timing Note (Transient ENETUNREACH at Boot):** Immediately following a Pi boot or reboot, the worker service may initialize before `<PI_K14_INTERFACE>` finishes carrier negotiation. This produces an initial `connect ENETUNREACH` in PM2 logs. The worker contains built-in retry logic where the second connection attempt succeeds once carrier = 1 (verified in PI-RUNTIME-2E). Verify carrier with `cat /sys/class/net/<PI_K14_INTERFACE>/carrier` before treating an initial boot ENETUNREACH as a fault.
* **Remediation:** Re-seat RJ45 cable clips. On K14 menu, verify `Comm.` $\rightarrow$ `Ethernet` shows `<K14_IP>`, `<K14_NETMASK>`, `Gateway: 0.0.0.0`, `Port: 4370`.


---

### Symptom 5: Terminal Shows "Connecté: Non" / Heartbeat Stopped on Cloud

* **Likely Causes:** PM2 worker crashed; `DEVICE_TOKEN` mismatched; Pi lost Internet connection.
* **Safe Diagnostic Checks:**
  ```bash
  # Check Pi Internet connection
  curl -I https://<APP_DOMAIN>/api/health

  # Check PM2 worker status on Pi
  /opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 status
  /opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 logs zkteco-sync-worker --err --lines 30 --nostream
  ```
* **Remediation:** If PM2 shows errored, restart with `/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 restart zkteco-sync-worker --update-env`. Verify `API_BASE_URL` in `/opt/attendance-bridge/.env`.

---

### Symptom 6: Punches Created on K14 Do Not Appear on Cloud Dashboard

* **Likely Causes:** Sync interval not reached; network dropped during batch sync; user not enrolled in database.
* **Safe Diagnostic Checks:**
  1. Inspect PM2 logs on Pi to verify batch transmission:
     ```bash
     /opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 logs zkteco-sync-worker --lines 30 --nostream
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
  /opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 logs zkteco-sync-worker --err --lines 50 --nostream
  ```
* **Remediation:** Review error stack trace. Ensure `.env` contains valid `API_BASE_URL` with `https://` and exact variable names (`SYNC_INTERVAL_CRON`). If build output is missing, rebuild with `cd /opt/attendance-bridge && /opt/node24/bin/node /opt/node24/lib/node_modules/npm/bin/npm-cli.js run build`.

---

### Symptom 10: Raspberry Pi Rebooted and Worker Did Not Auto-Start / PM2 Node Version Mismatch

* **Likely Causes:** `pm2 startup` systemd service was not enabled; privileged registration command was not executed; or PM2 daemon started under an unconfigured Node binary instead of `/opt/node24/bin/node`.
* **Safe Diagnostic Checks:**
  ```bash
  systemctl is-enabled pm2-<PI_USER>.service
  systemctl status pm2-<PI_USER>.service
  ls -la ~/.pm2/dump.pm2

  # Check effective systemd service commands:
  systemctl show pm2-<PI_USER>.service -p ExecStart -p ExecReload -p ExecStop -p Environment

  # Verify PM2 supervisor daemon executable:
  PM2_DAEMON_PID=$(pgrep -u <PI_USER> -f "PM2.*Daemon" || pgrep -u <PI_USER> -f "PM2.*God Daemon" || echo "")
  readlink -f "/proc/$PM2_DAEMON_PID/exe"   # Must equal: /opt/node24/bin/node

  # Verify worker executable, interpreter, and working directory:
  WORKER_PID=$(pgrep -f "dist/index.js" | head -n 1)
  readlink -f "/proc/$WORKER_PID/exe"       # Must equal: /opt/node24/bin/node
  readlink -f "/proc/$WORKER_PID/cwd"       # Must equal: /opt/attendance-bridge
  /opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 show zkteco-sync-worker | grep -Ei 'exec mode|node version|interpreter|script path'
  ```
* **Remediation:**
  > [!IMPORTANT]
  > **Authoritative Controlled Migration Protocol Notice:**
  > Writing a systemd drop-in and running `systemctl daemon-reload` alone does **NOT** migrate an already-running PM2 daemon (which retains its active launch binary in memory space).
  >
  > Do **NOT** attempt ad-hoc inline service restarts or uncoordinated process killing.
  >
  > **STOP** normal troubleshooting flow and execute the authoritative 12-step supervisor migration protocol in:
  > **[`04-RASPBERRY-PI-INSTALLATION.md`](04-RASPBERRY-PI-INSTALLATION.md) — Stage 6, Step 4: Controlled 12-Step PM2 Supervisor Migration Protocol.**
  >
  > That authoritative protocol enforces:
  > 1. Pre-migration state assertion on `dump.pm2`.
  > 2. Explicit command resets (`ExecStart=`, `ExecReload=`, `ExecStop=`) under Node 24.
  > 3. Strict effective systemd configuration assertions.
  > 4. Controlled service restart.
  > 5. Active ownership correlation (`OS_PID == PM2_PID`).
  > 6. Post-migration `dump.pm2` assertion and logrotate configuration.

  **Secondary Diagnostic Health Check (Informational Only):**
  > [!NOTE]
  > This check provides quick secondary diagnostics after executing the authoritative migration procedure. It does **NOT** replace or weaken the full fail-closed gates (daemon/worker cardinality, exact argv vector parsing, dump.pm2 validation, and reboot proof) defined in [`04-RASPBERRY-PI-INSTALLATION.md`](04-RASPBERRY-PI-INSTALLATION.md) Stage 6.
  ```bash
  # 1. Verify systemd service is active:
  test "$(systemctl is-active pm2-<PI_USER>.service)" = "active" || {
    echo "ERROR: pm2-<PI_USER>.service is not active! STOP."; exit 1;
  }

  # 2. Verify PM2 daemon runs under /opt/node24/bin/node and count is exactly 1:
  DAEMON_PIDS=$(pgrep -u <PI_USER> -f "PM2 v[0-9]|PM2.*Daemon|PM2.*God Daemon")
  test $(echo "$DAEMON_PIDS" | grep -v "^$" | wc -l) -eq 1 || {
    echo "ERROR: PM2 daemon count is not 1! PIDs: $DAEMON_PIDS. STOP."; exit 1;
  }
  PM2_DAEMON_PID=$(echo "$DAEMON_PIDS" | tr -d "[:space:]")
  test "$(readlink -f /proc/$PM2_DAEMON_PID/exe)" = "/opt/node24/bin/node" || {
    echo "ERROR: PM2 daemon executable mismatch! Expected /opt/node24/bin/node. STOP."; exit 1;
  }

  # 3. Verify worker PID correlation and properties:
  PM2_JSON=$(/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 jlist)
  PM2_PID=$(/opt/node24/bin/node -e '
    const d = JSON.parse(process.argv[1]);
    if (!Array.isArray(d) || d.length !== 1) process.exit(1);
    const p = d[0];
    if (p.name !== "zkteco-sync-worker" || (p.pm2_env && p.pm2_env.status) !== "online") process.exit(1);
    if (typeof p.pid !== "number" || p.pid <= 0) process.exit(1);
    console.log(p.pid);
  ' "$PM2_JSON") || {
    echo "ERROR: PM2 online worker state verification failed! STOP."; exit 1;
  }

  OS_PIDS=$(pgrep -f "dist/index.js")
  test $(echo "$OS_PIDS" | grep -v "^$" | wc -l) -eq 1 || {
    echo "ERROR: Expected exactly 1 OS worker process! PIDs: $OS_PIDS. STOP."; exit 1;
  }
  OS_PID=$(echo "$OS_PIDS" | tr -d "[:space:]")

  test "$OS_PID" = "$PM2_PID" || {
    echo "ERROR: Process ownership mismatch (OS: $OS_PID != PM2: $PM2_PID)! STOP."; exit 1;
  }

  test "$(readlink -f /proc/$PM2_PID/exe)" = "/opt/node24/bin/node" || {
    echo "ERROR: Worker executable mismatch! STOP."; exit 1;
  }
  test "$(readlink -f /proc/$PM2_PID/cwd)" = "/opt/attendance-bridge" || {
    echo "ERROR: Worker cwd mismatch! STOP."; exit 1;
  }

  echo "PM2 supervisor and worker verified under /opt/node24/bin/node (Secondary Diagnostics Passed)."
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
