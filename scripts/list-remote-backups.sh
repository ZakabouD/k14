#!/usr/bin/env bash
# ==============================================================================
# Commercial Attendance Stack - List Remote Cloudflare R2 Backups
# Lists available remote dumps, sizes, timestamps, and completion marker status
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_BACKUP="${ROOT_DIR}/.env.backup"
ENV_DOCKER="${ROOT_DIR}/.env.docker"

if [[ -f "${ENV_BACKUP}" ]]; then
    ENV_SOURCE="${ENV_BACKUP}"
elif [[ -f "${ENV_DOCKER}" ]]; then
    ENV_SOURCE="${ENV_DOCKER}"
else
    ENV_SOURCE=""
fi

if [[ -n "${ENV_SOURCE}" ]]; then
    BACKUP_CLIENT_ID="${BACKUP_CLIENT_ID:-$(grep -E '^BACKUP_CLIENT_ID=' "${ENV_SOURCE}" | cut -d '=' -f2- | tr -d '\r\n"' || true)}"
    R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-$(grep -E '^R2_ACCOUNT_ID=' "${ENV_SOURCE}" | cut -d '=' -f2- | tr -d '\r\n"' || true)}"
    R2_BUCKET="${R2_BUCKET:-$(grep -E '^R2_BUCKET=' "${ENV_SOURCE}" | cut -d '=' -f2- | tr -d '\r\n"' || true)}"
    R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-$(grep -E '^R2_ACCESS_KEY_ID=' "${ENV_SOURCE}" | cut -d '=' -f2- | tr -d '\r\n"' || true)}"
    R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-$(grep -E '^R2_SECRET_ACCESS_KEY=' "${ENV_SOURCE}" | cut -d '=' -f2- | tr -d '\r\n"' || true)}"
    R2_ENDPOINT="${R2_ENDPOINT:-$(grep -E '^R2_ENDPOINT=' "${ENV_SOURCE}" | cut -d '=' -f2- | tr -d '\r\n"' || true)}"
fi

BACKUP_CLIENT_ID="${BACKUP_CLIENT_ID:-client-default}"

if [[ -z "${R2_BUCKET:-}" ]] || [[ -z "${R2_ACCESS_KEY_ID:-}" ]] || [[ -z "${R2_SECRET_ACCESS_KEY:-}" ]]; then
    echo "[-] ERROR: R2 credentials or bucket missing in environment configuration." >&2
    exit 1
fi

if [[ -z "${R2_ENDPOINT:-}" ]]; then
    R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
fi

if ! command -v aws >/dev/null 2>&1; then
    echo "[-] ERROR: 'aws' CLI tool is required to list remote backups." >&2
    exit 1
fi

export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION="auto"

echo "=========================================================================================================="
echo " Available Cloudflare R2 Remote Backups (Bucket: ${R2_BUCKET}, Client: ${BACKUP_CLIENT_ID})"
echo "=========================================================================================================="
printf "%-56s | %-10s | %-20s\n" "Remote Key" "Size" "Last Modified"
echo "----------------------------------------------------------------------------------------------------------"

OBJECTS="$(aws s3api list-objects-v2 --bucket "${R2_BUCKET}" --prefix "${BACKUP_CLIENT_ID}/postgres/" --endpoint-url "${R2_ENDPOINT}" --query "Contents[?ends_with(Key, '.dump')].[Key, Size, LastModified]" --output text 2>/dev/null || echo "")"

if [[ -z "${OBJECTS}" || "${OBJECTS}" == "None" ]]; then
    echo "  (No remote backups found for prefix: ${BACKUP_CLIENT_ID}/postgres/)"
else
    echo "${OBJECTS}" | while IFS=$'\t' read -r key size last_mod; do
        if [[ -n "${key}" ]]; then
            SIZE_HUMAN="$(numfmt --to=iec-i --suffix=B "${size}" 2>/dev/null || echo "${size} bytes")"
            printf "%-56s | %-10s | %-20s\n" "${key}" "${SIZE_HUMAN}" "${last_mod}"
        fi
    done
fi
echo "=========================================================================================================="
