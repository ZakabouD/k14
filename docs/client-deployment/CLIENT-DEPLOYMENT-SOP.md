# CLIENT DEPLOYMENT STANDARD OPERATING PROCEDURE (SOP) V1
# Commercial Attendance Deployment Master Guide

> [!NOTE]
> **Document Status:**
> **ACCEPTED / CANONICAL.** This document and the associated numbered runbooks in `docs/client-deployment/` constitute the canonical operator standard and master operational execution guide for deploying a dedicated commercial attendance instance for a single client.

---

## 1. Document Authority & Hierarchy

This document and the associated numbered runbooks in `docs/client-deployment/` represent the **canonical commercial deployment SOP suite** accepted by Project Brain governance. This suite is the canonical operator standard and supersedes legacy deployment documents for all new commercial client installations:

```
docs/client-deployment/CLIENT-DEPLOYMENT-SOP.md  <── CANONICAL OPERATOR ENTRY POINT
├── 00-CLIENT-INFORMATION-FORM.md               <── Intake & Policy Questionnaire
├── 01-PRE-DEPLOYMENT-CHECKLIST.md              <── Go / No-Go Gating Criteria
├── 02-VPS-INSTALLATION.md                      <── Cloud Infrastructure & Stack
├── 03-APPLICATION-PROVISIONING.md              <── Settings, Device & Shifts
├── 04-RASPBERRY-PI-INSTALLATION.md             <── Bridge Controller & Worker
├── 05-K14-CONNECTION.md                       <── Isolated Biometric LAN
├── 06-CLIENT-ACCEPTANCE-TEST.md                <── Acceptance & Verification
├── 07-BACKUP-AND-DR.md                         <── Backup, R2 & Disaster Recovery
├── 08-SECURITY-HARDENING.md                    <── Security Controls & Recovery
├── 09-CLIENT-HANDOVER.md                       <── Training, Custody & Sign-Off
└── 10-TROUBLESHOOTING.md                       <── Field Diagnostics Runbook
```

> [!IMPORTANT]
> **Historical Technical References:**
> Older deployment documentation files (`docs/PRODUCTION_DEPLOYMENT.md`, `docs/RASPBERRY_PI_DEPLOYMENT.md`, `docs/BACKUP_RUNBOOK.md`, `docs/CLIENT_DEPLOYMENT_CHECKLIST.md`, `docs/CLIENT_ACCEPTANCE_TEST.md`, `docs/PRODUCTION_ACCEPTANCE_CHECKLIST.md`) outside `docs/client-deployment/` are retained as technical and historical reference material only. They are **REFERENCE-ONLY / SUPERSEDED FOR NEW COMMERCIAL DEPLOYMENTS**.

---

## 2. Architecture & Operating Boundary

### Single-Tenant Baseline Architecture:
The validated commercial architecture is strictly single-tenant:
**1 Client = 1 VPS + 1 PostgreSQL Database + 1 Application Stack + 1 Raspberry Pi Bridge + 1 ZKTeco K14 Terminal**

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ CLOUD INFRASTRUCTURE (Ubuntu 24.04 LTS VPS — Current Deployment Target)                │
│                                                                                        │
│  [Caddy 2: zk_caddy] ──► [Next.js 16.2.6: zk_dashboard] ──► [PostgreSQL 16: zk_postgres]│
│  https://<APP_DOMAIN>                                       (Persistent Volume)        │
│        ▲                                                            │                  │
│        │ HTTPS API: /api/device/sync & /heartbeat                   │ Daily 03:00      │
│        │ (x-device-id & x-device-token)                             ▼ (pg_dump -Fc)    │
│        │                                                 [Cloudflare R2 Bucket]        │
│        │                                                 zk-k14-commercial-backups     │
│        │                                                 client-<CLIENT_SLUG>/postgres/│
└────────┼───────────────────────────────────────────────────────────────────────────────┘
         │
         │ WPA2/WPA3 Site Wi-Fi or Office LAN (<PI_UPLINK_INTERFACE>)
         │
┌────────┴───────────────────────────────────────────────────────────────────────────────┐
│ ON-SITE HARDWARE PAIRING                                                              │
│                                                                                        │
│  [Raspberry Pi Bridge: attendance-<CLIENT_SLUG>-pi]                                    │
│  (PM2: zkteco-sync-worker / systemd boot persistence)                                  │
│        │                                                                               │
│        │ Point-to-Point Direct CAT6 RJ45 (<PI_K14_INTERFACE>)                          │
│        │ Isolated Subnet: <PI_K14_IP>/<K14_NETMASK> ◄──► <K14_IP>:4370 (No Gateway)    │
│        ▼                                                                               │
│  [ZKTeco K14 Standalone Biometric Terminal]                                            │
│  (Fingerprint Sensor / Static IP / Port 4370 / DHCP: OFF)                              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Architectural & Technology Stack Specification:

| Layer | Component | Specification & Version Status | Evidence Classification |
| :--- | :--- | :--- | :--- |
| **Web Dashboard** | Next.js App Router | `16.2.6` (manifest/lock in `dashboard/package.json`) | `DECLARED` / `LOCKED` |
| **UI Framework** | React / React DOM | `19.2.4` (manifest/lock in `dashboard/package.json`) | `DECLARED` / `LOCKED` |
| **Database ORM (Root)** | Prisma Client / CLI | Declared `^7.8.0`; locked Client `7.8.0`, locked CLI `7.8.0` | `DECLARED` / `LOCKED` |
| **Database ORM (Dash)** | Prisma Client / CLI | Declared `^7.8.0`; locked Client `7.8.0`, locked CLI `7.9.1` | `DECLARED` / `LOCKED` |
| **Database Engine** | PostgreSQL | `postgres:16-alpine` (Compose image; no exact patch implied) | `FLOATING IMAGE MAJOR` |
| **Reverse Proxy** | Caddy 2 | `caddy:2-alpine` (Compose image; automated ACME TLS) | `FLOATING IMAGE MAJOR` |
| **VPS Base Image** | Node.js (Cloud Build) | `node:22-alpine` (Dockerfile build container image) | `FLOATING IMAGE MAJOR` |
| **VPS Host OS** | Ubuntu Linux | Ubuntu 24.04 LTS (deployment policy target) | `DEPLOYMENT POLICY TARGET` |
| **Pi Hardware Target** | Raspberry Pi | Pi 4B 2GB physically proven in LAB; Pi 5 NOT-VALIDATED | `HISTORICALLY PHYSICALLY TESTED` / `NOT-VALIDATED` |
| **Pi Bridge Runtime** | Node.js (On-Site) | Node 20.20.2 proven in LAB (EOL); Node 22 ARM64 NOT-VALIDATED | `EOL` / `NOT-VALIDATED` (Gated) |
| **Timezone Baseline** | System & App Clock | `Africa/Casablanca` (IANA timezone database identifier) | `ACTIVE POLICY` |
| **Deduplication Key** | PostgreSQL Schema | Compound unique index `(zktecoUserId, recordTime)` on `RawPunch` | `CODE-PROVEN` (Single Terminal) |

> [!NOTE]
> **Currently Running Version & Inspection Boundary:**
> No currently running VPS/container installation was contacted or inspected during SOP documentation review.
> Therefore:
> * Exact currently running patch versions are **NOT VERIFIED**.
> * Floating tags such as `node:22-alpine`, `postgres:16-alpine`, and `caddy:2-alpine` do not prove an exact runtime patch.
> * The stack specification above represents repository declarations, package locks, container configuration, and historical physical qualification only.

---

## 3. Deployment Phase Progression

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE PROGRESSION PIPELINE                                                             │
│                                                                                        │
│ [  ] PHASE 0 — Client Intake & Gating Review             (Form 00, Checklist 01)        │
│ [  ] PHASE 1 — Cloud VPS & Base Infrastructure           (Runbook 02)                  │
│ [  ] PHASE 2 — Commercial Application Stack Deployment   (Runbook 02, Provisioning 03) │
│ [  ] PHASE 3 — Dedicated Raspberry Pi Bridge Preparation (Runbook 04)                  │
│ [  ] PHASE 4 — ZKTeco K14 Hardware & Isolated LAN Setup  (Connection 05)               │
│ [  ] PHASE 5 — End-to-End Physical Acceptance Testing    (Protocol 06)                 │
│ [  ] PHASE 6 — Backup, Disaster Recovery & Hardening     (07-DR, 08-Security)          │
│ [  ] PHASE 7 — Client Training, Sign-Off & Handover      (Handover 09)                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### PHASE 0: Client Intake & Gating Review
* **Guide Reference:** [`00-CLIENT-INFORMATION-FORM.md`](00-CLIENT-INFORMATION-FORM.md) & [`01-PRE-DEPLOYMENT-CHECKLIST.md`](01-PRE-DEPLOYMENT-CHECKLIST.md)
* **Goal:** Collect legal entity data, HR policies, network parameters (`<K14_SUBNET>`, `<PI_K14_IP>`, `<K14_IP>`), and verify 5 Go/No-Go gates.
* **Stop / Go Gate:** All 5 gates in Checklist 01 must be **`GO`**.

---

### PHASE 1: Cloud VPS Infrastructure Setup
* **Guide Reference:** [`02-VPS-INSTALLATION.md`](02-VPS-INSTALLATION.md)
* **Goal:** Initialize fresh Ubuntu 24.04 LTS VPS, configure UFW firewall (22, 80, 443/tcp; 443/udp reserved for QUIC capability), install Docker Engine & Compose plugin.
* **Stop / Go Gate:** `docker compose version` valid, UFW active, SSH key access verified.

---

### PHASE 2: Commercial Application Stack Deployment
* **Guide Reference:** [`02-VPS-INSTALLATION.md`](02-VPS-INSTALLATION.md) & [`03-APPLICATION-PROVISIONING.md`](03-APPLICATION-PROVISIONING.md)
* **Goal:** Clone repository on `commercial` branch, generate high-entropy secrets (`POSTGRES_PASSWORD`, `JWT_SECRET`, non-empty `ADMIN_PASSWORD`), configure `APP_DOMAIN`, launch Docker Compose stack, register biometric device via canonical CLI:
  ```bash
  npm run docker:device:create -- --id "DEV-<CLIENT_SLUG>-K14-01" --name "Pointeuse Principale K14"
  ```
* **Stop / Go Gate:** `/api/health` returns HTTP 200 `{"status":"ok","database":"connected"}`; Caddy TLS active.

---

### PHASE 3: Dedicated Raspberry Pi Bridge Preparation
* **Guide Reference:** [`04-RASPBERRY-PI-INSTALLATION.md`](04-RASPBERRY-PI-INSTALLATION.md)
* **Goal:** Flash Raspberry Pi OS Lite (64-bit), set hostname `attendance-<CLIENT_SLUG>-pi`, set timezone `Africa/Casablanca`, configure dual-homed network (`<PI_UPLINK_INTERFACE>` default route, `<PI_K14_INTERFACE>` static `<PI_K14_IP>/<K14_NETMASK>` with no gateway), await Node.js runtime qualification gate sign-off, build bridge worker via `npm ci --include=dev` and `npx prisma generate`, configure `.env` mode `600` with `SYNC_INTERVAL_CRON`, execute privileged `pm2 startup` systemd command, enable boot persistence.
* **Stop / Go Gate:** `pm2 status` shows `zkteco-sync-worker` online; `systemctl is-enabled pm2-<PI_USER>.service` returns `enabled`.

---

### PHASE 4: ZKTeco K14 Hardware & Isolated LAN Setup
* **Guide Reference:** [`05-K14-CONNECTION.md`](05-K14-CONNECTION.md)
* **Goal:** Connect direct CAT6 patch cable between Pi `<PI_K14_INTERFACE>` and K14 terminal. Configure static IP on K14 (`<K14_IP>`, mask `<K14_NETMASK>`, gateway `0.0.0.0`, port `4370`, DHCP `OFF`). Verify carrier, ICMP, TCP 4370, and PM2 logs.
* **Stop / Go Gate:** Carrier = 1, ping 0% loss, TCP 4370 open, PM2 logs show `TCP connection successful`.

---

### PHASE 5: End-to-End Physical Acceptance Testing
* **Guide Reference:** [`06-CLIENT-ACCEPTANCE-TEST.md`](06-CLIENT-ACCEPTANCE-TEST.md)
* **Goal:** Execute baseline comparisons on `<ACCEPTANCE_LOCAL_DATE>`: enroll test employee on K14, create approved Shift in `/shifts`, perform Punch #1 (verify timestamp fidelity in `Africa/Casablanca`), perform Punch #2 (verify `CalculatedDailyReport` shift hours & status), verify replay deduplication (zero new `RawPunch` rows), verify reboot survival.
* **Stop / Go Gate:** All acceptance stages evaluated as **`PASS`**.

---

### PHASE 6: Backup, Disaster Recovery & Security Hardening
* **Guide Reference:** [`07-BACKUP-AND-DR.md`](07-BACKUP-AND-DR.md) & [`08-SECURITY-HARDENING.md`](08-SECURITY-HARDENING.md)
* **Goal:** Run manual backup (`scripts/backup-full.sh`), verify local `.dump` + `.sha256` and R2 upload under `client-<CLIENT_SLUG>/postgres/` with `.complete` marker (Cloudflare R2 provider-level storage encryption relied upon; transport TLS active). Perform isolated DR restore into dynamic disposable `<UNIQUE_DR_DATABASE>`. Install daily backup schedule at 03:00 Africa/Casablanca via systemd timer (`scripts/install-backup-schedule.sh --systemd`). Verify file permissions (`600`) and host port isolation.
* **Stop / Go Gate:** R2 upload verified, isolated restore verified, daily systemd timer active.

---

### PHASE 7: Client Training, Sign-Off & Handover
* **Guide Reference:** [`09-CLIENT-HANDOVER.md`](09-CLIENT-HANDOVER.md)
* **Goal:** Deliver administrative credentials via secure vault/ephemeral link, train client on personnel management in `/artisans`, shift creation in `/shifts`, live dashboard, anomalies, and multi-tab Excel payroll export in `/reports`. Sign formal Client Acceptance Certificate.
* **Stop / Go Gate:** Formal acceptance certificate signed by client representative and lead engineer.

---

## 4. Final Deployment Acceptance Record

```
================================================================================
                    CLIENT DEPLOYMENT ACCEPTANCE RECORD
================================================================================

CLIENT INFORMATION:
Client Legal Name:          <CLIENT_NAME>
Client Slug:                <CLIENT_SLUG>
Operational Web Domain:     https://<APP_DOMAIN>
Cloud VPS IP Address:       <VPS_IP>
Raspberry Pi Hostname:      attendance-<CLIENT_SLUG>-pi
Biometric Device ID:        DEV-<CLIENT_SLUG>-K14-01
K14 Serial Number:          <K14_SERIAL_NUMBER>
Installation Physical Site: <PHYSICAL_LOCATION>

MILESTONE CHECKLIST:
[  ] Phase 0: Client Intake & Gating Review passed (All 5 gates GO).
[  ] Phase 1: Cloud VPS infrastructure initialized & UFW firewall secured.
[  ] Phase 2: Application stack deployed, APP_DOMAIN active, TLS verified.
[  ] Phase 3: Dedicated Raspberry Pi bridge configured & boot persistence enabled.
[  ] Phase 4: ZKTeco K14 terminal connected over isolated Layer 2 Ethernet link.
[  ] Phase 5: End-to-end physical attendance punch acceptance completed.
[  ] Phase 6: Daily Cloudflare R2 backup (03:00) & isolated DR restore validated.
[  ] Phase 7: Client administrator trained & credentials delivered securely.

SIGN-OFF APPROVAL:

Installation Date:          _____ / _____ / 2026
Lead Deployment Engineer:   ____________________________________________________
Client Representative:      ____________________________________________________
Final Deployment Status:    [  ] ACCEPTED & OPERATIONAL    [  ] REJECTED / PENDING

================================================================================
```
