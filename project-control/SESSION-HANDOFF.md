# Session Handoff — read after PROJECT-BRAIN

Updated 2026-09-08. **SOP-3 documentation consolidation was formally ACCEPTED BY CHATGPT** following independent Work verification in SOP-3H (`PASS — SOP-3 READY FOR CHATGPT ACCEPTANCE`). Canonicalization of accepted SOP and project-control state is being finalized in CONTROL-SOP3-1.

## Operational Authority Baseline
- **Canonical Deployment Documentation:** `docs/client-deployment/` is now the canonical operator standard for all new commercial client installations.
- **Legacy Deployment Runbooks:** Legacy documentation outside `docs/client-deployment/` (`docs/PRODUCTION_DEPLOYMENT.md`, `docs/RASPBERRY_PI_DEPLOYMENT.md`, `docs/BACKUP_RUNBOOK.md`, `docs/CLIENT_DEPLOYMENT_CHECKLIST.md`, `docs/CLIENT_ACCEPTANCE_TEST.md`, `docs/PRODUCTION_ACCEPTANCE_CHECKLIST.md`) is **REFERENCE-ONLY / SUPERSEDED FOR NEW COMMERCIAL DEPLOYMENTS**.
- **Next Major Technical Phase:** **SUPPORTED PI RUNTIME QUALIFICATION** (formal physical qualification of Node.js 22 LTS on ARM64 Raspberry Pi OS Lite / Debian 12 Bookworm).
- **Client #1 Production Deployment:** **NOT AUTHORIZED**.

## Client #1 Explicit Blockers
1. **Supported Pi Runtime Qualification:** `PENDING`. Node.js 20.20.2 was physically tested in LAB historically, but Node 20 is EOL. Node 22 LTS ARM64 / supported future runtime is `NOT-VALIDATED` on target Pi deployment hardware.
2. **Historical D7 Admin Credential Closure:** `PENDING OPERATIONAL EVIDENCE`. No new operational evidence proves the historically exposed D7 admin password was rotated/closed on target environments.

Key accepted baseline truths:
- PasswordAuthentication remained enabled on LAB Pi (key-only hardening NOT-VALIDATED).
- D7 admin password rotation remains NOT CONFIRMED (treat as compromised until rotated before real Client #1).
- D5 simulated outage proved worker survival and polling recovery only (not offline punch buffering).
- D5B reboot was a controlled software reboot (not a cold power cycle).
- Backups are PostgreSQL custom `.dump` archives with `.sha256` sidecars, transport TLS, and R2 provider storage encryption (not tarballs; no application-level client-side encryption).

Repo: branch commercial, HEAD 924532bba9a73951907549042b32276d4cb8b47e. This control pack and `docs/client-deployment/` are uncommitted; preserve them and unrelated branding/website files. Recheck branch/HEAD/status every session. Read [CURRENT-STATE](CURRENT-STATE.md) and [SAFETY-BOUNDARIES](SAFETY-BOUNDARIES.md) before action.

## Exact next task

Proceed to **CONTROL-SOP3-2 Work verification** of the canonicalization and commit scope review. Once verified, prepare for the **Supported Pi Runtime Qualification** phase. Real Client #1 deployment remains blocked until both Pi runtime qualification is complete and operational evidence of D7 admin credential closure is established.

## Safety and release reminders

LIVE Pi/K14/Hostinger are excluded; never start a second poller or clear K14/LAB data. Do not touch main/live checkout or unrelated untracked files. Never expose any secrets. D7 admin credential remains compromised until rotated before real Client #1; D6 left password SSH enabled. Node 20 LAB proof does not qualify future support; VPS Docker uses Node 22. D7 adjusted home entry is accepted non-blocking UX, not a raw timestamp failure. Multi-terminal and finished dynamic branding remain unvalidated; R2 prefix is not credential isolation. No future phase is authorized merely by appearing on the roadmap.

After each major **accepted** phase, update this handoff with the accepted verdict, evidence and next scope; keep historical proof separate from current revalidation.
