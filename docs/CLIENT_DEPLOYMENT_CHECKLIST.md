# Client #1 Master Deployment & Pre-Flight Checklist

**ZKTeco K14 Commercial Attendance Solution — Deployment Runbook**

This document serves as the canonical master deployment guide and pre-flight checklist for onboarding a new commercial customer from a fresh VPS, fresh Raspberry Pi, on-premise ZKTeco K14 biometric terminal, and client domain.

---

## 1. System Architecture & Network Isolation

The commercial solution follows a strict zero-inbound-port hardware bridge architecture. The on-premise Raspberry Pi communicates with local ZKTeco K14 terminal(s) across the local area network (LAN) and pushes encrypted attendance data to the central cloud VPS exclusively over outbound HTTPS (TCP 443).

```
                                  INTERNET
                                     │
                                     │ Outbound HTTPS :443 Only
                                     ▼
                       ┌───────────────────────────┐
                       │     CLIENT CLOUD VPS      │
                       │                           │
                       │ ┌───────────────────────┐ │
                       │ │ Caddy (TLS / Proxy)   │ │
                       │ └───────────┬───────────┘ │
                       │             ▼             │
                       │ ┌───────────────────────┐ │
                       │ │ Next.js 16 Dashboard  │ │
                       │ └───────────┬───────────┘ │
                       │             ▼             │
                       │ ┌───────────────────────┐ │
                       │ │ PostgreSQL 16 Private │ │
                       │ └───────────────────────┘ │
                       │ ┌───────────────────────┐ │
                       │ │ Automated R2 Backups  │ │
                       │ └───────────────────────┘ │
                       └─────────────▲─────────────┘
                                     │
                                     │ Outbound HTTPS :443
                                     │ (Token Authenticated)
┌────────────────────────────────────┼────────────────────────────────────┐
│ Client On-Premise LAN              │                                    │
│                                    │                                    │
│  ┌───────────────────────┐         │          ┌──────────────────────┐  │
│  │   ZKTeco K14 Terminal │         └──────────│  Raspberry Pi Bridge │  │
│  │   192.168.1.201       │ ── UDP/TCP :4370 ──► │  (Debian 64-bit)     │  │
│  │   (Fixed LAN IP)      │                    │  SyncWorker (PM2)    │  │
│  └───────────────────────┘                    └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Critical Security Boundaries
- **K14 Port 4370 is Private:** ZKTeco port 4370 must **NEVER** be port-forwarded or exposed to the public internet.
- **PostgreSQL is Private:** Database port 5432 is bound to internal Docker bridge network only (`zk_commercial_backend_net`) and must **NEVER** be published to the host network.
- **Zero Inbound Ports on Pi:** The Raspberry Pi requires zero incoming internet firewall rules.
- **Outbound HTTPS Traffic Only:** All synchronization, heartbeat, and remote polling occur via HTTPS over port 443 with device token authentication.

---

## 2. Client Configuration Matrix

| Category | Parameter | Example / Format | Storage Location | Sensitivity |
| :--- | :--- | :--- | :--- | :--- |
| **Client Metadata** | `CLIENT_NAME` | `"Acme Maroc SARL"` | Project records / Handover doc | Public / Metadata |
| **Client Metadata** | `CLIENT_DOMAIN` | `"pointage.acmemaroc.ma"` | DNS A-Record / Caddyfile | Public / Metadata |
| **Client Metadata** | `ADMIN_EMAIL` | `"admin@acmemaroc.ma"` | `.env.docker` | Low / Metadata |
| **Client Metadata** | `COMPANY_NAME` | `"Acme Maroc"` | `.env.docker` / DB Settings | Public / Metadata |
| **Client Metadata** | `DEFAULT_CURRENCY` | `"DH"` | `.env.docker` / DB Settings | Fixed / Metadata |
| **Client Metadata** | `TIMEZONE` | `"Africa/Casablanca"` | `.env.docker` / Pi OS / Code | Fixed Constant |
| **VPS Infrastructure**| `VPS_IPV4` | `51.210.xx.xx` | Hosting Provider | Deployment Info |
| **VPS Infrastructure**| `SSH_USER` | `deploy` | Server OS | Deployment Info |
| **Database Secret** | `POSTGRES_DB` | `attendance_acme` | `.env.docker` | Low |
| **Database Secret** | `POSTGRES_USER` | `zk_acme_user` | `.env.docker` | Low |
| **Database Secret** | `POSTGRES_PASSWORD` | `[64-hex random string]` | `.env.docker` (chmod 600) | **CRITICAL SECRET** |
| **Dashboard Secret** | `JWT_SECRET` | `[64-hex random string]` | `.env.docker` (chmod 600) | **CRITICAL SECRET** |
| **Dashboard Secret** | `ADMIN_PASSWORD` | `[Secure initial password]` | Seed / Transferred securely | **CRITICAL SECRET** |
| **Device Credential**| `DEVICE_ID` | `"DEV-CASABLANCA-01"` | DB `Device` / Pi `.env` | Low / Identifier |
| **Device Credential**| `DEVICE_NAME` | `"Pointeuse Principale"` | DB `Device` | Low / Label |
| **Device Secret** | `DEVICE_TOKEN` | `[64-hex random token]` | Pi `.env` (chmod 600) | **CRITICAL SECRET** |
| **Device Hardware** | `ZKTECO_IP` | `"192.168.1.201"` | Pi `.env` | Local LAN Info |
| **Device Hardware** | `ZKTECO_PORT` | `4370` | Pi `.env` | Local LAN Port |
| **Backup Config** | `BACKUP_CLIENT_ID` | `"acme-casablanca"` | `.env.backup` | Low / Bucket Prefix |
| **Backup Secret** | `R2_ACCESS_KEY_ID` | `[Cloudflare R2 Key]` | `.env.backup` (chmod 600) | **CRITICAL SECRET** |
| **Backup Secret** | `R2_SECRET_ACCESS_KEY` | `[Cloudflare R2 Secret]` | `.env.backup` (chmod 600) | **CRITICAL SECRET** |

> [!CAUTION]
> **SECRETS HYGIENE:**
> Never commit `.env.docker`, `.env.backup`, or Raspberry Pi `.env` files to Git. All secret files must be configured directly on target hosts with permissions set to `chmod 600`.

---

## 3. Pre-Deployment Readiness Checklist

Before scheduling on-site installation, complete and verify every pre-deployment item:

### A. Client Information & DNS
- [ ] **Client Legal Name:** ________________________________________
- [ ] **Target Domain:** `pointage.<client-domain>.ma`
- [ ] **DNS A-Record Configured:** `pointage.<client-domain>.ma` $\rightarrow$ VPS Public IPv4 (`dig +short pointage.<client-domain>.ma`).
- [ ] **Client Primary Administrator Email:** ________________________________________
- [ ] **Client Primary Administrator Phone:** ________________________________________

### B. Cloud VPS Preparation
- [ ] **VPS Provisioned:** Clean Ubuntu 24.04 / 22.04 LTS (minimum 2 vCPU, 4GB RAM, 40GB SSD).
- [ ] **SSH Hardened:** Dedicated `deploy` user with SSH public key; password authentication disabled.
- [ ] **Firewall Configured:** UFW active allowing only ports `22/tcp`, `80/tcp`, `443/tcp`, `443/udp`.
- [ ] **Docker Installed:** Docker Engine 24+ and Docker Compose 2+ active.
- [ ] **Timezone Configured:** `timedatectl` set to `Africa/Casablanca`.

### C. On-Premise Hardware Preparation
- [ ] **Raspberry Pi Unit:** Raspberry Pi 4 Model B (2GB/4GB) or Raspberry Pi 5.
- [ ] **Power Supply:** Official Raspberry Pi USB-C power supply (5V / 3A or 5A).
- [ ] **Storage:** High-endurance 32GB/64GB MicroSD card flashed with Raspberry Pi OS Lite (64-bit).
- [ ] **Biometric Terminal:** ZKTeco K14 terminal with 12V/1.5A power adapter.
- [ ] **Local Network:** Wired RJ45 Ethernet connection available for both Pi and K14 (or enterprise Wi-Fi).

---

## 4. Sequential Deployment Procedure

---

### STAGE 1: Central VPS Cloud Deployment
Follow the authoritative production deployment runbook:
$\rightarrow$ **[PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)**

**Key Acceptance Gates:**
1. Clone commercial repository branch `commercial` at the latest verified release tag.
2. Generate production secrets (`POSTGRES_PASSWORD`, `JWT_SECRET`, `ADMIN_PASSWORD`) via `openssl rand -hex 32`.
3. Configure `/opt/attendance/zk-k14-commercial/.env.docker` (`chmod 600`).
4. Build and start containers: `npm run docker:up`.
5. Verify health endpoint: `curl -i https://pointage.<client-domain>.ma/api/health` returns HTTP 200 `{"status":"ok","database":"connected"}`.
6. Verify admin web login at `https://pointage.<client-domain>.ma/login`.
7. Configure off-site R2 automated backup scheduler (`npm run backup:schedule -- --systemd`).

---

### STAGE 2: Device Credential Provisioning (on VPS)
1. Execute the canonical containerized device provisioning command inside the project root on the VPS:
   ```bash
   npm run docker:device:create -- --id DEV-CASABLANCA-01 --name "Pointeuse Principale"
   ```
2. Record the displayed raw `DEVICE_TOKEN` securely for transfer to the Raspberry Pi.

> [!WARNING]
> **TOKEN ROTATION NOTICE:**
> Re-running `npm run docker:device:create` on an existing `DEVICE_ID` generates a **new** token hash and rotates credentials in the database.
> The old token on the Raspberry Pi will immediately receive HTTP 401 Unauthorized until `.env` is updated on the Pi.

- [ ] **DEVICE_ID Documented:** `DEV-CASABLANCA-01`
- [ ] **Raw Token Stored Securely:** Temporarily placed in password manager for Pi deployment.
- [ ] **Zero Plaintext in DB:** Database stores only SHA-256 hash.

---

### STAGE 3: On-Premise Raspberry Pi Installation
Follow the detailed hardware bridge runbook:
$\rightarrow$ **[RASPBERRY_PI_DEPLOYMENT.md](./RASPBERRY_PI_DEPLOYMENT.md)**

**Key Acceptance Gates:**
1. Update system packages: `sudo apt update && sudo apt upgrade -y`.
2. Configure mandatory Morocco timezone:
   ```bash
   sudo timedatectl set-timezone Africa/Casablanca
   timedatectl
   # Must confirm: Time zone: Africa/Casablanca and System clock synchronized: yes
   ```
3. Install Node.js 20 LTS deterministically via official NodeSource repository:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   node -v   # Must confirm >= v20.0.0 LTS (do NOT use Debian default Node 18)
   sudo npm install -g pm2
   ```
4. Deploy worker code to `/opt/attendance-bridge`, run `npm ci` and `npm run build`.
5. Configure `/opt/attendance-bridge/.env` (`chmod 600`) with authoritative variables:
   ```env
   API_BASE_URL="https://pointage.<client-domain>.ma"
   DEVICE_ID="DEV-CASABLANCA-01"
   DEVICE_TOKEN="<PROVISIONED_DEVICE_TOKEN>"
   ZKTECO_IP="192.168.1.201"
   ZKTECO_PORT=4370
   SYNC_INTERVAL_CRON="*/15 * * * *"
   ```
6. Start PM2 process: `pm2 start dist/index.js --name "zkteco-sync-worker"`.
7. Configure startup persistence: `pm2 startup` and `pm2 save`.
8. Configure log rotation: `pm2 install pm2-logrotate`.

> [!NOTE]
> **HEARTBEAT & DEVICE ONLINE SEMANTICS:**
> - The Raspberry Pi sends an HTTPS heartbeat to the central VPS every 10 seconds.
> - The `deviceOnline` flag in the Dashboard indicates whether the Raspberry Pi can actively communicate with the physical K14 terminal over LAN port 4370.
> - If the Pi is powered on and sending heartbeats but the K14 ethernet cable is disconnected or the terminal is powered off, the Dashboard correctly reflects the terminal as offline (`deviceOnline: false`).

---

### STAGE 4: ZKTeco K14 Hardware Terminal Setup
1. Power on the ZKTeco K14 terminal.
2. Enter terminal Menu $\rightarrow$ **Comm.** $\rightarrow$ **Ethernet**:
   - Assign static IP: `192.168.1.201` (or configure router DHCP static MAC reservation).
   - Subnet Mask: `255.255.255.0`
   - Gateway: `192.168.1.1`
3. Enter terminal Menu $\rightarrow$ **System** $\rightarrow$ **Date/Time**:
   - Verify local Morocco wall-clock time matches standard time exactly.
4. Enroll at least one dedicated test employee (e.g. User ID `999` or User ID `1`) with fingerprint and PIN for acceptance testing.

> [!IMPORTANT]
> **SINGLE POLLER RULE:**
> Exactly ONE worker process must poll the client K14. Ensure no legacy or duplicate sync scripts are running across the client network.

---

### STAGE 5: Formal Acceptance Testing & Sign-Off
Execute the full acceptance test suite using:
$\rightarrow$ **[CLIENT_ACCEPTANCE_TEST.md](./CLIENT_ACCEPTANCE_TEST.md)**

Complete all 12 test sections and obtain formal stakeholder signatures.

---

## 5. Client Handover Protocol

Upon successful completion of all acceptance tests:

1. **Admin Credentials Handover:**
   - Transfer primary administrator credentials (`ADMIN_EMAIL` and temporary `ADMIN_PASSWORD`) securely to the client's authorized contact.
   - Instruct the client administrator to change their password immediately upon first login.
2. **Dashboard URL:**
   - Provide client with direct web application URL: `https://pointage.<client-domain>.ma`.
3. **Training & Orientation:**
   - Demonstrate employee management, schedule/shift configuration, and monthly attendance report exports.
4. **Support & Maintenance Protocol:**
   - Document SLA, support email/phone, and maintenance windows.

---

## 6. Testing Strategy & Test Lab Distinction

> [!NOTE]
> **DEDICATED LAB HARDWARE (PHASE 4.4-D):**
> Deploying Client #1 does not require purchasing additional test lab equipment immediately.
> However, before scaling to multiple commercial clients, a dedicated hardware test lab (1 test K14 + 1 test Raspberry Pi) will be established under **Phase 4.4-D — Lab Hardware End-to-End Validation** to validate future software updates safely off-site without touching live customer environments.
