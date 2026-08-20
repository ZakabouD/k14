#!/usr/bin/env bash
# ==============================================================================
# Commercial Attendance Stack - Cloudflare R2 Backup Downloader
# Downloads and validates remote backups (.dump, .sha256, .complete) from R2
# Enforces strict client prefix isolation and Model A completion marker contract
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DOWNLOAD_DIR="${ROOT_DIR}/backups/postgres"

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

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <remote_backup_key_or_filename> [destination_dir]" >&2
    echo "" >&2
    echo "Example: $0 attendance_2026-08-19_212910Z.dump" >&2
    exit 1
fi

# Validate client identifier format
if [[ ! "${BACKUP_CLIENT_ID}" =~ ^[A-Za-z0-9_-]{1,64}$ ]]; then
    echo "[-] ERROR: Invalid BACKUP_CLIENT_ID '${BACKUP_CLIENT_ID}'." >&2
    exit 1
fi

REMOTE_KEY="$1"
DEST_DIR="${2:-${DOWNLOAD_DIR}}"
mkdir -p "${DEST_DIR}"

if [[ -z "${R2_BUCKET:-}" ]] || [[ -z "${R2_ACCESS_KEY_ID:-}" ]] || [[ -z "${R2_SECRET_ACCESS_KEY:-}" ]]; then
    echo "[-] ERROR: R2 credentials or bucket missing in environment configuration." >&2
    exit 1
fi

if [[ -z "${R2_ENDPOINT:-}" ]]; then
    R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
fi

if ! command -v aws >/dev/null 2>&1; then
    echo "[-] ERROR: 'aws' CLI tool is required to download remote backups." >&2
    exit 1
fi

# Reject path traversal tricks
if [[ "${REMOTE_KEY}" == *".."* ]] || [[ "${REMOTE_KEY}" == *"\\"* ]] || [[ "${REMOTE_KEY}" == *"//"* ]]; then
    echo "[-] SECURITY ERROR: Path traversal detected in remote key argument." >&2
    exit 1
fi

# Strip s3:// and leading slashes
REMOTE_KEY="${REMOTE_KEY#s3://${R2_BUCKET}/}"
REMOTE_KEY="${REMOTE_KEY#/}"

# ==============================================================================
# STRICT CLIENT PREFIX ENFORCEMENT
# ==============================================================================
EXPECTED_PREFIX="${BACKUP_CLIENT_ID}/postgres/"

if [[ "${REMOTE_KEY}" == *"/"* ]]; then
    # Full key was provided - must strictly start with client prefix
    if [[ "${REMOTE_KEY}" != "${EXPECTED_PREFIX}"* ]]; then
        echo "[-] SECURITY ERROR: Access denied. Requested key '${REMOTE_KEY}' is outside client prefix '${EXPECTED_PREFIX}'." >&2
        exit 1
    fi
else
    # Only filename was provided - search strictly under client prefix
    echo "[i] Locating '${REMOTE_KEY}' within client prefix '${EXPECTED_PREFIX}'..."
    export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
    export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
    export AWS_DEFAULT_REGION="auto"
    
    FOUND_KEY="$(aws s3api list-objects-v2 --bucket "${R2_BUCKET}" --prefix "${EXPECTED_PREFIX}" --endpoint-url "${R2_ENDPOINT}" --query "Contents[?ends_with(Key, '${REMOTE_KEY}')].Key | [0]" --output text 2>/dev/null || echo "")"
    if [[ -n "${FOUND_KEY}" && "${FOUND_KEY}" != "None" ]]; then
        REMOTE_KEY="${FOUND_KEY}"
    else
        echo "[-] ERROR: Backup '${REMOTE_KEY}' not found under prefix '${EXPECTED_PREFIX}'." >&2
        exit 1
    fi
fi

export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION="auto"

DUMP_BASENAME="$(basename "${REMOTE_KEY}")"
LOCAL_DUMP_PATH="${DEST_DIR}/${DUMP_BASENAME}"
LOCAL_SHA_PATH="${LOCAL_DUMP_PATH}.sha256"
LOCAL_MARKER_PATH="${LOCAL_DUMP_PATH}.complete"

REMOTE_SHA_KEY="${REMOTE_KEY}.sha256"
REMOTE_MARKER_KEY="${REMOTE_KEY}.complete"

echo "============================================================"
echo " Downloading Backup from Cloudflare R2"
echo " Client:      ${BACKUP_CLIENT_ID}"
echo " Remote Key:  s3://${R2_BUCKET}/${REMOTE_KEY}"
echo " Destination: ${LOCAL_DUMP_PATH}"
echo "============================================================"

# Step 1: Download dump file
echo "[+] Downloading .dump file..."
if ! aws s3 cp "s3://${R2_BUCKET}/${REMOTE_KEY}" "${LOCAL_DUMP_PATH}" --endpoint-url "${R2_ENDPOINT}"; then
    echo "[-] ERROR: Failed to download ${REMOTE_KEY} from R2." >&2
    exit 1
fi

# Step 2: Download sha256 checksum
echo "[+] Downloading .sha256 checksum..."
if ! aws s3 cp "s3://${R2_BUCKET}/${REMOTE_SHA_KEY}" "${LOCAL_SHA_PATH}" --endpoint-url "${R2_ENDPOINT}"; then
    echo "[-] ERROR: Failed to download checksum file from R2." >&2
    rm -f "${LOCAL_DUMP_PATH}"
    exit 1
fi

# Step 3: Download completion marker (Model A: Authoritative Requirement)
echo "[+] Downloading .complete atomic completion marker..."
if ! aws s3 cp "s3://${R2_BUCKET}/${REMOTE_MARKER_KEY}" "${LOCAL_MARKER_PATH}" --endpoint-url "${R2_ENDPOINT}"; then
    echo "[-] ATOMICITY ERROR: Remote completion marker (${REMOTE_MARKER_KEY}) is missing!" >&2
    echo "[-] This backup may be incomplete or corrupted in R2. Aborting." >&2
    rm -f "${LOCAL_DUMP_PATH}" "${LOCAL_SHA_PATH}"
    exit 1
fi

# Step 4: Validate Completion Marker Contents
echo "[+] Validating completion marker metadata..."
MARKER_CLIENT="$(grep -E '"client_id":' "${LOCAL_MARKER_PATH}" | cut -d '"' -f4 || true)"
MARKER_FILENAME="$(grep -E '"filename":' "${LOCAL_MARKER_PATH}" | cut -d '"' -f4 || true)"
MARKER_STATUS="$(grep -E '"status":' "${LOCAL_MARKER_PATH}" | cut -d '"' -f4 || true)"
MARKER_SIZE="$(grep -E '"size_bytes":' "${LOCAL_MARKER_PATH}" | tr -dc '0-9' || true)"
MARKER_SHA="$(grep -E '"sha256":' "${LOCAL_MARKER_PATH}" | cut -d '"' -f4 || true)"

if [[ "${MARKER_CLIENT}" != "${BACKUP_CLIENT_ID}" ]]; then
    echo "[-] MARKER VALIDATION ERROR: Marker client_id ('${MARKER_CLIENT}') does not match expected '${BACKUP_CLIENT_ID}'." >&2
    rm -f "${LOCAL_DUMP_PATH}" "${LOCAL_SHA_PATH}" "${LOCAL_MARKER_PATH}"
    exit 1
fi

if [[ "${MARKER_STATUS}" != "complete" ]]; then
    echo "[-] MARKER VALIDATION ERROR: Marker status is '${MARKER_STATUS}', expected 'complete'." >&2
    rm -f "${LOCAL_DUMP_PATH}" "${LOCAL_SHA_PATH}" "${LOCAL_MARKER_PATH}"
    exit 1
fi

if [[ "${MARKER_FILENAME}" != "${DUMP_BASENAME}" ]]; then
    echo "[-] MARKER VALIDATION ERROR: Marker filename ('${MARKER_FILENAME}') does not match '${DUMP_BASENAME}'." >&2
    rm -f "${LOCAL_DUMP_PATH}" "${LOCAL_SHA_PATH}" "${LOCAL_MARKER_PATH}"
    exit 1
fi

LOCAL_DOWNLOAD_SIZE="$(stat -f "%z" "${LOCAL_DUMP_PATH}" 2>/dev/null || stat -c "%s" "${LOCAL_DUMP_PATH}" 2>/dev/null || echo "0")"
if [[ -n "${MARKER_SIZE}" && "${MARKER_SIZE}" -ne "${LOCAL_DOWNLOAD_SIZE}" ]]; then
    echo "[-] MARKER VALIDATION ERROR: Downloaded file size (${LOCAL_DOWNLOAD_SIZE} bytes) does not match marker size (${MARKER_SIZE} bytes)." >&2
    rm -f "${LOCAL_DUMP_PATH}" "${LOCAL_SHA_PATH}" "${LOCAL_MARKER_PATH}"
    exit 1
fi

# Step 5: Cryptographic SHA-256 Verification
echo "[+] Verifying SHA-256 checksum of downloaded backup..."
if command -v sha256sum >/dev/null 2>&1; then
    ACTUAL_HASH="$(cd "${DEST_DIR}" && sha256sum "${DUMP_BASENAME}" | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
    ACTUAL_HASH="$(cd "${DEST_DIR}" && shasum -a 256 "${DUMP_BASENAME}" | awk '{print $1}')"
else
    echo "[-] ERROR: sha256sum or shasum tool missing." >&2
    exit 1
fi

EXPECTED_HASH="$(awk '{print $1}' "${LOCAL_SHA_PATH}")"

if [[ "${ACTUAL_HASH}" != "${EXPECTED_HASH}" ]]; then
    echo "[-] ERROR: Downloaded file checksum mismatch against .sha256 sidecar!" >&2
    echo "[-] Expected: ${EXPECTED_HASH}" >&2
    echo "[-] Actual:   ${ACTUAL_HASH}" >&2
    rm -f "${LOCAL_DUMP_PATH}" "${LOCAL_SHA_PATH}" "${LOCAL_MARKER_PATH}"
    exit 1
fi

if [[ -n "${MARKER_SHA}" && "${ACTUAL_HASH}" != "${MARKER_SHA}" ]]; then
    echo "[-] ERROR: Downloaded file checksum mismatch against .complete marker!" >&2
    rm -f "${LOCAL_DUMP_PATH}" "${LOCAL_SHA_PATH}" "${LOCAL_MARKER_PATH}"
    exit 1
fi

echo "============================================================"
echo " DOWNLOAD & VALIDATION SUCCESS"
echo " Client:      ${BACKUP_CLIENT_ID}"
echo " Local File:  ${LOCAL_DUMP_PATH}"
echo " Size:        ${LOCAL_DOWNLOAD_SIZE} bytes"
echo " Checksum:    VALID (${ACTUAL_HASH})"
echo " Marker:      COMPLETE (Verified)"
echo " Ready for restore verification with:"
echo "   ./scripts/restore-postgres.sh ${LOCAL_DUMP_PATH}"
echo "============================================================"
