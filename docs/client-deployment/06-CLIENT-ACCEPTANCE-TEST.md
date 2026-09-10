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
  "/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 logs zkteco-sync-worker --lines 25 --nostream"

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
  "/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 logs zkteco-sync-worker --lines 20 --nostream"

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
  "/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 logs zkteco-sync-worker --lines 20 --nostream"

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

### Step 1: Capture Pre-Reboot Evidence & Trigger Controlled Reboot
Capture the pre-reboot boot ID locally on the operator workstation (so it survives the reboot), preflight sudo, and trigger controlled reboot:

```bash
# A. Allocate secure local file on operator workstation for pre-boot kernel ID:
LOCAL_PRE_BOOT_FILE=$(mktemp /tmp/acceptance_pre_boot_id.XXXXXX) || {
  echo "ERROR: Failed to allocate local pre-boot file on operator workstation. STOP." >&2
  exit 1
}
chmod 600 "$LOCAL_PRE_BOOT_FILE" || {
  echo "ERROR: Failed to set mode 600 on $LOCAL_PRE_BOOT_FILE. STOP." >&2
  rm -f "$LOCAL_PRE_BOOT_FILE"
  exit 1
}

# Capture pre-reboot boot_id from Pi over SSH to operator workstation:
ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> <PI_USER>@attendance-<CLIENT_SLUG>-pi.local \
  "cat /proc/sys/kernel/random/boot_id" > "$LOCAL_PRE_BOOT_FILE" || {
  echo "ERROR: Failed to retrieve pre-reboot boot_id over SSH. STOP." >&2
  rm -f "$LOCAL_PRE_BOOT_FILE"
  exit 1
}

UUID_REGEX='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
PRE_ID=$(tr -d '[:space:]' < "$LOCAL_PRE_BOOT_FILE")
if ! echo "$PRE_ID" | grep -qE "$UUID_REGEX"; then
  echo "ERROR: Pre-reboot boot_id is not a valid UUID ('$PRE_ID'). STOP." >&2
  rm -f "$LOCAL_PRE_BOOT_FILE"
  exit 1
fi
echo "Pre-reboot boot_id recorded and validated on operator workstation: $PRE_ID"

# NOTE: Post-reboot sync baseline is captured ONLY AFTER proving the new boot.
# Do NOT rely on pre-reboot lastSyncAt as the decisive gate boundary.

# B. Preflight non-interactive sudo capability on Pi before reboot:
ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> <PI_USER>@attendance-<CLIENT_SLUG>-pi.local "sudo -n true" || {
  echo "ERROR: Non-interactive sudo capability check failed on Pi. STOP." >&2
  rm -f "$LOCAL_PRE_BOOT_FILE"
  exit 1
}

# C. Trigger Controlled Software Reboot:
# Issue reboot command; connection termination (exit 0 or 255) is expected on reboot:
set +e
ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> <PI_USER>@attendance-<CLIENT_SLUG>-pi.local "sudo reboot"
REBOOT_CMD_STATUS=$?
set -e
if [ "$REBOOT_CMD_STATUS" -ne 0 ] && [ "$REBOOT_CMD_STATUS" -ne 255 ]; then
  echo "ERROR: Reboot command failed with unexpected exit status $REBOOT_CMD_STATUS. STOP." >&2
  rm -f "$LOCAL_PRE_BOOT_FILE"
  exit 1
fi

# Independently verify Pi host actually disconnects/shuts down within 30s:
echo "Verifying Pi host actually disconnects..."
DOWN=false
for i in $(seq 1 30); do
  if ! ssh -q -i ~/.ssh/id_ed25519_<CLIENT_SLUG> -o ConnectTimeout=2 -o BatchMode=yes <PI_USER>@attendance-<CLIENT_SLUG>-pi.local "true" 2>/dev/null; then
    DOWN=true
    echo "Pi host shutdown confirmed (disconnected at ${i}s)."
    break
  fi
  sleep 1
done
if [ "$DOWN" != true ]; then
  echo "ERROR: Pi host remained reachable 30s after reboot command! Machine did not shut down. STOP." >&2
  rm -f "$LOCAL_PRE_BOOT_FILE"
  exit 1
fi

# Bounded poll for SSH reachability recovery (up to 120s):
echo "Waiting for Raspberry Pi to boot and restore SSH reachability..."
UP=false
for i in $(seq 1 40); do
  if ssh -q -i ~/.ssh/id_ed25519_<CLIENT_SLUG> -o ConnectTimeout=3 -o BatchMode=yes <PI_USER>@attendance-<CLIENT_SLUG>-pi.local "true" 2>/dev/null; then
    UP=true
    echo "Raspberry Pi reconnected after ${i} checks."
    break
  fi
  sleep 3
done
if [ "$UP" != true ]; then
  echo "ERROR: Raspberry Pi failed to recover SSH reachability within timeout. STOP." >&2
  rm -f "$LOCAL_PRE_BOOT_FILE"
  exit 1
fi
```

### Step 2: Post-Reboot Verification (Reboot Proof, Infrastructure, Baseline & Typed Sync Delta)
```bash
# A. Authenticate OS Reboot (boot_id MUST change and be valid UUID):
POST_ID=$(ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> <PI_USER>@attendance-<CLIENT_SLUG>-pi.local "cat /proc/sys/kernel/random/boot_id" | tr -d '[:space:]')
if ! echo "$POST_ID" | grep -qE "$UUID_REGEX"; then
  echo "ERROR: Post-reboot boot_id is not a valid UUID ('$POST_ID'). STOP." >&2
  rm -f "$LOCAL_PRE_BOOT_FILE"
  exit 1
fi

if [ "$PRE_ID" = "$POST_ID" ]; then
  echo "ERROR: Boot ID unchanged ($POST_ID). OS reboot did not occur! STOP." >&2
  rm -f "$LOCAL_PRE_BOOT_FILE"
  exit 1
fi
rm -f "$LOCAL_PRE_BOOT_FILE"
echo "OS Reboot PROVEN: Pre-boot ID ($PRE_ID) -> Post-boot ID ($POST_ID)"

# B. Establish Post-Boot Sync Baseline in Cloud Database:
# Only AFTER proving the new boot, query Device.lastSyncAt to form the baseline:
cd /opt/attendance/zk-k14-commercial
DEVICE_ID="DEV-<CLIENT_SLUG>-K14-01"

BASELINE_QUERY="SELECT COALESCE(TO_CHAR(\"lastSyncAt\" AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'), 'NULL') FROM \"Device\" WHERE \"deviceId\" = '$DEVICE_ID';"

set +e
POST_BOOT_BASELINE_RAW=$(docker compose --env-file .env.docker exec -T postgres psql -U attendance_user -d attendance -t -A -c "$BASELINE_QUERY" 2>&1)
DB_BASELINE_STATUS=$?
set -e

if [ "$DB_BASELINE_STATUS" -ne 0 ]; then
  echo "ERROR: Failed to query baseline Device.lastSyncAt from database (status $DB_BASELINE_STATUS): $POST_BOOT_BASELINE_RAW. STOP." >&2
  exit 1
fi

POST_BOOT_BASELINE=$(echo "$POST_BOOT_BASELINE_RAW" | tr -d '[:space:]')
if [ -z "$POST_BOOT_BASELINE" ] || [ "$POST_BOOT_BASELINE" = "NULL" ]; then
  echo "ERROR: Device '$DEVICE_ID' returned NULL or empty lastSyncAt baseline! Device must have an established sync baseline. STOP." >&2
  exit 1
fi
echo "Post-boot database baseline established: lastSyncAt = $POST_BOOT_BASELINE"

# C. Capture Post-Boot Log File Identity & Baseline Byte Size on Pi:
LOG_PATH="/home/<PI_USER>/.pm2/logs/zkteco-sync-worker-out.log"

set +e
LOG_STAT_RAW=$(ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> <PI_USER>@attendance-<CLIENT_SLUG>-pi.local \
  "test -f '$LOG_PATH' && test -r '$LOG_PATH' && stat -c '%d %i %s' '$LOG_PATH'" 2>&1)
STAT_STATUS=$?
set -e

if [ "$STAT_STATUS" -ne 0 ] || [ -z "$LOG_STAT_RAW" ]; then
  echo "ERROR: Failed to stat log file '$LOG_PATH' on Pi (status $STAT_STATUS): $LOG_STAT_RAW. STOP." >&2
  exit 1
fi

BASE_LOG_DEV=$(echo "$LOG_STAT_RAW" | awk '{print $1}')
BASE_LOG_INODE=$(echo "$LOG_STAT_RAW" | awk '{print $2}')
BASE_LOG_SIZE=$(echo "$LOG_STAT_RAW" | awk '{print $3}')

if ! echo "$BASE_LOG_DEV" | grep -qE '^[0-9]+$' || \
   ! echo "$BASE_LOG_INODE" | grep -qE '^[1-9][0-9]*$' || \
   ! echo "$BASE_LOG_SIZE" | grep -qE '^[0-9]+$'; then
  echo "ERROR: Malformed log metadata from Pi: '$LOG_STAT_RAW'. STOP." >&2
  exit 1
fi
echo "Post-boot log boundary established: dev=$BASE_LOG_DEV inode=$BASE_LOG_INODE offset=${BASE_LOG_SIZE}B"

# D. Execute remote fail-closed service, daemon, worker, and ownership correlation assertions:
ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> <PI_USER>@attendance-<CLIENT_SLUG>-pi.local '
  set -e

  # 1. PM2 systemd service state:
  test "$(systemctl is-enabled pm2-<PI_USER>.service)" = "enabled"
  test "$(systemctl is-active pm2-<PI_USER>.service)" = "active"

  # 2. PM2 daemon executable is /opt/node24/bin/node and count is exactly 1:
  DAEMON_PIDS=$(pgrep -u <PI_USER> -f "PM2 v[0-9]|PM2.*Daemon|PM2.*God Daemon")
  test $(echo "$DAEMON_PIDS" | grep -v "^$" | wc -l) -eq 1
  PM2_DAEMON_PID=$(echo "$DAEMON_PIDS" | tr -d "[:space:]")
  test "$(readlink -f /proc/$PM2_DAEMON_PID/exe)" = "/opt/node24/bin/node"

  # 3. Query PM2 process table and extract online PID:
  PM2_JSON=$(/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 jlist)
  PM2_WORKER_PID=$(/opt/node24/bin/node -e "
    const data = JSON.parse(process.argv[1]);
    if (!Array.isArray(data) || data.length !== 1) process.exit(1);
    const p = data[0];
    if (p.name !== \"zkteco-sync-worker\" || (p.pm2_env && p.pm2_env.status) !== \"online\") process.exit(1);
    if (typeof p.pid !== \"number\" || p.pid <= 0) process.exit(1);
    console.log(p.pid);
  " "$PM2_JSON")
  test -n "$PM2_WORKER_PID"

  # 4. Query OS process table independently:
  OS_WORKER_PIDS=$(pgrep -f "dist/index.js")
  test $(echo "$OS_WORKER_PIDS" | wc -l) -eq 1
  OS_WORKER_PID=$(echo "$OS_WORKER_PIDS" | tr -d "[:space:]")

  # 5. Ownership correlation: OS worker PID MUST match PM2 online PID:
  test "$OS_WORKER_PID" = "$PM2_WORKER_PID"

  # 6. Correlated worker executable, cwd, and cmdline:
  test "$(readlink -f /proc/$PM2_WORKER_PID/exe)" = "/opt/node24/bin/node"
  test "$(readlink -f /proc/$PM2_WORKER_PID/cwd)" = "/opt/attendance-bridge"
  tr "\0" " " < "/proc/$PM2_WORKER_PID/cmdline" | grep -q "/opt/attendance-bridge/dist/index.js"

  # 7. Saved PM2 state in dump.pm2 contains exactly 1 worker under /opt/node24/bin/node:
  /opt/node24/bin/node -e "
    const fs = require(\"fs\");
    const dump = JSON.parse(fs.readFileSync(\"/home/<PI_USER>/.pm2/dump.pm2\", \"utf8\"));
    if (!Array.isArray(dump) || dump.length !== 1) process.exit(1);
    const p = dump[0];
    const interp = p.exec_interpreter || (p.pm2_env && p.pm2_env.exec_interpreter) || (p.pm2_env && p.pm2_env.pm_exec_interpreter);
    if (p.name !== \"zkteco-sync-worker\" || interp !== \"/opt/node24/bin/node\") process.exit(1);
  "

  # 8. K14 TCP port 4370 connectivity:
  nc -z -w 5 <K14_IP> 4370

  echo "Post-reboot infrastructure & ownership correlation assertions PASSED."
' || {
  echo "ERROR: Remote post-reboot assertions failed! STOP." >&2
  exit 1
}

# E. Verify Post-Baseline Sync Completion & Typed Database Advancement:
# 1. Bounded database polling loop: poll every 15s, maximum 64 iterations (16 minutes = 960s).
# The bridge cron schedule is */15 * * * *; 16 minutes guarantees coverage of at least one full scheduled opportunity.
POLL_INTERVAL=15
MAX_ITERATIONS=64
SYNC_CONFIRMED=false

echo "Polling PostgreSQL for post-boot sync completion (every ${POLL_INTERVAL}s, max 16m)..."

for i in $(seq 1 "$MAX_ITERATIONS"); do
  set +e
  ADVANCE_RAW=$(docker compose --env-file .env.docker exec -T postgres psql -U attendance_user -d attendance -t -A -F '|' -c "
    SELECT (\"lastSyncAt\" > '$POST_BOOT_BASELINE'::timestamptz) AS advanced,
           COALESCE(TO_CHAR(\"lastSyncAt\" AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'), 'NULL') AS current_sync
    FROM \"Device\"
    WHERE \"deviceId\" = '$DEVICE_ID';
  " 2>&1)
  QUERY_STATUS=$?
  set -e

  if [ "$QUERY_STATUS" -ne 0 ]; then
    echo "ERROR: Database query failed on iteration $i (status $QUERY_STATUS): $ADVANCE_RAW. STOP." >&2
    exit 1
  fi

  IS_ADVANCED=$(echo "$ADVANCE_RAW" | cut -d'|' -f1 | tr -d '[:space:]')
  CURRENT_SYNC=$(echo "$ADVANCE_RAW" | cut -d'|' -f2 | tr -d '[:space:]')

  if [ "$IS_ADVANCED" = "t" ] || [ "$IS_ADVANCED" = "true" ]; then
    SYNC_CONFIRMED=true
    echo "PASS: Server-side sync advancement detected at iteration $i ($((i * POLL_INTERVAL))s elapsed)."
    echo "Baseline:     $POST_BOOT_BASELINE"
    echo "New lastSync: $CURRENT_SYNC"
    break
  fi

  sleep "$POLL_INTERVAL"
done

if [ "$SYNC_CONFIRMED" != true ]; then
  echo "ERROR: Timed out after 16 minutes awaiting post-boot sync advancement beyond $POST_BOOT_BASELINE! STOP." >&2
  exit 1
fi

# 2. Re-stat log file on Pi and detect rotation, replacement, or truncation:
set +e
CUR_STAT_RAW=$(ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> <PI_USER>@attendance-<CLIENT_SLUG>-pi.local \
  "test -f '$LOG_PATH' && test -r '$LOG_PATH' && stat -c '%d %i %s' '$LOG_PATH'" 2>&1)
CUR_STAT_STATUS=$?
set -e

if [ "$CUR_STAT_STATUS" -ne 0 ] || [ -z "$CUR_STAT_RAW" ]; then
  echo "ERROR: Failed to re-stat log file '$LOG_PATH' on Pi (status $CUR_STAT_STATUS): $CUR_STAT_RAW. STOP." >&2
  exit 1
fi

CUR_LOG_DEV=$(echo "$CUR_STAT_RAW" | awk '{print $1}')
CUR_LOG_INODE=$(echo "$CUR_STAT_RAW" | awk '{print $2}')
CUR_LOG_SIZE=$(echo "$CUR_STAT_RAW" | awk '{print $3}')

if ! echo "$CUR_LOG_DEV" | grep -qE '^[0-9]+$' || \
   ! echo "$CUR_LOG_INODE" | grep -qE '^[1-9][0-9]*$' || \
   ! echo "$CUR_LOG_SIZE" | grep -qE '^[0-9]+$'; then
  echo "ERROR: Malformed current log metadata from Pi: '$CUR_STAT_RAW'. STOP." >&2
  exit 1
fi

if [ "$CUR_LOG_DEV" != "$BASE_LOG_DEV" ] || [ "$CUR_LOG_INODE" != "$BASE_LOG_INODE" ]; then
  echo "ERROR: Log file rotated or replaced between baseline and verification! Base inode: $BASE_LOG_INODE, Current inode: $CUR_LOG_INODE. STOP." >&2
  exit 1
fi

if [ "$CUR_LOG_SIZE" -lt "$BASE_LOG_SIZE" ]; then
  echo "ERROR: Log file truncated between baseline and verification! Base size: ${BASE_LOG_SIZE}B, Current size: ${CUR_LOG_SIZE}B. STOP." >&2
  exit 1
fi

if [ "$CUR_LOG_SIZE" -eq "$BASE_LOG_SIZE" ]; then
  echo "ERROR: Zero bytes appended to log file after post-boot baseline! STOP." >&2
  exit 1
fi

# 3. Inspect ONLY bytes appended strictly after local validated BASE_LOG_SIZE:
START_BYTE=$((BASE_LOG_SIZE + 1))
POST_LOGS=$(ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> <PI_USER>@attendance-<CLIENT_SLUG>-pi.local \
  "tail -c +${START_BYTE} '$LOG_PATH'")

if [ -z "$POST_LOGS" ]; then
  echo "ERROR: Appended log content is empty after byte offset $BASE_LOG_SIZE! STOP." >&2
  exit 1
fi

# Assert required worker execution sequence occurred in appended content:
echo "$POST_LOGS" | grep -qE "\[ZKTeco\] Connecting to terminal at " || {
  echo "ERROR: Appended post-baseline logs missing terminal connection attempt. STOP." >&2
  exit 1
}
echo "$POST_LOGS" | grep -qE "\[SyncWorker\] Read [0-9]+ punch records and [0-9]+ users from hardware\." || {
  echo "ERROR: Appended post-baseline logs missing hardware read confirmation. STOP." >&2
  exit 1
}
echo "$POST_LOGS" | grep -qE "\[SyncWorker\] Sync complete! Stats: Received [0-9]+, Inserted [0-9]+, Duplicates [0-9]+" || {
  echo "ERROR: Appended post-baseline logs missing successful API completion log. STOP." >&2
  exit 1
}

# Verify logical ordering of cycle events:
CONN_LINE=$(echo "$POST_LOGS" | grep -nE "\[ZKTeco\] Connecting to terminal at " | head -n 1 | cut -d: -f1)
READ_LINE=$(echo "$POST_LOGS" | grep -nE "\[SyncWorker\] Read [0-9]+ punch records and [0-9]+ users from hardware\." | head -n 1 | cut -d: -f1)
SYNC_LINE=$(echo "$POST_LOGS" | grep -nE "\[SyncWorker\] Sync complete! Stats: Received [0-9]+, Inserted [0-9]+, Duplicates [0-9]+" | head -n 1 | cut -d: -f1)

if [ "$CONN_LINE" -gt "$READ_LINE" ] || [ "$READ_LINE" -gt "$SYNC_LINE" ]; then
  echo "ERROR: Appended log events appeared in illogical order (conn: line $CONN_LINE, read: line $READ_LINE, sync: line $SYNC_LINE). STOP." >&2
  exit 1
fi

echo "Post-reboot sync PROVEN: Database lastSyncAt advanced ($POST_BOOT_BASELINE -> $CURRENT_SYNC) AND worker completed post-baseline cycle successfully in validated log range."
```

* **Pass Criteria:**
  * Pre/Post `boot_id` differ (actual kernel reboot proven via workstation-stored evidence).
  * `pm2-<PI_USER>.service` is `enabled` and `active`.
  * PM2 daemon executable is `/opt/node24/bin/node` and daemon PID count is exactly 1.
  * PM2 online worker PID strictly correlates with OS worker PID (`OS_PID == PM2_PID`).
  * Worker process executable is `/opt/node24/bin/node` with cwd `/opt/attendance-bridge` and script `/opt/attendance-bridge/dist/index.js`.
  * Exactly 1 attendance poller is active across OS and PM2 tables.
  * Saved `dump.pm2` state contains exactly 1 worker under `/opt/node24/bin/node`.
  * K14 TCP port 4370 responds to connection probe.
  * Database verifies typed post-boot advancement (`lastSyncAt > POST_BOOT_BASELINE`) within bounded 16-minute scheduled wait.
  * Worker logs strictly appended after validated byte offset confirm log identity (same device/inode, zero rotation/truncation), K14 connection, records read, and cloud API push completion in logical order.
  * Initial boot `connect ENETUNREACH` (if present before network carrier is negotiated) automatically recovers on the second connection attempt.
  * Heartbeat telemetry advances on cloud dashboard.

> [!IMPORTANT]
> **Controlled Software Reboot vs Cold Power Loss:**
> Stage 6 validates **controlled software reboot persistence** (`sudo reboot`).
> It does **NOT** validate cold power-loss, abrupt power cuts, or ungraceful unplug-and-replug resilience, which remains **NOT-VALIDATED**.

> [!WARNING]
> **Outage Resilience Boundary (Historical D5 Finding):**
> Historical D5 validation proved:
> * The worker process survived a short API outage.
> * Polling resumed automatically afterward.
>
> Historical D5 validation did **NOT** prove:
> * Durable local queuing.
> * Arbitrary offline buffering during extended cloud outages.
> * Zero data loss across prolonged network failures.
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
