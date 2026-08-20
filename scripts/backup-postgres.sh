#!/usr/bin/env bash
# ==============================================================================
# Commercial Attendance Stack - Atomic PostgreSQL Backup Script
# Creates verified, custom-format (pg_dump -Fc) PostgreSQL backups with SHA-256
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups/postgres"
ENV_FILE="${ROOT_DIR}/.env.docker"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

# Validate environment configuration file exists
if [[ ! -f "${ENV_FILE}" ]]; then
    echo "[-] ERROR: Docker environment file not found at ${ENV_FILE}" >&2
    echo "[-] Please create it from .env.docker.example before running backups." >&2
    exit 1
fi

# Load variables from .env.docker (with env variable override support)
POSTGRES_DB="${POSTGRES_DB:-$(grep -E '^POSTGRES_DB=' "${ENV_FILE}" | cut -d '=' -f2- | tr -d '\r\n"' || true)}"
POSTGRES_USER="${POSTGRES_USER:-$(grep -E '^POSTGRES_USER=' "${ENV_FILE}" | cut -d '=' -f2- | tr -d '\r\n"' || true)}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(grep -E '^POSTGRES_PASSWORD=' "${ENV_FILE}" | cut -d '=' -f2- | tr -d '\r\n"' || true)}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

# Fallbacks if optional in .env.docker
POSTGRES_DB="${POSTGRES_DB:-attendance}"
POSTGRES_USER="${POSTGRES_USER:-attendance_user}"

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
    echo "[-] ERROR: POSTGRES_PASSWORD is empty or not set in ${ENV_FILE}" >&2
    exit 1
fi

CONTAINER_NAME="zk_postgres"

# Check if PostgreSQL container is running
if ! docker ps --filter "name=^/${CONTAINER_NAME}$" --filter "status=running" --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "[-] ERROR: PostgreSQL container '${CONTAINER_NAME}' is not running." >&2
    exit 1
fi

# Check PostgreSQL readiness
if ! docker exec "${CONTAINER_NAME}" pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
    echo "[-] ERROR: PostgreSQL database '${POSTGRES_DB}' is not accepting connections." >&2
    exit 1
fi

TIMESTAMP="$(date -u +"%Y-%m-%d_%H%M%SZ")"
BACKUP_BASENAME="${POSTGRES_DB}_${TIMESTAMP}.dump"
PARTIAL_FILE="${BACKUP_DIR}/${BACKUP_BASENAME}.partial"
FINAL_FILE="${BACKUP_DIR}/${BACKUP_BASENAME}"
CHECKSUM_FILE="${FINAL_FILE}.sha256"

echo "============================================================"
echo " Starting PostgreSQL Backup"
echo " Database:  ${POSTGRES_DB}"
echo " Container: ${CONTAINER_NAME}"
echo " Target:    ${FINAL_FILE}"
echo "============================================================"

# Ensure cleanup of partial file and notify on unexpected failure
cleanup_partial() {
    local exit_code=$?
    if [[ ${exit_code} -ne 0 ]]; then
        if [[ -f "${PARTIAL_FILE}" ]]; then
            echo "[-] Cleaning up incomplete partial backup: ${PARTIAL_FILE}" >&2
            rm -f "${PARTIAL_FILE}"
        fi
        "${SCRIPT_DIR}/notify-backup-failure.sh" "local_postgres_backup" "pg_dump or local validation failed" "${exit_code}" || true
    fi
}
trap cleanup_partial EXIT INT TERM

# Step 1: Execute pg_dump directly into partial file
echo "[+] Creating custom-format pg_dump archive..."
if ! docker exec "${CONTAINER_NAME}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -Fc > "${PARTIAL_FILE}"; then
    echo "[-] ERROR: pg_dump command failed." >&2
    exit 1
fi

# Verify partial file is not empty
if [[ ! -s "${PARTIAL_FILE}" ]]; then
    echo "[-] ERROR: Generated backup dump is empty." >&2
    exit 1
fi

# Step 2: Validate archive structure using pg_restore --list
echo "[+] Validating backup archive integrity with pg_restore --list..."
if ! docker exec -i "${CONTAINER_NAME}" pg_restore --list < "${PARTIAL_FILE}" >/dev/null 2>&1; then
    echo "[-] ERROR: Backup validation failed (corrupted archive structure)." >&2
    exit 1
fi

# Step 3: Promote partial backup to final filename atomically
mv "${PARTIAL_FILE}" "${FINAL_FILE}"
# Remove trap trigger for clean exit
trap - EXIT INT TERM

# Step 4: Generate SHA-256 Checksum (Mandatory)
echo "[+] Generating SHA-256 checksum..."
if command -v sha256sum >/dev/null 2>&1; then
    (cd "${BACKUP_DIR}" && sha256sum "${BACKUP_BASENAME}" > "${BACKUP_BASENAME}.sha256")
elif command -v shasum >/dev/null 2>&1; then
    (cd "${BACKUP_DIR}" && shasum -a 256 "${BACKUP_BASENAME}" > "${BACKUP_BASENAME}.sha256")
else
    echo "[-] ERROR: Neither sha256sum nor shasum is available. Cannot produce mandatory checksum." >&2
    rm -f "${FINAL_FILE}"
    exit 1
fi

BACKUP_SIZE="$(du -h "${FINAL_FILE}" | cut -f1)"
CHECKSUM_VALUE="$(cut -d ' ' -f1 < "${CHECKSUM_FILE}" 2>/dev/null || echo "N/A")"

# Step 5: Enforce Local Retention Policy
if [[ "${BACKUP_RETENTION_DAYS}" -gt 0 ]]; then
    echo "[+] Applying retention policy (retention: ${BACKUP_RETENTION_DAYS} days)..."
    # Find and delete backups older than BACKUP_RETENTION_DAYS days
    # Using specific path matching to prevent accidental directory traversal
    find "${BACKUP_DIR}" -maxdepth 1 -name "${POSTGRES_DB}_*.dump" -type f -mtime +"${BACKUP_RETENTION_DAYS}" -exec rm -f {} \; -exec echo "    Deleted old backup: {}" \; || true
    find "${BACKUP_DIR}" -maxdepth 1 -name "${POSTGRES_DB}_*.dump.sha256" -type f -mtime +"${BACKUP_RETENTION_DAYS}" -exec rm -f {} \; || true
fi

echo "============================================================"
echo " BACKUP SUCCESS"
echo " File:       ${BACKUP_BASENAME}"
echo " Directory:  ${BACKUP_DIR}"
echo " Size:       ${BACKUP_SIZE}"
echo " SHA-256:    ${CHECKSUM_VALUE}"
echo " Validation: PASS (pg_restore verified)"
echo "============================================================"
