# 04 — RASPBERRY PI INSTALLATION
# Dedicated Bridge Controller Setup & Hardening

This guide details the complete installation, network configuration, build process, and process persistence setup for the on-site Raspberry Pi bridge connecting the ZKTeco K14 terminal to the cloud API.

---

## 1. Hardware & Operating System Standard

* **SUPPORTED COMMERCIAL RUNTIME (EXECUTION-PROVEN & PHYSICAL-PROVEN):**
  * Hardware: Raspberry Pi 4 Model B (2GB+ RAM).
  * Operating System: Debian GNU/Linux 13.5 (trixie) ARM64 / aarch64 (Raspberry Pi OS Lite 64-bit) ONLY. (Debian 12 / bookworm is NOT-VALIDATED; policy candidate requiring separate qualification if deployed).
  * Runtime: Node.js 24 LTS (exact: Node 24.20.0, npm 11.19.0, PM2 7.0.4).
  * Canonical Node Binary: `/opt/node24/bin/node` (exact standalone binary directory `/opt/node24`).
  * Supervisor Service: `pm2-<PI_USER>.service` with drop-in `/etc/systemd/system/pm2-<PI_USER>.service.d/node24.conf`.
  * Attendance Worker Interpreter: `/opt/node24/bin/node`.
  * Qualification Status: **PASSED / QUALIFIED (GATE CLOSED) — EXECUTION-PROVEN + PHYSICAL-PROVEN** via PI-RUNTIME-2A through PI-RUNTIME-2E on dedicated LAB hardware. Exactly one poller, physical fingerprint ingestion, cloud dedup, PM2 supervisor migration, and software reboot recovery are physically proven.
* **HISTORICAL ROLLBACK / REFERENCE RUNTIME:**
  * Node.js 20.20.2: EOL in 2026. Preserved in LAB qualification archive for emergency rollback reference only. Not permitted for new commercial production installations.
* **REMAINING UNVALIDATED LIMITATIONS:**
  * Raspberry Pi 5 Hardware: **NOT-VALIDATED** (Raspberry Pi 4 Model B is the only qualified platform).
  * Debian 12 / bookworm: **NOT-VALIDATED** (Debian 13.5 trixie is the only physically qualified OS).
  * Multi-Terminal Support: **NOT-VALIDATED** (architecture strictly qualifies 1 K14 terminal per Pi/deployment).
  * Cold Power-Loss / Unplug-and-Replug: **NOT-VALIDATED** (controlled software reboot was tested; cold ungraceful power loss is unverified).
  * Durable Offline Buffering: **NOT-VALIDATED** (long API outage buffering is not proven).
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

> [!NOTE]
> **QUALIFIED RUNTIME STANDARD (GATE CLOSED):**
> * **Gate Status:** `SUPPORTED PI RUNTIME QUALIFICATION` is **PASSED / QUALIFIED (GATE CLOSED) — EXECUTION-PROVEN + PHYSICAL-PROVEN**.
> * **Standard:** Node.js 24 LTS (exact: Node 24.20.0, npm 11.19.0, PM2 7.0.4) on Debian GNU/Linux 13.5 (trixie) ARM64 ONLY was physically proven in PI-RUNTIME-2A–2E.
> * **Operating System Boundary:** Debian 12 (bookworm) is **NOT-VALIDATED** (candidate requiring separate qualification if deployed).
> * **Canonical Runtime Path:** Standalone installation at `/opt/node24/bin/node`. (NodeSource `/usr/bin/node` is an alternative that was NOT used in the physical qualification).
> * **Historical Rollback:** Node 20.20.2 is EOL and strictly preserved for emergency rollback/reference only.
> * *(Operational Status: Historical D7 Admin Credential Closure is OPERATIONALLY CLOSED / PASS; Client #1 is authorized to begin Phase 0).*

### Canonical Production Build Procedure:

```bash
# ----------------------------------------------------------------------
# 1. Layered Pre-Install Safety & Conflict Detection Gate (Fail-Closed)
# ----------------------------------------------------------------------
# Before modifying either /opt/node24 or /opt/attendance-bridge, collect and
# evaluate ALL relevant existing system state.
# Every inspection must resolve to one of THREE outcomes:
#   1. KNOWN CLEAN
#   2. EXISTING STATE DETECTED
#   3. INSPECTION FAILED / UNKNOWN
# Any UNKNOWN state or command failure MUST immediately STOP.

# A. Assert all required host inspection tools exist before running checks:
for tool in grep pgrep systemctl crontab ss awk readlink tr; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "ERROR: Required inspection tool '$tool' is missing or not executable. UNKNOWN host state. STOP." >&2
    exit 1
  fi
done

EXISTING_STATE_FOUND=false
EXISTING_UNKNOWN_FOUND=false

# B. Filesystem path inspection (Reject ANY regular directory, file, symlink, or dangling symlink):
if [ -e "/opt/node24" ] || [ -L "/opt/node24" ]; then
  echo "DETECTED: Existing filesystem object (directory, file, or symlink) at /opt/node24." >&2
  EXISTING_STATE_FOUND=true
fi

if [ -e "/opt/attendance-bridge" ] || [ -L "/opt/attendance-bridge" ]; then
  echo "DETECTED: Existing filesystem object (directory, file, or symlink) at /opt/attendance-bridge." >&2
  EXISTING_STATE_FOUND=true
fi

if [ -e "/home/<PI_USER>/.env" ] || [ -L "/home/<PI_USER>/.env" ]; then
  echo "DETECTED: Existing environment file at /home/<PI_USER>/.env." >&2
  EXISTING_STATE_FOUND=true
fi

# C. PM2 process inspection (distinguish: absent / clean / detected / unknown):
PM2_BIN=""
if command -v pm2 >/dev/null 2>&1; then
  PM2_BIN=$(command -v pm2)
elif [ -e "/opt/node24/lib/node_modules/pm2/bin/pm2" ] || [ -L "/opt/node24/lib/node_modules/pm2/bin/pm2" ]; then
  PM2_BIN="/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2"
fi

if [ -n "$PM2_BIN" ]; then
  PM2_OUT=$($PM2_BIN list 2>&1)
  PM2_STATUS=$?
  if [ "$PM2_STATUS" -ne 0 ]; then
    echo "ERROR: PM2 process inspection command failed (exit status $PM2_STATUS): $PM2_OUT. UNKNOWN state. STOP." >&2
    EXISTING_UNKNOWN_FOUND=true
  else
    echo "$PM2_OUT" | grep -qiE "zkteco|attendance|k14|sync-worker"
    GREP_PM2_STATUS=$?
    if [ "$GREP_PM2_STATUS" -eq 0 ]; then
      echo "DETECTED: Existing PM2 attendance process found in PM2 process table." >&2
      EXISTING_STATE_FOUND=true
    elif [ "$GREP_PM2_STATUS" -eq 1 ]; then
      : # KNOWN CLEAN: PM2 is installed but contains no attendance processes
    else
      echo "ERROR: grep failed evaluating PM2 process list (exit status $GREP_PM2_STATUS). UNKNOWN state. STOP." >&2
      EXISTING_UNKNOWN_FOUND=true
    fi
  fi
else
  : # KNOWN CLEAN: PM2 binary is absent from system
fi

# D. Process-table inspection (pgrep: 0=match, 1=no match, >1=error/unknown):
for pattern in "dist/index.js" "zkteco-sync-worker" "attendance-bridge"; do
  PIDS=$(pgrep -f "$pattern" 2>&1)
  PGREP_STATUS=$?
  if [ "$PGREP_STATUS" -eq 0 ]; then
    echo "DETECTED: Running attendance process matching '$pattern' (PIDs: $PIDS)." >&2
    EXISTING_STATE_FOUND=true
  elif [ "$PGREP_STATUS" -eq 1 ]; then
    : # KNOWN CLEAN: No matching process running
  else
    echo "ERROR: pgrep failed on pattern '$pattern' (exit status $PGREP_STATUS): $PIDS. UNKNOWN state. STOP." >&2
    EXISTING_UNKNOWN_FOUND=true
  fi
done

# E. Systemd unit inspection (systemctl: unit list success required; grep 0=match, 1=no match, >1=error):
UNIT_LIST=$(systemctl list-unit-files --no-legend 2>&1)
SYS_STATUS=$?
if [ "$SYS_STATUS" -ne 0 ]; then
  echo "ERROR: systemctl list-unit-files failed (exit status $SYS_STATUS): $UNIT_LIST. UNKNOWN state. STOP." >&2
  EXISTING_UNKNOWN_FOUND=true
else
  MATCH_PM2_SVC=$(echo "$UNIT_LIST" | grep -iE "pm2-.*\.service")
  GREP_SYS=$?
  if [ "$GREP_SYS" -eq 0 ]; then
    echo "DETECTED: Existing PM2 systemd service found: $MATCH_PM2_SVC" >&2
    EXISTING_STATE_FOUND=true
  elif [ "$GREP_SYS" -eq 1 ]; then
    : # KNOWN CLEAN: No pm2-*.service unit file registered
  else
    echo "ERROR: grep failed during systemd unit inspection (exit status $GREP_SYS). UNKNOWN state. STOP." >&2
    EXISTING_UNKNOWN_FOUND=true
  fi
fi

# Inspect /etc/systemd/system/ for attendance unit definitions:
set +e
GREP_SVC_OUT=$(grep -rnE "attendance-bridge|dist/index\.js|zkteco" /etc/systemd/system/ 2>&1)
GREP_SVC_STATUS=$?
set -e
if [ "$GREP_SVC_STATUS" -eq 0 ]; then
  set +e
  EXTRA_SVC=$(echo "$GREP_SVC_OUT" | grep -v "pm2-.*\.service")
  GREP_V_STATUS=$?
  set -e
  if [ "$GREP_V_STATUS" -eq 0 ]; then
    echo "DETECTED: Systemd service definitions referencing attendance worker found in /etc/systemd/system/." >&2
    EXISTING_STATE_FOUND=true
  elif [ "$GREP_V_STATUS" -eq 1 ]; then
    : # All matching lines were pm2-*.service (evaluated separately)
  else
    echo "ERROR: grep -v failed during systemd unit inspection (exit status $GREP_V_STATUS). UNKNOWN state. STOP." >&2
    EXISTING_UNKNOWN_FOUND=true
  fi
elif [ "$GREP_SVC_STATUS" -eq 1 ]; then
  : # KNOWN CLEAN: No attendance units in /etc/systemd/system/
else
  echo "ERROR: grep failed searching /etc/systemd/system/ (exit status $GREP_SVC_STATUS): $GREP_SVC_OUT. UNKNOWN state. STOP." >&2
  EXISTING_UNKNOWN_FOUND=true
fi

# F. Cron inspection (User & Root crontabs; permission or command error = STOP):
set +e
USER_CRON=$(crontab -l 2>&1)
USER_CRON_STATUS=$?
set -e
if [ "$USER_CRON_STATUS" -eq 0 ]; then
  set +e
  echo "$USER_CRON" | grep -qiE "attendance|dist/index\.js|zkteco"
  GREP_UC_STATUS=$?
  set -e
  if [ "$GREP_UC_STATUS" -eq 0 ]; then
    echo "DETECTED: Attendance entries found in user crontab." >&2
    EXISTING_STATE_FOUND=true
  elif [ "$GREP_UC_STATUS" -eq 1 ]; then
    : # KNOWN CLEAN: User crontab contains no attendance entries
  else
    echo "ERROR: grep failed inspecting user crontab (exit status $GREP_UC_STATUS). UNKNOWN state. STOP." >&2
    EXISTING_UNKNOWN_FOUND=true
  fi
elif [ "$USER_CRON_STATUS" -eq 1 ]; then
  set +e
  echo "$USER_CRON" | grep -qiE "no crontab for"
  GREP_NOCRON=$?
  set -e
  if [ "$GREP_NOCRON" -eq 0 ]; then
    : # KNOWN CLEAN: User crontab does not exist
  elif [ "$GREP_NOCRON" -eq 1 ]; then
    echo "ERROR: Unexpected crontab output (status 1 but missing 'no crontab'): $USER_CRON. UNKNOWN state. STOP." >&2
    EXISTING_UNKNOWN_FOUND=true
  else
    echo "ERROR: grep failed parsing crontab output (exit status $GREP_NOCRON). UNKNOWN state. STOP." >&2
    EXISTING_UNKNOWN_FOUND=true
  fi
else
  echo "ERROR: Failed to inspect user crontab (exit status $USER_CRON_STATUS): $USER_CRON. UNKNOWN state. STOP." >&2
  EXISTING_UNKNOWN_FOUND=true
fi

set +e
ROOT_CRON=$(sudo crontab -l 2>&1)
ROOT_CRON_STATUS=$?
set -e
if [ "$ROOT_CRON_STATUS" -eq 0 ]; then
  set +e
  echo "$ROOT_CRON" | grep -qiE "attendance|dist/index\.js|zkteco"
  GREP_RC_STATUS=$?
  set -e
  if [ "$GREP_RC_STATUS" -eq 0 ]; then
    echo "DETECTED: Attendance entries found in root crontab." >&2
    EXISTING_STATE_FOUND=true
  elif [ "$GREP_RC_STATUS" -eq 1 ]; then
    : # KNOWN CLEAN: Root crontab contains no attendance entries
  else
    echo "ERROR: grep failed inspecting root crontab (exit status $GREP_RC_STATUS). UNKNOWN state. STOP." >&2
    EXISTING_UNKNOWN_FOUND=true
  fi
elif [ "$ROOT_CRON_STATUS" -eq 1 ]; then
  set +e
  echo "$ROOT_CRON" | grep -qiE "no crontab for"
  GREP_NOROOTCRON=$?
  set -e
  if [ "$GREP_NOROOTCRON" -eq 0 ]; then
    : # KNOWN CLEAN: Root crontab does not exist
  elif [ "$GREP_NOROOTCRON" -eq 1 ]; then
    echo "ERROR: Unexpected root crontab output: $ROOT_CRON. UNKNOWN state. STOP." >&2
    EXISTING_UNKNOWN_FOUND=true
  else
    echo "ERROR: grep failed parsing root crontab output. UNKNOWN state. STOP." >&2
    EXISTING_UNKNOWN_FOUND=true
  fi
else
  echo "ERROR: Failed to inspect root crontab (exit status $ROOT_CRON_STATUS): $ROOT_CRON. UNKNOWN state. STOP." >&2
  EXISTING_UNKNOWN_FOUND=true
fi

set +e
CRON_DIR_OUT=$(sudo grep -rnE "attendance|dist/index\.js|zkteco" /etc/cron* 2>&1)
CRON_DIR_STATUS=$?
set -e
if [ "$CRON_DIR_STATUS" -eq 0 ]; then
  echo "DETECTED: Attendance entries found in /etc/cron* directories." >&2
  EXISTING_STATE_FOUND=true
elif [ "$CRON_DIR_STATUS" -eq 1 ]; then
  : # KNOWN CLEAN: No attendance entries in /etc/cron*
else
  echo "ERROR: Failed to inspect /etc/cron* (exit status $CRON_DIR_STATUS): $CRON_DIR_OUT. UNKNOWN state. STOP." >&2
  EXISTING_UNKNOWN_FOUND=true
fi

# G. Socket / Port inspection (ss: status 0 required; port 4370 collision check):
set +e
SS_OUT=$(ss -tupn 2>&1)
SS_STATUS=$?
set -e
if [ "$SS_STATUS" -ne 0 ]; then
  echo "ERROR: ss -tupn command failed (exit status $SS_STATUS): $SS_OUT. UNKNOWN state. STOP." >&2
  EXISTING_UNKNOWN_FOUND=true
else
  set +e
  echo "$SS_OUT" | grep -q ":4370"
  GREP_SS_STATUS=$?
  set -e
  if [ "$GREP_SS_STATUS" -eq 0 ]; then
    echo "DETECTED: Active socket or connection to K14 port 4370." >&2
    EXISTING_STATE_FOUND=true
  elif [ "$GREP_SS_STATUS" -eq 1 ]; then
    : # KNOWN CLEAN: No active socket on port 4370
  else
    echo "ERROR: grep failed during socket inspection (exit status $GREP_SS_STATUS). UNKNOWN state. STOP." >&2
    EXISTING_UNKNOWN_FOUND=true
  fi
fi

# H. Fail-Closed Gate Evaluation:
if [ "$EXISTING_UNKNOWN_FOUND" = true ]; then
  echo "============================================================" >&2
  echo "CRITICAL: PRE-INSTALL INSPECTION ENCOUNTERED UNKNOWN STATE." >&2
  echo "AMBIGUITY REQUIRES IMMEDIATE STOP. DO NOT PROCEED." >&2
  echo "Resolve command errors or missing tools before deployment." >&2
  echo "============================================================" >&2
  exit 1
fi

if [ "$EXISTING_STATE_FOUND" = true ]; then
  echo "============================================================" >&2
  echo "CRITICAL: EXISTING ATTENDANCE / RUNTIME STATE DETECTED." >&2
  echo "DO NOT PROCEED. RECONCILE HOST ENVIRONMENT BEFORE DEPLOYMENT." >&2
  echo "============================================================" >&2
  echo "Do NOT overwrite, reset, pull, chown recursively, replace env, or delete PM2 entries" >&2
  echo "without an explicit, authorized migration/reconciliation plan." >&2
  exit 1
fi
echo "Pre-install conflict detection PASSED: clean host environment verified."

# ----------------------------------------------------------------------
# 2. Canonical Node.js 24 LTS Staging, Checksum Verification & Install
# ----------------------------------------------------------------------
# Install native build tools, curl, and archive utilities:
sudo apt update && sudo apt install -y build-essential git curl xz-utils

# Fail closed if destination already exists (directory, file, or symlink; do NOT overlay):
if [ -e "/opt/node24" ] || [ -L "/opt/node24" ]; then
  echo "ERROR: /opt/node24 already exists (directory, file, or symlink). Overlaying runtimes is prohibited. STOP." >&2
  exit 1
fi

# Allocate secure temporary staging directory:
TMPDIR=$(mktemp -d /tmp/node24-install.XXXXXX) || {
  echo "ERROR: Failed to allocate secure temporary directory via mktemp. STOP." >&2
  exit 1
}
chmod 700 "$TMPDIR" || {
  echo "ERROR: Failed to set mode 700 on temporary directory $TMPDIR. STOP." >&2
  rm -rf "$TMPDIR"
  exit 1
}

# Install trap for reliable temporary directory cleanup on failure or script exit:
trap 'rm -rf "$TMPDIR"' EXIT INT TERM

# Download Node.js 24.20.0 ARM64 archive and authoritative official checksums:
NODE_TAR="node-v24.20.0-linux-arm64.tar.xz"
curl -fsSL "https://nodejs.org/dist/v24.20.0/$NODE_TAR" -o "$TMPDIR/$NODE_TAR" || {
  echo "ERROR: Failed to download Node.js archive $NODE_TAR. STOP." >&2
  exit 1
}
curl -fsSL "https://nodejs.org/dist/v24.20.0/SHASUMS256.txt" -o "$TMPDIR/SHASUMS256.txt" || {
  echo "ERROR: Failed to download SHASUMS256.txt. STOP." >&2
  exit 1
}

# Select checksum metadata by exact literal filename field using awk:
MATCHING_HASHES=$(awk -v tar="$NODE_TAR" '$2 == tar { print $1 }' "$TMPDIR/SHASUMS256.txt")
MATCH_COUNT=$(echo "$MATCHING_HASHES" | grep -c . || true)

if [ "$MATCH_COUNT" -ne 1 ]; then
  echo "ERROR: Checksum record ambiguity! Expected exactly 1 match for $NODE_TAR in SHASUMS256.txt, found $MATCH_COUNT. STOP." >&2
  exit 1
fi

EXPECTED_HASH=$(echo "$MATCHING_HASHES" | tr -d '[:space:]')
if ! echo "$EXPECTED_HASH" | grep -qE '^[a-fA-F0-9]{64}$'; then
  echo "ERROR: Invalid SHA-256 format for $NODE_TAR in SHASUMS256.txt: '$EXPECTED_HASH'. STOP." >&2
  exit 1
fi

# Calculate local archive SHA-256 and compare exact strings:
ACTUAL_HASH=$(sha256sum "$TMPDIR/$NODE_TAR" | awk '{ print $1 }')
if [ "$ACTUAL_HASH" != "$EXPECTED_HASH" ]; then
  echo "ERROR: SHA-256 checksum mismatch for $NODE_TAR!" >&2
  echo "  Expected: $EXPECTED_HASH" >&2
  echo "  Actual:   $ACTUAL_HASH" >&2
  echo "STOP." >&2
  exit 1
fi
echo "Node.js archive SHA-256 integrity verified: $ACTUAL_HASH"

# Extract into isolated staging directory:
mkdir -p "$TMPDIR/staging" || {
  echo "ERROR: Failed to create staging directory. STOP." >&2
  exit 1
}
tar -xJf "$TMPDIR/$NODE_TAR" -C "$TMPDIR/staging" --strip-components=1 || {
  echo "ERROR: Failed to extract $NODE_TAR into staging directory. STOP." >&2
  exit 1
}

# Validate staged binaries BEFORE installing to final destination:
STAGED_NODE="$TMPDIR/staging/bin/node"
STAGED_NPM_CLI="$TMPDIR/staging/lib/node_modules/npm/bin/npm-cli.js"

if [ ! -x "$STAGED_NODE" ]; then
  echo "ERROR: Staged node binary is missing or not executable at $STAGED_NODE. STOP." >&2
  exit 1
fi
if [ ! -f "$STAGED_NPM_CLI" ]; then
  echo "ERROR: Staged npm CLI is missing at $STAGED_NPM_CLI. STOP." >&2
  exit 1
fi

STAGED_NODE_VER=$("$STAGED_NODE" -v 2>&1)
if [ "$STAGED_NODE_VER" != "v24.20.0" ]; then
  echo "ERROR: Staged node version mismatch (expected v24.20.0, got '$STAGED_NODE_VER'). STOP." >&2
  exit 1
fi

STAGED_NPM_VER=$("$STAGED_NODE" "$STAGED_NPM_CLI" -v 2>&1)
if [ "$STAGED_NPM_VER" != "11.19.0" ]; then
  echo "ERROR: Staged npm version mismatch (expected 11.19.0, got '$STAGED_NPM_VER'). STOP." >&2
  exit 1
fi
echo "Staged runtime validated: node $STAGED_NODE_VER, npm $STAGED_NPM_VER"

# Install validated staged runtime into final location:
sudo mv "$TMPDIR/staging" /opt/node24 || {
  echo "ERROR: Failed to move staged runtime to /opt/node24. STOP." >&2
  exit 1
}
sudo chown -R root:root /opt/node24 || {
  echo "ERROR: Failed to set root:root ownership on /opt/node24. STOP." >&2
  exit 1
}

# Verify canonical npm CLI exists under installed runtime:
CANONICAL_NPM_CLI="/opt/node24/lib/node_modules/npm/bin/npm-cli.js"
if [ ! -f "$CANONICAL_NPM_CLI" ]; then
  echo "ERROR: Canonical npm CLI missing at $CANONICAL_NPM_CLI. STOP." >&2
  exit 1
fi

# Install exact PM2 7.0.4 globally under /opt/node24 prefix using canonical Node 24 and npm CLI:
sudo /opt/node24/bin/node "$CANONICAL_NPM_CLI" install -g --prefix /opt/node24 pm2@7.0.4 || {
  echo "ERROR: Failed to install PM2 7.0.4 under /opt/node24. STOP." >&2
  exit 1
}

# Verify canonical PM2 CLI path exists:
CANONICAL_PM2_CLI="/opt/node24/lib/node_modules/pm2/bin/pm2"
if [ ! -f "$CANONICAL_PM2_CLI" ]; then
  echo "ERROR: Canonical PM2 CLI missing at $CANONICAL_PM2_CLI. STOP." >&2
  exit 1
fi

# Fail-Closed Post-Install Version & Executable Path Verification Gate:
NODE_VER=$(/opt/node24/bin/node -v 2>&1)
NPM_VER=$(/opt/node24/bin/node "$CANONICAL_NPM_CLI" -v 2>&1)
PM2_VER=$(/opt/node24/bin/node "$CANONICAL_PM2_CLI" -v 2>&1)

if [ "$NODE_VER" != "v24.20.0" ]; then
  echo "ERROR: Node version mismatch! Expected exact v24.20.0, got '$NODE_VER'." >&2
  exit 1
fi
if [ "$NPM_VER" != "11.19.0" ]; then
  echo "ERROR: npm version mismatch! Expected exact 11.19.0, got '$NPM_VER'." >&2
  exit 1
fi
if [ "$PM2_VER" != "7.0.4" ]; then
  echo "ERROR: PM2 version mismatch! Expected exact 7.0.4, got '$PM2_VER'." >&2
  exit 1
fi
echo "Canonical Node.js 24 LTS verified: Node $NODE_VER, npm $NPM_VER, PM2 $PM2_VER at /opt/node24"

# ----------------------------------------------------------------------
# 3. Create Bridge Application Directory
# ----------------------------------------------------------------------
sudo mkdir -p /opt/attendance-bridge
sudo chown -R <PI_USER>:<PI_USER> /opt/attendance-bridge

# ----------------------------------------------------------------------
# 4. Clone Repository & Approved Release Revision Gate
# ----------------------------------------------------------------------
git clone -b commercial https://github.com/ZakabouD/k14.git /opt/attendance-bridge
cd /opt/attendance-bridge

# Revision verification:
# (f5eae2fd20b36904a6793fbfee90e86cb5b9765f was the PI-RUNTIME-2 qualification commit;
# future commercial production deployments must specify their explicitly approved release commit)
APPROVED_RELEASE_COMMIT="<APPROVED_RELEASE_COMMIT>"

ACTUAL_COMMIT=$(git rev-parse HEAD)
if [ "$ACTUAL_COMMIT" != "$APPROVED_RELEASE_COMMIT" ]; then
  echo "ERROR: Git HEAD mismatch!" >&2
  echo "  Expected approved release commit: $APPROVED_RELEASE_COMMIT" >&2
  echo "  Actual checked-out HEAD commit:   $ACTUAL_COMMIT" >&2
  echo "STOP IMMEDIATELY. Building from an unapproved or moving commit is prohibited." >&2
  exit 1
fi
echo "Approved release commit verified: $ACTUAL_COMMIT"

# ----------------------------------------------------------------------
# 5. Lockfile-Based Deterministic Build
# ----------------------------------------------------------------------
# Execute npm ci explicitly under Node 24 (includes devDependencies for tsc & Prisma):
/opt/node24/bin/node /opt/node24/lib/node_modules/npm/bin/npm-cli.js ci --include=dev || {
  echo "ERROR: npm ci failed under Node 24. STOP." >&2
  exit 1
}

# Run Prisma code generation and TypeScript compilation explicitly under Node 24:
/opt/node24/bin/node /opt/node24/lib/node_modules/npm/bin/npm-cli.js run generate || {
  echo "ERROR: Prisma client generation failed under Node 24. STOP." >&2
  exit 1
}
/opt/node24/bin/node /opt/node24/lib/node_modules/npm/bin/npm-cli.js run build || {
  echo "ERROR: TypeScript application build failed under Node 24. STOP." >&2
  exit 1
}
```

> [!WARNING]
> **NodeSource Alternative Notice (NOT Physically Qualified):**
> If NodeSource (`setup_24.x`) is used instead of `/opt/node24`, it installs `/usr/bin/node`.
> That distribution path was **NOT** used in the PI-RUNTIME-2 physical qualification.
> Do NOT mix `/usr/bin/node` with `/opt/node24/bin/node` or treat NodeSource as physically proven without a separate qualification phase.

### Historical Reference Only (DO NOT USE FOR PRODUCTION):
> [!NOTE]
> **Historical Reference — Node 20.20.2 (EOL):**
> Historically, LAB validation used `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -` on Pi 4B (2GB) under Node 20.20.2. This runtime is EOL in 2026, retained in LAB qualification archives for rollback reference only, and is strictly deprecated for commercial deployments.


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

## STAGE 6: PM2 Process Management, Supervisor Migration & Boot Persistence

### 1. Pre-Start Single-Poller Gate (Fail-Closed)
Before starting the attendance worker, you MUST prove that **active attendance/K14 pollers = 0**.
Do not assume `pm2 list` being empty proves no poller is running.

```bash
# Assert required inspection tools:
for tool in pgrep ss awk readlink tr; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "ERROR: Required tool '$tool' missing. STOP." >&2
    exit 1
  fi
done

# Verify zero existing pollers across PM2, manual node workers, and port 4370 connections:
PM2_POLLERS=0
if [ -f "/opt/node24/lib/node_modules/pm2/bin/pm2" ]; then
  PM2_JSON=$(/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 jlist 2>&1)
  PM2_STATUS=$?
  if [ "$PM2_STATUS" -ne 0 ]; then
    echo "ERROR: PM2 jlist failed during pre-start check (exit status $PM2_STATUS): $PM2_JSON. STOP." >&2
    exit 1
  fi
  PM2_POLLERS=$(/opt/node24/bin/node -e '
    let d;
    try {
      d = JSON.parse(process.argv[1]);
    } catch (e) {
      console.error("ERROR: Failed to parse PM2 jlist JSON:", e.message);
      process.exit(1);
    }
    if (!Array.isArray(d)) {
      console.error("ERROR: PM2 jlist output is not an array. UNKNOWN state. STOP.");
      process.exit(1);
    }
    console.log(d.filter(p => p.name === "zkteco-sync-worker").length);
  ' "$PM2_JSON") || {
    echo "ERROR: Failed to validate PM2 process table array. STOP." >&2
    exit 1
  }
fi

MANUAL_PIDS=$(pgrep -f "dist/index.js" 2>&1)
MANUAL_PGREP_STATUS=$?
if [ "$MANUAL_PGREP_STATUS" -eq 0 ]; then
  MANUAL_POLLERS=$(echo "$MANUAL_PIDS" | wc -l)
elif [ "$MANUAL_PGREP_STATUS" -eq 1 ]; then
  MANUAL_POLLERS=0
else
  echo "ERROR: pgrep failed during pre-start poller check (status $MANUAL_PGREP_STATUS): $MANUAL_PIDS. STOP." >&2
  exit 1
fi

SS_PRE_OUT=$(ss -tupn 2>&1)
SS_PRE_STATUS=$?
if [ "$SS_PRE_STATUS" -ne 0 ]; then
  echo "ERROR: ss -tupn failed during pre-start check (status $SS_PRE_STATUS): $SS_PRE_OUT. STOP." >&2
  exit 1
fi
set +e
PORT_MATCHES=$(echo "$SS_PRE_OUT" | grep ":4370")
GREP_SS_PRE=$?
set -e
if [ "$GREP_SS_PRE" -eq 0 ]; then
  PORT_POLLERS=$(echo "$PORT_MATCHES" | grep -v '^$' | wc -l)
elif [ "$GREP_SS_PRE" -eq 1 ]; then
  PORT_POLLERS=0
else
  echo "ERROR: grep failed during pre-start socket check (status $GREP_SS_PRE). STOP." >&2
  exit 1
fi

echo "Active poller pre-check: PM2=$PM2_POLLERS, Manual=$MANUAL_POLLERS, TCP 4370=$PORT_POLLERS"

if [ "$PM2_POLLERS" -ne 0 ] || [ "$MANUAL_POLLERS" -ne 0 ] || [ "$PORT_POLLERS" -ne 0 ]; then
  echo "CRITICAL: Pre-existing or conflicting attendance poller detected!" >&2
  echo "  - PM2-managed attendance processes: $PM2_POLLERS" >&2
  echo "  - Manual 'dist/index.js' processes:  $MANUAL_POLLERS" >&2
  echo "  - Connections to K14 port 4370:      $PORT_POLLERS" >&2
  echo "STOP IMMEDIATELY. Multiple concurrent pollers cause corrupt biometric state." >&2
  echo "Reconcile or terminate ambiguous workers before starting a new worker." >&2
  exit 1
fi
echo "Pre-start single-poller gate PASSED: exactly 0 active pollers detected."
```

### 2. Start Worker Under Explicit Node 24 Binary
Start the attendance worker with explicit interpreter `/opt/node24/bin/node` using the canonical PM2 CLI:

```bash
cd /opt/attendance-bridge

# Start worker using exact qualified Node 24 binary and canonical PM2 CLI:
/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 start dist/index.js \
  --name "zkteco-sync-worker" \
  --interpreter /opt/node24/bin/node \
  --cwd /opt/attendance-bridge || {
  echo "ERROR: Failed to start zkteco-sync-worker under PM2. STOP." >&2
  exit 1
}

# Verify post-start poller count equals exactly 1:
POST_START_PIDS=$(pgrep -f "dist/index.js")
POST_PGREP_STATUS=$?
if [ "$POST_PGREP_STATUS" -ne 0 ] || [ "$(echo "$POST_START_PIDS" | wc -l)" -ne 1 ]; then
  echo "ERROR: Expected exactly 1 active attendance poller after start, found: $(echo "$POST_START_PIDS" | wc -l)" >&2
  exit 1
fi
echo "Post-start single-poller gate PASSED: exactly 1 worker active."
```

### 3. Generate Systemd Startup Configuration
```bash
# Generate and register the privileged systemd startup service using canonical PM2 under Node 24:
/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 startup systemd -u <PI_USER> --hp /home/<PI_USER>
# IMPORTANT: If prompted by PM2 with a specific privileged setup command, execute that exact command with sudo:
# (e.g., sudo env PATH=$PATH:/opt/node24/bin /opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 startup systemd -u <PI_USER> --hp /home/<PI_USER>)
```

### 4. Controlled 12-Step PM2 Supervisor Migration Protocol
> [!IMPORTANT]
> **PM2 Supervisor Migration & Drop-In Semantics:**
> Writing a systemd drop-in and running `systemctl daemon-reload` alone does **NOT** migrate an already-running PM2 daemon (which retains its launch executable and memory space).
> The controlled 12-step protocol below guarantees both the PM2 daemon and worker run under `/opt/node24/bin/node`:

```bash
# Step 1: Save running PM2 process table and assert dump.pm2 contains exactly 1 intended worker
/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 save || {
  echo "ERROR: pm2 save failed. STOP." >&2
  exit 1
}

/opt/node24/bin/node -e '
const fs = require("fs");
const dumpPath = "/home/<PI_USER>/.pm2/dump.pm2";
if (!fs.existsSync(dumpPath)) { console.error("ERROR: dump.pm2 missing at " + dumpPath); process.exit(1); }
const list = JSON.parse(fs.readFileSync(dumpPath, "utf8"));
if (!Array.isArray(list) || list.length !== 1) {
  console.error("ERROR: dump.pm2 must contain exactly 1 process, found: " + (Array.isArray(list) ? list.length : "invalid"));
  process.exit(1);
}
const p = list[0];
const env = p.pm2_env || {};
const interp = p.exec_interpreter || env.exec_interpreter || env.pm_exec_interpreter || p.pm_exec_interpreter;
if (p.name !== "zkteco-sync-worker" || p.pm_exec_path !== "/opt/attendance-bridge/dist/index.js" || p.pm_cwd !== "/opt/attendance-bridge" || interp !== "/opt/node24/bin/node") {
  console.error("ERROR: dump.pm2 process mismatch: name=" + p.name + " script=" + p.pm_exec_path + " cwd=" + p.pm_cwd + " interp=" + interp);
  process.exit(1);
}
console.log("dump.pm2 pre-migration verified: exactly 1 worker under /opt/node24/bin/node.");
' || { echo "ERROR: PM2 saved state assertion failed. STOP." >&2; exit 1; }

# Step 2: Write systemd drop-in resetting and explicitly defining Node 24 ExecStart, ExecReload, ExecStop commands:
sudo mkdir -p /etc/systemd/system/pm2-<PI_USER>.service.d || {
  echo "ERROR: Failed to create systemd drop-in directory. STOP." >&2
  exit 1
}

sudo tee /etc/systemd/system/pm2-<PI_USER>.service.d/node24.conf << 'EOF' || { echo "ERROR: Failed to write drop-in. STOP." >&2; exit 1; }
[Service]
Environment="PATH=/opt/node24/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Environment="PM2_HOME=/home/<PI_USER>/.pm2"
ExecStart=
ExecStart=/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 resurrect
ExecReload=
ExecReload=/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 reload all
ExecStop=
ExecStop=/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 kill
EOF

# Step 3: Reload systemd configuration
sudo systemctl daemon-reload || {
  echo "ERROR: systemctl daemon-reload failed. STOP." >&2
  exit 1
}

# Step 4: Assert Effective Systemd Commands and Environment (Fail-Closed)
# Verify effective ExecStart, ExecReload, ExecStop, and Environment match Node 24 PM2 paths and exact argument vectors:
EFF_START=$(systemctl show pm2-<PI_USER>.service -p ExecStart --value)
EFF_RELOAD=$(systemctl show pm2-<PI_USER>.service -p ExecReload --value)
EFF_STOP=$(systemctl show pm2-<PI_USER>.service -p ExecStop --value)
EFF_ENV=$(systemctl show pm2-<PI_USER>.service -p Environment --value)

# Assert ExecStart exact executable and complete argument vector (no loose substring/regex matching):
/opt/node24/bin/node -e '
  const raw = process.argv[1];
  const expectedArgs = ["/opt/node24/bin/node", "/opt/node24/lib/node_modules/pm2/bin/pm2", "resurrect"];
  const argvMatch = raw.match(/argv\[\]=([^;]+)/);
  const pathMatch = raw.match(/path=([^;]+)/);
  const path = pathMatch ? pathMatch[1].trim() : "";
  const args = argvMatch ? argvMatch[1].trim().split(/\s+/) : raw.trim().replace(/^\{|\}$/g, "").split(/\s+/);
  if (path && path !== expectedArgs[0]) {
    console.error("ExecStart path mismatch:", path, "expected:", expectedArgs[0]);
    process.exit(1);
  }
  if (JSON.stringify(args) !== JSON.stringify(expectedArgs)) {
    console.error("ExecStart argument vector mismatch. Expected:", expectedArgs, "Actual:", args);
    process.exit(1);
  }
' "$EFF_START" || {
  echo "ERROR: Effective ExecStart does not match canonical Node24 PM2 command vector. STOP." >&2
  echo "Effective value: $EFF_START" >&2
  exit 1
}

# Assert ExecReload exact executable and complete argument vector:
/opt/node24/bin/node -e '
  const raw = process.argv[1];
  const expectedArgs = ["/opt/node24/bin/node", "/opt/node24/lib/node_modules/pm2/bin/pm2", "reload", "all"];
  const argvMatch = raw.match(/argv\[\]=([^;]+)/);
  const pathMatch = raw.match(/path=([^;]+)/);
  const path = pathMatch ? pathMatch[1].trim() : "";
  const args = argvMatch ? argvMatch[1].trim().split(/\s+/) : raw.trim().replace(/^\{|\}$/g, "").split(/\s+/);
  if (path && path !== expectedArgs[0]) {
    console.error("ExecReload path mismatch:", path, "expected:", expectedArgs[0]);
    process.exit(1);
  }
  if (JSON.stringify(args) !== JSON.stringify(expectedArgs)) {
    console.error("ExecReload argument vector mismatch. Expected:", expectedArgs, "Actual:", args);
    process.exit(1);
  }
' "$EFF_RELOAD" || {
  echo "ERROR: Effective ExecReload does not match canonical Node24 PM2 command vector. STOP." >&2
  echo "Effective value: $EFF_RELOAD" >&2
  exit 1
}

# Assert ExecStop exact executable and complete argument vector:
/opt/node24/bin/node -e '
  const raw = process.argv[1];
  const expectedArgs = ["/opt/node24/bin/node", "/opt/node24/lib/node_modules/pm2/bin/pm2", "kill"];
  const argvMatch = raw.match(/argv\[\]=([^;]+)/);
  const pathMatch = raw.match(/path=([^;]+)/);
  const path = pathMatch ? pathMatch[1].trim() : "";
  const args = argvMatch ? argvMatch[1].trim().split(/\s+/) : raw.trim().replace(/^\{|\}$/g, "").split(/\s+/);
  if (path && path !== expectedArgs[0]) {
    console.error("ExecStop path mismatch:", path, "expected:", expectedArgs[0]);
    process.exit(1);
  }
  if (JSON.stringify(args) !== JSON.stringify(expectedArgs)) {
    console.error("ExecStop argument vector mismatch. Expected:", expectedArgs, "Actual:", args);
    process.exit(1);
  }
' "$EFF_STOP" || {
  echo "ERROR: Effective ExecStop does not match canonical Node24 PM2 command vector. STOP." >&2
  echo "Effective value: $EFF_STOP" >&2
  exit 1
}

# Assert PATH first component MUST be /opt/node24/bin (no substring-only matching):
PATH_ENTRY=$(echo "$EFF_ENV" | tr ' ' '\n' | grep '^PATH=' || true)
PATH_VAL=${PATH_ENTRY#PATH=}
FIRST_PATH_DIR=${PATH_VAL%%:*}
if [ "$FIRST_PATH_DIR" != "/opt/node24/bin" ]; then
  echo "ERROR: Effective Environment PATH does not prioritize /opt/node24/bin as first component! First dir: '$FIRST_PATH_DIR'. Got: $PATH_ENTRY" >&2
  exit 1
fi

# Assert PM2_HOME exact assignment (no substring-only matching):
PM2_HOME_ENTRY=$(echo "$EFF_ENV" | tr ' ' '\n' | grep '^PM2_HOME=' || true)
if [ "$PM2_HOME_ENTRY" != "PM2_HOME=/home/<PI_USER>/.pm2" ]; then
  echo "ERROR: Effective Environment PM2_HOME mismatch! Expected 'PM2_HOME=/home/<PI_USER>/.pm2', got: '$PM2_HOME_ENTRY'" >&2
  exit 1
fi

# Also assert drop-in definitions loaded by systemd:
systemctl cat pm2-<PI_USER>.service | grep -F "ExecStart=/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 resurrect" >/dev/null || {
  echo "ERROR: systemctl cat does not show exact ExecStart definition. STOP." >&2
  exit 1
}
echo "Effective systemd unit configuration ASSERTED: all commands match /opt/node24 exactly."

# Step 5: Before supervisor restart, confirm exactly one current poller is active
ACTIVE_BEFORE=$(pgrep -f "dist/index.js" | wc -l)
if [ "$ACTIVE_BEFORE" -ne 1 ]; then
  echo "ERROR: Poller count before restart is $ACTIVE_BEFORE (expected exactly 1). STOP." >&2
  exit 1
fi

# Step 6: Execute controlled systemd PM2 supervisor restart
sudo systemctl restart pm2-<PI_USER>.service || {
  echo "ERROR: systemctl restart pm2-<PI_USER>.service failed. STOP." >&2
  exit 1
}

# Step 7: Verify active systemd service state and assert exactly one PM2 daemon PID under Node 24
SVC_STATUS=$(systemctl is-active pm2-<PI_USER>.service 2>&1) || {
  echo "ERROR: pm2-<PI_USER>.service is not active ($SVC_STATUS). STOP." >&2
  exit 1
}
if [ "$SVC_STATUS" != "active" ]; then
  echo "ERROR: pm2-<PI_USER>.service status is '$SVC_STATUS' (expected 'active'). STOP." >&2
  exit 1
fi

set +e
DAEMON_PIDS_RAW=$(pgrep -u <PI_USER> -f "PM2 v[0-9]|PM2.*Daemon|PM2.*God Daemon" 2>/dev/null)
DAEMON_PGREP_STATUS=$?
set -e

if [ "$DAEMON_PGREP_STATUS" -gt 1 ]; then
  echo "ERROR: pgrep failed searching for PM2 daemon (exit status $DAEMON_PGREP_STATUS). UNKNOWN state. STOP." >&2
  exit 1
elif [ "$DAEMON_PGREP_STATUS" -eq 1 ] || [ -z "$DAEMON_PIDS_RAW" ]; then
  echo "ERROR: Zero PM2 daemon processes found after restart. STOP." >&2
  exit 1
fi

DAEMON_PID_COUNT=$(echo "$DAEMON_PIDS_RAW" | grep -v '^$' | wc -l)
if [ "$DAEMON_PID_COUNT" -ne 1 ]; then
  echo "ERROR: Expected exactly 1 PM2 daemon PID, found $DAEMON_PID_COUNT: $DAEMON_PIDS_RAW. STOP." >&2
  exit 1
fi

PM2_DAEMON_PID=$(echo "$DAEMON_PIDS_RAW" | tr -d '[:space:]')
PM2_DAEMON_EXE=$(readlink -f "/proc/$PM2_DAEMON_PID/exe")
if [ "$PM2_DAEMON_EXE" != "/opt/node24/bin/node" ]; then
  echo "ERROR: PM2 daemon running under incorrect executable: $PM2_DAEMON_EXE (expected /opt/node24/bin/node). STOP." >&2
  exit 1
fi
echo "PM2 daemon verified: active systemd service, exactly 1 PID ($PM2_DAEMON_PID) under /opt/node24/bin/node."

# Step 8: Query PM2 process state using canonical Node 24 PM2 CLI and extract PM2-managed PID:
PM2_PROC_JSON=$(/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 jlist) || {
  echo "ERROR: Failed to query PM2 process list via canonical PM2 CLI. STOP." >&2
  exit 1
}

PM2_WORKER_PID=$(/opt/node24/bin/node -e '
  const data = JSON.parse(process.argv[1]);
  if (!Array.isArray(data) || data.length !== 1) {
    console.error("ERROR: Expected exactly 1 PM2 process, found " + (Array.isArray(data) ? data.length : "invalid"));
    process.exit(1);
  }
  const p = data[0];
  if (p.name !== "zkteco-sync-worker") {
    console.error("ERROR: PM2 process name mismatch: " + p.name + " (expected zkteco-sync-worker)");
    process.exit(1);
  }
  const status = p.pm2_env && p.pm2_env.status;
  if (status !== "online") {
    console.error("ERROR: PM2 process status is " + status + " (expected online)");
    process.exit(1);
  }
  const pid = p.pid;
  if (typeof pid !== "number" || pid <= 0 || !Number.isInteger(pid)) {
    console.error("ERROR: Invalid PM2 pid: " + pid);
    process.exit(1);
  }
  console.log(pid);
' "$PM2_PROC_JSON") || {
  echo "ERROR: PM2 online worker state verification failed! STOP." >&2
  exit 1
}
echo "PM2 online process verified: name=zkteco-sync-worker status=online PID=$PM2_WORKER_PID"

# Step 9: Independently query OS process table and prove ownership correlation:
OS_WORKER_PIDS=$(pgrep -f "dist/index.js")
PGREP_RET=$?
if [ "$PGREP_RET" -ne 0 ]; then
  echo "ERROR: No attendance worker found in OS process table (pgrep returned $PGREP_RET). STOP." >&2
  exit 1
fi
OS_PID_COUNT=$(echo "$OS_WORKER_PIDS" | wc -l)
if [ "$OS_PID_COUNT" -ne 1 ]; then
  echo "ERROR: Expected exactly 1 attendance worker in OS process table, found $OS_PID_COUNT (PIDs: $OS_WORKER_PIDS). STOP." >&2
  exit 1
fi
OS_WORKER_PID=$(echo "$OS_WORKER_PIDS" | tr -d '[:space:]')

# Prove correlation: matching OS process PID == PM2-managed PID
if [ "$OS_WORKER_PID" != "$PM2_WORKER_PID" ]; then
  echo "ERROR: Ownership correlation failure! OS process PID ($OS_WORKER_PID) != PM2-managed PID ($PM2_WORKER_PID). STOP." >&2
  exit 1
fi
echo "Process ownership correlation PROVEN: OS PID ($OS_WORKER_PID) == PM2 online PID ($PM2_WORKER_PID)"

# Step 10: Validate executable, cwd, and script path for that exact correlated PID:
WORKER_EXE=$(readlink -f "/proc/$PM2_WORKER_PID/exe")
if [ "$WORKER_EXE" != "/opt/node24/bin/node" ]; then
  echo "ERROR: Correlated worker running under incorrect executable: $WORKER_EXE (expected /opt/node24/bin/node). STOP." >&2
  exit 1
fi

WORKER_CWD=$(readlink -f "/proc/$PM2_WORKER_PID/cwd")
if [ "$WORKER_CWD" != "/opt/attendance-bridge" ]; then
  echo "ERROR: Correlated worker cwd mismatch: $WORKER_CWD (expected /opt/attendance-bridge). STOP." >&2
  exit 1
fi

WORKER_CMDLINE=$(tr '\0' ' ' < "/proc/$PM2_WORKER_PID/cmdline")
if ! echo "$WORKER_CMDLINE" | grep -q "/opt/attendance-bridge/dist/index.js"; then
  echo "ERROR: Correlated worker cmdline does not correspond to /opt/attendance-bridge/dist/index.js! Cmdline: $WORKER_CMDLINE. STOP." >&2
  exit 1
fi
echo "Correlated worker properties verified: exe=$WORKER_EXE, cwd=$WORKER_CWD, script confirmed."

# Step 11: Save and assert running state in dump.pm2 (All three truths agree: PM2 online, OS process, saved dump)
/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 save || {
  echo "ERROR: pm2 save failed. STOP." >&2
  exit 1
}

/opt/node24/bin/node -e '
const fs = require("fs");
const dumpPath = "/home/<PI_USER>/.pm2/dump.pm2";
const list = JSON.parse(fs.readFileSync(dumpPath, "utf8"));
if (!Array.isArray(list) || list.length !== 1) {
  console.error("ERROR: dump.pm2 process count mismatch: " + (Array.isArray(list) ? list.length : "invalid"));
  process.exit(1);
}
const p = list[0];
const env = p.pm2_env || {};
const interp = p.exec_interpreter || env.exec_interpreter || env.pm_exec_interpreter || p.pm_exec_interpreter;
if (p.name !== "zkteco-sync-worker" || p.pm_exec_path !== "/opt/attendance-bridge/dist/index.js" || p.pm_cwd !== "/opt/attendance-bridge" || interp !== "/opt/node24/bin/node") {
  console.error("ERROR: dump.pm2 property mismatch");
  process.exit(1);
}
console.log("dump.pm2 post-migration verified: exactly 1 worker under /opt/node24/bin/node.");
' || { echo "ERROR: Post-migration saved state check failed. STOP." >&2; exit 1; }

# Step 12: Configure log rotation under Node 24 PM2 using canonical CLI:
/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 install pm2-logrotate || {
  echo "ERROR: Failed to install pm2-logrotate under Node 24 PM2. STOP." >&2
  exit 1
}
/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 set pm2-logrotate:max_size 10M || {
  echo "ERROR: Failed to set pm2-logrotate:max_size. STOP." >&2
  exit 1
}
/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 set pm2-logrotate:retain 14 || {
  echo "ERROR: Failed to set pm2-logrotate:retain. STOP." >&2
  exit 1
}
/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 set pm2-logrotate:compress true || {
  echo "ERROR: Failed to set pm2-logrotate:compress. STOP." >&2
  exit 1
}
```

### 5. Fail-Closed Controlled Software Reboot Verification
> [!NOTE]
> **Boot-Time Network Startup Timing & Automatic Transient ENETUNREACH Recovery:**
> During a system reboot, the PM2 service may launch before physical network carrier is established on `<PI_K14_INTERFACE>` (`eth0`) or `<PI_UPLINK_INTERFACE>` (`wlan0`).
> During this brief interval, the initial connection attempt may fail while the K14-side interface/carrier is still becoming ready (`connect ENETUNREACH`).
> In PI-RUNTIME-2 physical qualification, the second connection attempt succeeded cleanly once carrier was ready. This transient startup log is expected and normal during reboot.
>
> **Controlled Software Reboot vs Cold Power Loss:**
> This procedure verifies **controlled software reboot persistence** (`sudo reboot`). Abrupt power cut or cold ungraceful unplug-and-replug remains **NOT-VALIDATED**.

```bash
# ----------------------------------------------------------------------
# 1. Capture Pre-Reboot Evidence on Operator Workstation
# ----------------------------------------------------------------------
# Pre-reboot boot_id must live OUTSIDE the Pi session on the operator workstation:
LOCAL_PRE_BOOT_FILE=$(mktemp /tmp/pi_pre_reboot_boot_id.XXXXXX) || {
  echo "ERROR: Failed to allocate local pre-boot file on operator workstation. STOP." >&2
  exit 1
}
chmod 600 "$LOCAL_PRE_BOOT_FILE" || {
  echo "ERROR: Failed to set mode 600 on $LOCAL_PRE_BOOT_FILE. STOP." >&2
  rm -f "$LOCAL_PRE_BOOT_FILE"
  exit 1
}

# Capture pre-reboot boot_id from Pi over SSH to operator workstation:
ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> <PI_USER>@attendance-<CLIENT_SLUG>-pi.local \
  "cat /proc/sys/kernel/random/boot_id" > "$LOCAL_PRE_BOOT_FILE" || {
  echo "ERROR: Failed to retrieve pre-reboot boot_id over SSH. STOP." >&2
  rm -f "$LOCAL_PRE_BOOT_FILE"
  exit 1
}

UUID_REGEX='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
PRE_BOOT_ID=$(tr -d '[:space:]' < "$LOCAL_PRE_BOOT_FILE")
if ! echo "$PRE_BOOT_ID" | grep -qE "$UUID_REGEX"; then
  echo "ERROR: Pre-reboot boot_id is not a valid UUID ('$PRE_BOOT_ID'). STOP." >&2
  rm -f "$LOCAL_PRE_BOOT_FILE"
  exit 1
fi
echo "Pre-reboot boot_id recorded and validated on operator workstation: $PRE_BOOT_ID"

# NOTE: Post-reboot sync baseline is captured ONLY AFTER proving the new boot.
# Do NOT rely on pre-reboot lastSyncAt as the decisive gate boundary.

# ----------------------------------------------------------------------
# 2. Preflight Sudo Capability & Trigger Controlled Software Reboot
# ----------------------------------------------------------------------
# Preflight non-interactive sudo capability before requesting reboot:
ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> <PI_USER>@attendance-<CLIENT_SLUG>-pi.local "sudo -n true" || {
  echo "ERROR: Non-interactive sudo capability check failed on Pi. STOP." >&2
  rm -f "$LOCAL_PRE_BOOT_FILE"
  exit 1
}

# Issue reboot command; connection termination (exit 0 or 255) is expected on reboot:
set +e
ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> <PI_USER>@attendance-<CLIENT_SLUG>-pi.local "sudo reboot"
REBOOT_CMD_STATUS=$?
set -e
if [ "$REBOOT_CMD_STATUS" -ne 0 ] && [ "$REBOOT_CMD_STATUS" -ne 255 ]; then
  echo "ERROR: Reboot command failed with unexpected exit status $REBOOT_CMD_STATUS. STOP." >&2
  rm -f "$LOCAL_PRE_BOOT_FILE"
  exit 1
fi

# Independently verify Pi host actually disconnects/shuts down within 30s:
echo "Verifying Pi host actually disconnects..."
DOWN=false
for i in $(seq 1 30); do
  if ! ssh -q -i ~/.ssh/id_ed25519_<CLIENT_SLUG> -o ConnectTimeout=2 -o BatchMode=yes <PI_USER>@attendance-<CLIENT_SLUG>-pi.local "true" 2>/dev/null; then
    DOWN=true
    echo "Pi host shutdown confirmed (disconnected at ${i}s)."
    break
  fi
  sleep 1
done
if [ "$DOWN" != true ]; then
  echo "ERROR: Pi host remained reachable 30s after reboot command! Machine did not shut down. STOP." >&2
  rm -f "$LOCAL_PRE_BOOT_FILE"
  exit 1
fi

# Bounded poll for SSH reachability recovery (up to 120s):
echo "Waiting for Raspberry Pi to boot and restore SSH reachability..."
UP=false
for i in $(seq 1 40); do
  if ssh -q -i ~/.ssh/id_ed25519_<CLIENT_SLUG> -o ConnectTimeout=3 -o BatchMode=yes <PI_USER>@attendance-<CLIENT_SLUG>-pi.local "true" 2>/dev/null; then
    UP=true
    echo "Pi host reconnected after ${i} checks."
    break
  fi
  sleep 3
done
if [ "$UP" != true ]; then
  echo "ERROR: Pi host failed to recover SSH reachability within timeout. STOP." >&2
  rm -f "$LOCAL_PRE_BOOT_FILE"
  exit 1
fi

# ----------------------------------------------------------------------
# 3. Post-Reboot Fail-Closed Assertions
# ----------------------------------------------------------------------
# A. Authenticate that an actual OS reboot occurred (boot_id MUST change and be valid UUID):
POST_BOOT_ID=$(ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> <PI_USER>@attendance-<CLIENT_SLUG>-pi.local \
  "cat /proc/sys/kernel/random/boot_id" | tr -d '[:space:]')
if ! echo "$POST_BOOT_ID" | grep -qE "$UUID_REGEX"; then
  echo "ERROR: Post-reboot boot_id is not a valid UUID ('$POST_BOOT_ID'). STOP." >&2
  rm -f "$LOCAL_PRE_BOOT_FILE"
  exit 1
fi

if [ "$POST_BOOT_ID" = "$PRE_BOOT_ID" ]; then
  echo "ERROR: Boot ID unchanged ($POST_BOOT_ID). OS reboot did NOT occur! STOP." >&2
  rm -f "$LOCAL_PRE_BOOT_FILE"
  exit 1
fi
rm -f "$LOCAL_PRE_BOOT_FILE"
echo "OS Reboot PROVEN: Pre-boot ID ($PRE_BOOT_ID) -> Post-boot ID ($POST_BOOT_ID)"

# B. Capture Post-Boot Log File Identity & Baseline Byte Size on Pi:
LOG_PATH="/home/<PI_USER>/.pm2/logs/zkteco-sync-worker-out.log"

set +e
LOG_STAT_RAW=$(ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> <PI_USER>@attendance-<CLIENT_SLUG>-pi.local \
  "test -f '$LOG_PATH' && test -r '$LOG_PATH' && stat -c '%d %i %s' '$LOG_PATH'" 2>&1)
STAT_STATUS=$?
set -e

if [ "$STAT_STATUS" -ne 0 ] || [ -z "$LOG_STAT_RAW" ]; then
  echo "ERROR: Failed to stat log file '$LOG_PATH' on Pi (status $STAT_STATUS): $LOG_STAT_RAW. STOP." >&2
  exit 1
fi

BASE_LOG_DEV=$(echo "$LOG_STAT_RAW" | awk '{print $1}')
BASE_LOG_INODE=$(echo "$LOG_STAT_RAW" | awk '{print $2}')
BASE_LOG_SIZE=$(echo "$LOG_STAT_RAW" | awk '{print $3}')

if ! echo "$BASE_LOG_DEV" | grep -qE '^[0-9]+$' || \
   ! echo "$BASE_LOG_INODE" | grep -qE '^[1-9][0-9]*$' || \
   ! echo "$BASE_LOG_SIZE" | grep -qE '^[0-9]+$'; then
  echo "ERROR: Malformed log metadata from Pi: '$LOG_STAT_RAW'. STOP." >&2
  exit 1
fi
echo "Post-boot log boundary established: dev=$BASE_LOG_DEV inode=$BASE_LOG_INODE offset=${BASE_LOG_SIZE}B"

# C. Execute remote fail-closed infrastructure assertions on Pi:
ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> <PI_USER>@attendance-<CLIENT_SLUG>-pi.local '
  set -e

  # 1. Verify systemd PM2 service is enabled and active:
  test "$(systemctl is-enabled pm2-<PI_USER>.service)" = "enabled"
  test "$(systemctl is-active pm2-<PI_USER>.service)" = "active"
  echo "PM2 systemd service: enabled & active."

  # 2. Verify PM2 daemon executable is /opt/node24/bin/node and count is exactly 1:
  DAEMON_PIDS=$(pgrep -u <PI_USER> -f "PM2 v[0-9]|PM2.*Daemon|PM2.*God Daemon")
  test $(echo "$DAEMON_PIDS" | grep -v "^$" | wc -l) -eq 1
  PM2_DAEMON_PID=$(echo "$DAEMON_PIDS" | tr -d "[:space:]")
  test "$(readlink -f /proc/$PM2_DAEMON_PID/exe)" = "/opt/node24/bin/node"
  echo "PM2 daemon verified under /opt/node24/bin/node (PID: $PM2_DAEMON_PID)."

  # 3. Ownership correlation: Query PM2 online process state and correlate with OS process table:
  PM2_JSON=$(/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 jlist)
  PM2_WORKER_PID=$(/opt/node24/bin/node -e "
    const data = JSON.parse(process.argv[1]);
    if (!Array.isArray(data) || data.length !== 1) process.exit(1);
    const p = data[0];
    if (p.name !== \"zkteco-sync-worker\" || (p.pm2_env && p.pm2_env.status) !== \"online\") process.exit(1);
    if (typeof p.pid !== \"number\" || p.pid <= 0) process.exit(1);
    console.log(p.pid);
  " "$PM2_JSON")
  test -n "$PM2_WORKER_PID"

  OS_WORKER_PIDS=$(pgrep -f "dist/index.js")
  test $(echo "$OS_WORKER_PIDS" | wc -l) -eq 1
  OS_WORKER_PID=$(echo "$OS_WORKER_PIDS" | tr -d "[:space:]")

  # Require OS PID == PM2 PID:
  test "$OS_WORKER_PID" = "$PM2_WORKER_PID"
  echo "Process ownership correlation PROVEN: OS PID ($OS_WORKER_PID) == PM2 online PID ($PM2_WORKER_PID)"

  # 4. Verify worker executable, cwd, and cmdline for the correlated PID:
  test "$(readlink -f /proc/$PM2_WORKER_PID/exe)" = "/opt/node24/bin/node"
  test "$(readlink -f /proc/$PM2_WORKER_PID/cwd)" = "/opt/attendance-bridge"
  tr "\0" " " < "/proc/$PM2_WORKER_PID/cmdline" | grep -q "/opt/attendance-bridge/dist/index.js"
  echo "Correlated worker verified: /opt/node24/bin/node, cwd /opt/attendance-bridge."

  # 5. Verify saved PM2 state in dump.pm2 remains exactly 1 worker under /opt/node24/bin/node:
  /opt/node24/bin/node -e "
    const fs = require(\"fs\");
    const dump = JSON.parse(fs.readFileSync(\"/home/<PI_USER>/.pm2/dump.pm2\", \"utf8\"));
    if (!Array.isArray(dump) || dump.length !== 1) process.exit(1);
    const p = dump[0];
    const interp = p.exec_interpreter || (p.pm2_env && p.pm2_env.exec_interpreter) || (p.pm2_env && p.pm2_env.pm_exec_interpreter);
    if (p.name !== \"zkteco-sync-worker\" || interp !== \"/opt/node24/bin/node\") process.exit(1);
  "
  echo "Saved dump.pm2 state verified: exactly 1 worker under /opt/node24/bin/node."

  # 6. Verify K14 network carrier & route:
  ip route | grep -q "<K14_SUBNET>"
  nc -z -w 5 <K14_IP> 4370
  echo "K14 TCP port 4370 reachable."
' || {
  echo "ERROR: Remote post-reboot assertions failed! STOP." >&2
  exit 1
}

# D. Verify Post-Baseline Log Identity and Appended Content (Fail-Closed against historical logs & rotation):
# 1. Re-stat log file on Pi and detect rotation, replacement, or truncation:
set +e
CUR_STAT_RAW=$(ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> <PI_USER>@attendance-<CLIENT_SLUG>-pi.local \
  "test -f '$LOG_PATH' && test -r '$LOG_PATH' && stat -c '%d %i %s' '$LOG_PATH'" 2>&1)
CUR_STAT_STATUS=$?
set -e

if [ "$CUR_STAT_STATUS" -ne 0 ] || [ -z "$CUR_STAT_RAW" ]; then
  echo "ERROR: Failed to re-stat log file '$LOG_PATH' on Pi (status $CUR_STAT_STATUS): $CUR_STAT_RAW. STOP." >&2
  exit 1
fi

CUR_LOG_DEV=$(echo "$CUR_STAT_RAW" | awk '{print $1}')
CUR_LOG_INODE=$(echo "$CUR_STAT_RAW" | awk '{print $2}')
CUR_LOG_SIZE=$(echo "$CUR_STAT_RAW" | awk '{print $3}')

if ! echo "$CUR_LOG_DEV" | grep -qE '^[0-9]+$' || \
   ! echo "$CUR_LOG_INODE" | grep -qE '^[1-9][0-9]*$' || \
   ! echo "$CUR_LOG_SIZE" | grep -qE '^[0-9]+$'; then
  echo "ERROR: Malformed current log metadata from Pi: '$CUR_STAT_RAW'. STOP." >&2
  exit 1
fi

if [ "$CUR_LOG_DEV" != "$BASE_LOG_DEV" ] || [ "$CUR_LOG_INODE" != "$BASE_LOG_INODE" ]; then
  echo "ERROR: Log file rotated or replaced between baseline and verification! Base inode: $BASE_LOG_INODE, Current inode: $CUR_LOG_INODE. STOP." >&2
  exit 1
fi

if [ "$CUR_LOG_SIZE" -lt "$BASE_LOG_SIZE" ]; then
  echo "ERROR: Log file truncated between baseline and verification! Base size: ${BASE_LOG_SIZE}B, Current size: ${CUR_LOG_SIZE}B. STOP." >&2
  exit 1
fi

if [ "$CUR_LOG_SIZE" -eq "$BASE_LOG_SIZE" ]; then
  echo "ERROR: Zero bytes appended to log file after post-boot baseline! STOP." >&2
  exit 1
fi

# 2. Inspect ONLY bytes appended strictly after local validated BASE_LOG_SIZE:
START_BYTE=$((BASE_LOG_SIZE + 1))
POST_LOGS=$(ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> <PI_USER>@attendance-<CLIENT_SLUG>-pi.local \
  "tail -c +${START_BYTE} '$LOG_PATH'")

if [ -z "$POST_LOGS" ]; then
  echo "ERROR: Appended log content is empty after byte offset $BASE_LOG_SIZE! STOP." >&2
  exit 1
fi

# 3. Assert source-backed cycle events and logical sequence in appended content:
echo "$POST_LOGS" | grep -qE "\[ZKTeco\] Connecting to terminal at " || {
  echo "ERROR: Appended post-baseline logs missing terminal connection attempt. STOP." >&2
  exit 1
}
echo "$POST_LOGS" | grep -qE "\[SyncWorker\] Read [0-9]+ punch records and [0-9]+ users from hardware\." || {
  echo "ERROR: Appended post-baseline logs missing hardware read confirmation. STOP." >&2
  exit 1
}
echo "$POST_LOGS" | grep -qE "\[SyncWorker\] Sync complete! Stats: Received [0-9]+, Inserted [0-9]+, Duplicates [0-9]+" || {
  echo "ERROR: Appended post-baseline logs missing successful API completion log. STOP." >&2
  exit 1
}

CONN_LINE=$(echo "$POST_LOGS" | grep -nE "\[ZKTeco\] Connecting to terminal at " | head -n 1 | cut -d: -f1)
READ_LINE=$(echo "$POST_LOGS" | grep -nE "\[SyncWorker\] Read [0-9]+ punch records and [0-9]+ users from hardware\." | head -n 1 | cut -d: -f1)
SYNC_LINE=$(echo "$POST_LOGS" | grep -nE "\[SyncWorker\] Sync complete! Stats: Received [0-9]+, Inserted [0-9]+, Duplicates [0-9]+" | head -n 1 | cut -d: -f1)

if [ "$CONN_LINE" -gt "$READ_LINE" ] || [ "$READ_LINE" -gt "$SYNC_LINE" ]; then
  echo "ERROR: Appended log events appeared in illogical order (conn: line $CONN_LINE, read: line $READ_LINE, sync: line $SYNC_LINE). STOP." >&2
  exit 1
fi

echo "Post-reboot log verification PASSED: Log identity confirmed, zero rotation/truncation, full cycle sequence validated in appended byte range."

# Pass Criteria for Post-Reboot Sync Acceptance:
# 1. A post-reboot sync cycle is identifiable occurring strictly AFTER the post-boot baseline (log dev=$BASE_LOG_DEV inode=$BASE_LOG_INODE offset=${BASE_LOG_SIZE}B).
# 2. Log file identity is validated: same device and inode, size > baseline size (zero rotation or truncation).
# 3. Worker logs confirm terminal connection, records read, and cloud API push completion in logical order.
# 4. Any initial transient ENETUNREACH prior to carrier establishment was recovered on the second connection attempt.
# 5. Complete end-to-end sync acceptance requires BOTH server-side lastSyncAt advancement beyond the post-boot baseline (queried via PostgreSQL over bounded scheduled-sync polling loop) AND worker log confirmation of successful API completion (see 06-CLIENT-ACCEPTANCE-TEST.md Stage 6).
```

---

## STAGE 7: Verification Checklist

```bash
# Check PM2 process status using canonical Node 24 PM2 CLI:
/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 status

# Check live bridge logs using canonical Node 24 PM2 CLI:
/opt/node24/bin/node /opt/node24/lib/node_modules/pm2/bin/pm2 logs zkteco-sync-worker --lines 20 --nostream
```

* **Pass Criteria:**
  * `zkteco-sync-worker` status is `online`.
  * Logs show worker initialization and periodic API heartbeat.
  * Cloud dashboard displays device `Connecté` (Online).
