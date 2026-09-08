# 07 — BACKUP AND DISASTER RECOVERY
# Off-Site Replication & Isolated Disaster Recovery Protocol

This document defines the automated backup pipeline, Cloudflare R2 off-site synchronization, and isolated disaster recovery verification procedure for ensuring data durability and business continuity.

---

## 1. Backup Architecture & Storage Format

```
┌──────────────────────────────────────────────────────────┐
│ Cloud VPS PostgreSQL Database (Service: postgres)        │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼ (Atomic pg_dump -Fc)
┌──────────────────────────────────────────────────────────┐
│ Local Backup Directory: backups/postgres/                │
│ - attendance_<TIMESTAMP>.dump (PostgreSQL Custom Archive)│
│ - attendance_<TIMESTAMP>.dump.sha256 (SHA-256 Sidecar)   │
│ (7-Day Local Retention Policy)                           │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼ (HTTPS S3 API Upload)
┌──────────────────────────────────────────────────────────┐
│ Cloudflare R2 Global Object Storage                      │
│ Bucket: zk-k14-commercial-backups                        │
│ Path: client-<CLIENT_SLUG>/postgres/<YYYY>/<MM>/         │
│ - attendance_<TIMESTAMP>.dump                            │
│ - attendance_<TIMESTAMP>.dump.sha256                     │
│ - attendance_<TIMESTAMP>.dump.complete (Atomic Marker)   │
│ (30-Day Remote Retention Policy)                         │
└──────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Data Security & Isolation Boundaries:**
> 1. **Format:** Backups are PostgreSQL custom-format archives (`.dump`), **NOT tarballs**.
> 2. **Integrity:** Every archive is preflight-checked via `pg_restore --list` before upload and accompanied by a `.sha256` checksum.
> 3. **Encryption:** Cloudflare R2 provider-level storage encryption is relied upon as a provider property; this repository does not configure independent application-level client-side encryption. Backups use HTTPS/TLS in transit.
> 4. **Tenant Isolation:** The R2 client prefix (`client-<CLIENT_SLUG>/`) provides logical folder organization, not cryptographic credential-level isolation.
> 5. **Environment Reconstruction:** The database backup preserves data rows, but full environment recovery also requires restoring `.env.docker`, `.env.backup`, Caddy configuration, and DNS records.

---

## 2. Automated Daily Backup Execution

The backup pipeline is executed via `/opt/attendance/zk-k14-commercial/scripts/backup-full.sh`:

```bash
cd /opt/attendance/zk-k14-commercial
./scripts/backup-full.sh
```

### Automated Pipeline Steps:
1. **Concurrency Lock:** Acquires non-blocking lock (`/tmp/zk_commercial_backup.lock` via `flock` or atomic directory `/tmp/zk_commercial_backup.lock.d`).
2. **Atomic Dump:** Creates custom-format PostgreSQL archive (`pg_dump -Fc`) from `zk_postgres`.
3. **Local Integrity Preflight:** Verifies archive structure using `pg_restore --list`.
4. **Checksum Generation:** Generates SHA-256 hash file (`.sha256`).
5. **R2 Upload:** Uploads `.dump`, `.sha256`, and atomic `.complete` completion marker.
6. **Remote Verification:** Validates object existence and byte size on Cloudflare R2.
7. **Retention Enforcement:** Best-effort policy enforcement according to script behavior: prunes local dumps older than 7 days and remote R2 dumps older than 30 days under the client's prefix (does not guarantee exact immediate deletion).

---

## 3. Production Backup Scheduler Installation (MUTUALLY EXCLUSIVE CHOICE)

> [!WARNING]
> **Duplicate Scheduler Prevention:**
> Backup scheduler installation is a **MUTUALLY EXCLUSIVE CHOICE**. Choose either **Option A (Systemd Timer — Preferred)** OR **Option B (Host Crontab — Alternative)**.
> 
> Before installing, inspect active systemd units and crontabs across both root and deployer users to prevent duplicate execution:
> ```bash
> # 1. Check systemd timer registration:
> systemctl list-timers --all 2>/dev/null | grep "zk-commercial-backup.timer" || echo "Systemd timer: NOT INSTALLED"
> 
> # 2. Check root crontab:
> sudo crontab -l 2>/dev/null | grep -E 'backup-full\.sh|backup:full' || echo "Root crontab: NONE"
> 
> # 3. Check current user crontab:
> crontab -l 2>/dev/null | grep -E 'backup-full\.sh|backup:full' || echo "User crontab: NONE"
> ```
> **STOP** if any active schedule already exists. Reconcile or uninstall (`sudo ./scripts/install-backup-schedule.sh --uninstall`) before proceeding.

### Option A: Systemd Timer (Preferred Production Path)
* **Service Unit:** `zk-commercial-backup.service` (Type: `oneshot`, runs `/opt/attendance/zk-k14-commercial/scripts/backup-full.sh`).
* **Timer Unit:** `zk-commercial-backup.timer` (`OnCalendar=*-*-* 03:00:00 Africa/Casablanca`, `Persistent=true`, `RandomizedDelaySec=60`).
* **Execution Identity:** Systemd runs the service as `root` after `docker.service`.
* **Tooling Dependencies:** System `PATH` must resolve `docker`, `aws` (AWS CLI for S3/R2), and PostgreSQL client utilities.
* **Logging Destination:** Systemd journal (`StandardOutput=journal`, `StandardError=journal`, identifier `zk-attendance-backup`).

```bash
cd /opt/attendance/zk-k14-commercial
sudo ./scripts/install-backup-schedule.sh --systemd

# Verify timer status and next scheduled trigger:
sudo systemctl status zk-commercial-backup.timer
systemctl list-timers zk-commercial-backup.timer --no-pager

# CONTROLLED REAL BACKUP EXECUTION:
# (Executes an approved, non-destructive live test backup run via systemd service)
sudo systemctl start zk-commercial-backup.service
journalctl -u zk-commercial-backup.service -n 30 --no-pager
```

### Option B: Host Crontab (Alternative Path)
* **Installer Behavior:** Automatically detects `npm` binary path and configures:
  `CRON_TZ=Africa/Casablanca`
  `0 3 * * * cd /opt/attendance/zk-k14-commercial && <NPM_BIN> run backup:full >> /var/log/attendance-backup.log 2>&1`
* **Environment:** Does not inject a custom `PATH` line; relies on qualified `<NPM_BIN>` path and standard system cron environment.
* **Log File Ownership:** `/var/log/attendance-backup.log` must be writable by the crontab user.

```bash
cd /opt/attendance/zk-k14-commercial
./scripts/install-backup-schedule.sh --cron

# Verify crontab entry:
crontab -l | grep "backup:full"
```

### Failure Notification Configuration Gate
> [!CAUTION]
> **NO FAILURE ALERTING EXISTS UNTIL NOTIFICATION DESTINATION IS CONFIGURED AND TESTED.**
> The error handler `scripts/notify-backup-failure.sh` exits silently without sending an alert if `BACKUP_ALERT_WEBHOOK_URL` is unset or empty.
> * Document the designated alert recipient in `00-CLIENT-INFORMATION-FORM.md`.
> * Set `BACKUP_ALERT_WEBHOOK_URL` in `/opt/attendance/zk-k14-commercial/.env.backup`.
> * Test notification delivery before declaring backup automation operational.

---

## 4. Concurrency Locking Diagnostics

> [!WARNING]
> **Lock Diagnostics — Never Delete Blindly:**
> The lock file `/tmp/zk_commercial_backup.lock` normally persists on the filesystem between runs. File existence alone does **NOT** indicate a stale or broken lock.

### Inspect Active Lock Holder:
```bash
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
* If an active backup process holds the lock, allow it to complete.
* Only if no active process holds the lock AND an unhandled crash occurred should the operator investigate backup logs before removing stale lock artifacts.

---

## 5. Isolated Disaster Recovery (DR) Protocol

> [!CAUTION]
> **Strict Disaster Recovery Rule:**
> * **NEVER** restore a backup directly over the active production database during DR testing.
> * Always restore into a dynamically generated, unique disposable validation database (`<UNIQUE_DR_DATABASE>`) and unique temporary directory (`<UNIQUE_DR_DIR>`).

### Step 1: Allocate Unique DR Workspace (Fail-Closed Allocation & State Tracking)
```bash
# Initialize artifact creation state tracking
database_created=false
directory_created=false

# 1. Allocate unique private temporary directory with secure permissions
UNIQUE_DR_DIR=$(mktemp -d /tmp/dr_val_XXXXXX) || { echo "ERROR: mktemp -d failed"; exit 1; }
directory_created=true
chmod 700 "$UNIQUE_DR_DIR" || { echo "ERROR: chmod failed"; rm -rf "$UNIQUE_DR_DIR"; exit 1; }

# Fail-closed validation of allocated directory:
test -d "$UNIQUE_DR_DIR" || { echo "ERROR: Not a directory"; exit 1; }
test ! -L "$UNIQUE_DR_DIR" || { echo "ERROR: Symlink detected"; rm -rf "$UNIQUE_DR_DIR"; exit 1; }
test "$(stat -c '%u' "$UNIQUE_DR_DIR")" = "$(id -u)" || { echo "ERROR: Ownership mismatch"; rm -rf "$UNIQUE_DR_DIR"; exit 1; }
test "$(stat -c '%a' "$UNIQUE_DR_DIR")" = "700" || { echo "ERROR: Permissions are not 700"; rm -rf "$UNIQUE_DR_DIR"; exit 1; }

# 2. Generate high-entropy unique database name and verify non-empty generation
RANDOM_SUFFIX=$(od -vN 4 -An -tx1 /dev/urandom | tr -d ' \n') || { echo "ERROR: urandom generation failed"; rm -rf "$UNIQUE_DR_DIR"; exit 1; }
test -n "$RANDOM_SUFFIX" || { echo "ERROR: Empty random suffix generated"; rm -rf "$UNIQUE_DR_DIR"; exit 1; }
UNIQUE_DR_DB="attendance_dr_${RANDOM_SUFFIX}"

# 3. Query PostgreSQL to verify target validation database does NOT already exist
DB_EXISTS=$(docker compose --env-file .env.docker exec -T postgres psql -U attendance_user -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname = '${UNIQUE_DR_DB}';" 2>/dev/null) || {
  echo "ERROR: PostgreSQL query failed; cannot verify database non-existence";
  rm -rf "$UNIQUE_DR_DIR";
  exit 1;
}

if [ "$DB_EXISTS" = "1" ]; then
  echo "ERROR: Generated target database ${UNIQUE_DR_DB} unexpectedly exists. Halting.";
  rm -rf "$UNIQUE_DR_DIR";
  exit 1;
fi

echo "Allocated DR Workspace: ${UNIQUE_DR_DIR}"
echo "Allocated DR Target DB: ${UNIQUE_DR_DB}"
```

### Step 2: Download Remote Backup from Cloudflare R2
```bash
cd /opt/attendance/zk-k14-commercial
./scripts/list-remote-backups.sh

# Download selected backup using helper into the allocated private directory
./scripts/download-backup-r2.sh "client-<CLIENT_SLUG>/postgres/YYYY/MM/attendance_<TIMESTAMP>.dump" "${UNIQUE_DR_DIR}"
```
* **Pass Criteria:** Helper script verifies SHA-256 checksum against `.sha256` and confirms the `.complete` marker.

### Step 3: Restore into Disposable Validation Database
```bash
# Execute isolated restore into unique validation DB
./scripts/restore-postgres.sh "${UNIQUE_DR_DIR}/attendance_<TIMESTAMP>.dump" "${UNIQUE_DR_DB}" "--keep" && database_created=true
```

> [!WARNING]
> **Restore Script Limitation Notice:**
> `restore-postgres.sh` currently tolerates `pg_restore` exit status 1 without proving that all underlying warnings/errors are harmless.
> Therefore, DR validation must **NOT** rely on exit status alone; it must include rigorous read-only entity, schema, and relationship audits (Step 4) to prove data fidelity.

### Step 4: Audit Restored Data (Read-Only Schema & Relationship Integrity Checks)
```bash
# 1. Verify that all core application tables exist in the restored catalog:
docker compose --env-file .env.docker exec postgres psql -U attendance_user -d "${UNIQUE_DR_DB}" -c "
SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
ORDER BY tablename;
"

# 2. Audit entity counts across core domain models:
docker compose --env-file .env.docker exec postgres psql -U attendance_user -d "${UNIQUE_DR_DB}" -c "
SELECT count(*) AS devices FROM \"Device\";
SELECT count(*) AS users FROM \"User\";
SELECT count(*) AS shifts FROM \"Shift\";
SELECT count(*) AS punches FROM \"RawPunch\";
SELECT count(*) AS reports FROM \"CalculatedDailyReport\";
SELECT count(*) AS settings FROM \"SystemSettings\";
"

# 3. Audit relationship and schema integrity:
docker compose --env-file .env.docker exec postgres psql -U attendance_user -d "${UNIQUE_DR_DB}" -x -c "
-- Verify SystemSettings singleton row readability:
SELECT \"id\", \"companyName\", \"adminEmail\", \"timezone\" FROM \"SystemSettings\" LIMIT 1;

-- Verify User to Shift foreign-key relationship readability:
SELECT u.\"id\", u.\"zktecoUserId\", u.\"firstName\", u.\"lastName\", s.\"name\" AS shift_name
FROM \"User\" u
LEFT JOIN \"Shift\" s ON u.\"shiftId\" = s.\"id\"
LIMIT 5;

-- Verify RawPunch timestamp ordering and constraints:
SELECT \"id\", \"zktecoUserId\", \"recordTime\", \"type\", \"state\"
FROM \"RawPunch\"
ORDER BY \"recordTime\" DESC
LIMIT 5;
"
```
* **Pass Criteria:** Core tables exist, entity counts match production expectations, relational joins execute cleanly, and singleton `SystemSettings` is readable.

### Step 5: Clean Up Validation Artifacts (Strictly Scoped by State Tracking)
```bash
# Drop validation database ONLY if it was successfully created during this test run:
if [ "$database_created" = "true" ]; then
  echo "Dropping disposable DR database ${UNIQUE_DR_DB}..."
  docker compose --env-file .env.docker exec postgres psql -U attendance_user -d postgres -c "DROP DATABASE \"${UNIQUE_DR_DB}\";"
fi

# Remove temporary directory ONLY if successfully allocated by this procedure:
if [ "$directory_created" = "true" ] && [ -n "$UNIQUE_DR_DIR" ] && [ -d "$UNIQUE_DR_DIR" ]; then
  echo "Removing disposable DR workspace ${UNIQUE_DR_DIR}..."
  rm -rf "$UNIQUE_DR_DIR"
fi
```
