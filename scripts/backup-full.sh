#!/usr/bin/env bash
# ==============================================================================
# Commercial Attendance Stack - Unified Full Backup Workflow
# Executes local atomic verified backup + optional Cloudflare R2 off-site sync
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_BACKUP="${ROOT_DIR}/.env.backup"
ENV_DOCKER="${ROOT_DIR}/.env.docker"

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
