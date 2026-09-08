# 04 — RASPBERRY PI INSTALLATION
# Dedicated Bridge Controller Setup & Hardening

This guide details the complete installation, network configuration, build process, and process persistence setup for the on-site Raspberry Pi bridge connecting the ZKTeco K14 terminal to the cloud API.

---

## 1. Hardware & Operating System Standard

* **HISTORICAL PHYSICAL EVIDENCE (LAB BASELINE):**
  * Hardware: Raspberry Pi 4 Model B (2GB RAM).
  * Runtime: Node.js 20.20.2 (physically proven in historical LAB testing).
  * Status: **Node 20 is now EOL** (End-of-Life) and cannot be deployed for new commercial production installations.
* **CURRENT CLIENT #1 DEPLOYMENT BLOCKER:**
  * Supported, non-EOL ARM64 Node.js runtime has **NOT yet been formally qualified** on Raspberry Pi hardware.
  * **MANDATORY GATE:** `SUPPORTED PI RUNTIME QUALIFICATION REQUIRED BEFORE CLIENT #1`. The executable Client #1 installation procedure must **STOP** at Stage 4 until ChatGPT / Project Lead issues formal qualification sign-off for an approved supported runtime.
* **PROPOSED FUTURE TARGET (NOT-VALIDATED):**
  * Proposed Candidate: Node.js 22 LTS on ARM64 Raspberry Pi OS Lite (64-bit) (Debian 12 Bookworm). Status: **NOT-VALIDATED** until physical qualification is executed.
  * Raspberry Pi 5 Hardware: **NOT-VALIDATED** and not part of the currently proven hardware baseline.
* **Storage:** 16GB+ High-Endurance Class 10 / A1 MicroSD card.
* **Canonical Hostname:** `attendance-<CLIENT_SLUG>-pi`
* **Default Admin User:** `<PI_USER>` *(client-specific deployer user; no LAB username used in commercial deployment)*

---

## STAGE 1: OS Base Initialization & Clock Synchronization

Connect to the freshly booted Raspberry Pi via SSH:

```bash
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Set canonical hostname
sudo hostnamectl set-hostname attendance-<CLIENT_SLUG>-pi

# 3. Configure Timezone & NTP (Mandatory for timestamp fidelity)
sudo timedatectl set-timezone Africa/Casablanca
sudo timedatectl set-ntp true

# 4. Verify system clock status
timedatectl
```

* **Pass Criteria:** `Time zone: Africa/Casablanca` (IANA date-aware) and `System clock synchronized: yes`.

---

## STAGE 2: SSH Key Setup & Safe Hardening Protocol

### 1. Out-of-Band Recovery Readiness (Mandatory Prerequisite Before SSH Modification)
> [!IMPORTANT]
> **Out-of-Band Recovery Verification (Pi):**
> Before applying any SSH configuration changes, verify out-of-band recovery readiness:
> * Ensure a client-specific emergency recovery key is installed OR a tested physical recovery path (e.g. mounting MicroSD ext4 filesystem on an administrative workstation or console UART/display access) is available.
> * Do not wait until lockout to discover that physical or console recovery access does not work.

1. **Verify Host Fingerprint Out-of-Band:** Verify the Pi's SSH host key fingerprint out-of-band before initial connection.
2. **Install Client-Specific Technician SSH Public Key (from workstation):**
   ```bash
   ssh-copy-id -i ~/.ssh/id_ed25519_<CLIENT_SLUG>.pub <PI_USER>@attendance-<CLIENT_SLUG>-pi.local
   ```
3. **Rotate Password Interactively on Pi:**
   ```bash
   ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> <PI_USER>@attendance-<CLIENT_SLUG>-pi.local
   passwd
   ```

> [!WARNING]
> **Safe SSH Hardening Protocol (Lockout Prevention):**
> SSH hardening carries inherent lockout risks; no procedure is zero-risk. Follow this strict sequence:
> 1. Verify host key fingerprint out-of-band and confirm working client-specific SSH key login.
> 2. Verify sudo privilege in the active session (`sudo -v`). *(Note: verifies shell sudo access, not physical recovery)*.
> 3. **Keep the initial SSH session OPEN throughout the entire procedure.**
> 4. Inspect `/etc/ssh/sshd_config`, `/etc/ssh/sshd_config.d/`, `Include` directives, and applicable `Match` blocks.
> 5. Evaluate effective sshd configuration and OpenSSH precedence order before editing (`sudo sshd -T`). Note that drop-in files in `/etc/ssh/sshd_config.d/` may override or take precedence over `/etc/ssh/sshd_config`; evaluate all configuration sources.
> 6. Apply intended configuration via a controlled location (drop-in or file edit based on distribution include order).
> 7. Execute syntax check: `sudo sshd -t`. **STOP immediately if syntax validation fails.**
> 8. Reload daemon only after validation succeeds: `sudo systemctl reload ssh`.
> 9. In a **SECOND independent terminal window**, establish a **PERSISTENT interactive key-only SSH session** explicitly disabling fallback authentication:
>    ```bash
>    ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> \
>      -o PreferredAuthentications=publickey \
>      -o PasswordAuthentication=no \
>      -o KbdInteractiveAuthentication=no \
>      -o IdentitiesOnly=yes \
>      <PI_USER>@attendance-<CLIENT_SLUG>-pi.local
>    ```
> 10. Inside that **active second interactive session**, evaluate effective sshd configuration for the supplied connection context and verify sudo access:
>     ```bash
>     # Evaluate effective configuration using the real connection context (supply actual client source IP/host if Match rules apply):
>     sudo sshd -T -C user=<PI_USER>,host=attendance-<CLIENT_SLUG>-pi.local,addr=<ACTUAL_CLIENT_SOURCE_IP> | grep -Ei '^(passwordauthentication|kbdinteractiveauthentication|permitrootlogin)'
>     # Verify sudo access in second session
>     sudo -v
>     ```
> 11. Confirm that password authentication is disabled and key authentication works reliably before closing the original terminal.
> 12. Only then close the initial session.

---

## STAGE 3: Dual-Homed Isolated Network Routing

The Raspberry Pi bridge operates in a dual-homed configuration to isolate the biometric hardware from the general office network:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Raspberry Pi Bridge (attendance-<CLIENT_SLUG>-pi)                      │
│                                                                        │
│  [<PI_UPLINK_INTERFACE>]  ──> Default Route (Internet / Cloud API)    │
│  [<PI_K14_INTERFACE>]     ──> Isolated Link: <PI_K14_IP>/<K14_NETMASK> │
└────────────────────────────────────────────────────────────────────────┘
```

### Network Configuration (Ethernet Uplink or Interactive Wi-Fi):
```bash
# 1. Inspect existing connections and identify profile bound to <PI_K14_INTERFACE>
nmcli -g NAME,UUID,DEVICE connection show

# 2. Configure static IP on <PI_K14_INTERFACE> using its connection UUID with NO default gateway
sudo nmcli connection modify "<NETWORKMANAGER_PROFILE_UUID>" \
  ipv4.method manual \
  ipv4.addresses "<PI_K14_IP>/<K14_NETMASK>" \
  ipv4.gateway "" \
  ipv4.never-default true \
  ipv4.route-metric 100 \
  connection.autoconnect yes

# 3. If Uplink is Wi-Fi: Connect using NetworkManager interactive prompt (NEVER pass password in command arguments)
# sudo nmcli --ask dev wifi connect "<WIFI_SSID>"

# 4. Apply settings
sudo nmcli connection up "<NETWORKMANAGER_PROFILE_UUID>"

# 5. Verify routing table
ip route
```

* **Pass Criteria:**
  * Default route points ONLY to `<PI_UPLINK_INTERFACE>` (`default via <ROUTER_IP> dev <PI_UPLINK_INTERFACE>`).
  * Isolated subnet route `<K14_SUBNET> dev <PI_K14_INTERFACE>` metric 100 exists.
  * Pi can reach Internet via HTTPS: `curl -I https://<APP_DOMAIN>/api/health` returns HTTP 200.

---

## STAGE 4: Node.js, PM2 & Bridge Application Build

> [!CAUTION]
> **MANDATORY CLIENT #1 BLOCKING GATE — STOP EXECUTION:**
> * **Gate:** `SUPPORTED PI RUNTIME QUALIFICATION REQUIRED BEFORE CLIENT #1`.
> * **Status:** Node.js 20.20.2 was historically physically proven on LAB Pi 4B hardware, but **Node 20 is EOL**. Node.js 22 LTS on ARM64 is the proposed target candidate, but is **NOT-VALIDATED** until formal qualification testing is completed.
> * **Action Required:** **DO NOT proceed with runtime installation for Client #1 until ChatGPT / Project Lead issues formal approval of a qualified supported Node.js runtime.**

### Production Build Procedure (Execute ONLY after Supported Runtime is Qualified):

```bash
# 1. Install Approved Node.js LTS Runtime & Build Dependencies
# (Execute ONLY with the specific runtime approved during qualification gate sign-off)
# e.g., for approved Node.js LTS candidate on Debian 12 Bookworm:
# curl -fsSL https://deb.nodesource.com/setup_<QUALIFIED_VERSION>.x | sudo -E bash -
# sudo apt install -y nodejs build-essential git

# 2. Install PM2 process manager globally
sudo npm install -g pm2

# 3. Create bridge application directory
sudo mkdir -p /opt/attendance-bridge
sudo chown -R <PI_USER>:<PI_USER> /opt/attendance-bridge

# 4. Clone repository on branch commercial
git clone -b commercial https://github.com/ZakabouD/k14.git /opt/attendance-bridge
cd /opt/attendance-bridge

# 5. Lockfile-Based Deterministic Dependency Installation & TypeScript Build
# (Uses npm ci --include=dev for exact lockfile reproducibility including devDependencies for tsc & Prisma)
npm ci --include=dev
npx prisma generate
npm run build
```

### Historical Reference Only (DO NOT USE FOR PRODUCTION):
> [!NOTE]
> **Historical Reference — Node 20.20.2 (EOL):**
> Historically, LAB validation used `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -` on Pi 4B (2GB) under Node 20.20.2. This command is retained for audit and historical traceability only and is strictly deprecated for commercial deployments.

---

## STAGE 5: Bridge Environment Configuration (`.env`)

### Step 1: Write Non-Sensitive Base Configuration
Create `/opt/attendance-bridge/.env` with strict permissions and non-sensitive parameters:

```bash
PI_ENV_FILE="/opt/attendance-bridge/.env"

if [ -e "$PI_ENV_FILE" ]; then
  if [ ! -f "$PI_ENV_FILE" ] || [ -L "$PI_ENV_FILE" ] || [ ! -O "$PI_ENV_FILE" ]; then
    echo "ERROR: Existing bridge .env has invalid type, is symlink, or wrong owner. Halting." >&2
    exit 1
  fi
fi

(
  umask 077
  touch "$PI_ENV_FILE" || { echo "ERROR: Cannot create $PI_ENV_FILE"; exit 1; }
  chmod 600 "$PI_ENV_FILE" || { echo "ERROR: chmod 600 failed on $PI_ENV_FILE"; exit 1; }
)

cat << 'EOF' > /opt/attendance-bridge/.env
# Commercial Cloud API Endpoint
API_BASE_URL=https://<APP_DOMAIN>

# Device Identification
DEVICE_ID=DEV-<CLIENT_SLUG>-K14-01

# Isolated Hardware Connection
ZKTECO_IP=<K14_IP>
ZKTECO_PORT=4370
ZKTECO_TIMEOUT=10000

# Background Sync Schedule (Every 15 minutes)
SYNC_INTERVAL_CRON=*/15 * * * *
TIMEZONE=Africa/Casablanca
EOF
```

### Step 2: Protected Device Token Injection (Fail-Closed)
> [!WARNING]
> **Secret Token Protection Contract:**
> * Never paste raw device tokens into reusable heredocs, scripts, shell command arguments, chat transcripts, or ticket systems.
> * Inject `DEVICE_TOKEN` into `/opt/attendance-bridge/.env` using a protected, non-echoing method into pre-validated `.env`:

```bash
PI_ENV_FILE="/opt/attendance-bridge/.env"
if [ ! -f "$PI_ENV_FILE" ] || [ -L "$PI_ENV_FILE" ] || [ ! -O "$PI_ENV_FILE" ]; then
  echo "ERROR: Destination file $PI_ENV_FILE is invalid or insecure. Aborting token write." >&2
  exit 1
fi

set +x

# Protected Interactive Input (Silent, not recorded in shell history or process tables)
read -s -r -p "Enter raw DEVICE_TOKEN from Phase 2 provisioning: " RAW_TOKEN
echo ""

(
  umask 077
  printf "DEVICE_TOKEN=%s\n" "$RAW_TOKEN" >> "$PI_ENV_FILE" || { echo "ERROR: Failed writing DEVICE_TOKEN"; exit 1; }
  chmod 600 "$PI_ENV_FILE" || { echo "ERROR: chmod 600 failed on $PI_ENV_FILE"; exit 1; }
)
unset RAW_TOKEN
```

### Step 3: Safe Token Presence Verification (Without Value Exposure):
```bash
# Verify that DEVICE_TOKEN exists, is non-empty, and satisfies minimum hex length without printing value:
test -n "$(grep -E '^DEVICE_TOKEN=[a-f0-9]{32,}' /opt/attendance-bridge/.env)" || { echo "ERROR: DEVICE_TOKEN missing or invalid in .env"; exit 1; }
test -n "$(grep -E '^API_BASE_URL=https://.+' /opt/attendance-bridge/.env)" || { echo "ERROR: API_BASE_URL missing in .env"; exit 1; }
echo "Bridge Environment: OK (Configured & Protected)"
```

---

## STAGE 6: PM2 Process Management & Boot Persistence

```bash
cd /opt/attendance-bridge

# 1. Start worker under PM2
pm2 start dist/index.js --name "zkteco-sync-worker"

# 2. Generate systemd startup configuration
pm2 startup systemd
# IMPORTANT: The command above generates and prints a privileged systemd registration command.
# You MUST copy and execute that exact generated command with sudo (e.g., sudo env PATH=$PATH:... pm2 startup systemd -u <PI_USER> --hp /home/<PI_USER>).
# Running 'pm2 save' alone does NOT configure system boot persistence.

# 3. Save process table to dump.pm2
pm2 save

# 4. Install and configure log rotation module
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
```

---

## STAGE 7: Verification Checklist

```bash
# Check PM2 process status
pm2 status

# Check live bridge logs
pm2 logs zkteco-sync-worker --lines 20 --nostream
```

* **Pass Criteria:**
  * `zkteco-sync-worker` status is `online`.
  * Logs show worker initialization and periodic API heartbeat.
  * Cloud dashboard displays device `Connecté` (Online).
