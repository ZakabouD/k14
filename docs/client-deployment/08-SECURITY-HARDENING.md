# 08 — SECURITY HARDENING
# Pre-Handover Hardening Matrix & Emergency Recovery Strategy

This document establishes the mandatory security controls required for every commercial deployment, along with out-of-band recovery procedures for system administrators.

---

## 1. Security Hardening Checklist

| Control | Target Component | Requirement | Safe Verification Method (No Secret Display) |
| :--- | :--- | :--- | :--- |
| **Unique Database Password** | Cloud VPS (`.env.docker`) | High-entropy random hex secret | `test -n "$(grep -E '^POSTGRES_PASSWORD=[a-f0-9]{32,}' .env.docker)"` |
| **Unique JWT Secret** | Cloud VPS (`.env.docker`) | High-entropy random hex string | `test -n "$(grep -E '^JWT_SECRET=[a-f0-9]{32,}' .env.docker)"` |
| **Unique Admin Password** | Cloud VPS (`SystemSettings`) | Explicitly configured initial admin password | Configured prior to first boot, transferred privately |
| **File Permissions** | VPS & Pi Environment Files | Mode `600` (`-rw-------`), owner only | `ls -la .env*` |
| **Device Registration** | Cloud PostgreSQL | Device row active with valid hash | `SELECT "deviceId", "name", "isActive" FROM "Device"` |
| **Host Port Isolation** | PostgreSQL (5432), Dashboard (3000) | NO public host port binding; container network only | `docker compose config` + `docker compose ps` + `docker port` + `ss` |
| **Firewall (UFW)** | Cloud VPS | Ports 22/tcp, 80/tcp, 443/tcp open (443/udp reserved for Caddy QUIC capability; runtime negotiation NOT-VALIDATED) | `sudo ufw status verbose` |
| **SSH Key Authentication** | VPS & Raspberry Pi | Client-specific Ed25519 key auth enforced | `ssh -o IdentitiesOnly=yes ...` |
| **Root Login Restricted** | VPS & Raspberry Pi | `PermitRootLogin prohibit-password` or `no` | `sudo sshd -T \| grep permitrootlogin` |
| **HTTPS TLS Active** | Caddy Reverse Proxy | Automated TLS certificate valid | `curl -I https://<APP_DOMAIN>` |

---

## 2. Hardening Execution Procedures

### A. Securing Environment Files:
```bash
# On Cloud VPS:
chmod 600 /opt/attendance/zk-k14-commercial/.env.docker
chmod 600 /opt/attendance/zk-k14-commercial/.env.backup 2>/dev/null || true

# On Raspberry Pi Bridge:
chmod 600 /opt/attendance-bridge/.env
```

### B. Host Port Isolation Verification (PostgreSQL 5432 & Dashboard 3000):
> [!IMPORTANT]
> **Docker Port Isolation Truth:**
> In the canonical `docker-compose.yml`, `postgres` and `dashboard` ports are attached to internal Docker bridge networks and are **NOT** published to the host (`ports:` directive is omitted for 3000 and 5432; only Caddy publishes 80 and 443).
> 
> Verifying isolation requires multiple complementary tools (`ss` alone does not inspect Docker engine mappings):

```bash
cd /opt/attendance/zk-k14-commercial

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
# (Note: External port unreachability proves firewall blocking, but internal container port isolation must be proven via steps 1-3 above)
```

---

### C. Mandatory 14-Step Safe SSH Hardening Protocol:

> [!WARNING]
> **Lockout Risk Mitigation (No Procedure is Zero-Risk):**
> Modifying SSH access carries inherent lockout risks. Never rely on a single `sed` edit on `/etc/ssh/sshd_config`, as drop-in files in `/etc/ssh/sshd_config.d/`, `Include` directives, or `Match` blocks can override directives or invalidate syntax. Follow this exact 14-step protocol on both the Cloud VPS and the Raspberry Pi:

1. **Prerequisite: Verify Out-of-Band Recovery Readiness BEFORE Modification:**
   Do **NOT** wait until lockout to discover recovery access does not work.
   * **VPS:** Verify active cloud console (e.g. OVHcloud / Hetzner VNC / Rescue mode) credentials and access.
   * **Pi:** Confirm client-specific emergency recovery key installed OR physical MicroSD ext4 mounting path is verified.

2. **Out-of-Band Host Fingerprint Verification:**
   Verify the host key fingerprint out-of-band against known server provisioning records before initiating configuration.

3. **Verified Client-Specific Key Login:**
   Confirm successful key-based login using the client-specific Ed25519 private key.

4. **Verified Sudo Privilege (In-Session):**
   Verify active sudo elevation capability in the session:
   ```bash
   sudo -v || sudo -n true
   ```

5. **Keep Original Session Open:**
   **DO NOT close the active authenticated SSH terminal.** Maintain this original session continuously throughout the hardening process to serve as an emergency recovery channel.

6. **Inspect Configuration Files, Drop-Ins & Include Precedence:**
   Inspect `/etc/ssh/sshd_config`, all drop-in files in `/etc/ssh/sshd_config.d/`, `Include` directives, and all applicable `Match` blocks:
   ```bash
   ls -la /etc/ssh/sshd_config.d/
   grep -E '^(Include|Match)' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null || true
   ```

7. **Evaluate Effective Configuration BEFORE Editing:**
   Evaluate effective sshd configuration to determine active parameters:
   ```bash
   sudo sshd -T | grep -E '^(passwordauthentication|kbdinteractiveauthentication|permitrootlogin|pubkeyauthentication)'
   ```

8. **Determine Precedence & Apply Intended Settings in Controlled Location:**
   OpenSSH evaluates configuration directives using **first-obtained-value semantics** (for most directives, the first value specified wins). Effective behavior depends on:
   - Placement of `Include` directives in `/etc/ssh/sshd_config` (at top vs at bottom of file).
   - Alphabetical sorting order of files in `/etc/ssh/sshd_config.d/` (e.g., `01-*.conf` vs `50-*.conf`).
   - Any active `Match` blocks that override global parameters.

   Determine which controlled location (a drop-in placed before default includes, or direct controlled edit of `/etc/ssh/sshd_config`) will actually enforce the policy on this specific host distribution. Then apply intended settings:
   ```bash
   # EXAMPLE (Valid ONLY after verifying drop-in precedence order for this OS):
   sudo tee /etc/ssh/sshd_config.d/01-hardened.conf > /dev/null << 'EOF'
   PasswordAuthentication no
   KbdInteractiveAuthentication no
   PermitRootLogin prohibit-password
   PubkeyAuthentication yes
   EOF
   sudo chmod 644 /etc/ssh/sshd_config.d/01-hardened.conf
   ```

9. **Run Syntax Validation Test:**
   Execute full configuration validation:
   ```bash
   sudo sshd -t
   ```

10. **STOP Immediately If Syntax Validation Fails:**
    If `sshd -t` returns **ANY** error, warning, or non-zero exit code, **DO NOT RELOAD**. Investigate and fix the issue immediately using the open primary session.

11. **Reload Only After Validation Succeeds:**
    Reload the SSH daemon configuration without interrupting active connections:
    ```bash
    sudo systemctl reload ssh 2>/dev/null || sudo systemctl reload sshd
    ```

12. **Establish PERSISTENT Second Interactive Key-Only SSH Session:**
    From a separate terminal window on the deployer workstation, initiate a **persistent interactive** SSH connection explicitly disabling fallback authentication (do NOT use a one-shot command):
    ```bash
    ssh -i ~/.ssh/id_ed25519_<CLIENT_SLUG> \
      -o PreferredAuthentications=publickey \
      -o PasswordAuthentication=no \
      -o KbdInteractiveAuthentication=no \
      -o IdentitiesOnly=yes \
      <USER>@<HOST>
    ```

13. **Inside Second Session: Evaluate Connection Context Policy & Sudo:**
    Inside that active second interactive session, evaluate effective configuration for the real connection context and verify sudo privilege:
    ```bash
    # Evaluate effective sshd configuration for the actual connection context (supply actual remote client source IP/host):
    sudo sshd -T -C user=<USER>,addr=<ACTUAL_CLIENT_SOURCE_IP>,host=<HOST> | grep -E '^(passwordauthentication|kbdinteractiveauthentication|permitrootlogin)'
    # Verify sudo privilege in second session:
    sudo -v
    ```
    * **STOP Condition:** If `sshd -T` shows `passwordauthentication yes`, the configuration precedence was not effective. Re-evaluate `Include` positioning and drop-in ordering before closing the first session.

14. **Only Then Close Original Session:**
    Only after independent interactive key authentication, effective connection context policy enforcement, and in-session sudo privilege are all verified from the second session may the original initial SSH session be safely closed.

---

## 3. Out-of-Band Emergency Recovery Strategy

In the event of accidental lockout, network loss, or hardware failure, use the following tiered recovery paths:

### Tier 1: Dual SSH Key Provisioning
Every deployment should maintain two client-specific authorized public keys in `~/.ssh/authorized_keys`:
1. **Primary Deployer Key:** `id_ed25519_<CLIENT_SLUG>` (Held by primary account manager).
2. **Client Emergency Recovery Key:** `id_ed25519_<CLIENT_SLUG>_recovery` (Stored securely in client offline vault).

### Tier 2: Cloud VPS Out-of-Band Web Console
* **Provider Access:** OVHcloud / Hetzner / Scaleway Cloud VNC web console.
* **Mechanism:** Log in directly via cloud console using emergency rescue mode or server root credentials to fix network/firewall configurations.

### Tier 3: Physical Raspberry Pi Bridge Recovery
If network access to the on-site Raspberry Pi is completely lost:
1. **Power Off Pi:** Disconnect USB-C power adapter.
2. **Remove MicroSD Card:** Insert the MicroSD card into a Linux-capable workstation or Linux VM (native macOS does not support ext4 filesystems).
3. **Mount Root Filesystem & Inspect Precedence:**
   * Inspect both `/etc/ssh/sshd_config` AND all drop-ins in `/etc/ssh/sshd_config.d/` to ensure overrides are properly modified.
   * Set `PasswordAuthentication yes` in the appropriate effective configuration file.
   * Or add a new public key directly to `/home/<PI_USER>/.ssh/authorized_keys`.
4. **Reinsert & Boot:** Reinsert MicroSD card into Pi, connect power, and log in.
