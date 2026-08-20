# Production Acceptance & Go-Live Checklist

**ZKTeco K14 Commercial Attendance Platform**

Client Name: ____________________________  
Deployment Date: ________________________  
Assigned Operator: ______________________  
Domain / URL: ___________________________  
Client Identifier: _______________________  

---

## 1. Server & Security Baseline

- [ ] **Target OS:** Ubuntu 24.04 / 22.04 LTS updated with all security patches (`apt update && apt upgrade -y`).
- [ ] **Timezone:** Official timezone verified as `Africa/Casablanca` (`timedatectl`).
- [ ] **SSH Hardening:** Dedicated `deploy` administrative user created with SSH public-key authentication.
- [ ] **SSH Password Auth:** Password authentication and direct root login disabled in `/etc/ssh/sshd_config`.
- [ ] **Host Firewall (UFW):** Strict default deny incoming enabled; only ports `22/tcp`, `80/tcp`, `443/tcp`, and `443/udp` permitted.
- [ ] **No Secret Exposure:** Verified `.env.docker` and `.env.backup` have restricted permissions (`chmod 600`) and are not world-readable.

---

## 2. Docker & Network Isolation

- [ ] **Docker Engine:** Docker Engine (v24+) and Docker Compose (v2+) installed from official Docker repository.
- [ ] **Container Status:** All 3 containers (`zk_caddy`, `zk_dashboard`, `zk_postgres`) running and in `healthy` state.
- [ ] **Restart Policy:** Configured as `restart: unless-stopped`.
- [ ] **Network Isolation:** Verified dual-network model:
  - `frontend_net`: `zk_caddy` $\leftrightarrow$ `zk_dashboard`
  - `backend_net`: `zk_dashboard` $\leftrightarrow$ `zk_postgres`, `zk_migrator`
- [ ] **Private Database:** Port `5432` is **NOT** published to the host network (`docker ps` shows no `0.0.0.0:5432->5432`).
- [ ] **Private Dashboard:** Port `3000` is **NOT** published to the host network (`expose: 3000` only).
- [ ] **Named Volumes:** Persistent data volumes verified:
  - `zk_commercial_postgres_data`
  - `zk_commercial_caddy_data`
  - `zk_commercial_caddy_config`

---

## 3. Domain & HTTPS Reverse Proxy

- [ ] **DNS Resolution:** Client domain (`APP_DOMAIN`) points directly to the VPS IPv4 address (`dig +short <APP_DOMAIN>`).
- [ ] **Automatic TLS Certificate:** Caddy successfully negotiated Let's Encrypt / ZeroSSL certificate.
- [ ] **HTTP $\rightarrow$ HTTPS Redirect:** HTTP requests to port 80 return HTTP 308 permanent redirect to HTTPS.
- [ ] **Security Headers:** Verified presence of:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [ ] **Forwarded-IP Sanitization:** Caddy configured to strictly overwrite `X-Forwarded-For` and `X-Real-IP` with `{remote_host}`.

---

## 4. Database & Prisma Migrations

- [ ] **Migration Status:** Migrator container completed successfully (`npx prisma migrate deploy`).
- [ ] **System Settings Initialized:** Company name, default currency (`DH`), and timezone (`Africa/Casablanca`) initialized.
- [ ] **Admin Account Provisioned:** Initial administrator account created with unique, strong password.
- [ ] **Client Isolation:** Database credentials (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`) generated uniquely for this client.

---

## 5. Dashboard & Application Core

- [ ] **Public Health Endpoint:** `https://<APP_DOMAIN>/api/health` returns HTTP 200 `{"status":"ok","database":"connected"}`.
- [ ] **Authentication:** Admin login successful via `/login`; secure session cookie set with `HttpOnly`, `SameSite=Lax`, and `Secure` flags.
- [ ] **Rate Limiter:** Login rate limiting active against brute force attempts.
- [ ] **CRUD Operations:** Verified creation, editing, and viewing of:
  - Shifts & Working Schedules
  - Employee Profiles
  - Public Holidays
  - Leave Requests

---

## 6. Hardware Bridge (Raspberry Pi & ZKTeco K14)

- [ ] **LAN Hardware Isolation:** ZKTeco terminal communicates locally with Raspberry Pi over port `4370`. Port 4370 is **NOT** exposed to the internet.
- [ ] **Device Registration:** Terminal registered in Dashboard; unique `deviceId` and `deviceToken` issued.
- [ ] **Outbound HTTPS API:** Raspberry Pi connects outbound to `https://<APP_DOMAIN>/api/device/*` using token authentication.
- [ ] **Heartbeat:** Raspberry Pi periodic heartbeat received and status displayed as "En ligne" in Dashboard.
- [ ] **Punch Synchronization:** Test punch registered on physical terminal; successfully synced to `RawPunch` table in PostgreSQL.
- [ ] **Duplicate Protection:** Repeated device sync payloads do not duplicate raw attendance records (`sn` / `zktecoUserId` + `recordTime`).

---

## 7. Attendance Calculations & Payroll Reporting

- [ ] **Unified Engine:** Server calculation engine processes raw punches into `CalculatedDailyReport`.
- [ ] **Overtime & Anomaly Detection:** Verified standard hours, overtime (150% / 200%), and anomaly flags (missing punch, late arrival).
- [ ] **Export Functionality:** Monthly payroll / attendance report exports to Excel/CSV cleanly.

---

## 8. Backup & Off-Site Replication (Cloudflare R2)

- [ ] **Client Identifier:** `BACKUP_CLIENT_ID` set to unique client name (e.g. `client-acme-casablanca`). Not `client-local-dev`.
- [ ] **Rotated API Credentials:** Cloudflare R2 API token created specifically for production with *Object Read & Write* restricted to `zk-k14-commercial-backups`.
- [ ] **Atomic Dump Creation:** `npm run backup:full` creates custom archive (`pg_dump -Fc`), validates via `pg_restore --list`, and produces SHA-256 sidecar.
- [ ] **Off-Site Synchronization:** Three objects successfully uploaded to R2:
  - `s3://zk-k14-commercial-backups/<CLIENT_ID>/postgres/YYYY/MM/*.dump`
  - `s3://zk-k14-commercial-backups/<CLIENT_ID>/postgres/YYYY/MM/*.dump.sha256`
  - `s3://zk-k14-commercial-backups/<CLIENT_ID>/postgres/YYYY/MM/*.dump.complete`
- [ ] **Remote Listing Status:** `npm run backup:remote:list` confirms status is `COMPLETE`.
- [ ] **Model A Completion Marker:** Marker metadata matches dump byte size and SHA-256 cryptographic hash.
- [ ] **Local Retention:** Local backup directory retains 7 days of archives.
- [ ] **Remote Retention:** Cloudflare R2 prefix retains 30 days of archives.

---

## 9. Automated Scheduling & Failure Alerting

- [ ] **Systemd Timer Active:** `zk-commercial-backup.timer` enabled and running (`npm run backup:schedule -- --status`).
- [ ] **Execution Time:** Scheduled for **03:00 Africa/Casablanca** daily.
- [ ] **Concurrency Locking:** `flock` non-blocking lock prevents overlapping backup runs.
- [ ] **Failure Webhook (Optional):** If `BACKUP_ALERT_WEBHOOK_URL` is configured, test alert verified without exposing secrets.

---

## 10. Disaster Recovery Verification

- [ ] **Remote Download Drill:** `npm run backup:remote:download` downloads remote dump and verifies SHA-256 hash.
- [ ] **Isolated Test Restore:** `npm run backup:restore -- backups/postgres/<DUMP_FILE> attendance_dr_test --keep` restores data into temporary test database.
- [ ] **Table Count Verification:** Restored tables contain expected records (`SystemSettings`, `User`, `Shift`, `Device`, `RawPunch`, `CalculatedDailyReport`).
- [ ] **Temporary DB Cleanup:** Temporary database dropped cleanly after drill (`DROP DATABASE attendance_dr_test;`).
- [ ] **Primary DB Untouched:** Production database (`POSTGRES_DB`) verified completely untouched during restore verification.
- [ ] **OVH VPS Backup Layer:** OVHcloud automated VPS backup snapshot enabled in OVH dashboard.

---

## 11. Final Sign-Off

| Domain | Status | Notes |
| :--- | :---: | :--- |
| **Server & Security** | [ ] PASS | SSH keys, UFW firewall, fail2ban active |
| **Docker & Network** | [ ] PASS | Container health OK, port 5432 private |
| **HTTPS & Reverse Proxy**| [ ] PASS | Domain active, TLS certificate valid |
| **Database & Migrations**| [ ] PASS | Schema v7.9.1, unique client secrets |
| **Application & CRUD** | [ ] PASS | Dashboard operational, login verified |
| **Hardware & Bridge** | [ ] PASS | Pi heartbeat online, punches syncing |
| **Backup & R2 Sync** | [ ] PASS | Local dump + R2 off-site verified |
| **Automated Scheduler** | [ ] PASS | systemd timer at 03:00 Africa/Casablanca |
| **Disaster Recovery** | [ ] PASS | DR test restore executed & verified |

**Deployment Operator Signature:** _____________________________  
**Date:** ________________________  
**Final Production Verdict:** `[ ] ACCEPTED FOR GO-LIVE`
