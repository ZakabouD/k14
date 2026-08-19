#!/usr/bin/env bash
# ==============================================================================
# Commercial Attendance Stack - List Available PostgreSQL Backups
# Displays timestamp, filename, size, and checksum status for all local dumps
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups/postgres"

if [[ ! -d "${BACKUP_DIR}" ]]; then
    echo "No backup directory found at ${BACKUP_DIR}"
    exit 0
fi

shopt -s nullglob
DUMPS=("${BACKUP_DIR}"/*.dump)
shopt -u nullglob

if [[ ${#DUMPS[@]} -eq 0 ]]; then
    echo "============================================================"
    echo " Available PostgreSQL Backups (${BACKUP_DIR})"
    echo "============================================================"
    echo "  (No backups found)"
    echo "============================================================"
    exit 0
fi

echo "====================================================================================================="
echo " Available PostgreSQL Backups (${BACKUP_DIR})"
echo "====================================================================================================="
printf "%-38s | %-10s | %-20s | %-12s\n" "Filename" "Size" "Modified (UTC)" "Checksum"
echo "-----------------------------------------------------------------------------------------------------"

for DUMP_FILE in "${DUMPS[@]}"; do
    FILENAME="$(basename "${DUMP_FILE}")"
    SIZE="$(du -h "${DUMP_FILE}" | cut -f1)"
    
    # Platform-compatible file modification time
    if stat -c "%y" "${DUMP_FILE}" >/dev/null 2>&1; then
        MOD_TIME="$(stat -c "%y" "${DUMP_FILE}" | cut -d'.' -f1)"
    elif stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "${DUMP_FILE}" >/dev/null 2>&1; then
        MOD_TIME="$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "${DUMP_FILE}")"
    else
        MOD_TIME="N/A"
    fi

    CHECKSUM_FILE="${DUMP_FILE}.sha256"
    if [[ -f "${CHECKSUM_FILE}" ]]; then
        CHECKSUM_STATUS="Present (OK)"
    else
        CHECKSUM_STATUS="Missing"
    fi

    printf "%-38s | %-10s | %-20s | %-12s\n" "${FILENAME}" "${SIZE}" "${MOD_TIME}" "${CHECKSUM_STATUS}"
done
echo "====================================================================================================="
