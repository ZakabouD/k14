#!/usr/bin/env bash
# ==============================================================================
# Commercial Attendance Stack - Production Preflight Validation Script
# Performs non-destructive, read-only verification of production readiness
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_DOCKER="${ROOT_DIR}/.env.docker"
ENV_BACKUP="${ROOT_DIR}/.env.backup"

echo "================================================================================"
echo " Starting Production Preflight Verification"
echo " Target Directory: ${ROOT_DIR}"
echo " Timestamp:        $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "================================================================================"

FAILURES=0
WARNINGS=0

pass() {
    echo "  [PASS] $1"
}

fail() {
    echo "  [FAIL] $1" >&2
    FAILURES=$((FAILURES + 1))
}

warn() {
    echo "  [WARN] $1"
    WARNINGS=$((WARNINGS + 1))
}

# ------------------------------------------------------------------------------
# 1. Environment Files Presence & Permissions
# ------------------------------------------------------------------------------
echo ""
echo "[1/6] Checking Configuration Files..."

if [[ -f "${ENV_DOCKER}" ]]; then
    pass ".env.docker exists"
    # Check permissions (should not be world-readable)
    if stat -c "%a" "${ENV_DOCKER}" 2>/dev/null | grep -qE "600|400|640"; then
        pass ".env.docker permissions are secure"
    elif stat -f "%Lp" "${ENV_DOCKER}" 2>/dev/null | grep -qE "600|400|640"; then
        pass ".env.docker permissions are secure"
    else
        warn ".env.docker permissions should be restricted (recommended: chmod 600 .env.docker)"
    fi
else
    fail ".env.docker is missing. Copy from .env.docker.example and configure before deploying."
fi

if [[ -f "${ENV_BACKUP}" ]]; then
    pass ".env.backup exists"
else
    warn ".env.backup is missing. Required if off-site Cloudflare R2 backup is enabled."
fi

# ------------------------------------------------------------------------------
# 2. Docker & Database Variables Validation
# ------------------------------------------------------------------------------
echo ""
echo "[2/6] Auditing Application & Database Environment Variables..."

if [[ -f "${ENV_DOCKER}" ]]; then
    APP_DOMAIN="$(grep -E '^APP_DOMAIN=' "${ENV_DOCKER}" | cut -d '=' -f2- | tr -d '\r\n"' || true)"
    POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "${ENV_DOCKER}" | cut -d '=' -f2- | tr -d '\r\n"' || true)"
    POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "${ENV_DOCKER}" | cut -d '=' -f2- | tr -d '\r\n"' || true)"
    POSTGRES_PASSWORD="$(grep -E '^POSTGRES_PASSWORD=' "${ENV_DOCKER}" | cut -d '=' -f2- | tr -d '\r\n"' || true)"
    JWT_SECRET="$(grep -E '^JWT_SECRET=' "${ENV_DOCKER}" | cut -d '=' -f2- | tr -d '\r\n"' || true)"
    ADMIN_EMAIL="$(grep -E '^ADMIN_EMAIL=' "${ENV_DOCKER}" | cut -d '=' -f2- | tr -d '\r\n"' || true)"

    if [[ -n "${APP_DOMAIN}" && "${APP_DOMAIN}" != "pointage.example.com" ]]; then
        pass "APP_DOMAIN configured (${APP_DOMAIN})"
    else
        fail "APP_DOMAIN is empty or set to example placeholder (pointage.example.com)"
    fi

    if [[ -n "${POSTGRES_DB}" ]]; then
        pass "POSTGRES_DB configured (${POSTGRES_DB})"
    else
        fail "POSTGRES_DB is empty"
    fi

    if [[ -n "${POSTGRES_USER}" ]]; then
        pass "POSTGRES_USER configured (${POSTGRES_USER})"
    else
        fail "POSTGRES_USER is empty"
    fi

    if [[ -n "${POSTGRES_PASSWORD}" && "${POSTGRES_PASSWORD}" != "CHANGE_ME_"* && ${#POSTGRES_PASSWORD} -ge 16 ]]; then
        pass "POSTGRES_PASSWORD is set and sufficiently strong"
    else
        fail "POSTGRES_PASSWORD is empty, default placeholder, or too weak (min 16 chars required)"
    fi

    if [[ -n "${JWT_SECRET}" && "${JWT_SECRET}" != "CHANGE_ME_"* && ${#JWT_SECRET} -ge 32 ]]; then
        pass "JWT_SECRET is set and meets minimum length requirements (>= 32 chars)"
    else
        fail "JWT_SECRET is empty, default placeholder, or shorter than 32 characters"
    fi

    if [[ -n "${ADMIN_EMAIL}" && "${ADMIN_EMAIL}" != "admin@example.com" ]]; then
        pass "ADMIN_EMAIL configured (${ADMIN_EMAIL})"
    else
        warn "ADMIN_EMAIL is set to default placeholder (admin@example.com)"
    fi
fi

# ------------------------------------------------------------------------------
# 3. Off-Site Backup & Client Identity Model
# ------------------------------------------------------------------------------
echo ""
echo "[3/6] Auditing Off-Site Backup & Client Identity Model..."

if [[ -f "${ENV_BACKUP}" ]]; then
    BACKUP_REMOTE_ENABLED="$(grep -E '^BACKUP_REMOTE_ENABLED=' "${ENV_BACKUP}" | cut -d '=' -f2- | tr -d '\r\n"' || true)"
    BACKUP_CLIENT_ID="$(grep -E '^BACKUP_CLIENT_ID=' "${ENV_BACKUP}" | cut -d '=' -f2- | tr -d '\r\n"' || true)"
    R2_BUCKET="$(grep -E '^R2_BUCKET=' "${ENV_BACKUP}" | cut -d '=' -f2- | tr -d '\r\n"' || true)"
    R2_ACCESS_KEY_ID="$(grep -E '^R2_ACCESS_KEY_ID=' "${ENV_BACKUP}" | cut -d '=' -f2- | tr -d '\r\n"' || true)"
    R2_SECRET_ACCESS_KEY="$(grep -E '^R2_SECRET_ACCESS_KEY=' "${ENV_BACKUP}" | cut -d '=' -f2- | tr -d '\r\n"' || true)"

    if [[ "${BACKUP_CLIENT_ID}" =~ ^[A-Za-z0-9_-]{1,64}$ ]]; then
        if [[ "${BACKUP_CLIENT_ID}" == "client-local-dev" || "${BACKUP_CLIENT_ID}" == "client-default" ]]; then
            warn "BACKUP_CLIENT_ID is using development value '${BACKUP_CLIENT_ID}'. Set to unique client identifier (e.g. client-acme)."
        else
            pass "BACKUP_CLIENT_ID is valid and unique (${BACKUP_CLIENT_ID})"
        fi
    else
        fail "BACKUP_CLIENT_ID is invalid or contains prohibited characters"
    fi

    if [[ "${BACKUP_REMOTE_ENABLED}" == "true" ]]; then
        if [[ -n "${R2_BUCKET}" && "${R2_BUCKET}" != "your_r2_bucket_name" ]]; then
            pass "R2_BUCKET configured (${R2_BUCKET})"
        else
            fail "R2_BUCKET is empty or contains template placeholder"
        fi

        if [[ -n "${R2_ACCESS_KEY_ID}" && "${R2_ACCESS_KEY_ID}" != "your_r2_access_key_id" ]]; then
            pass "R2_ACCESS_KEY_ID is configured"
        else
            fail "R2_ACCESS_KEY_ID is empty or contains template placeholder"
        fi

        if [[ -n "${R2_SECRET_ACCESS_KEY}" && "${R2_SECRET_ACCESS_KEY}" != "your_r2_secret_access_key" ]]; then
            pass "R2_SECRET_ACCESS_KEY is configured"
        else
            fail "R2_SECRET_ACCESS_KEY is empty or contains template placeholder"
        fi
    else
        pass "Remote R2 backup is disabled (BACKUP_REMOTE_ENABLED=false)"
    fi
fi

# ------------------------------------------------------------------------------
# 4. Host Tooling & Docker Engine
# ------------------------------------------------------------------------------
echo ""
echo "[4/6] Verifying Required Host Tooling..."

if command -v docker >/dev/null 2>&1; then
    pass "Docker engine CLI found ($(docker --version))"
else
    fail "Docker engine is not installed on this host"
fi

if docker compose version >/dev/null 2>&1; then
    pass "Docker Compose found ($(docker compose version))"
else
    fail "Docker Compose (v2) is not installed"
fi

if command -v aws >/dev/null 2>&1; then
    pass "AWS CLI tool found for R2 replication"
else
    warn "AWS CLI ('aws') not found on host. Required for off-site Cloudflare R2 backup replication."
fi

# ------------------------------------------------------------------------------
# 5. Shell Scripts Syntax & Integrity
# ------------------------------------------------------------------------------
echo ""
echo "[5/6] Verifying Shell Scripts Syntax (bash -n)..."

SCRIPT_ERRORS=0
for script in "${ROOT_DIR}"/scripts/*.sh; do
    if [[ -f "${script}" ]]; then
        if bash -n "${script}"; then
            pass "$(basename "${script}") syntax valid"
        else
            fail "$(basename "${script}") syntax error"
            SCRIPT_ERRORS=$((SCRIPT_ERRORS + 1))
        fi
    fi
done

# ------------------------------------------------------------------------------
# 6. Docker Compose Configuration Integrity
# ------------------------------------------------------------------------------
echo ""
echo "[6/6] Verifying Docker Compose Configuration..."

if [[ -f "${ENV_DOCKER}" ]]; then
    if docker compose --env-file "${ENV_DOCKER}" config >/dev/null 2>&1; then
        pass "docker-compose.yml configuration passes interpolation and schema validation"
    else
        fail "docker compose config failed. Check .env.docker and docker-compose.yml"
    fi
fi

# ------------------------------------------------------------------------------
# Summary & Decision Gate
# ------------------------------------------------------------------------------
echo ""
echo "================================================================================"
echo " Preflight Verification Summary"
echo " Failures: ${FAILURES}"
echo " Warnings: ${WARNINGS}"
echo "================================================================================"

if [[ ${FAILURES} -eq 0 ]]; then
    echo "[+] PRODUCTION PREFLIGHT: PASS"
    exit 0
else
    echo "[-] PRODUCTION PREFLIGHT: FAIL (${FAILURES} blocking issue(s) detected)" >&2
    exit 1
fi
