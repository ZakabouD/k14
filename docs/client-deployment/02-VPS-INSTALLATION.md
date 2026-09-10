# 02 — VPS INSTALLATION
# Commercial Cloud Server Deployment Runbook

This guide documents the provisioning of a dedicated commercial application server on Ubuntu 24.04 LTS (current deployment target/policy), setting up Docker Engine, automated TLS via Caddy 2, PostgreSQL 16 database, and Next.js 16 dashboard.

---

## 1. Cloud Architecture Overview

```
[Browser / Mobile Client / Pi Bridge]
          │  HTTPS 443 / HTTP 80 (ACME Challenge)
          ▼
┌──────────────────────────────────────────────────────────┐
│ Caddy 2 Reverse Proxy (Automated Let's Encrypt TLS)     │
│ Service: caddy | Container: zk_caddy                     │
└─────────┬────────────────────────────────────────────────┘
          │  Internal Docker Bridge Network (frontend_net)
          ▼
┌──────────────────────────────────────────────────────────┐
│ Next.js 16.2.6 Production Dashboard (React 19.2.4)       │
│ Service: dashboard | Container: zk_dashboard (Port 3000) │
└─────────┬────────────────────────────────────────────────┘
          │  Internal Docker Bridge Network (backend_net)
          ▼
┌──────────────────────────────────────────────────────────┐
│ PostgreSQL 16 Database (postgres:16-alpine)              │
│ Service: postgres | Container: zk_postgres (Port 5432)   │
│ Persistent Docker Volume: zk_commercial_postgres_data    │
└──────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Host Port Isolation & Network Verification Boundary:**
> * In `docker-compose.yml`, PostgreSQL (`5432`) and Next.js Dashboard (`3000`) are **NOT published as host ports** (they have no `ports:` mapping to the host).
> * They communicate strictly across internal Docker bridge networks (`frontend_net`, `backend_net`).
> * **UFW Alone Is Insufficient:** Docker by default manages Linux `iptables` directly and can bypass standard UFW host rules for published ports. Omitting host port bindings in the Compose definition is the primary isolation barrier. Verification requires inspecting Compose config, runtime container port mapping (`docker port`), and external reachability tests.

---

## STAGE 1: Server Base Hardening & Docker Engine Installation

### Target OS: Ubuntu 24.04 LTS (Deployment Policy Target)

```bash
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Install essential dependencies
sudo apt install -y curl git ufw fail2ban ca-certificates gnupg lsb-release

# 3. Configure UFW Firewall (Strict host port lockdown)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP ACME challenge'
sudo ufw allow 443/tcp comment 'HTTPS Caddy'
sudo ufw allow 443/udp comment '443/udp - reserved/allowed for Caddy QUIC/HTTP3 capability; runtime negotiation NOT-VALIDATED'
sudo ufw --force enable

# 4. Install official Docker Engine & Docker Compose plugin (Ubuntu 24.04)
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 5. Add deployment user to docker group
sudo usermod -aG docker $USER
```

> [!NOTE]
> **Docker Group Membership:**
> Adding your user to the `docker` group requires starting a new login session. Execute `newgrp docker` or log out and reconnect via SSH to apply permissions without `sudo`.

> [!NOTE]
> **Operating System Qualification Boundary:**
> Debian 12 is **NOT currently execution-qualified** by this SOP evidence. It may be a future alternative requiring a separate validated installation path. For Client #1, this SOP's deployment policy target remains **Ubuntu 24.04 LTS**.

---

## STAGE 2: Repository Setup & Protected Secret Generation

```bash
# 1. Create deployment directory with correct permissions
sudo mkdir -p /opt/attendance
sudo chown -R $USER:$USER /opt/attendance

# 2. Clone commercial repository on branch commercial
git clone -b commercial https://github.com/ZakabouD/k14.git /opt/attendance/zk-k14-commercial
cd /opt/attendance/zk-k14-commercial

# 3. Prepare .env.docker with restrictive permissions BEFORE writing configuration
(umask 077 && cp .env.docker.example .env.docker && chmod 600 .env.docker)

# 4. Configure non-secret client parameters in .env.docker
sed -i "s|^APP_DOMAIN=.*|APP_DOMAIN=<APP_DOMAIN>|" .env.docker
sed -i "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=<ADMIN_EMAIL>|" .env.docker
sed -i "s|^COMPANY_NAME=.*|COMPANY_NAME=\"<CLIENT_DISPLAY_NAME>\"|" .env.docker
sed -i "s|^TIMEZONE=.*|TIMEZONE=Africa/Casablanca|" .env.docker
sed -i "s|^DEFAULT_CURRENCY=.*|DEFAULT_CURRENCY=DH|" .env.docker

# 5. Protected Secret Generation & Ephemeral Credential Custody (Fail-Closed)
# Remove template placeholder lines for secrets:
sed -i -E '/^(POSTGRES_PASSWORD|JWT_SECRET|ADMIN_PASSWORD)=/d' .env.docker

# Stream generated high-entropy secrets directly into .env.docker via standard redirection
# (No secret values are placed in command-line arguments, shell variables, or process tables)
(
  umask 077
  set +x

  # Initialize tracking variables for ephemeral files
  ADMIN_STAGE_FILE=""
  HANDOVER_CRED_FILE=""

  cleanup_temp_creds() {
    [ -n "$ADMIN_STAGE_FILE" ] && [ -f "$ADMIN_STAGE_FILE" ] && (shred -u "$ADMIN_STAGE_FILE" 2>/dev/null || rm -f "$ADMIN_STAGE_FILE")
    [ -n "$HANDOVER_CRED_FILE" ] && [ -f "$HANDOVER_CRED_FILE" ] && rm -f "$HANDOVER_CRED_FILE"
  }
  trap cleanup_temp_creds ERR

  printf "POSTGRES_PASSWORD=" >> .env.docker || { echo "ERROR: Failed writing POSTGRES_PASSWORD prefix"; exit 1; }
  openssl rand -hex 24 >> .env.docker || { echo "ERROR: Failed generating POSTGRES_PASSWORD"; exit 1; }

  printf "JWT_SECRET=" >> .env.docker || { echo "ERROR: Failed writing JWT_SECRET prefix"; exit 1; }
  openssl rand -hex 32 >> .env.docker || { echo "ERROR: Failed generating JWT_SECRET"; exit 1; }

  # Generate initial admin password into unique private staging file (Fail-Closed)
  ADMIN_STAGE_FILE=$(mktemp ~/.zk_admin_stage.XXXXXX) || { echo "ERROR: mktemp failed for admin staging file" >&2; exit 1; }
  chmod 600 "$ADMIN_STAGE_FILE" || { echo "ERROR: chmod failed on admin staging file" >&2; exit 1; }

  # Fail-closed checks: regular file, not symlink, owned by current user
  if [ ! -f "$ADMIN_STAGE_FILE" ] || [ -L "$ADMIN_STAGE_FILE" ] || [ ! -O "$ADMIN_STAGE_FILE" ]; then
    echo "ERROR: Invalid staging credential file permissions/ownership. Aborting." >&2
    exit 1
  fi

  openssl rand -hex 16 > "$ADMIN_STAGE_FILE" || { echo "ERROR: openssl generation failed" >&2; exit 1; }

  printf "ADMIN_PASSWORD=" >> .env.docker || { echo "ERROR: Failed writing ADMIN_PASSWORD prefix"; exit 1; }
  cat "$ADMIN_STAGE_FILE" >> .env.docker || { echo "ERROR: Failed writing ADMIN_PASSWORD to .env.docker"; exit 1; }

  # Create unique ephemeral handover record for Phase 7 delivery (Fail-Closed)
  HANDOVER_CRED_FILE=$(mktemp ~/.zk_handover_cred.XXXXXX) || { echo "ERROR: mktemp failed for handover credential file" >&2; exit 1; }
  chmod 600 "$HANDOVER_CRED_FILE" || { echo "ERROR: chmod failed on handover credential file" >&2; exit 1; }

  if [ ! -f "$HANDOVER_CRED_FILE" ] || [ -L "$HANDOVER_CRED_FILE" ] || [ ! -O "$HANDOVER_CRED_FILE" ]; then
    echo "ERROR: Invalid handover credential file permissions/ownership. Aborting." >&2
    exit 1
  fi

  printf "ADMIN_PASSWORD=" > "$HANDOVER_CRED_FILE" || { echo "ERROR: Failed writing prefix to handover file"; exit 1; }
  cat "$ADMIN_STAGE_FILE" >> "$HANDOVER_CRED_FILE" || { echo "ERROR: Failed copying password to handover file"; exit 1; }

  # Remove intermediate staging file immediately after copying to handover file
  shred -u "$ADMIN_STAGE_FILE" 2>/dev/null || rm -f "$ADMIN_STAGE_FILE"
  ADMIN_STAGE_FILE=""

  echo "Ephemeral admin credential recorded at: ${HANDOVER_CRED_FILE}"
  echo "(Mode 600, unique regular file; transfer to client password vault, confirm recipient custody, then delete immediately: rm -f \"${HANDOVER_CRED_FILE}\")"
)
```

> [!IMPORTANT]
> **Database Seeding & Ephemeral Admin Credential Lifecycle:**
> * **Seeding Contract:** During first startup, the `migrate` container runs `prisma migrate deploy` followed by `src/scripts/seed.ts`. `seed.ts` creates the singleton `SystemSettings` row derived from `.env.docker`. If `ADMIN_PASSWORD` is missing, empty, or whitespace during initial execution, `seed.ts` generates a random 24-character hex password and prints it to stdout.
> * **Existing Database Behavior:** If `SystemSettings` already exists, `seed.ts` skips initialization entirely. Changing `ADMIN_PASSWORD` in `.env.docker` later does **NOT** automatically update an existing database password.
> * **Pre-Startup Secret Gate (STOP Condition):** Before launching containers, verify `ADMIN_PASSWORD` is non-empty. If validation fails, STOP and do not proceed.
> * **Historical Credential Closure Status:** Historical D7 admin credential exposure was operationally rotated, verified, and closed (OPERATIONALLY CLOSED / PASS); Client #1 is authorized to begin Phase 0.
> * **Zero Permanent Temporary Handover/Staging Credential Files:** Never store permanent plaintext handover/staging credential files on disk. (Note: `.env.docker`, `.env.backup`, and on-site bridge `.env` legitimately contain persistent mode-600 operational runtime configurations). The unique temporary file (`$HANDOVER_CRED_FILE`) created above must be transferred to the client's secure password vault or via an ephemeral single-view secret link during handover, recipient custody confirmed, and deleted immediately: `rm -f "$HANDOVER_CRED_FILE"`. Never use broad wildcard deletions (`rm -f ~/.zk_*`).
> * **Secure Erase Limitations:** Utility commands such as `shred` provide best-effort overwriting and are dependent on underlying storage architecture (copy-on-write filesystems, SSD wear-leveling controllers, and VM block layers may retain underlying data). Minimize on-disk plaintext exposure by transferring credentials and removing temporary files promptly.

### Safe Secret Presence Verification (Without Value Exposure):
```bash
# Check that required secrets exist, are non-empty, and satisfy minimum lengths without printing them:
test -n "$(grep -E '^POSTGRES_PASSWORD=[a-f0-9]{32,}' .env.docker)" && echo "POSTGRES_PASSWORD: OK (High-entropy)"
test -n "$(grep -E '^JWT_SECRET=[a-f0-9]{32,}' .env.docker)" && echo "JWT_SECRET: OK (High-entropy)"
test -n "$(grep -E '^ADMIN_PASSWORD=[a-f0-9]{16,}' .env.docker)" && echo "ADMIN_PASSWORD: OK (Configured)"
test -n "$(grep -E '^APP_DOMAIN=.+' .env.docker)" && echo "APP_DOMAIN: OK"

# Stop gate: Halt if any secret is missing or empty
if [ -z "$(grep -E '^ADMIN_PASSWORD=[a-f0-9]{16,}' .env.docker)" ]; then
  echo "CRITICAL ERROR: ADMIN_PASSWORD is missing or invalid in .env.docker. Aborting." >&2
  exit 1
fi
```

---

## STAGE 3: Build & Start Containerized Stack

```bash
cd /opt/attendance/zk-k14-commercial

# 1. Build and launch containers
docker compose --env-file .env.docker up -d --build

# 2. Check running services
docker compose --env-file .env.docker ps
```

### Expected Service Status:
| Service Name | Container Name | Status | Ports |
| :--- | :--- | :--- | :--- |
| `caddy` | `zk_caddy` | `Up` | `0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp, 443/udp (QUIC capability reserved/allowed; runtime negotiation NOT-VALIDATED)` |
| `dashboard` | `zk_dashboard` | `Up (healthy)` | `3000/tcp (internal only)` |
| `postgres` | `zk_postgres` | `Up (healthy)` | `5432/tcp (internal only)` |
| `migrate` | `zk_migrator` | `Exited (0)` | *(Migrator terminates cleanly after seeding)* |

### Mandatory Host Port Isolation Verification (Fail-Closed):
```bash
# 1. Verify Compose parsed configuration (Only caddy has published ports):
docker compose --env-file .env.docker config | grep -E 'ports:' -A 2

# 2. Verify runtime container port bindings (Fail-Closed: command failure halts verification):
DASHBOARD_CID=$(docker compose --env-file .env.docker ps -q dashboard) || { echo "ERROR: Failed querying dashboard container ID"; exit 1; }
test -n "$DASHBOARD_CID" || { echo "ERROR: Dashboard container not found"; exit 1; }
DASHBOARD_PORTS=$(docker port "$DASHBOARD_CID") || { echo "ERROR: docker port command failed for dashboard"; exit 1; }
test -z "$DASHBOARD_PORTS" || { echo "ERROR: Dashboard unexpectedly published host ports: $DASHBOARD_PORTS"; exit 1; }
echo "Dashboard: No host port published (OK)"

POSTGRES_CID=$(docker compose --env-file .env.docker ps -q postgres) || { echo "ERROR: Failed querying postgres container ID"; exit 1; }
test -n "$POSTGRES_CID" || { echo "ERROR: Postgres container not found"; exit 1; }
POSTGRES_PORTS=$(docker port "$POSTGRES_CID") || { echo "ERROR: docker port command failed for postgres"; exit 1; }
test -z "$POSTGRES_PORTS" || { echo "ERROR: Postgres unexpectedly published host ports: $POSTGRES_PORTS"; exit 1; }
echo "PostgreSQL: No host port published (OK)"

# 3. Verify host network sockets (Distinguish 'no listening socket on host' from firewall reachability):
sudo ss -tulpn | grep -E ':(5432|3000)\b' && { echo "ERROR: Host socket listening on 5432 or 3000"; exit 1; } || echo "Host sockets: No listening ports on 5432 or 3000 (OK)"

# 4. External negative reachability test (from external authorized host - tests public firewall posture):
# nc -zv -w 3 <VPS_IP> 3000 -> Expected: Connection refused or timed out
# nc -zv -w 3 <VPS_IP> 5432 -> Expected: Connection refused or timed out
# (Note: Port unreachable externally proves firewall posture, but internal container port isolation must be verified via steps 1-3 above)
```

---

## STAGE 4: Automated TLS & Health Verification

```bash
# 1. Query local API health endpoint via HTTPS
curl -i https://<APP_DOMAIN>/api/health

# 2. Query from external machine / workstation
curl -s -w "\nHTTP_STATUS: %{http_code}\n" https://<APP_DOMAIN>/api/health
```

### Expected Response:
```http
HTTP/2 200 
content-type: application/json

{"status":"ok","database":"connected"}
HTTP_STATUS: 200
```

* **Pass Criteria:** HTTP 200 OK, TLS certificate valid, JSON returns `{"status":"ok","database":"connected"}`.
* **Stop Condition:** If database is unreachable, `/api/health` returns HTTP 503 `{"status":"error","database":"disconnected"}`. If TLS handshake fails or 502 Bad Gateway occurs, check DNS propagation (`dig +short <APP_DOMAIN> @1.1.1.1`) and Caddy logs (`docker compose --env-file .env.docker logs caddy`).
