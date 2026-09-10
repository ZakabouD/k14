# Current State

- **Historical CONTROL-1 Baseline (2026-09-08):** commercial checkout `zk-k14-commercial`, branch **commercial**, HEAD **924532bba9a73951907549042b32276d4cb8b47e**.
- **Current Canonical Repository Baseline:** commercial checkout `zk-k14-commercial`, branch **commercial**, accepted HEAD **f5eae2fd20b36904a6793fbfee90e86cb5b9765f** (accepted CONTROL-SOP3 commit), prior to the current uncommitted PI-RUNTIME-2F documentation reconciliation. Separate main/live checkout `zk-k14-test` was listed by Git at `aa4d917`; it was not inspected or modified.

## Phase and evidence

CONTROL-1 governance pack was reconciled through CONTROL-2/CONTROL-2R and formally accepted by ChatGPT. **SOP-3 documentation consolidation was formally ACCEPTED by ChatGPT Project Brain** following SOP-3H independent Work verification (`PASS — SOP-3 READY FOR CHATGPT ACCEPTANCE`).

- **Canonical Commercial Deployment Documentation:** `docs/client-deployment/` is now the canonical operator standard for all new commercial client installations (accepted in CONTROL-SOP3, commit `f5eae2fd20b36904a6793fbfee90e86cb5b9765f`).
- **Legacy Deployment Documentation:** Legacy runbooks outside `docs/client-deployment/` (`docs/PRODUCTION_DEPLOYMENT.md`, `docs/RASPBERRY_PI_DEPLOYMENT.md`, `docs/BACKUP_RUNBOOK.md`, `docs/CLIENT_DEPLOYMENT_CHECKLIST.md`, `docs/CLIENT_ACCEPTANCE_TEST.md`, `docs/PRODUCTION_ACCEPTANCE_CHECKLIST.md`) are **REFERENCE-ONLY / SUPERSEDED FOR NEW COMMERCIAL DEPLOYMENTS**.
- **Supported Pi Runtime Qualification:** **CLOSED / QUALIFIED** (PI-RUNTIME-2A through PI-RUNTIME-2E). Standardized on Node.js 24 LTS (`/opt/node24/bin/node`, Node 24.20.0 LTS, npm 11.19.0, PM2 7.0.4) on Debian GNU/Linux 13.5 (trixie) ARM64 / Raspberry Pi OS Lite 64-bit (Debian 12 bookworm was not tested in PI-RUNTIME-2 and remains NOT-VALIDATED). Real physical fingerprint ingestion, cloud dedup, PM2 supervisor migration, and software reboot recovery are physically proven.
- **Client #1 Production Deployment:** **NOT AUTHORIZED**.

### Client #1 Explicit Blockers:
1. **Historical D7 Admin Credential Closure:** `PENDING OPERATIONAL EVIDENCE`. No new operational evidence yet proves the historically exposed D7 admin credential was rotated/closed on target systems. (Sole remaining blocker for Client #1 authorization; Supported Pi Runtime Qualification is CLOSED).


Historical last accepted major operational result: **D7 READY WITH NON-BLOCKING NOTES**. Phases 4.3, 4.4-B/B1, C1, C2, D1–D7, SOP-1, SOP-2, CONTROL-1/2/2R, and SOP-3 are complete with their recorded qualifications; see [roadmap](ROADMAP.md) and [register](VALIDATION-REGISTER.md). Current deployed health and credential status were not checked.

## Current repository stack — CODE-PROVEN declarations

| Component | Observed source | Qualification |
|---|---|---|
| Next.js / React | 16.2.6 / 19.2.4 in [dashboard manifest](../dashboard/package.json); App Router directory present | Manifest versions, not running installation. |
| Tailwind | v4 declared in dashboard manifest | Range, not independent installed-version check. |
| Prisma | ^7.8.0 in [root manifest](../package.json) and dashboard | Range, not claim of exact current runtime version. |
| Database / proxy | postgres:16-alpine and caddy:2-alpine in [Compose](../docker-compose.yml) | Deployment definitions. |
| VPS Node | node:22-alpine in [Dockerfile](../Dockerfile) | Container image for dashboard service; distinct from Pi bridge runtime. |
| Pi bridge | Node/TypeScript; zkteco-js ^1.7.1; Node.js 24.20.0 LTS (`/opt/node24/bin/node`), npm 11.19.0, PM2 7.0.4; [entrypoint](../src/index.ts) bootstraps dotenv then config/timezone guards; root [tsconfig](../tsconfig.json) includes `src/**/*` | Physically and execution-proven in PI-RUNTIME-2A–2E on Debian GNU/Linux 13.5 trixie ARM64 (Debian 12 bookworm was not tested and remains NOT-VALIDATED). Built from commercial commit `f5eae2fd20b36904a6793fbfee90e86cb5b9765f`; real K14 physical fingerprint punch ingested and cloud dedup confirmed; PM2 supervisor and worker running under `/opt/node24/bin/node`; software reboot persistence verified. Node 20.20.2 is EOL and retained strictly as rollback/reference evidence. |
| Authentication | jose HS256 in [session](../dashboard/src/lib/session.ts); bcrypt comparison in [actions](../dashboard/src/app/actions.ts); header/token-hash device auth in [device-auth](../dashboard/src/lib/device-auth.ts) | Static source inspection only. |
| Data / settings | RawPunch unique (zktecoUserId, recordTime), DH/Africa/Casablanca defaults and optional logoUrl in [schema](../prisma/schema.prisma) | No Device in dedup key; logo field is not a finished white-label storage workflow. |
| Backups | Local PostgreSQL custom-format archive (`.dump` via `pg_dump -Fc` verified with `pg_restore --list`), `.sha256` checksum sidecar, `.complete` marker, and R2 sync in [backup-full](../scripts/backup-full.sh) and [uploader](../scripts/upload-backup-r2.sh) | Custom archive format (not a tarball); transport (TLS) and R2 provider storage encryption apply (no client-side/application-level encryption). R2 credentials and actual scope not inspected. |

## Historical SOP-2 Findings — Resolved / Superseded through Accepted SOP-3

| ID | Conflict / consequence | SOP-3 correction |
|---|---|---|
| B1 | [02](../docs/client-deployment/02-VPS-INSTALLATION.md) sets DOMAIN; Compose/Caddy read APP_DOMAIN with localhost fallback. | Use actual domain contract and safe non-secret verification. |
| B2 | [03](../docs/client-deployment/03-APPLICATION-PROVISIONING.md) uses ON CONFLICT(name) for Shift; schema name has no unique constraint. | Document valid existing provisioning; no schema change in SOP-3. |
| B3 | [04](../docs/client-deployment/04-RASPBERRY-PI-INSTALLATION.md) installs production-only dependencies then builds; TypeScript/dotenv tooling is in devDependencies, root tsconfig.json compiles wider src tree (entering Prisma dependencies), and Prisma generation is omitted. | Complete dependency/build/bootstrap sequence against source and older Pi runbook; address build scope and prerequisites in documentation without prescribing runtime redesign. |
| B4 | [02](../docs/client-deployment/02-VPS-INSTALLATION.md) prints secret fields and creates credential temp file before chmod; provisioning also needs protected token output. | Redacted validation, restrictive creation permissions and secure handover; no credentials in transcripts. |
| B5 | Ubuntu Docker repository commands in [02](../docs/client-deployment/02-VPS-INSTALLATION.md), while onboarding permits Debian. | Narrow supported OS or explicitly document qualified OS-specific paths. |
| B6 | [07](../docs/client-deployment/07-BACKUP-AND-DR.md) claims UTC for bare cron without timezone control and assumes log permissions/dependencies. Existing [scheduler](../scripts/install-backup-schedule.sh) uses Casablanca; uploader requires AWS CLI. | Reconcile scheduler, dependency/PATH/log permissions and supported timezone semantics. |

Additional SOP-3 corrections: restore canonical device provisioning; use SYNC_INTERVAL_CRON (not SYNC_CRON); distinguish Compose services from container names; remove docker system prune as a log-cleaning remedy; diagnose locks safely; discover network profiles instead of assuming names; distinguish R2 prefix from credential scope; handle SSH recovery/sudo before hardening; replace LAB-specific acceptance identities. Address Moroccan onboarding, privacy/biometric/legal review responsibilities, HR policy sign-off and multi-terminal scope without claiming compliance already validated.

## Product/security notes and contradictions

- D7's adjusted firstPunchIn is supported by current calculation/action source: raw 19:32:41 becomes effective 20:00:41, later than checkout 19:56:20, zero regular hours, status OK. Exact historical values/UI are REPORT-ONLY here. Raw timeline fidelity passed historically. This was accepted as non-blocking UX; future physicalCheckIn/effectiveBillableStart separation requires an approved runtime phase.
- LAB PasswordAuthentication remained enabled after D6; key login worked but noninteractive sudo hardening was incomplete. This is not a fully hardened SSH baseline.
- D7 printed an admin password: treat it as compromised until rotated before real Client #1. Earlier LAB token, temporary Pi password and R2 exposures were reportedly rotated; no current recheck. See [security boundaries](SAFETY-BOUNDARIES.md).
- `src/scripts/seed.ts` generates a random 24-character hexadecimal admin password only when initialization/settings creation is required and `ADMIN_PASSWORD` is missing, empty, or whitespace-only, printing that generated password to stdout. If `SystemSettings` already exist, this initialization path is skipped. Future SOP must require deliberate secure credential handling and environment configuration during provisioning; never reproduce credentials in transcripts.
- Pi Node 20.20.2 was physically tested historically, but Node 20 is EOL per official Node release tables. PI-RUNTIME-2A through PI-RUNTIME-2E physically qualified Node.js 24 LTS (exact Node 24.20.0 LTS, npm 11.19.0, PM2 7.0.4 under `/opt/node24` on Debian GNU/Linux 13.5 trixie ARM64; Debian 12 bookworm was not tested and remains NOT-VALIDATED) on dedicated LAB hardware with real K14 fingerprint ingestion, cloud dedup, PM2 supervisor migration, and software reboot auto-restart. Node 20 is retained strictly as rollback/reference evidence. Controlled software reboot persistence was verified; cold power-loss / unplug-and-replug resilience remains NOT-VALIDATED.
- HTTPS is deployment policy, but [worker validation](../src/config/worker-config.ts) accepts HTTP or HTTPS and [API client](../src/services/api-client.ts) has a localhost HTTP fallback. Do not claim the code enforces HTTPS-only. Flag to ChatGPT; do not change runtime in SOP-3.
- Canonical [device-create](../src/scripts/device-create.ts) hashes tokens but prints raw output; rerunning an existing ID rotates its credential. It is neither a harmless read nor safe to capture verbatim.
- Multi-terminal/multi-K14 is NOT-VALIDATED; dedup lacks Device. Dynamic logo/white-label asset storage is not fully validated despite optional logoUrl and unrelated untracked brand assets.
- Backups are PostgreSQL custom archives (`.dump` via `pg_dump -Fc` verified with `pg_restore --list`) with `.sha256` checksums and `.complete` metadata markers. They are not tarballs and do not have application-level/client-side encryption; encryption is provided by transport TLS and Cloudflare R2 server-side storage. R2 prefix separation (`${BACKUP_CLIENT_ID}/postgres/`) is logical, not credential-level tenant isolation. A flock file's existence does not establish a held/stale lock; deleting it can undermine mutual exclusion. Review process ownership and locking mode first.
- D4–D7 extend the earlier deferred physical acceptance, but LAB success does not prove a repeatable clean-client SOP or present production readiness. The SOP-1 claim of operational readiness is contradicted by B1–B6.

## Preserved baseline and next action

Pre-existing untracked paths: `branding/`, `dashboard/public/brand/`, `docs/BRAND_FOUNDATION.md`, `docs/EXPLORATION_NOMS.md`, `docs/IDENTITE_TEMYO.md`, `docs/client-deployment/`, `website/`. No tracked changes existed initially. All are preserved. This pack is uncommitted, so future sessions must use this checkout or deliberately transfer these files; HEAD alone does not contain them.

SOP-3 documentation consolidation is complete and formally accepted. Supported Pi Runtime Qualification (PI-RUNTIME-2A–2E) is complete and PASSED / QUALIFIED, standardizing on Node.js 24 LTS under `/opt/node24` on Debian GNU/Linux 13.5 trixie ARM64 (Debian 12 bookworm remains NOT-VALIDATED). Supported Pi Runtime Qualification (Gate 1) is CLOSED. Client #1 production deployment remains NOT AUTHORIZED pending resolution of the sole remaining blocker: operational evidence of Historical D7 Admin Credential Closure. Next major technical task is operational verification and closure of the D7 credential rotation.
