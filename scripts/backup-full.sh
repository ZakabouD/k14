#!/usr/bin/env bash
# ==============================================================================
# Commercial Attendance Stack - Unified Full Backup Workflow
# Executes local atomic verified backup + optional Cloudflare R2 off-site sync
# Includes non-blocking concurrency locking (flock/atomic lock) and failure alerting
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ==============================================================================
# CONCURRENCY CONTROL (flock / portable atomic lock)
# ==============================================================================
LOCK_DIR="/tmp/zk_commercial_backup.lock.d"
LOCK_FILE="/tmp/zk_commercial_backup.lock"

if command -v flock >/dev/null 2>&1; then
    exec 200>"${LOCK_FILE}"
    if ! flock -n 200; then
        echo "[-] [LOCK] Another backup pipeline process is already running. Exiting safely to prevent concurrency." >&2
        exit 0
    fi
else
    # Portable atomic directory lock fallback (POSIX compliant for macOS/BSD)
    if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
        if [[ -f "${LOCK_DIR}/pid" ]]; then
            EXISTING_PID="$(cat "${LOCK_DIR}/pid" 2>/dev/null || echo "")"
            if [[ -n "${EXISTING_PID}" ]] && kill -0 "${EXISTING_PID}" 2>/dev/null; then
                echo "[-] [LOCK] Another backup pipeline process (PID ${EXISTING_PID}) is already running. Exiting safely." >&2
                exit 0
            fi
        fi
        rm -rf "${LOCK_DIR}" 2>/dev/null || true
        mkdir "${LOCK_DIR}" 2>/dev/null || exit 0
    fi
    echo "$$" > "${LOCK_DIR}/pid"
fi

# Pipeline cleanup and failure notification handler
on_pipeline_exit() {
    local exit_code=$?
    if ! command -v flock >/dev/null 2>&1; then
        rm -rf "${LOCK_DIR}" 2>/dev/null || true
    fi
    if [[ ${exit_code} -ne 0 ]]; then
        "${SCRIPT_DIR}/notify-backup-failure.sh" "full_pipeline" "Unified backup pipeline failed" "${exit_code}" || true
    fi
}
trap on_pipeline_exit EXIT INT TERM

echo "============================================================"
echo " Starting Full Backup Pipeline"
echo " Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "============================================================"

# Step 1: Create Local Atomic Verified Backup
echo "[1/2] Creating and validating local PostgreSQL backup..."
BACKUP_OUTPUT="$("${SCRIPT_DIR}/backup-postgres.sh")"
echo "${BACKUP_OUTPUT}"

# Extract generated dump filename from backup-postgres output
DUMP_BASENAME="$(echo "${BACKUP_OUTPUT}" | grep -E '^ File:' | awk '{print $2}' || true)"

if [[ -z "${DUMP_BASENAME}" ]]; then
    # Fallback to finding latest dump
    DUMP_PATH="$(ls -t "${ROOT_DIR}/backups/postgres"/*.dump 2>/dev/null | head -n 1 || true)"
else
    DUMP_PATH="${ROOT_DIR}/backups/postgres/${DUMP_BASENAME}"
fi

if [[ -z "${DUMP_PATH}" || ! -f "${DUMP_PATH}" ]]; then
    echo "[-] ERROR: Local backup file could not be determined." >&2
    exit 1
fi

# Step 2: Upload to Cloudflare R2 if enabled
echo ""
echo "[2/2] Checking Off-Site Cloudflare R2 synchronization..."
"${SCRIPT_DIR}/upload-backup-r2.sh" "${DUMP_PATH}"

echo ""
echo "============================================================"
echo " FULL BACKUP PIPELINE COMPLETED SUCCESSFULLY"
echo "============================================================"
