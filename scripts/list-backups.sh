#!/usr/bin/env bash
# ==============================================================================
# Commercial Attendance Stack - List Available PostgreSQL Backups
# Displays timestamp, filename, size, and real checksum status for all dumps
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
printf "%-46s | %-8s | %-19s | %-10s\n" "Filename" "Size" "Modified (UTC)" "Checksum"
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
    if [[ ! -f "${CHECKSUM_FILE}" ]]; then
        CHECKSUM_STATUS="MISSING"
    else
        EXPECTED_HASH="$(awk '{print $1}' "${CHECKSUM_FILE}" 2>/dev/null || echo "")"
        if command -v sha256sum >/dev/null 2>&1; then
            ACTUAL_HASH="$(cd "${BACKUP_DIR}" && sha256sum "${FILENAME}" 2>/dev/null | awk '{print $1}')"
        elif command -v shasum >/dev/null 2>&1; then
            ACTUAL_HASH="$(cd "${BACKUP_DIR}" && shasum -a 256 "${FILENAME}" 2>/dev/null | awk '{print $1}')"
        else
            ACTUAL_HASH="UNCHECKED"
        fi

        if [[ -n "${EXPECTED_HASH}" && "${EXPECTED_HASH}" == "${ACTUAL_HASH}" ]]; then
            CHECKSUM_STATUS="VALID"
        elif [[ "${ACTUAL_HASH}" == "UNCHECKED" ]]; then
            CHECKSUM_STATUS="PRESENT"
        else
            CHECKSUM_STATUS="INVALID"
        fi
    fi

    printf "%-46s | %-8s | %-19s | %-10s\n" "${FILENAME}" "${SIZE}" "${MOD_TIME}" "${CHECKSUM_STATUS}"
done
echo "====================================================================================================="
