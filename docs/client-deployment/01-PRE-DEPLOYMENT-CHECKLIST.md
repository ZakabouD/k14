# 01 — PRE-DEPLOYMENT CHECKLIST
# Mandatory Go / No-Go Gating Criteria

Every commercial deployment must pass all 5 blocking gates before physical installation or cloud provisioning begins. If any gate fails, the deployment status is **`NO-GO`** and execution must pause until the blocker is resolved.

---

## Gate 1: Cloud & Domain Readiness (Pre-Provision vs Post-Start)

### 1A. Pre-Provision Infrastructure Gating (Must pass BEFORE deploying containers):

| Check | Verification Command / Method | Requirement | Status |
| :--- | :--- | :--- | :--- |
| **VPS Provisioned & Reachable** | `ssh -o BatchMode=yes <SSH_USER>@<VPS_IP> "uname -a"` | Ubuntu 24.04 LTS (current deployment target/policy), SSH key auth operational | `BLOCKING` |
| **DNS A Record Configured** | `dig +short <APP_DOMAIN> @1.1.1.1` | Authoritative DNS resolves to exact `<VPS_IP>` | `BLOCKING` |
| **Cloud Firewall Ingress Policy** | Review Cloud Provider Security Group / Console | Ingress permitted on 22/tcp, 80/tcp, 443/tcp (443/udp allowed) | `BLOCKING` |
| **Sudo Privileges** | `ssh <SSH_USER>@<VPS_IP> "sudo -n true"` | Deployer account has documented sudo access | `BLOCKING` |

### 1B. Post-Service-Start Validation (Verified in Runbook 02 after Caddy/Compose startup):

| Check | Verification Command / Method | Requirement | Status |
| :--- | :--- | :--- | :--- |
| **HTTP ACME Listener Active** | `curl -I http://<APP_DOMAIN>` | Caddy listening on port 80/tcp, redirects to HTTPS or serves ACME | `POST-START GATE` |
| **HTTPS TLS Listener Active** | `curl -I https://<APP_DOMAIN>` | Caddy TLS handshake valid, certificate issued | `POST-START GATE` |
| **API Health Endpoint Reachable** | `curl -s https://<APP_DOMAIN>/api/health` | Returns HTTP 200 `{"status":"ok","database":"connected"}` | `POST-START GATE` |

---

## Gate 2: Hardware Readiness & Single-Terminal Scope

| Check | Verification Method | Requirement | Status |
| :--- | :--- | :--- | :--- |
| **Raspberry Pi Flashed** | Power on Pi with microSD flashed with Raspberry Pi OS Lite 64-bit | Boots cleanly, SSH enabled, hostname set | `BLOCKING` |
| **Supported Pi Runtime Qualification** | Verify Node.js runtime qualification status | Node 20 is EOL; ARM64 Node 22 runtime qualification must be confirmed prior to production deployment | `BLOCKING` |
| **ZKTeco K14 Unboxed & Tested** | Connect 12V power adapter, verify screen lights up | Optical sensor ready, keypad responsive, UI active | `BLOCKING` |
| **Single Terminal Scope Confirmed** | Confirm exactly 1 K14 terminal for this installation | Single-terminal architecture confirmed | `BLOCKING` |
| **Direct RJ45 Patch Cable** | Inspect physical CAT5e/CAT6 patch cable | Tested, no broken clips, minimum 0.5m length | `BLOCKING` |
| **Power Supplies Available** | Verify 2x standard 220V power outlets at mounting point | 1x 5V/3A (USB-C) for Pi, 1x 12V/1.5A for K14 | `BLOCKING` |

---

## Gate 3: Site Network & Route Discovery (Subnet Collision Prevention)

| Check | Verification Method | Requirement | Status |
| :--- | :--- | :--- | :--- |
| **Site Wi-Fi Availability** | Test SSID signal strength at exact physical wall mount location | Signal $\ge -65\text{ dBm}$, 2.4GHz/5GHz supported | `BLOCKING` |
| **Comprehensive Route Discovery** | On Pi and VPS, inspect all existing routes (`ip route`, site LAN, Wi-Fi, Ethernet, VPNs, Docker subnets) | Document all active subnets | `BLOCKING` |
| **Isolated Subnet Selection** | Compare `<K14_SUBNET>` against all discovered routes | `<K14_SUBNET>` must NOT collide with ANY existing network route. If a collision is found, select a distinct non-conflicting private subnet | `BLOCKING` |
| **NetworkManager Profile Resolution** | On Pi: `nmcli -g NAME,UUID,DEVICE connection show` | Identify profile bound to `<PI_K14_INTERFACE>` by UUID/interface. Stop if ambiguous | `BLOCKING` |

---

## Gate 4: Client Policy, HR Rules & Data Protection

| Check | Verification Method | Requirement | Status |
| :--- | :--- | :--- | :--- |
| **Form 00 Completed** | Verify all `REQUIRED` fields in `00-CLIENT-INFORMATION-FORM.md` | Legal name, ICE/RC, slug, APP_DOMAIN, admin email completed | `BLOCKING` |
| **Shift Policy Signed Off** | Review work schedule parameters with client HR | Shift hours, grace periods, delay rounding policies confirmed for entry in `/shifts` | `BLOCKING` |
| **Employee Matricule Mapping** | Verify mapping sheet prepared | Numeric K14 IDs mapped to HR matricules | `BLOCKING` |
| **CNDP / Privacy Acknowledgment** | Client acknowledges data controller obligations under Moroccan Law 09-08 | Regulatory notice reviewed ("Requires client/legal validation") | `BLOCKING` |

---

## Gate 5: Backup & Disaster Recovery Destination

| Check | Verification Method | Requirement | Status |
| :--- | :--- | :--- | :--- |
| **R2 Bucket Reachability** | Test S3 API connection with deployment credentials | Cloudflare R2 bucket reachable | `BLOCKING` |
| **R2 Client Prefix Defined** | Confirm client prefix naming: `client-<CLIENT_SLUG>/postgres/` | Logical directory prefix confirmed | `BLOCKING` |
| **R2 API Token Active** | Verify R2 access key has Object Read/Write/Delete permissions | Secret key available for `.env.backup` injection | `BLOCKING` |

---

## Pre-Deployment Decision Gate

```
[  ] ALL 5 GATES PASSED  ==>  GO: Proceed to 02-VPS-INSTALLATION.md
[  ] ANY GATE FAILED     ==>  NO-GO: Pause execution and resolve blocker with client / project lead
```
