# Safety Boundaries

## ABSOLUTE — LIVE ATELIER EXCLUDED

**Do not contact or modify LIVE infrastructure without explicit, specific authorization and a safe plan. These are safety identifiers only, never deployment targets:**

| LIVE identifier | Protected system |
|---|---|
| 192.168.11.175 | Live atelier Pi |
| 192.168.11.201:4370 | Live atelier K14 |
| 76.13.4.74 | Legacy Hostinger VPS / live DB/system |

- Never launch a second K14 poller while the live legacy worker is active. Never contact live port 4370 unless specifically authorized and safe.
- Never clear, delete or modify K14 data under this phase. Never casually alter the live Pi worker or Hostinger database/system. Legacy worker was historically direct-DB; commercial API work is separate.
- Never delete LAB acceptance data, provision users/devices, rotate credentials, run backups/restores, or contact LAB/commercial infrastructure as part of documentation work.

## Repository boundary

Use the separate commercial worktree, branch commercial. Main/live worktree `zk-k14-test` must not be modified, switched, merged into or deployed from for this work. Read [AGENTS.md](../AGENTS.md) on entry. Preserve unrelated untracked files, including branding, website and draft SOP files. CONTROL-1 permits only additions/edits inside project-control; no runtime/schema/migrations/dependencies/deployment script changes, database operations, staging or commit. SOP-3 handoff is documentation-only; a roadmap is not execution authorization.

## Historical dedicated LAB — identification only

REPORT-ONLY topology: dedicated Pi 4 (2 GB), hostname attendance-lab-pi, operational account labadmin; wlan0 192.168.11.137 via site LAN/internet; eth0 192.168.1.10/24 direct RJ45 to dedicated K14 192.168.1.201:4370, mask 255.255.255.0, gateway 0.0.0.0. Internet default route remained wlan0. Commercial domain `https://pointage.opaxia.store`, VPS 51.210.47.90, device identity DEV-LAB-K14-01. These are not reusable client defaults and do not authorize contact. LAB is distinct from LIVE.

## Secret incident register — no values

| Incident | Historical disposition | Required handling |
|---|---|---|
| First LAB device token exposed in transcript | Reportedly rotated via canonical provisioning | Never reproduce old/current token. Re-provisioning an existing ID rotates it; do not run for inspection. |
| Temporary LAB Pi password exposed | Reportedly rotated interactively in D6 | New password stays private; no retrieval, transcript search, printing or storage in docs. |
| R2 credentials exposed | Reportedly rotated | No current scope/rotation recheck; do not display configuration or assume prefix-scoped permissions. |
| Dashboard admin password printed during D7 | OPERATIONALLY CLOSED / PASS | Rotated via bcrypt in `SystemSettings` singleton on commercial VPS `51.210.47.90`; old credential rejected, new credential accepted; `JWT_SECRET` rotated with dashboard container recreated; owner custody confirmed; temporary handover file deleted without wildcards (D7-CLOSURE-1–5). |
| Dedicated LAB SSH private key | Must remain private | Never copy into repository/docs or expose; protect recovery mechanisms separately. |
| Legacy/live secrets and historical Pi passwords | Outside this task | Do not surface or change casually. |

LAB used ssh-keygen -R with ssh-keyscan/accept-new for continuity; this is weaker than out-of-band host-key fingerprint verification. Do not represent it as verified host identity. D6 key auth passed after password rotation, but PasswordAuthentication remained enabled because sudo hardening was incomplete noninteractively. Safe hardening needs a verified new key session, recovery and sudo plan before disabling access; no hardening performed here.

Never print env files, secret-bearing command output, database credentials, JWT keys, passwords, device tokens, R2 credentials or private keys. Canonical provisioning prints the generated token: future authorized execution needs protected output capture/secure transfer rather than chat logs. Use redacted presence/permission checks and restrictive file creation; chmod after creation does not eliminate an exposure window.

## Backup and network safety

R2 prefix is logical organization, not automatic credential isolation. DR tests use isolated disposable databases only with explicit authorization. A persistent flock file is normal: file existence alone must never trigger deletion. Establish lock mode, active holder/process and operation status; fallback directory locks need different diagnostics. Do not unlink an active lock or recommend broad Docker prune as log cleanup. Discover routes/profiles and subnet collisions before future network changes; do not copy LAB IPs into client instructions.
