# Roadmap

Proposed program as of 2026-09-08. ChatGPT may revise sequencing after review; no agent self-approves a major phase. Historical statuses below are REPORT-ONLY in CONTROL-1. Recorded outcomes are not new executions.

| Phase | Objective | Status / outcome | Exit criteria |
|---|---|---|---|
| 4.3 | Validate commercial architecture safely | Complete with deferred cutover; Claude COMPLETE WITH DEFERRED CUTOVER TEST | Passive real atelier trace without second poller and copied real-derived test API payload accepted on OVH; dedup/timezone passed; physical commercial automatic flow deferred at this stage. |
| 4.4-B/B1 | Harden deployment | Complete; Claude PASS WITH NON-BLOCKING NOTES | dotenv bootstrap, required config validation, lazy env getters, timezone constant, Docker Prisma generation and docs; historical tests/build passed. |
| 4.4-C1 | Safe local Docker qualification | Complete, PASS | Disposable Postgres, migrate image, Prisma generation, canonical device-create tested; no prod/hardware contact. |
| 4.4-C2 | Deployment/acceptance documentation | Complete at a36facc63d3ce726b7e499114f37e17b631be346 | Documentation-only pack finalized; Client #1 conditional on physical E2E then. |
| D1 | Dedicated LAB intake | Complete, PASS | Pi identity, OS/network/time/NTP, HTTPS health 200. |
| D2 | LAB base software and isolated LAN | Complete, PASS | Node 20.20.2/npm/git/PM2; eth0 persistent; wlan0 default route; ping/TCP 4370 passed. |
| D3 | Commercial bridge deployment readiness | Complete, PASS | Dedicated SSH key, /opt/attendance-bridge design, auth/provisioning/baseline DB reviewed, no second poller; connectivity incident recovered by controlled power cycle. |
| D4 | Physical commercial E2E | Complete, PASS | Dedicated device, PM2/heartbeat, empty K14 baseline, physical first punch/user, exact timestamp, one insert, dedup replay, daily report. |
| D5 | Resilience/backups/DR | Complete, PASS | PM2 systemd reboot recovery, short Pi-side API outage recovery, real-data backup/checksum/R2 and isolated restore; production untouched. |
| D6 | Second punch/security acceptance | Complete with SSH hardening note | Password rotated interactively, key reverified, second punch/dedup and health passed; PasswordAuthentication still enabled. |
| D7 | Calculation and real UI acceptance | Complete, READY WITH NON-BLOCKING NOTES | Raw timeline/timezone and connected indicators observed; adjusted Home entry explained as UX issue; no blanket payroll correctness proof. |
| SOP-1 | Draft standard client installation package | Complete creation; 12 files uncommitted | Master plus 00–10 documents exist; creation is not field-readiness acceptance. |
| SOP-2 | Deep read-only review | Complete, not field-safe | B1–B6 and supplementary corrections identified; no deployment or file changes in review. |
| CONTROL-1 | Permanent brain/governance layer | ACCEPTED AFTER CONTROL-2R RECONCILIATION | Eight control files, source/provenance conflicts, safety rules, relative links and clean scope review; no commit. |
| CONTROL-2 / CONTROL-2R | Developer reconciliation of control pack against implementation | Complete; corrected reconciliation accepted by ChatGPT | Actual VAL/DEC IDs reviewed, contradictions retracted, minor control-pack corrections identified. |
| SOP-3 | Consolidate deployment documentation | Complete; ACCEPTED BY CHATGPT | B1–B6 and supplementary findings reconciled against source; `docs/client-deployment/` established as canonical operator standard for new commercial deployments; SOP-3H Work verification returned PASS. |
| Supported Pi Runtime Qualification | Qualify supported Node runtime on ARM64 Pi | Complete; PASSED / QUALIFIED | PI-RUNTIME-2A through PI-RUNTIME-2E physical qualification completed on dedicated LAB Pi 4B (Debian GNU/Linux 13.5 trixie ARM64; Debian 12 bookworm was not tested and remains NOT-VALIDATED). Node.js 24.20.0 LTS, npm 11.19.0, PM2 7.0.4 standardized under /opt/node24; built from commercial commit f5eae2f, single poller enforced; physical fingerprint punch ingested into cloud API (Received 4 / Inserted 1 / Duplicates 3), replay dedup verified (Received 4 / Inserted 0 / Duplicates 4), PM2 supervisor & worker running under /opt/node24/bin/node, software reboot persistence with startup ENETUNREACH auto-recovered on second connection attempt verified (EXECUTION-PROVEN + PHYSICAL-PROVEN). Node 20 preserved as rollback reference. Cold power loss remains NOT-VALIDATED. Gate CLOSED. |
| D7 Admin Credential Closure | Operational verification of credential rotation | PENDING OPERATIONAL EVIDENCE | Dedicated verification that historically exposed D7 admin password is confirmed rotated/closed on target systems; required before Client #1. |
| SOP-4 | Safe templates and limited automation design | Proposed / pending | Reviewed parameter/secret contracts, safe defaults, stop/recovery gates, bounded automation design based on accepted SOP; implementation requires explicit scope. |
| SOP-5 | Simulated Client #2 deployment | Proposed / pending | Fresh isolated identities/configuration; follow accepted SOP end-to-end, record gaps and evidence without touching LAB/live; execution requires separate authorization. |
| Client #1 | Real-client security closure and onboarding | NOT AUTHORIZED / Conditional | Supported Pi Runtime Qualification is CLOSED. Blocked by D7 Admin Credential Closure (PENDING OPERATIONAL EVIDENCE). Complete client intake, HR/privacy/biometric/legal responsibilities, backup/DR/acceptance and handover under explicit deployment authorization. |

Full provisioning automation remains deferred until procedures are proven across multiple deployments. Multi-terminal support and physical/effective check-in separation remain separately scoped future decisions.
