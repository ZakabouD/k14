# 06 — CLIENT ACCEPTANCE TEST
# Real-World On-Site Acceptance & Validation Protocol

This protocol defines the exact 7-stage acceptance test procedure executed in the presence of the client representative to confirm end-to-end operational readiness before formal handover.

---

## 1. Acceptance Summary & Sign-Off Matrix

| Stage | Verification Scope | Acceptance Criteria | Class |
| :--- | :--- | :--- | :--- |
| **Stage 1** | Cloud API & Bridge Telemetry | HTTP 200 `/api/health`, Heartbeat advances across $\ge 2$ checks, device online | `BLOCKING` |
| **Stage 2** | Biometric User Enrollment | Test user enrolled on K14, synced into PostgreSQL `User` table | `BLOCKING` |
| **Stage 3** | First Punch Ingestion & Fidelity | Single punch stored in `RawPunch`, timestamp matches in `Africa/Casablanca` | `BLOCKING` |
| **Stage 4** | Second Punch & Shift Calculation | Matching exit punch ingested, `CalculatedDailyReport` regular/overtime hours calculated | `BLOCKING` |
| **Stage 5** | Deduplication / Idempotency | Replay sync creates ZERO new `RawPunch` rows for tested scope | `BLOCKING` |
| **Stage 6** | Bridge Reboot Persistence | Controlled Pi reboot, worker auto-starts via systemd without intervention | `BLOCKING` |
| **Stage 7** | Production UI Visual Check | Dashboard displays employee card, exact punch pills `[HH:MM]`, zero offset error | `BLOCKING` |

---

## STAGE 1: Cloud API & Heartbeat Telemetry

1. **Verify Cloud Health:**
   ```bash
   curl -s https://<APP_DOMAIN>/api/health
   # Expected: {"status":"ok","database":"connected"}
   ```
2. **Verify Device Heartbeat Progression in Database:**
   Execute two queries 15–30 seconds apart:
   ```bash
   cd /opt/attendance/zk-k14-commercial

   docker compose --env-file .env.docker exec postgres psql -U attendance_user -d attendance -x -c "
   SELECT \"deviceId\", \"name\", \"lastHeartbeat\", \"lastSeenAt\", \"syncStatus\" 
   FROM \"Device\" WHERE \"deviceId\" = 'DEV-<CLIENT_SLUG>-K14-01';
   "
   ```
* **Pass Criteria:** `lastHeartbeat` advances between checks; `syncStatus` is `IDLE` or `SUCCESS` (both are normal resting states between active synchronizations).

---

## STAGE 2: Biometric User Enrollment on K14

1. **Physical Action on Terminal:** Enroll a dedicated test employee on the K14 keypad:
   * **User ID:** `<TEST_USER_ID>` *(e.g. `999` or next available numeric ID)*
   * **Name:** `<TEST_USER_NAME>` *(e.g. `TEST CLIENT`)*
   * **Fingerprint:** Register 1 finger with 3 scans.
2. **Synchronize:** Allow the scheduled 15-minute sync to run, or trigger manual sync via the authenticated dashboard interface.
3. **Verify User in Database:**
   ```bash
   docker compose --env-file .env.docker exec postgres psql -U attendance_user -d attendance -c "
   SELECT \"zktecoUserId\", \"firstName\", \"lastName\", \"isActive\" FROM \"User\" 
   WHERE \"zktecoUserId\" = '<TEST_USER_ID>';
   "
   ```
4. **Assign Shift in Dashboard:** In the web UI at `https://<APP_DOMAIN>/artisans`, assign the test employee to the approved Shift.

---

## STAGE 3: First Physical Punch Ingestion & Timestamp Fidelity (Baseline → Action → Sync → Delta)

### Step 1: Establish Acceptance Date Scope & Capture Pre-Action Baseline
1. **Define Local Date & Derive UTC Bounds:**
   * Select local acceptance calendar date `<ACCEPTANCE_LOCAL_DATE>` in `Africa/Casablanca` (e.g. `2026-09-08`).
   * Derive the exact UTC range for that local day (`<ACCEPTANCE_START_UTC>` and `<ACCEPTANCE_END_UTC_EXCLUSIVE>`) using IANA timezone rules, or evaluate date bounds directly using `("recordTime" AT TIME ZONE 'Africa/Casablanca')::date`.
2. **Capture Pre-Action Baseline Count & Sync Marker:**
   ```bash
   cd /opt/attendance/zk-k14-commercial

   # Query baseline punch count for test user on acceptance date:
   docker compose --env-file .env.docker exec postgres psql -U attendance_user -d attendance -x -c "
   SELECT count(*) AS baseline_punch_count, max(\"id\") AS latest_punch_id, max(\"recordTime\") AS latest_record_time
   FROM \"RawPunch\"
   WHERE \"zktecoUserId\" = '<TEST_USER_ID>'
     AND \"recordTime\" >= '<ACCEPTANCE_START_UTC>'::timestamptz
     AND \"recordTime\" < '<ACCEPTANCE_END_UTC_EXCLUSIVE>'::timestamptz;
   "

   # Capture pre-action sync marker on Device table (do NOT rely on lastSeenAt, which is updated by periodic heartbeat):
   docker compose --env-file .env.docker exec postgres psql -U attendance_user -d attendance -x -c "
   SELECT \"deviceId\", \"lastSyncAt\" AS pre_action_lastSyncAt, \"syncStatus\" 
   FROM \"Device\" WHERE \"deviceId\" = 'DEV-<CLIENT_SLUG>-K14-01';
   "
   ```
   * Record `baseline_punch_count` (e.g. `0`), `latest_punch_id`, and `pre_action_lastSyncAt`.

### Step 2: Physical Action on Hardware
1. Place registered finger on the K14 optical sensor.
2. Note the exact physical displayed time and observation precision on the terminal screen (e.g. `YYYY-MM-DD HH:MM:SS`).

### Step 3: Verify Identified Sync Completion (Source-Backed Marker)
Do NOT assume synchronization completed merely because time elapsed. Prove that an active synchronization cycle completed **after** the physical action occurred:
```bash
# 1. Verify Pi bridge worker log evidence for completed sync cycle
ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> <PI_USER>@attendance-<CLIENT_SLUG>-pi.local \
  "pm2 logs zkteco-sync-worker --lines 25 --nostream"

# 2. Verify that post_action_lastSyncAt has advanced beyond pre_action_lastSyncAt
docker compose --env-file .env.docker exec postgres psql -U attendance_user -d attendance -x -c "
SELECT \"deviceId\", \"lastSyncAt\" AS post_action_lastSyncAt, \"syncStatus\" 
FROM \"Device\" WHERE \"deviceId\" = 'DEV-<CLIENT_SLUG>-K14-01';
"
```
* **Sync Completion Pass Criteria:**
  * PM2 worker logs show active terminal connection, punch fetch, and successful push to API.
  * Database verifies `post_action_lastSyncAt` > `pre_action_lastSyncAt` and `syncStatus` is `IDLE` or `SUCCESS`.
  * **STOP:** If sync completion cannot be proven, the test **FAILS**.

### Step 4: Post-Action Query & Delta Verification
```bash
docker compose --env-file .env.docker exec postgres psql -U attendance_user -d attendance -x -c "
SELECT count(*) AS post_punch_count, max(\"id\") AS new_punch_id, max(\"recordTime\") AS new_record_time
FROM \"RawPunch\"
WHERE \"zktecoUserId\" = '<TEST_USER_ID>'
  AND \"recordTime\" >= '<ACCEPTANCE_START_UTC>'::timestamptz
  AND \"recordTime\" < '<ACCEPTANCE_END_UTC_EXCLUSIVE>'::timestamptz;

SELECT \"id\", \"zktecoUserId\", \"recordTime\", \"type\", \"state\" FROM \"RawPunch\" 
WHERE \"zktecoUserId\" = '<TEST_USER_ID>' ORDER BY \"recordTime\" DESC LIMIT 1;
"
```
* **Delta Pass Criteria:**
  * `post_punch_count` = `baseline_punch_count + 1`.
  * `new_punch_id` > `latest_punch_id`.
  * Stored UTC timestamp `recordTime` converted to `Africa/Casablanca` matches physical terminal display within observation precision.

---

## STAGE 4: Second Physical Punch & Business Calculation (Baseline → Action → Sync → Delta)

### Step 1: Capture Pre-Action Baseline & Sync Marker
```bash
docker compose --env-file .env.docker exec postgres psql -U attendance_user -d attendance -x -c "
SELECT count(*) AS baseline_punch_count FROM \"RawPunch\"
WHERE \"zktecoUserId\" = '<TEST_USER_ID>'
  AND \"recordTime\" >= '<ACCEPTANCE_START_UTC>'::timestamptz
  AND \"recordTime\" < '<ACCEPTANCE_END_UTC_EXCLUSIVE>'::timestamptz;

SELECT \"lastSyncAt\" AS pre_stage4_lastSyncAt FROM \"Device\" WHERE \"deviceId\" = 'DEV-<CLIENT_SLUG>-K14-01';
"
```

### Step 2: Physical Action on Hardware
Perform a second punch on the K14 terminal after an observed interval (e.g. 5+ minutes).

### Step 3: Verify Identified Sync Completion
```bash
# Check Pi PM2 worker log:
ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> <PI_USER>@attendance-<CLIENT_SLUG>-pi.local \
  "pm2 logs zkteco-sync-worker --lines 20 --nostream"

# Confirm sync advancement:
docker compose --env-file .env.docker exec postgres psql -U attendance_user -d attendance -x -c "
SELECT \"lastSyncAt\" AS post_stage4_lastSyncAt FROM \"Device\" WHERE \"deviceId\" = 'DEV-<CLIENT_SLUG>-K14-01';
"
```
* **Sync Pass Criteria:** `post_stage4_lastSyncAt` > `pre_stage4_lastSyncAt`.

### Step 4: Post-Action Query & Calculation Delta
```bash
docker compose --env-file .env.docker exec postgres psql -U attendance_user -d attendance -x -c "
SELECT count(*) AS post_punch_count FROM \"RawPunch\"
WHERE \"zktecoUserId\" = '<TEST_USER_ID>'
  AND \"recordTime\" >= '<ACCEPTANCE_START_UTC>'::timestamptz
  AND \"recordTime\" < '<ACCEPTANCE_END_UTC_EXCLUSIVE>'::timestamptz;

SELECT c.\"id\", u.\"zktecoUserId\", c.\"date\", c.\"firstPunchIn\", c.\"lastPunchOut\", 
       c.\"regularHours\", c.\"overtime150Hours\", c.\"overtime200Hours\", c.\"status\", c.\"anomalyReason\"
FROM \"CalculatedDailyReport\" c
JOIN \"User\" u ON c.\"userId\" = u.\"id\"
WHERE u.\"zktecoUserId\" = '<TEST_USER_ID>' 
  AND c.\"date\" = '<ACCEPTANCE_LOCAL_DATE>'::date;
"
```
* **Delta Pass Criteria:**
  * `post_punch_count` = `baseline_punch_count + 1`.
  * `CalculatedDailyReport` populates `firstPunchIn` and `lastPunchOut`.
  * `regularHours` and `status` reflect the configured shift rule for the observed interval.

> [!NOTE]
> **Raw Physical Punch vs Business Calculation:**
> * `RawPunch.recordTime` stores the exact physical timestamp from the biometric hardware.
> * `CalculatedDailyReport.firstPunchIn` / `regularHours` apply shift rules, grace periods, and delay rounding policies. Differences between raw punch times and calculated shift hours reflect business policy, not timestamp errors.

---

## STAGE 5: Deduplication Replay Validation (Baseline → Replay Sync → Zero Delta)

### Step 1: Capture Pre-Replay Baseline Count & Sync Marker
```bash
docker compose --env-file .env.docker exec postgres psql -U attendance_user -d attendance -x -c "
SELECT count(*) AS baseline_count FROM \"RawPunch\" 
WHERE \"zktecoUserId\" = '<TEST_USER_ID>'
  AND \"recordTime\" >= '<ACCEPTANCE_START_UTC>'::timestamptz
  AND \"recordTime\" < '<ACCEPTANCE_END_UTC_EXCLUSIVE>'::timestamptz;

SELECT \"lastSyncAt\" AS pre_replay_lastSyncAt FROM \"Device\" WHERE \"deviceId\" = 'DEV-<CLIENT_SLUG>-K14-01';
"
```

### Step 2: Confirmed Replay Sync Action
Trigger or await a synchronization cycle without creating any new punches on the physical hardware. Confirm from PM2 logs and database sync timestamps that a sync cycle actually ran, polled hardware, and completed:
```bash
ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> <PI_USER>@attendance-<CLIENT_SLUG>-pi.local \
  "pm2 logs zkteco-sync-worker --lines 20 --nostream"

docker compose --env-file .env.docker exec postgres psql -U attendance_user -d attendance -x -c "
SELECT \"lastSyncAt\" AS post_replay_lastSyncAt FROM \"Device\" WHERE \"deviceId\" = 'DEV-<CLIENT_SLUG>-K14-01';
"
```
* **Verification:** Log must show active connection to terminal and successful API push completion with `post_replay_lastSyncAt > pre_replay_lastSyncAt`. A test where no synchronization occurred is invalid and must **FAIL**.

### Step 3: Post-Replay Query & Zero-Delta Verification
```bash
docker compose --env-file .env.docker exec postgres psql -U attendance_user -d attendance -c "
SELECT count(*) AS post_replay_count FROM \"RawPunch\" 
WHERE \"zktecoUserId\" = '<TEST_USER_ID>'
  AND \"recordTime\" >= '<ACCEPTANCE_START_UTC>'::timestamptz
  AND \"recordTime\" < '<ACCEPTANCE_END_UTC_EXCLUSIVE>'::timestamptz;
"
```
* **Pass Criteria:** `post_replay_count` == `baseline_count`. Replaying already-ingested hardware records produces **ZERO NEW `RawPunch` rows** for the tested scope.

---

## STAGE 6: Bridge Reboot Persistence

1. **Execute Controlled Reboot on Pi:**
   ```bash
   ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> <PI_USER>@attendance-<CLIENT_SLUG>-pi.local "sudo reboot"
   ```
2. **Reconnect after Boot (preventing local workstation shell expansion):**
   ```bash
   ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> <PI_USER>@attendance-<CLIENT_SLUG>-pi.local \
     "uptime; pm2 status; systemctl is-active pm2-<PI_USER>.service"
   ```
* **Pass Criteria:**
  * Pi reconnects cleanly.
  * `zkteco-sync-worker` status is `online`.
  * `pm2-<PI_USER>.service` is `active`.
  * Heartbeat telemetry advances on cloud dashboard.

> [!WARNING]
> **Outage Resilience Boundary (Historical D5 Finding):**
> Historical D5 validation proved:
> * The worker process survived a short API outage.
> * Polling resumed automatically afterward.
>
> Historical D5 validation did **NOT** prove:
> * Durable local queuing.
> * Arbitrary offline buffering.
> * Zero data loss.
> * Ingestion/catch-up of punches created during the tested outage.

---

## STAGE 7: Production Dashboard Visual Inspection

Open `https://<APP_DOMAIN>` in the client's web browser:

1. Log in with `<ADMIN_EMAIL>`.
2. Inspect the **Tableau de Bord** (`/`):
   * Test employee appears with live attendance status.
3. Inspect **Centre d'Exportations & Rapports** (`/reports`):
   * Row for `<ACCEPTANCE_LOCAL_DATE>` displays raw punch pills `[HH:MM]`.
   * Hours and calculation columns display accurately without timezone offset errors.
4. Inspect **Gestion des Horaires** (`/shifts`) and **Gestion des Artisans** (`/artisans`):
   * Configured shift and test employee reflect expected values.
5. Inspect **Configuration** (`/settings`):
   * Database, Bridge, and Terminal indicators show `Connecté` (Green).
* **Pass Criteria:** All UI views render cleanly without console errors or missing assets.
