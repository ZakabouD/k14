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
| SOP-3 | Consolidate deployment documentation | NEXT / pending | Resolve B1–B6 and extra findings against source/older runbooks; define canonical hierarchy, secret-safe commands and client-neutral acceptance; review documentation only; report runtime blockers separately. |
| SOP-4 | Safe templates and limited automation design | Proposed / pending | Reviewed parameter/secret contracts, safe defaults, stop/recovery gates, bounded automation design based on accepted SOP; implementation requires explicit scope. |
| SOP-5 | Simulated Client #2 deployment | Proposed / pending | Fresh isolated identities/configuration; follow accepted SOP end-to-end, record gaps and evidence without touching LAB/live; execution requires separate authorization. |
| Client #1 | Real-client security closure and onboarding | Conditional / pending | Close exposed admin credential, SSH/recovery and runtime support decisions; complete client intake, HR/privacy/biometric/legal responsibilities, backup/DR/acceptance and handover under explicit deployment authorization. |

Full provisioning automation remains deferred until procedures are proven across multiple deployments. Multi-terminal support and physical/effective check-in separation remain separately scoped future decisions.
