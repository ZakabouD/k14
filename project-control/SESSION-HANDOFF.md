# Session Handoff — read after PROJECT-BRAIN

Updated 2026-09-09. **PI-RUNTIME-2A through PI-RUNTIME-2E completed**: Supported Raspberry Pi Runtime Qualification is **PASSED / QUALIFIED (GATE CLOSED)**, standardizing on Node.js 24 LTS (`/opt/node24/bin/node`, Node 24.20.0 LTS, npm 11.19.0, PM2 7.0.4) on Debian GNU/Linux 13.5 (trixie) ARM64 / Raspberry Pi OS Lite 64-bit (Debian 12 bookworm was not tested in PI-RUNTIME-2 and remains NOT-VALIDATED).

## Operational Authority Baseline
- **Canonical Deployment Documentation:** `docs/client-deployment/` is the canonical operator standard for all new commercial client installations (accepted in CONTROL-SOP3, commit `f5eae2fd20b36904a6793fbfee90e86cb5b9765f`).
- **Legacy Deployment Runbooks:** Legacy documentation outside `docs/client-deployment/` (`docs/PRODUCTION_DEPLOYMENT.md`, `docs/RASPBERRY_PI_DEPLOYMENT.md`, `docs/BACKUP_RUNBOOK.md`, `docs/CLIENT_DEPLOYMENT_CHECKLIST.md`, `docs/CLIENT_ACCEPTANCE_TEST.md`, `docs/PRODUCTION_ACCEPTANCE_CHECKLIST.md`) is **REFERENCE-ONLY / SUPERSEDED FOR NEW COMMERCIAL DEPLOYMENTS**.
- **Supported Pi Runtime Qualification:** **CLOSED / QUALIFIED** (PI-RUNTIME-2A–2E physical qualification completed).
- **Client #1 Production Deployment:** **NOT AUTHORIZED**.

## Client #1 Explicit Blockers
1. **Historical D7 Admin Credential Closure:** `PENDING OPERATIONAL EVIDENCE`. No new operational evidence yet proves the historically exposed D7 admin password was rotated/closed on target systems. (Sole remaining blocker for Client #1 authorization).

Key accepted baseline truths:
- Supported commercial Pi runtime is **Node.js 24 LTS** (exact Node 24.20.0 LTS, npm 11.19.0, PM2 7.0.4 under `/opt/node24` on Debian GNU/Linux 13.5 trixie ARM64; Debian 12 bookworm was not tested and remains NOT-VALIDATED).
- Node 20.20.2 is EOL and preserved strictly as historical rollback/reference evidence.
- Physical fingerprint punch ingestion and cloud dedup were verified E2E under Node 24 (`Received 4 / Inserted 1 / Duplicates 3` on new punch; `Received 4 / Inserted 0 / Duplicates 4` on replay; EXECUTION-PROVEN + PHYSICAL-PROVEN).
- PM2 supervisor migration to Node 24 verified; daemon and worker both running under `/opt/node24/bin/node`.
- Controlled software reboot persistence under Node 24 verified (`pm2-labadmin.service` auto-started, transient startup `connect ENETUNREACH` before network carrier was recovered automatically by built-in retry on the second connection attempt).
- Cold power-loss / unplug-and-replug test remains **NOT-VALIDATED** (software reboot does not prove cold power-cycle resilience).
- Multi-terminal support remains **NOT-VALIDATED** (dedup key lacks Device; single K14 only).
- Durable offline punch buffering during prolonged API outage remains **NOT-VALIDATED**.
- PasswordAuthentication remained enabled on LAB Pi (key-only hardening NOT-VALIDATED).
- D7 admin credential rotation closure remains **PENDING OPERATIONAL EVIDENCE** (treat as compromised until rotated before real Client #1).
- Backups are PostgreSQL custom `.dump` archives with `.sha256` sidecars, transport TLS, and R2 provider storage encryption (not tarballs; no application-level client-side encryption).

Repo: branch commercial, HEAD `f5eae2fd20b36904a6793fbfee90e86cb5b9765f`. Preserve unrelated branding/website files. Recheck branch/HEAD/status every session. Read [CURRENT-STATE](CURRENT-STATE.md) and [SAFETY-BOUNDARIES](SAFETY-BOUNDARIES.md) before action.

## Exact next task

Proceed to **HISTORICAL D7 ADMIN CREDENTIAL CLOSURE**: obtain and verify authorized operational evidence confirming the historically exposed D7 admin password has been rotated and closed on target systems. Real Client #1 deployment remains strictly blocked until this operational evidence is accepted by Project Brain.

## Safety and release reminders

LIVE Pi/K14/Hostinger are excluded; never start a second poller or clear K14/LAB data. Do not touch main/live checkout or unrelated untracked files. Never expose any secrets. D7 admin credential remains compromised until rotated before real Client #1; D6 left password SSH enabled. Supported Pi runtime is Node.js 24 LTS; historical Node 20 is EOL. D7 adjusted home entry is accepted non-blocking UX, not a raw timestamp failure. Multi-terminal and finished dynamic branding remain unvalidated; R2 prefix is not credential isolation. No future phase is authorized merely by appearing on the roadmap.
