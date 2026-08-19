#!/usr/bin/env bash
# ==============================================================================
# Commercial Attendance Stack - PostgreSQL Restore Verification Script
# Restores a verified custom-format dump into a SEPARATE validation database
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.docker"

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <path_to_backup.dump> [target_database_name] [--keep]" >&2
    echo "" >&2
    echo "Example: $0 backups/postgres/attendance_2026-08-19_200000Z.dump" >&2
    exit 1
fi

BACKUP_PATH="$1"
# Resolve absolute path if relative
if [[ ! "${BACKUP_PATH}" = /* ]]; then
    BACKUP_PATH="${ROOT_DIR}/${BACKUP_PATH}"
fi

# Load variables from .env.docker
if [[ ! -f "${ENV_FILE}" ]]; then
    echo "[-] ERROR: Docker environment file not found at ${ENV_FILE}" >&2
    exit 1
fi

POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "${ENV_FILE}" | cut -d '=' -f2- | tr -d '\r\n"' || true)"
POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "${ENV_FILE}" | cut -d '=' -f2- | tr -d '\r\n"' || true)"
POSTGRES_PASSWORD="$(grep -E '^POSTGRES_PASSWORD=' "${ENV_FILE}" | cut -d '=' -f2- | tr -d '\r\n"' || true)"

POSTGRES_DB="${POSTGRES_DB:-attendance}"
POSTGRES_USER="${POSTGRES_USER:-attendance_user}"

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
    echo "[-] ERROR: POSTGRES_PASSWORD is empty or not set in ${ENV_FILE}" >&2
    exit 1
fi

CONTAINER_NAME="zk_postgres"

# Determine target database name (Must NEVER equal active POSTGRES_DB)
TIMESTAMP="$(date -u +"%Y%m%d_%H%M%S")"
TARGET_DB="${2:-attendance_restore_test_${TIMESTAMP}}"
KEEP_DB=false
if [[ "${2:-}" == "--keep" ]] || [[ "${3:-}" == "--keep" ]]; then
    KEEP_DB=true
fi
if [[ "${2:-}" == "--drop" ]] || [[ "${3:-}" == "--drop" ]]; then
    KEEP_DB=false
fi

# ==============================================================================
# CRITICAL ACTIVE DATABASE OVERWRITE PROTECTION
# ==============================================================================
if [[ "${TARGET_DB}" == "${POSTGRES_DB}" ]]; then
    echo "[-] CRITICAL SAFETY ERROR: Refusing to restore into active production database '${POSTGRES_DB}'." >&2
    echo "[-] The restore script is designed for separate validation/staging databases only." >&2
    exit 1
fi

echo "============================================================"
echo " Starting PostgreSQL Restore Verification"
echo " Backup File:   ${BACKUP_PATH}"
echo " Target DB:     ${TARGET_DB}"
echo " Container:     ${CONTAINER_NAME}"
echo "============================================================"

# Step 1: Check backup file existence
if [[ ! -f "${BACKUP_PATH}" ]]; then
    echo "[-] ERROR: Backup file '${BACKUP_PATH}' does not exist." >&2
    exit 1
fi

if [[ ! -s "${BACKUP_PATH}" ]]; then
    echo "[-] ERROR: Backup file '${BACKUP_PATH}' is empty." >&2
    exit 1
fi

# Step 2: Verify SHA-256 Checksum
CHECKSUM_FILE="${BACKUP_PATH}.sha256"
echo "[+] Verifying SHA-256 checksum..."
if [[ ! -f "${CHECKSUM_FILE}" ]]; then
    echo "[-] ERROR: Checksum file not found: ${CHECKSUM_FILE}" >&2
    echo "[-] Restore aborted: Checksum verification is mandatory." >&2
    exit 1
fi

BACKUP_DIR="$(dirname "${BACKUP_PATH}")"
BACKUP_BASENAME="$(basename "${BACKUP_PATH}")"

# Compute current hash
if command -v sha256sum >/dev/null 2>&1; then
    ACTUAL_HASH="$(cd "${BACKUP_DIR}" && sha256sum "${BACKUP_BASENAME}" | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
    ACTUAL_HASH="$(cd "${BACKUP_DIR}" && shasum -a 256 "${BACKUP_BASENAME}" | awk '{print $1}')"
else
    echo "[-] ERROR: sha256sum / shasum tool missing." >&2
    exit 1
fi

EXPECTED_HASH="$(awk '{print $1}' "${CHECKSUM_FILE}")"

if [[ "${ACTUAL_HASH}" != "${EXPECTED_HASH}" ]]; then
    echo "[-] CHECKSUM MISMATCH FAILURE!" >&2
    echo "[-] Expected: ${EXPECTED_HASH}" >&2
    echo "[-] Actual:   ${ACTUAL_HASH}" >&2
    echo "[-] Restore aborted: Backup file may be corrupted or tampered with." >&2
    exit 1
fi
echo "[+] Checksum verification PASSED (${ACTUAL_HASH})."

# Step 3: Validate archive structure using pg_restore --list
echo "[+] Validating backup archive structure..."
if ! docker exec -i "${CONTAINER_NAME}" pg_restore --list < "${BACKUP_PATH}" >/dev/null 2>&1; then
    echo "[-] ERROR: Archive structure validation failed (corrupt header or payload)." >&2
    exit 1
fi

# Step 4: Verify PostgreSQL container availability
if ! docker ps --filter "name=^/${CONTAINER_NAME}$" --filter "status=running" --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "[-] ERROR: PostgreSQL container '${CONTAINER_NAME}' is not running." >&2
    exit 1
fi

# Step 5: Create isolated temporary restore database
echo "[+] Creating temporary restore database '${TARGET_DB}'..."
# Drop prior test database if it exists
docker exec "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d postgres -c "DROP DATABASE IF EXISTS \"${TARGET_DB}\";" >/dev/null 2>&1
docker exec "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d postgres -c "CREATE DATABASE \"${TARGET_DB}\";" >/dev/null 2>&1

# Step 6: Restore archive into temporary database
echo "[+] Restoring data into '${TARGET_DB}'..."
# pg_restore might return exit code 0 or 1 (for non-fatal warnings on clean DB)
set +e
docker exec -i "${CONTAINER_NAME}" pg_restore -U "${POSTGRES_USER}" -d "${TARGET_DB}" --no-owner --no-privileges < "${BACKUP_PATH}" >/dev/null 2>&1
RESTORE_STATUS=$?
set -e

if [[ ${RESTORE_STATUS} -ne 0 && ${RESTORE_STATUS} -ne 1 ]]; then
    echo "[-] ERROR: pg_restore failed with exit code ${RESTORE_STATUS}." >&2
    docker exec "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d postgres -c "DROP DATABASE IF EXISTS \"${TARGET_DB}\";" >/dev/null 2>&1 || true
    exit 1
fi

# Step 7: Verify Table Integrity and Record Counts in Restored Database
echo "[+] Verifying restored table contents..."
VERIFICATION_OUTPUT="$(docker exec "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d "${TARGET_DB}" -t -A -c "
  SELECT 'SystemSettings:' || count(*) FROM \"SystemSettings\"
  UNION ALL
  SELECT 'Shift:' || count(*) FROM \"Shift\"
  UNION ALL
  SELECT 'User:' || count(*) FROM \"User\"
  UNION ALL
  SELECT 'Device:' || count(*) FROM \"Device\"
  UNION ALL
  SELECT 'RawPunch:' || count(*) FROM \"RawPunch\"
  UNION ALL
  SELECT 'CalculatedDailyReport:' || count(*) FROM \"CalculatedDailyReport\"
  UNION ALL
  SELECT '_prisma_migrations:' || count(*) FROM \"_prisma_migrations\";
" 2>/dev/null || echo "QUERY_ERROR")"

if [[ "${VERIFICATION_OUTPUT}" == "QUERY_ERROR" || -z "${VERIFICATION_OUTPUT}" ]]; then
    echo "[-] ERROR: Failed to query required tables from restored database '${TARGET_DB}'." >&2
    docker exec "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d postgres -c "DROP DATABASE IF EXISTS \"${TARGET_DB}\";" >/dev/null 2>&1 || true
    exit 1
fi

echo "------------------------------------------------------------"
echo " RESTORED DATABASE CONTENT SUMMARY (${TARGET_DB})"
echo "------------------------------------------------------------"
echo "${VERIFICATION_OUTPUT}" | while IFS=':' read -r tbl count; do
    printf "  %-24s : %s rows\n" "${tbl}" "${count}"
done
echo "------------------------------------------------------------"

# Step 8: Cleanup or retain test database
if [[ "${KEEP_DB}" == "false" ]]; then
    echo "[+] Dropping temporary verification database '${TARGET_DB}'..."
    docker exec "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d postgres -c "DROP DATABASE IF EXISTS \"${TARGET_DB}\";" >/dev/null 2>&1
    echo "[+] Cleaned up temporary database."
else
    echo "[i] Temporary verification database '${TARGET_DB}' retained for inspection."
fi

echo "============================================================"
echo " RESTORE VERIFICATION SUCCESS"
echo " Backup:      ${BACKUP_BASENAME}"
echo " Checksum:    VALID"
echo " Schema & Data: VERIFIED"
echo " Primary DB:  UNTOUCHED (${POSTGRES_DB})"
echo "============================================================"
