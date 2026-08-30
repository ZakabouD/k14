# Client #1 Formal Acceptance Test Protocol

**ZKTeco K14 Commercial Attendance Solution — GO / NO-GO Verification**

Client Legal Name: ________________________________________  
Client Domain: `https://________________________`  
Assigned Lead Field Engineer: ________________________________________  
Client Technical Representative: ________________________________________  
Execution Date: ________________________  

---

## 1. Executive Summary & Acceptance Rules

This document establishes the official formal acceptance procedure for commissioning the commercial ZKTeco K14 attendance solution for a client. Every test section must be executed sequentially, and every critical criteria must achieve a **PASS** status before the system is declared ready for production go-live.

### Blocking GO / NO-GO Criteria
A failure in ANY of the following 11 core gates constitutes a mandatory **NO-GO**:
1. **HTTPS / Domain Security:** Invalid SSL/TLS certificate or unencrypted endpoints.
2. **Database Connectivity:** Central PostgreSQL unavailable or schema migrations failed.
3. **Bridge Timezone Alignment:** Raspberry Pi running in any timezone other than `Africa/Casablanca`.
4. **NTP Clock Synchronization:** Raspberry Pi system clock not synchronized with NTP.
5. **Device Authentication:** Bridge receiving HTTP 401 / 403 or failing token validation.
6. **Physical Punch Pipeline:** Real K14 physical fingerprint punch fails to ingest into PostgreSQL.
7. **Timestamp Fidelity:** Stored or displayed attendance timestamp exhibits a $\pm 1$-hour shift.
8. **Deduplication Idempotency:** Repeated sync runs create duplicate `RawPunch` records.
9. **PM2 Reboot Persistence:** Worker does not automatically resume and stabilize after Raspberry Pi reboot.
10. **Off-Site Backup Verification:** Atomic database backup to Cloudflare R2 fails or marker missing.
11. **Isolated Disaster Recovery:** Latest production backup fails to restore into an isolated temporary database with key table row-count parity using full R2 key.

---

## 2. Structured Verification Protocol

---

### SECTION A: Central Cloud VPS & Application Baseline

| Item | Verification Procedure | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **A.1** | `curl -i https://<CLIENT_DOMAIN>/api/health` | HTTP/2 200 OK `{"status":"ok","database":"connected"}` | | `[ ] PASS`<br>`[ ] FAIL` |
| **A.2** | Verify HTTPS redirect: `curl -I http://<CLIENT_DOMAIN>` | HTTP 308 Permanent Redirect to `https://` | | `[ ] PASS`<br>`[ ] FAIL` |
| **A.3** | Verify container status: `docker compose ps` | `zk_caddy`, `zk_dashboard`, `zk_postgres` all `healthy` | | `[ ] PASS`<br>`[ ] FAIL` |
| **A.4** | Administrator web login at `https://<CLIENT_DOMAIN>/login` | Successful login to dashboard; session cookie active | | `[ ] PASS`<br>`[ ] FAIL` |

*Evidence / Notes:* ____________________________________________________________________

---

### SECTION B: Raspberry Pi Hardware Bridge Baseline

| Item | Verification Procedure | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **B.1** | Run `timedatectl` on Raspberry Pi | `Time zone: Africa/Casablanca` and `System clock synchronized: yes` | | `[ ] PASS`<br>`[ ] FAIL` |
| **B.2** | Verify Node version: `node -v` | Node.js version $\ge$ v20.0.0 LTS | | `[ ] PASS`<br>`[ ] FAIL` |
| **B.3** | Verify `.env` permissions: `ls -la /opt/attendance-bridge/.env` | Permissions are strictly `600` (`-rw-------`) | | `[ ] PASS`<br>`[ ] FAIL` |
| **B.4** | Inspect PM2 worker status: `pm2 status` | `zkteco-sync-worker` status is `online` and stable (not in crash loop) | | `[ ] PASS`<br>`[ ] FAIL` |

*Evidence / Notes:* ____________________________________________________________________

---

### SECTION C: ZKTeco K14 Hardware Terminal Setup

| Item | Verification Procedure | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **C.1** | Check K14 physical display clock | Screen displays accurate Morocco local time ($\pm 5$ seconds) | | `[ ] PASS`<br>`[ ] FAIL` |
| **C.2** | Network ping from Pi: `ping -c 3 <ZKTECO_IP>` | 0% packet loss, latency $< 10$ms | | `[ ] PASS`<br>`[ ] FAIL` |
| **C.3** | TCP port check from Pi: `nc -z -v -w 3 <ZKTECO_IP> 4370` | Connection to `<ZKTECO_IP> 4370` succeeded | | `[ ] PASS`<br>`[ ] FAIL` |
| **C.4** | Verify test employee enrollment | Test employee (User ID `1` or `999`) enrolled on K14 | | `[ ] PASS`<br>`[ ] FAIL` |

*Evidence / Notes:* ____________________________________________________________________

---

### SECTION D: Device Authentication & Heartbeat

> [!NOTE]
> **HEARTBEAT vs DEVICE ONLINE:**
> - Heartbeat delivery proves the Raspberry Pi has active HTTPS outbound communication with the central VPS.
> - `deviceOnline` indicates whether the Pi can reach the physical K14 over LAN port 4370.

| Item | Verification Procedure | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **D.1** | Observe Pi logs: `pm2 logs zkteco-sync-worker --lines 30` | Heartbeat payload sent every 10s with HTTP 200 OK | | `[ ] PASS`<br>`[ ] FAIL` |
| **D.2** | Inspect Central Dashboard UI $\rightarrow$ **Paramètres** | Terminal status displayed as "En ligne" with green indicator | | `[ ] PASS`<br>`[ ] FAIL` |
| **D.3** | Query database `SystemSettings` singleton | `deviceOnline = true`, `lastHeartbeat` recent timestamp | | `[ ] PASS`<br>`[ ] FAIL` |
| **D.4** | Verify zero credential leakage | Zero raw tokens or passwords printed in PM2 logs | | `[ ] PASS`<br>`[ ] FAIL` |

*Evidence / Notes:* ____________________________________________________________________

---

### SECTION E: First Physical Punch Ingestion Pipeline

> [!IMPORTANT]
> **PHYSICAL HARDWARE TEST ONLY:**
> This test must be performed via physical fingerprint / badge registration on the K14 terminal. Do NOT manually insert database records or inject synthetic API payloads.

1. **Step 1:** Record exact Morocco wall-clock time from official reference: `____:____:____`.
2. **Step 2:** Test employee physically places registered fingerprint on K14 sensor. Terminal announces *"Merci"* / *"Thank you"*.
3. **Step 3:** Record K14 terminal displayed punch time: `____:____:____` and User ID: `______`.
4. **Step 4:** Wait for automatic background sync iteration (or trigger via supported manual sync button).

| Item | Verification Procedure | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **E.1** | Pi Worker Ingestion Log | Worker reads punch from terminal and posts batch with HTTP 200 | | `[ ] PASS`<br>`[ ] FAIL` |
| **E.2** | PostgreSQL `RawPunch` verification | New `RawPunch` record created with matching `zktecoUserId` | | `[ ] PASS`<br>`[ ] FAIL` |
| **E.3** | Unified Calculation Engine | Server computes `CalculatedDailyReport` for test employee | | `[ ] PASS`<br>`[ ] FAIL` |
| **E.4** | Dashboard Attendance View | Attendance punch appears in dashboard after sync cycle completes (or upon manual sync and page refresh) | | `[ ] PASS`<br>`[ ] FAIL` |

*Evidence / Notes:* ____________________________________________________________________

---

### SECTION F: Timezone Fidelity & Zero 1-Hour Shift Audit

| Item | Verification Parameter | Value | IANA Alignment Rule | Status |
| :--- | :--- | :--- | :--- | :---: |
| **F.1** | Physical K14 Screen Time | `____:____:____` | Morocco Local Reference | `[ ] PASS`<br>`[ ] FAIL` |
| **F.2** | Stored `RawPunch.recordTime` (UTC) | `____-____-____T____:____:____Z` | Stored UTC instant converted through `Africa/Casablanca` reproduces K14 local wall-clock time | `[ ] PASS`<br>`[ ] FAIL` |
| **F.3** | Web Dashboard Displayed Time | `____:____:____` | Matches Physical K14 Screen Time exactly | `[ ] PASS`<br>`[ ] FAIL` |
| **F.4** | Calculation Shift Alignment | Calculated report | Zero 1-hour calculation discrepancy (NO $\pm 1$-hour shift) | `[ ] PASS`<br>`[ ] FAIL` |

*Evidence / Notes:* ____________________________________________________________________

---

### SECTION G: Idempotency & Deduplication Protection

1. **Step 1:** Allow the commercial worker to complete a second automated sync iteration with NO new physical punches created.
2. **Step 2:** Inspect central PostgreSQL database `RawPunch` table.

| Item | Verification Procedure | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **G.1** | Pi Worker Duplicate Log | Worker reports `duplicates: N, inserted: 0` | | `[ ] PASS`<br>`[ ] FAIL` |
| **G.2** | `RawPunch` count verification | Total row count for test punch remains exactly `1` | | `[ ] PASS`<br>`[ ] FAIL` |
| **G.3** | Daily Report Stability | `CalculatedDailyReport` hours remain unchanged | | `[ ] PASS`<br>`[ ] FAIL` |

*Evidence / Notes:* ____________________________________________________________________

---

### SECTION H: Raspberry Pi Reboot & Persistence Verification

1. **Step 1:** Execute reboot on the Raspberry Pi: `sudo reboot`.
2. **Step 2:** Wait 60 seconds for operating system reboot.

| Item | Verification Procedure | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **H.1** | OS Boot & Network Recovery | Pi reconnects to LAN; NTP clock synchronizes | | `[ ] PASS`<br>`[ ] FAIL` |
| **H.2** | PM2 Process Auto-Start | `pm2 status` shows `zkteco-sync-worker` automatically online and stable | | `[ ] PASS`<br>`[ ] FAIL` |
| **H.3** | Working Directory & `.env` | Worker successfully loads `.env` from `/opt/attendance-bridge` | | `[ ] PASS`<br>`[ ] FAIL` |
| **H.4** | Heartbeat Resumption | Dashboard reflects device status back to "En ligne" | | `[ ] PASS`<br>`[ ] FAIL` |

*Evidence / Notes:* ____________________________________________________________________

---

### SECTION I: Controlled Offline & Reconnect Recovery Drill

1. **Step 1:** Temporarily disconnect the Raspberry Pi's internet access (e.g. block outbound HTTPS via temporary local router rule or disable default gateway for 2 minutes).
2. **Step 2:** Perform one physical punch on the K14 hardware while the bridge is offline.
3. **Step 3:** Restore internet access to the Raspberry Pi.

| Item | Verification Procedure | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **I.1** | Hardware Terminal Buffer | Punch safely stored in K14 flash memory during outage | | `[ ] PASS`<br>`[ ] FAIL` |
| **I.2** | Automatic Reconnection | Worker reconnects to VPS API with increasing linear retry delay | | `[ ] PASS`<br>`[ ] FAIL` |
| **I.3** | Batch Ingestion on Recovery | Buffered offline punch successfully ingested into `RawPunch` | | `[ ] PASS`<br>`[ ] FAIL` |
| **I.4** | Timestamp Integrity | Recovered punch retains original recorded wall-clock time | | `[ ] PASS`<br>`[ ] FAIL` |

*Evidence / Notes:* ____________________________________________________________________

---

### SECTION J: Automated Cloudflare R2 Backup Verification

| Item | Verification Procedure | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **J.1** | Run full backup on VPS: `npm run backup:full` | Atomic pg_dump custom archive created with SHA-256 sidecar | | `[ ] PASS`<br>`[ ] FAIL` |
| **J.2** | List remote R2 objects: `npm run backup:remote:list` | Latest archive listed with status `COMPLETE` | | `[ ] PASS`<br>`[ ] FAIL` |
| **J.3** | Verify Model A Completion Marker | Sidecar `.complete` object exists in R2 bucket | | `[ ] PASS`<br>`[ ] FAIL` |
| **J.4** | Verify Scheduler Timer | systemd timer active for 03:00 Africa/Casablanca | | `[ ] PASS`<br>`[ ] FAIL` |

*Evidence / Notes:* ____________________________________________________________________

---

### SECTION K: Isolated Disaster Recovery Verification Drill

> [!CAUTION]
> **ISOLATED DB RESTORE ONLY:**
> This drill must strictly restore into a temporary isolated database (`attendance_dr_test`). Never execute restore against the production database.

1. **Step 1:** Download latest backup using full R2 key: `npm run backup:remote:download -- <FULL_R2_KEY>`.
2. **Step 2:** Restore archive into temporary verification DB:
   ```bash
   npm run backup:restore -- backups/postgres/<DUMP_FILENAME> attendance_dr_test --keep
   ```
3. **Step 3:** Query restored row counts in `attendance_dr_test`.

| Item | Restored Table | Production Count | Restored Count | Alignment | Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **K.1** | `SystemSettings` | 1 | 1 | Exact Match | `[ ] PASS` `[ ] FAIL` |
| **K.2** | `Device` | 1 | 1 | Exact Match | `[ ] PASS` `[ ] FAIL` |
| **K.3** | `User` / `DashboardUser` | $\ge 1$ | $\ge 1$ | Exact Match | `[ ] PASS` `[ ] FAIL` |
| **K.4** | `RawPunch` | $\ge 1$ | $\ge 1$ | Exact Match | `[ ] PASS` `[ ] FAIL` |
| **K.5** | `CalculatedDailyReport` | $\ge 1$ | $\ge 1$ | Exact Match | `[ ] PASS` `[ ] FAIL` |

4. **Step 4:** Clean up temporary test database:
   ```bash
   POSTGRES_USER="$(grep -E '^POSTGRES_USER=' .env.docker | cut -d '=' -f2- | tr -d '\r\n"')"
   docker exec zk_postgres psql -U "${POSTGRES_USER}" -d postgres -c "DROP DATABASE IF EXISTS \"attendance_dr_test\";"
   ```
- [ ] **Temporary DB Dropped Cleanly:** Verified `attendance_dr_test` deleted.
- [ ] **Production Database Untouched:** Production database confirmed 100% operational.

*Evidence / Notes:* ____________________________________________________________________

---

### SECTION L: Production Security Audit

| Item | Security Control | Verification Command / Proof | Status |
| :--- | :--- | :--- | :--- | :---: |
| **L.1** | Public Port Scan | Only ports 22 (SSH), 80 (HTTP), 443 (HTTPS) open on VPS | `[ ] PASS`<br>`[ ] FAIL` |
| **L.2** | Private Database Isolation | Port 5432 is not listening on public interfaces | `[ ] PASS`<br>`[ ] FAIL` |
| **L.3** | Private Biometric Terminal | K14 port 4370 is inaccessible from the public internet | `[ ] PASS`<br>`[ ] FAIL` |
| **L.4** | Token Hash Ingestion | Database stores only SHA-256 hex string; no plaintext tokens | `[ ] PASS`<br>`[ ] FAIL` |
| **L.5** | Git Cleanliness | Zero `.env` files, private keys, or passwords tracked in Git | `[ ] PASS`<br>`[ ] FAIL` |

*Evidence / Notes:* ____________________________________________________________________

---

## 3. Acceptance Decision & Sign-Off

### Final Acceptance Evaluation

```
[ ] GO    — All 11 blocking gates and 12 test sections PASSED with zero blocking defects.
            The commercial attendance system is officially accepted for live production.

[ ] NO-GO — One or more blocking tests failed.
            Remediation required prior to customer go-live.
```

### Signatures

**For the Solution Provider:**
Lead Field Engineer Name: ________________________________________  
Signature: ________________________________________  
Date: ________________________  

**For the Client Organization:**
Authorized Technical Representative: ________________________________________  
Title: ________________________________________  
Signature: ________________________________________  
Date: ________________________  
