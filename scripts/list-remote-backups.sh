#!/usr/bin/env bash
# ==============================================================================
# Commercial Attendance Stack - List Remote Cloudflare R2 Backups
# Lists remote backups under the client namespace and distinguishes COMPLETE vs INCOMPLETE
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

# Validate client identifier format
if [[ ! "${BACKUP_CLIENT_ID}" =~ ^[A-Za-z0-9_-]{1,64}$ ]]; then
    echo "[-] ERROR: Invalid BACKUP_CLIENT_ID '${BACKUP_CLIENT_ID}'." >&2
    exit 1
fi

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

CLIENT_PREFIX="${BACKUP_CLIENT_ID}/postgres/"

echo "================================================================================================================================="
echo " Available Cloudflare R2 Remote Backups (Bucket: ${R2_BUCKET}, Client: ${BACKUP_CLIENT_ID})"
echo "================================================================================================================================="
printf "%-62s | %-10s | %-20s | %-16s\n" "Remote Key" "Size" "Last Modified" "Status"
echo "---------------------------------------------------------------------------------------------------------------------------------"

# Fetch all keys under client prefix in a single call for high efficiency
ALL_OBJECTS_JSON="$(aws s3api list-objects-v2 --bucket "${R2_BUCKET}" --prefix "${CLIENT_PREFIX}" --endpoint-url "${R2_ENDPOINT}" --output json 2>/dev/null || echo "{}")"

DUMP_KEYS="$(echo "${ALL_OBJECTS_JSON}" | grep -E '"Key":' | grep -E '\.dump"' | awk -F'"' '{print $4}' || true)"

if [[ -z "${DUMP_KEYS}" ]]; then
    echo "  (No remote backups found under client prefix: ${CLIENT_PREFIX})"
else
    echo "${DUMP_KEYS}" | while read -r DUMP_KEY; do
        if [[ -n "${DUMP_KEY}" ]]; then
            # Check size and date
            SIZE_BYTES="$(echo "${ALL_OBJECTS_JSON}" | grep -B 2 -A 4 "\"Key\": \"${DUMP_KEY}\"" | grep -E '"Size":' | tr -dc '0-9' || echo "0")"
            MOD_DATE="$(echo "${ALL_OBJECTS_JSON}" | grep -B 2 -A 4 "\"Key\": \"${DUMP_KEY}\"" | grep -E '"LastModified":' | awk -F'"' '{print $4}' | cut -d'.' -f1 || echo "N/A")"
            
            # Check for matching .sha256 and .complete
            HAS_SHA="$(echo "${ALL_OBJECTS_JSON}" | grep -q "\"Key\": \"${DUMP_KEY}.sha256\"" && echo "yes" || echo "no")"
            HAS_MARKER="$(echo "${ALL_OBJECTS_JSON}" | grep -q "\"Key\": \"${DUMP_KEY}.complete\"" && echo "yes" || echo "no")"
            
            if [[ "${HAS_SHA}" == "yes" && "${HAS_MARKER}" == "yes" ]]; then
                STATUS="COMPLETE"
            elif [[ "${HAS_SHA}" != "yes" ]]; then
                STATUS="INCOMPLETE (No SHA)"
            elif [[ "${HAS_MARKER}" != "yes" ]]; then
                STATUS="INCOMPLETE (No Marker)"
            else
                STATUS="INCOMPLETE"
            fi
            
            SIZE_HUMAN="$(numfmt --to=iec-i --suffix=B "${SIZE_BYTES}" 2>/dev/null || echo "${SIZE_BYTES} B")"
            printf "%-62s | %-10s | %-20s | %-16s\n" "${DUMP_KEY}" "${SIZE_HUMAN}" "${MOD_DATE}" "${STATUS}"
        fi
    done
fi
echo "================================================================================================================================="
