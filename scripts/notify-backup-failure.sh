#!/usr/bin/env bash
# ==============================================================================
# Commercial Attendance Stack - Backup Failure Notification Hook
# Sends operational alert webhook on backup failure without exposing secrets
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

BACKUP_ALERT_WEBHOOK_URL=""
BACKUP_CLIENT_ID="client-default"

if [[ -n "${ENV_SOURCE}" ]]; then
    BACKUP_ALERT_WEBHOOK_URL="$(grep -E '^BACKUP_ALERT_WEBHOOK_URL=' "${ENV_SOURCE}" | cut -d '=' -f2- | tr -d '\r\n"' || true)"
    BACKUP_CLIENT_ID="$(grep -E '^BACKUP_CLIENT_ID=' "${ENV_SOURCE}" | cut -d '=' -f2- | tr -d '\r\n"' || true)"
fi

BACKUP_ALERT_WEBHOOK_URL="${BACKUP_ALERT_WEBHOOK_URL:-}"
BACKUP_CLIENT_ID="${BACKUP_CLIENT_ID:-client-default}"

# If no webhook URL is configured, exit cleanly
if [[ -z "${BACKUP_ALERT_WEBHOOK_URL}" ]]; then
    exit 0
fi

STAGE="${1:-unknown_stage}"
MESSAGE="${2:-Backup pipeline execution failed}"
EXIT_CODE="${3:-1}"
TIMESTAMP_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
HOSTNAME="$(hostname 2>/dev/null || echo "unknown-host")"

# Sanitize message to prevent JSON formatting breakages
SANITIZED_MSG="$(echo "${MESSAGE}" | tr '\r\n"' ' ' | sed 's/\\/\\\\/g')"

PAYLOAD=$(cat <<EOF
{
  "status": "failed",
  "client_id": "${BACKUP_CLIENT_ID}",
  "timestamp_utc": "${TIMESTAMP_UTC}",
  "host": "${HOSTNAME}",
  "stage": "${STAGE}",
  "message": "${SANITIZED_MSG}",
  "exit_code": ${EXIT_CODE}
}
EOF
)

# Fire webhook non-blocking with 10s timeout, suppressing network errors
curl -s -X POST \
     -H "Content-Type: application/json" \
     -H "User-Agent: zk-attendance-backup-notifier/1.0" \
     --max-time 10 \
     --data "${PAYLOAD}" \
     "${BACKUP_ALERT_WEBHOOK_URL}" >/dev/null 2>&1 || true

exit 0
