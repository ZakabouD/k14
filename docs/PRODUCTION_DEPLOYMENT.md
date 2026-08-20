# Production Deployment Runbook

**ZKTeco K14 Attendance Platform — Commercial Edition**

This runbook provides the step-by-step procedure to deploy the commercial attendance platform to a clean Linux VPS (e.g. OVHcloud).

---

## 1. Architecture & Deployment Overview

### Deployment Model: 1 Client = 1 VPS
Each customer receives a dedicated, single-tenant installation comprising:
- 1 Linux VPS (e.g., OVHcloud 2 vCPU, 4 GB RAM, 40 GB NVMe SSD)
- 1 PostgreSQL 16 Alpine container (stored in persistent Docker named volume)
- 1 Next.js 16 standalone dashboard container
- 1 Caddy reverse proxy container (automatic Let's Encrypt / ZeroSSL TLS)
- 1 Automated daily backup pipeline (03:00 Africa/Casablanca $\rightarrow$ Cloudflare R2)
- 1 Local Raspberry Pi hardware bridge connected to on-premise ZKTeco K14 terminal(s)

```
Internet
   │
 HTTPS :443 (TCP/UDP)
   │
┌──▼───────────────────────────────────────────────────────────────────────────┐
│ Client VPS                                                                   │
│                                                                              │
│  ┌──────────────┐         frontend_net          ┌────────────────────────┐  │
│  │   zk_caddy   │ ────────────────────────────► │      zk_dashboard      │  │
│  └──────────────┘                               └───────────┬────────────┘  │
│                                                             │               │
│                                                             │ backend_net   │
│                                                             ▼               │
│                                                 ┌────────────────────────┐  │
│                                                 │      zk_postgres       │  │
│                                                 │ (Port 5432 is PRIVATE) │  │
│                                                 └────────────────────────┘  │
│                                                             ▲               │
│  ┌─────────────────────────────────┐                        │               │
│  │ systemd Timer (03:00 Casablanca)│ ───────────────────────┘               │
│  │  └─► backup-full.sh             │ (Local Dump + SHA-256 + Marker)        │
│  └────────────────┬────────────────┘                                        │
└───────────────────┼──────────────────────────────────────────────────────────┘
                    │
                    ▼ HTTPS (S3 API)
┌──────────────────────────────────────────────────────────────────────────────┐
│ Cloudflare R2 (Off-Site Backup Storage)                                      │
│ s3://zk-k14-commercial-backups/<BACKUP_CLIENT_ID>/postgres/YYYY/MM/          │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Step-by-Step Production Deployment Guide

---

### STAGE 0: Prerequisites & Planning
Before connecting to the server, ensure you have:
1. **VPS IP Address** (from OVHcloud dashboard).
2. **Domain Name / FQDN** (e.g. `pointage.client-domain.ma`).
3. **SSH Key Pair** (`~/.ssh/id_ed25519.pub` on operator machine).
4. **Cloudflare R2 Bucket & API Token** (Permissions: *Object Read & Write* restricted to `zk-k14-commercial-backups`).
5. **Unique Client Identifier** (e.g. `client-acme-casablanca`, matching `^[A-Za-z0-9_-]{1,64}$`).

---

### STAGE 1: Initial VPS Access
Log in to the fresh VPS as root using the temporary credentials provided by OVHcloud:
```bash
ssh root@<VPS_IP_ADDRESS>
```

---

### STAGE 2: Operating System Updates & Timezone
Update all system packages and configure the official timezone:
```bash
# Set timezone to Africa/Casablanca (Company Standard)
timedatectl set-timezone Africa/Casablanca

# Update base OS packages
apt update && apt upgrade -y
apt install -y curl wget git ufw htop fail2ban unzip awscli
```

---

### STAGE 3: Administrative Deployment User & SSH Hardening
Create a dedicated `deploy` user with sudo privileges and configure public key authentication:

```bash
# 1. Create deploy user
adduser --gecos "" deploy
usermod -aG sudo deploy

# 2. Configure SSH keys for deploy user
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
cat << 'EOF' >> /home/deploy/.ssh/authorized_keys
<PASTE_YOUR_OPERATOR_PUBLIC_SSH_KEY_HERE>
EOF
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh

# 3. Test deploy user sudo without password prompt (optional for automation)
echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deploy
chmod 440 /etc/sudoers.d/deploy
```

> [!IMPORTANT]
> **DO NOT CLOSE YOUR ROOT SESSION YET.**
> Open a new terminal window on your local machine and verify SSH login with key:
> ```bash
> ssh deploy@<VPS_IP_ADDRESS>
> sudo whoami  # Must return root
> ```

Once verified, harden SSH configuration in `/etc/ssh/sshd_config.d/99-hardening.conf` (or `/etc/ssh/sshd_config`):
```bash
sudo bash -c 'cat << "EOF" > /etc/ssh/sshd_config.d/99-hardening.conf
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
X11Forwarding no
MaxAuthTries 5
EOF'

sudo systemctl restart ssh || sudo systemctl restart sshd
```

---

### STAGE 4: Host Firewall (UFW)
Configure UFW with a strict default-deny policy:
```bash
# 1. Set default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 2. Allow SSH, HTTP, and HTTPS (TCP & UDP for HTTP/3 QUIC)
sudo ufw allow 22/tcp comment "SSH Management"
sudo ufw allow 80/tcp comment "HTTP (Caddy Redirect / ACME)"
sudo ufw allow 443/tcp comment "HTTPS (Caddy Web & Device API)"
sudo ufw allow 443/udp comment "HTTP/3 QUIC"

# 3. Enable firewall
sudo ufw --force enable
sudo ufw status verbose
```

---

### STAGE 5: Docker Engine & Compose Installation
Install official Docker Engine using Docker's official apt repository:
```bash
# 1. Add Docker official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# 2. Add repository to Apt sources
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 3. Install Docker packages
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 4. Add deploy user to docker group
sudo usermod -aG docker deploy
```
*Note: Log out and log back in for `docker` group membership to take effect.*

---

### STAGE 6: Repository Deployment
Clone the commercial repository to the production directory `/opt/attendance/zk-k14-commercial`:
```bash
sudo mkdir -p /opt/attendance
sudo chown deploy:deploy /opt/attendance

cd /opt/attendance
git clone https://github.com/ZakabouD/k14.git zk-k14-commercial
cd zk-k14-commercial
git checkout commercial
```

---

### STAGE 7: Production Environment Configuration
Generate cryptographically strong secrets for this specific client and configure `.env.docker` and `.env.backup`:

```bash
# 1. Generate secrets (Execute on VPS)
DB_PASS="$(openssl rand -base64 24 | tr -d '/+=')"
JWT_SEC="$(openssl rand -base64 36 | tr -d '\r\n')"
ADM_PASS="$(openssl rand -base64 16 | tr -d '/+=')"

echo "Generated Database Password: ${DB_PASS}"
echo "Generated Admin Password:    ${ADM_PASS}"

# 2. Create .env.docker
cp .env.docker.example .env.docker
chmod 600 .env.docker

# Edit .env.docker with production values:
# - APP_DOMAIN=pointage.client-domain.ma
# - POSTGRES_PASSWORD=<generated_db_pass>
# - JWT_SECRET=<generated_jwt_secret>
# - ADMIN_EMAIL=admin@client-domain.ma
# - ADMIN_PASSWORD=<generated_admin_pass>
# - COMPANY_NAME=Nom Client
```

Configure `.env.backup`:
```bash
# 3. Create .env.backup
cp .env.backup.example .env.backup
chmod 600 .env.backup

# Edit .env.backup with client values:
# - BACKUP_REMOTE_ENABLED=true
# - BACKUP_CLIENT_ID=client-acme-casablanca
# - R2_ACCOUNT_ID=<cloudflare_account_id>
# - R2_BUCKET=zk-k14-commercial-backups
# - R2_ACCESS_KEY_ID=<new_rotated_r2_access_key>
# - R2_SECRET_ACCESS_KEY=<new_rotated_r2_secret_key>
# - R2_ENDPOINT=https://<cloudflare_account_id>.r2.cloudflarestorage.com
# - BACKUP_ALERT_WEBHOOK_URL=https://hooks.slack.com/services/... (optional)
```

---

### STAGE 8: DNS Verification
Before launching Caddy, verify that the domain name points to the VPS IPv4 address:
```bash
# Query public DNS
dig +short pointage.client-domain.ma
# Ensure the returned IP matches your VPS IP address
```

---

### STAGE 9: Production Preflight Check
Run the non-destructive preflight audit script to verify environment integrity before starting containers:
```bash
npm run preflight
# Must output: [+] PRODUCTION PREFLIGHT: PASS
```

---

### STAGE 10: Container Build & Bootstrap Launch
Launch the production Docker stack:
```bash
npm run docker:up
```
This executes:
1. Builds the Next.js standalone runner image (`zk_dashboard`).
2. Builds the migration runner image (`zk_migrator`).
3. Starts `zk_postgres` in isolated network `zk_commercial_backend_net`.
4. Executes `zk_migrator` which runs `npx prisma migrate deploy` and seeds initial company settings & administrator.
5. Starts `zk_dashboard` on private port 3000.
6. Starts `zk_caddy` on public ports 80/443.

---

### STAGE 11: HTTPS & Application Health Verification
Verify that Caddy obtained a valid TLS certificate and the health endpoint returns 200 OK:
```bash
# Check container status
docker compose --env-file .env.docker ps

# Check public HTTPS endpoint
curl -i https://pointage.client-domain.ma/api/health
# Expected Output: HTTP/2 200 OK  {"status":"ok","database":"connected"}
```

---

### STAGE 12: Admin Dashboard Login
1. Navigate to `https://pointage.client-domain.ma/login` in your web browser.
2. Log in using `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
3. Verify access to Dashboard, Users, Shifts, Holidays, and Settings pages.

---

### STAGE 13: Provision Hardware Bridge (Raspberry Pi)
1. In the Dashboard UI $\rightarrow$ **Paramètres / Appareils** (or via `npm run device:create`):
   - Register a new device: `DEV-CASABLANCA-01`
   - Generate secure device token.
2. On the on-premise Raspberry Pi:
   - Configure `/opt/attendance-bridge/.env`:
     ```env
     VPS_API_URL=https://pointage.client-domain.ma
     DEVICE_ID=DEV-CASABLANCA-01
     DEVICE_TOKEN=<generated_device_token>
     ZK_DEVICE_IP=192.168.1.201
     ZK_DEVICE_PORT=4370
     ```
   - Start the bridge worker.
3. Verify that the Dashboard reflects real-time heartbeat and punch synchronization.

---

### STAGE 14: Automated Backup Scheduler Activation
Activate the systemd timer for daily automated backups at **03:00 Africa/Casablanca**:
```bash
# Install systemd service & timer
sudo npm run backup:schedule -- --systemd

# Verify timer is active and scheduled for next 03:00
npm run backup:schedule -- --status
```

---

### STAGE 15: Production Backup Smoke Test
Execute one manual full backup to confirm local dump creation and remote Cloudflare R2 synchronization:
```bash
# Run full backup
npm run backup:full

# List remote backups in R2
npm run backup:remote:list
# Verify output shows status: COMPLETE
```

---

### STAGE 16: Disaster Recovery Test (Validation DB)
Execute an isolated DR test restore into a temporary database:
```bash
# 1. Download latest backup from R2
npm run backup:remote:download -- <LATEST_DUMP_FILE>

# 2. Test-restore into temporary validation DB
npm run backup:restore -- backups/postgres/<LATEST_DUMP_FILE> attendance_dr_test --keep

# 3. Query records in attendance_dr_test
POSTGRES_USER="$(grep -E '^POSTGRES_USER=' .env.docker | cut -d '=' -f2- | tr -d '\r\n"')"
docker exec zk_postgres psql -U "${POSTGRES_USER}" -d attendance_dr_test -c "SELECT count(*) FROM \"User\";"

# 4. Clean up temporary test DB
docker exec zk_postgres psql -U "${POSTGRES_USER}" -d postgres -c "DROP DATABASE IF EXISTS \"attendance_dr_test\";"
```

---

### STAGE 17: Production Acceptance Sign-Off
Complete all checklist items in [PRODUCTION_ACCEPTANCE_CHECKLIST.md](file:///Users/zakariabouchtart/zk-k14-commercial/docs/PRODUCTION_ACCEPTANCE_CHECKLIST.md).

---

## 3. Operations & Maintenance Reference

### Viewing Live Logs
```bash
# Dashboard logs
npm run docker:logs

# Caddy logs
docker compose --env-file .env.docker logs -f caddy

# PostgreSQL logs
docker compose --env-file .env.docker logs -f postgres

# Backup schedule logs (systemd journal)
journalctl -u zk-commercial-backup.service -n 50 --no-pager
```

### Safe Stack Restart & Shutdown
```bash
# Safe restart
docker compose --env-file .env.docker restart

# Safe shutdown (Preserves all database & TLS volume data)
npm run docker:down
```

> [!WARNING]
> **NEVER run `docker compose down -v` in production.**
> `down -v` destroys the PostgreSQL database volume and Caddy TLS storage.
