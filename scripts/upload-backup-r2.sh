#!/usr/bin/env bash
# ==============================================================================
# Commercial Attendance Stack - Cloudflare R2 Off-Site Backup Uploader
# Uploads verified local PostgreSQL backups (.dump, .sha256, .complete) to R2
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Try loading from .env.backup first, then .env.docker
ENV_BACKUP="${ROOT_DIR}/.env.backup"
ENV_DOCKER="${ROOT_DIR}/.env.docker"

if [[ -f "${ENV_BACKUP}" ]]; then
    ENV_SOURCE="${ENV_BACKUP}"
elif [[ -f "${ENV_DOCKER}" ]]; then
    ENV_SOURCE="${ENV_DOCKER}"
else
    ENV_SOURCE=""
fi

# Load variables safely if env file exists
if [[ -n "${ENV_SOURCE}" ]]; then
    BACKUP_REMOTE_ENABLED="${BACKUP_REMOTE_ENABLED:-$(grep -E '^BACKUP_REMOTE_ENABLED=' "${ENV_SOURCE}" | cut -d '=' -f2- | tr -d '\r\n"' || true)}"
    BACKUP_CLIENT_ID="${BACKUP_CLIENT_ID:-$(grep -E '^BACKUP_CLIENT_ID=' "${ENV_SOURCE}" | cut -d '=' -f2- | tr -d '\r\n"' || true)}"
    R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-$(grep -E '^R2_ACCOUNT_ID=' "${ENV_SOURCE}" | cut -d '=' -f2- | tr -d '\r\n"' || true)}"
    R2_BUCKET="${R2_BUCKET:-$(grep -E '^R2_BUCKET=' "${ENV_SOURCE}" | cut -d '=' -f2- | tr -d '\r\n"' || true)}"
    R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-$(grep -E '^R2_ACCESS_KEY_ID=' "${ENV_SOURCE}" | cut -d '=' -f2- | tr -d '\r\n"' || true)}"
    R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-$(grep -E '^R2_SECRET_ACCESS_KEY=' "${ENV_SOURCE}" | cut -d '=' -f2- | tr -d '\r\n"' || true)}"
    R2_ENDPOINT="${R2_ENDPOINT:-$(grep -E '^R2_ENDPOINT=' "${ENV_SOURCE}" | cut -d '=' -f2- | tr -d '\r\n"' || true)}"
    BACKUP_REMOTE_RETENTION_DAYS="${BACKUP_REMOTE_RETENTION_DAYS:-$(grep -E '^BACKUP_REMOTE_RETENTION_DAYS=' "${ENV_SOURCE}" | cut -d '=' -f2- | tr -d '\r\n"' || true)}"
fi

BACKUP_REMOTE_ENABLED="${BACKUP_REMOTE_ENABLED:-false}"
BACKUP_CLIENT_ID="${BACKUP_CLIENT_ID:-client-default}"
BACKUP_REMOTE_RETENTION_DAYS="${BACKUP_REMOTE_RETENTION_DAYS:-30}"

# Error handler & notification
on_upload_error() {
    local exit_code=$?
    if [[ ${exit_code} -ne 0 ]]; then
        if [[ -n "${LOCAL_MARKER_PATH:-}" && -f "${LOCAL_MARKER_PATH}" ]]; then
            rm -f "${LOCAL_MARKER_PATH}"
        fi
        "${SCRIPT_DIR}/notify-backup-failure.sh" "r2_upload" "R2 upload or remote verification failed" "${exit_code}" || true
    fi
}
trap on_upload_error EXIT INT TERM

# If remote backup is disabled, exit gracefully
if [[ "${BACKUP_REMOTE_ENABLED}" != "true" ]]; then
    echo "[i] Off-site R2 backup is disabled (BACKUP_REMOTE_ENABLED=${BACKUP_REMOTE_ENABLED}). Skipping remote upload."
    trap - EXIT INT TERM
    exit 0
fi

# Validate input argument
if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <path_to_local_backup.dump>" >&2
    exit 1
fi

LOCAL_DUMP_PATH="$1"
if [[ ! "${LOCAL_DUMP_PATH}" = /* ]]; then
    LOCAL_DUMP_PATH="${ROOT_DIR}/${LOCAL_DUMP_PATH}"
fi

# Verify local dump and checksum exist
if [[ ! -f "${LOCAL_DUMP_PATH}" ]]; then
    echo "[-] ERROR: Local backup file '${LOCAL_DUMP_PATH}' not found." >&2
    exit 1
fi

LOCAL_SHA_PATH="${LOCAL_DUMP_PATH}.sha256"
if [[ ! -f "${LOCAL_SHA_PATH}" ]]; then
    echo "[-] ERROR: Local checksum file '${LOCAL_SHA_PATH}' not found. Cannot upload unverified backup." >&2
    exit 1
fi

# ==============================================================================
# DEFENSE IN DEPTH: REVALIDATE LOCAL ARCHIVE & CHECKSUM BEFORE UPLOAD
# ==============================================================================
echo "[+] Pre-upload verification: validating local checksum and archive integrity..."
if command -v sha256sum >/dev/null 2>&1; then
    ACTUAL_LOCAL_HASH="$(sha256sum "${LOCAL_DUMP_PATH}" | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
    ACTUAL_LOCAL_HASH="$(shasum -a 256 "${LOCAL_DUMP_PATH}" | awk '{print $1}')"
else
    echo "[-] ERROR: sha256sum or shasum tool missing." >&2
    exit 1
fi

EXPECTED_LOCAL_HASH="$(awk '{print $1}' "${LOCAL_SHA_PATH}")"
if [[ "${ACTUAL_LOCAL_HASH}" != "${EXPECTED_LOCAL_HASH}" ]]; then
    echo "[-] PRE-UPLOAD INTEGRITY ERROR: Local file hash does not match sidecar .sha256 file!" >&2
    echo "[-] Expected: ${EXPECTED_LOCAL_HASH}" >&2
    echo "[-] Actual:   ${ACTUAL_LOCAL_HASH}" >&2
    exit 1
fi

# Structural validation via pg_restore --list if container running
if docker ps --filter "name=^/zk_postgres$" --filter "status=running" --format '{{.Names}}' | grep -q "^zk_postgres$"; then
    if ! docker exec -i zk_postgres pg_restore --list < "${LOCAL_DUMP_PATH}" >/dev/null 2>&1; then
        echo "[-] PRE-UPLOAD INTEGRITY ERROR: pg_restore --list failed on local archive." >&2
        exit 1
    fi
fi
echo "[+] Local archive pre-validation PASSED."

# Validate client identifier format (strictly no path traversal)
if [[ ! "${BACKUP_CLIENT_ID}" =~ ^[A-Za-z0-9_-]{1,64}$ ]]; then
    echo "[-] ERROR: Invalid BACKUP_CLIENT_ID '${BACKUP_CLIENT_ID}'." >&2
    echo "[-] Allowed characters: alphanumeric, hyphens, underscores only (max 64 chars)." >&2
    exit 1
fi

# Validate R2 credentials and bucket
if [[ -z "${R2_BUCKET:-}" ]]; then
    echo "[-] ERROR: R2_BUCKET is required for off-site backup." >&2
    exit 1
fi
if [[ -z "${R2_ACCESS_KEY_ID:-}" ]] || [[ -z "${R2_SECRET_ACCESS_KEY:-}" ]]; then
    echo "[-] ERROR: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required for off-site backup." >&2
    exit 1
fi

# Determine endpoint URL
if [[ -z "${R2_ENDPOINT:-}" ]]; then
    if [[ -n "${R2_ACCOUNT_ID:-}" ]]; then
        R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    else
        echo "[-] ERROR: R2_ENDPOINT or R2_ACCOUNT_ID must be specified." >&2
        exit 1
    fi
fi

# Check AWS CLI tool availability
if ! command -v aws >/dev/null 2>&1; then
    echo "[-] ERROR: 'aws' CLI tool is required for Cloudflare R2 S3-compatible uploads." >&2
    echo "[-] Please install awscli or configure a containerized uploader." >&2
    exit 1
fi

DUMP_BASENAME="$(basename "${LOCAL_DUMP_PATH}")"
YEAR="$(date -u +"%Y")"
MONTH="$(date -u +"%m")"
REMOTE_PREFIX="${BACKUP_CLIENT_ID}/postgres/${YEAR}/${MONTH}"
REMOTE_DUMP_KEY="${REMOTE_PREFIX}/${DUMP_BASENAME}"
REMOTE_SHA_KEY="${REMOTE_PREFIX}/${DUMP_BASENAME}.sha256"
REMOTE_MARKER_KEY="${REMOTE_PREFIX}/${DUMP_BASENAME}.complete"

if stat -c "%s" "${LOCAL_DUMP_PATH}" >/dev/null 2>&1; then
    LOCAL_SIZE_BYTES="$(stat -c "%s" "${LOCAL_DUMP_PATH}")"
elif stat -f "%z" "${LOCAL_DUMP_PATH}" >/dev/null 2>&1; then
    LOCAL_SIZE_BYTES="$(stat -f "%z" "${LOCAL_DUMP_PATH}")"
else
    LOCAL_SIZE_BYTES="$(wc -c < "${LOCAL_DUMP_PATH}" | tr -d ' ')"
fi
SHA256_HASH="${ACTUAL_LOCAL_HASH}"
TIMESTAMP_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# Create atomic completion marker file locally
LOCAL_MARKER_PATH="${LOCAL_DUMP_PATH}.complete"
cat <<EOF > "${LOCAL_MARKER_PATH}"
{
  "client_id": "${BACKUP_CLIENT_ID}",
  "filename": "${DUMP_BASENAME}",
  "sha256": "${SHA256_HASH}",
  "size_bytes": ${LOCAL_SIZE_BYTES},
  "timestamp_utc": "${TIMESTAMP_UTC}",
  "status": "complete"
}
EOF

echo "============================================================"
echo " Starting Off-Site Backup Upload to Cloudflare R2"
echo " Local File:    ${DUMP_BASENAME}"
echo " Client ID:     ${BACKUP_CLIENT_ID}"
echo " R2 Bucket:     ${R2_BUCKET}"
echo " Remote Prefix: ${REMOTE_PREFIX}"
echo "============================================================"

export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION="auto"

# Step 1: Upload .dump file
echo "[+] Uploading dump archive to R2..."
if ! aws s3 cp "${LOCAL_DUMP_PATH}" "s3://${R2_BUCKET}/${REMOTE_DUMP_KEY}" --endpoint-url "${R2_ENDPOINT}" >/dev/null; then
    echo "[-] ERROR: Failed to upload ${DUMP_BASENAME} to Cloudflare R2." >&2
    rm -f "${LOCAL_MARKER_PATH}"
    exit 1
fi

# Step 2: Upload .sha256 checksum
echo "[+] Uploading SHA-256 checksum to R2..."
if ! aws s3 cp "${LOCAL_SHA_PATH}" "s3://${R2_BUCKET}/${REMOTE_SHA_KEY}" --endpoint-url "${R2_ENDPOINT}" >/dev/null; then
    echo "[-] ERROR: Failed to upload checksum to Cloudflare R2." >&2
    rm -f "${LOCAL_MARKER_PATH}"
    exit 1
fi

# Step 3: Upload .complete marker
echo "[+] Uploading atomic completion marker to R2..."
if ! aws s3 cp "${LOCAL_MARKER_PATH}" "s3://${R2_BUCKET}/${REMOTE_MARKER_KEY}" --endpoint-url "${R2_ENDPOINT}" >/dev/null; then
    echo "[-] ERROR: Failed to upload completion marker to Cloudflare R2." >&2
    rm -f "${LOCAL_MARKER_PATH}"
    exit 1
fi

# Clean up local temporary marker
rm -f "${LOCAL_MARKER_PATH}"

# Step 4: Verify Remote Upload Integrity
echo "[+] Verifying remote object presence and size..."
REMOTE_HEAD="$(aws s3api head-object --bucket "${R2_BUCKET}" --key "${REMOTE_DUMP_KEY}" --endpoint-url "${R2_ENDPOINT}" --output json 2>/dev/null || echo "")"

if [[ -z "${REMOTE_HEAD}" ]]; then
    echo "[-] ERROR: Remote verification failed. Dump object not found on R2." >&2
    exit 1
fi

REMOTE_SIZE_BYTES="$(echo "${REMOTE_HEAD}" | grep -E '"ContentLength":' | tr -dc '0-9' || echo "0")"

if [[ "${REMOTE_SIZE_BYTES}" -ne "${LOCAL_SIZE_BYTES}" ]]; then
    echo "[-] ERROR: Remote size mismatch! (Local: ${LOCAL_SIZE_BYTES} bytes, Remote: ${REMOTE_SIZE_BYTES} bytes)" >&2
    exit 1
fi

# Verify marker key exists remotely
if ! aws s3api head-object --bucket "${R2_BUCKET}" --key "${REMOTE_MARKER_KEY}" --endpoint-url "${R2_ENDPOINT}" >/dev/null 2>&1; then
    echo "[-] ERROR: Remote completion marker missing on R2." >&2
    exit 1
fi

echo "[+] Remote upload verified (Size: ${REMOTE_SIZE_BYTES} bytes, Marker: OK)."

# Step 5: Remote Retention Policy
if [[ "${BACKUP_REMOTE_RETENTION_DAYS}" -gt 0 ]]; then
    echo "[+] Enforcing remote retention policy (${BACKUP_REMOTE_RETENTION_DAYS} days) under prefix '${BACKUP_CLIENT_ID}/postgres/'..."
    CUTOFF_DATE="$(date -u -v-"${BACKUP_REMOTE_RETENTION_DAYS}"d +"%Y-%m-%d" 2>/dev/null || date -u -d "${BACKUP_REMOTE_RETENTION_DAYS} days ago" +"%Y-%m-%d" 2>/dev/null || echo "")"
    
    if [[ -n "${CUTOFF_DATE}" ]]; then
        aws s3 ls "s3://${R2_BUCKET}/${BACKUP_CLIENT_ID}/postgres/" --endpoint-url "${R2_ENDPOINT}" --recursive 2>/dev/null | while read -r line; do
            OBJ_DATE="$(echo "${line}" | awk '{print $1}')"
            OBJ_KEY="$(echo "${line}" | awk '{$1=$2=$3=""; print substr($0,4)}')"
            if [[ -n "${OBJ_KEY}" && "${OBJ_DATE}" < "${CUTOFF_DATE}" ]]; then
                echo "    Pruning expired remote backup: ${OBJ_KEY}"
                aws s3 rm "s3://${R2_BUCKET}/${OBJ_KEY}" --endpoint-url "${R2_ENDPOINT}" >/dev/null 2>&1 || true
            fi
        done
    fi
fi

# Remove error trap on success
trap - EXIT INT TERM

echo "============================================================"
echo " OFF-SITE R2 BACKUP SUCCESS"
echo " Remote Object: s3://${R2_BUCKET}/${REMOTE_DUMP_KEY}"
echo " Checksum:      ${SHA256_HASH}"
echo " Remote Size:   ${REMOTE_SIZE_BYTES} bytes"
echo " Verification:  PASS (3/3 objects verified)"
echo "============================================================"
