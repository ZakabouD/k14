# Session Handoff — read after PROJECT-BRAIN

Updated 2026-09-10. **PI-RUNTIME-2F-R5 ACCEPTED / CLOSED** & **HISTORICAL D7 ADMIN CREDENTIAL EXPOSURE OPERATIONALLY CLOSED / PASS**. Supported Raspberry Pi Runtime Qualification is **PASSED / QUALIFIED (GATE CLOSED)**, standardizing on Node.js 24 LTS (`/opt/node24/bin/node`, Node 24.20.0 LTS, npm 11.19.0, PM2 7.0.4) on Debian GNU/Linux 13.5 (trixie) ARM64 / Raspberry Pi OS Lite 64-bit (Debian 12 bookworm was not tested in PI-RUNTIME-2 and remains NOT-VALIDATED).

## Operational Authority Baseline
- **Canonical Deployment Documentation:** `docs/client-deployment/` is the canonical operator standard for all new commercial client installations (finalized in PI-RUNTIME-2F, accepted baseline commit `715f609afdf55c773659584730b38e362231c8d1`).
- **Legacy Deployment Runbooks:** Legacy documentation outside `docs/client-deployment/` (`docs/PRODUCTION_DEPLOYMENT.md`, `docs/RASPBERRY_PI_DEPLOYMENT.md`, `docs/BACKUP_RUNBOOK.md`, `docs/CLIENT_DEPLOYMENT_CHECKLIST.md`, `docs/CLIENT_ACCEPTANCE_TEST.md`, `docs/PRODUCTION_ACCEPTANCE_CHECKLIST.md`) is **REFERENCE-ONLY / SUPERSEDED FOR NEW COMMERCIAL DEPLOYMENTS**.
- **Supported Pi Runtime Qualification:** **CLOSED / QUALIFIED** (PI-RUNTIME-2A–2E physical qualification against commit `f5eae2f` accepted; PI-RUNTIME-2F documentation reconciliation closed; Gate 1 CLOSED).
- **Historical D7 Admin Credential Closure:** **OPERATIONALLY CLOSED / PASS** (verified on commercial VPS `51.210.47.90` via D7-CLOSURE-1–5; admin password rotated, old credentials/sessions rejected, new credentials accepted, `JWT_SECRET` rotated, container recreated with verified env load, owner custody confirmed, temporary file deleted).
- **Client #1 Deployment Status:** **AUTHORIZED FOR DEPLOYMENT**. The product/platform is authorized to BEGIN the canonical Client #1 deployment process starting with Phase 0 (Pre-Deployment & Client Intake). Per-client SOP gates (Phases 0–7) remain mandatory. Client #1 is not yet onboarded or deployed.

## Key Accepted Baseline Truths
- Supported commercial Pi runtime is **Node.js 24 LTS** (exact Node 24.20.0 LTS, npm 11.19.0, PM2 7.0.4 under `/opt/node24` on Debian GNU/Linux 13.5 trixie ARM64; Debian 12 bookworm was not tested and remains NOT-VALIDATED).
- Node 20.20.2 is EOL and preserved strictly as historical rollback/reference evidence.
- Physical fingerprint punch ingestion and cloud dedup were verified E2E under Node 24 (`Received 4 / Inserted 1 / Duplicates 3` on new punch; `Received 4 / Inserted 0 / Duplicates 4` on replay; EXECUTION-PROVEN + PHYSICAL-PROVEN).
- PM2 supervisor migration to Node 24 verified; daemon and worker both running under `/opt/node24/bin/node`.
- Controlled software reboot persistence under Node 24 verified (`pm2-labadmin.service` auto-started, transient startup `connect ENETUNREACH` before network carrier was recovered automatically by built-in retry on the second connection attempt).
- Cold power-loss / unplug-and-replug test remains **NOT-VALIDATED** (software reboot does not prove cold power-cycle resilience).
- Multi-terminal support remains **NOT-VALIDATED** (dedup key lacks Device; single K14 only).
- Durable offline punch buffering during prolonged API outage remains **NOT-VALIDATED**.
- PasswordAuthentication remained enabled on LAB Pi (key-only hardening NOT-VALIDATED).
- Historical D7 admin credential exposure is **OPERATIONALLY CLOSED / PASS** (VAL-26).
- Supported commercial topology remains: 1 client = 1 VPS + 1 PostgreSQL database + 1 application stack + 1 Raspberry Pi 4 + 1 ZKTeco K14 terminal.
- Backups are PostgreSQL custom `.dump` archives with `.sha256` sidecars, transport TLS, and R2 provider storage encryption (not tarballs; no application-level client-side encryption).

Repo: branch `commercial`, authoritative baseline HEAD `715f609afdf55c773659584730b38e362231c8d1`. Preserve unrelated branding/website files. Recheck branch/HEAD/status every session. Read [CURRENT-STATE](CURRENT-STATE.md) and [SAFETY-BOUNDARIES](SAFETY-BOUNDARIES.md) before action.

## Exact Next Task

Proceed to **Phase 0: Pre-Deployment & Client Intake** for Client #1 in accordance with [00-CLIENT-INFORMATION-FORM.md](../docs/client-deployment/00-CLIENT-INFORMATION-FORM.md) and [01-PRE-DEPLOYMENT-CHECKLIST.md](../docs/client-deployment/01-PRE-DEPLOYMENT-CHECKLIST.md).

## Safety and Release Reminders

LIVE Pi/K14/Hostinger are excluded; never start a second poller or clear K14/LAB data. Do not touch main/live checkout or unrelated untracked files. Never expose any secrets. Supported Pi runtime is Node.js 24 LTS; historical Node 20 is EOL. D7 adjusted home entry is accepted non-blocking UX, not a raw timestamp failure. Multi-terminal and finished dynamic branding remain unvalidated; R2 prefix is not credential isolation. No future phase is authorized merely by appearing on the roadmap. Every client deployment must complete all individual SOP gates (Phases 0–7) before live handover.
