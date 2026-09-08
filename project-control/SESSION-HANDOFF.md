# Session Handoff — read after PROJECT-BRAIN

Updated 2026-09-08. CONTROL-1 governance pack was reconciled in CONTROL-2/CONTROL-2R and formally **ACCEPTED BY CHATGPT**. (CONTROL-2 initial review contained mapping and claim errors; CONTROL-2R corrected them against source and logs). **Next proposed phase: SOP-3 — documentation consolidation.** Last accepted major operational result: **D7 READY WITH NON-BLOCKING NOTES** (historical). SOP-2 deep read-only review is complete; SOP-3 remains pending. Do not rerun physical acceptance just to refresh context.

Key accepted baseline truths:
- PasswordAuthentication remained enabled on LAB Pi (key-only hardening NOT-VALIDATED).
- D7 admin password rotation remains NOT CONFIRMED (treat as compromised until rotated before real Client #1).
- D5 simulated outage proved worker survival and polling recovery only (not offline punch buffering).
- D5B reboot was a controlled software reboot (not a cold power cycle).
- Backups are PostgreSQL custom `.dump` archives with `.sha256` sidecars, transport TLS, and R2 provider storage encryption (not tarballs; no application-level client-side encryption).

Repo: branch commercial, HEAD a36facc63d3ce726b7e499114f37e17b631be346, unchanged. This pack and docs/client-deployment are uncommitted; preserve them and unrelated branding/website files. Recheck branch/HEAD/status every session. Read [CURRENT-STATE](CURRENT-STATE.md) for source conflicts and [SAFETY-BOUNDARIES](SAFETY-BOUNDARIES.md) before action.

## Six SOP-2 blockers

1. B1: draft sets DOMAIN, while Compose/Caddy require APP_DOMAIN.
2. B2: Shift ON CONFLICT(name) is invalid against current nonunique name field.
3. B3: production-only Pi install omits build tooling/bootstrap requirements and Prisma generation.
4. B4: secret-printing checks and credential temp-file permissions are unsafe; canonical provisioning also prints its token.
5. B5: Ubuntu-only Docker repository instructions conflict with claimed Debian support.
6. B6: backup scheduler/dependencies/PATH/log permissions/timezone assumptions need reconciliation.

## Exact next task

Consolidate docs/client-deployment against current source and older runbooks, addressing B1–B6 and the supplementary findings in CURRENT-STATE. Restore canonical device provisioning with protected secret handling, SYNC_INTERVAL_CRON, correct Compose service identifiers, safe lock/network diagnostics, R2 scope limitations, SSH recovery nuances, supported-runtime qualification boundaries and client-neutral acceptance. Include Moroccan onboarding/privacy/biometric/legal/HR decisions and explicit single-terminal scope. Establish document hierarchy and preserve safeguards. Report any necessary runtime correction separately to ChatGPT; **no runtime/schema/dependency/deployment-script changes, deployment, infrastructure contact, database actions or commit** in the proposed docs-only phase.

## Safety and release reminders

LIVE Pi/K14/Hostinger are excluded; never start a second poller or clear K14/LAB data. Do not touch main/live checkout or unrelated untracked files. Never expose any secrets. D7 admin credential remains compromised until rotated before real Client #1; D6 left password SSH enabled. Node 20 LAB proof does not qualify future support; VPS Docker uses Node 22. D7 adjusted home entry is accepted non-blocking UX, not a raw timestamp failure. Multi-terminal and finished dynamic branding remain unvalidated; R2 prefix is not credential isolation. No future phase is authorized merely by appearing on the roadmap.

After each major **accepted** phase, update this handoff with the accepted verdict, evidence and next scope; keep historical proof separate from current revalidation.
