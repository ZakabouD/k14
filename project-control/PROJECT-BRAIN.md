# Project Brain

Canonical intent/context for the commercial ZKTeco attendance and payroll solution, recorded in CONTROL-1 on 2026-09-08. This file records intent/context; current code and execution evidence override stale statements. It is not deployment authorization.

## Read first

Read this file, then [SESSION-HANDOFF](SESSION-HANDOFF.md), [SAFETY-BOUNDARIES](SAFETY-BOUNDARIES.md), and [CURRENT-STATE](CURRENT-STATE.md). Consult [ROADMAP](ROADMAP.md), [DECISION-LOG](DECISION-LOG.md), [VALIDATION-REGISTER](VALIDATION-REGISTER.md), and [AGENT-ROLES](AGENT-ROLES.md) as needed.

## Product and operating model

Commercial target: Moroccan clients, Africa/Casablanca IANA timezone, DH currency, repeatable safe installation and support. Default: **1 client = 1 VPS + 1 PostgreSQL database + 1 app/dashboard + 1 Raspberry Pi bridge + 1 ZKTeco K14**. HR, owner and accounting users access the browser dashboard. Attendance feeds business calculations and payroll reporting; technical acceptance does not prove every client's HR policy or legal compliance.

K14 is LAN-only TCP/UDP 4370. The Pi reads locally and sends punches/users via authenticated HTTPS to the commercial API using x-device-id and x-device-token. The VPS hosts the application/database behind Caddy TLS. Commercial operation uses the API bridge, not the legacy direct-DB worker. Isolated Pi eth0-to-K14 wiring is preferred where site networking permits; internet stays on the site-facing interface.

In scope: single-tenant attendance/payroll, deployment documentation, client onboarding, backup/isolated DR, operational safety and review governance. Out of scope without a separately approved phase: heavy multi-tenancy, multi-terminal promises, full unattended provisioning, live atelier cutover, runtime redesign, or biometric/legal certification. Dynamic branding remains incomplete.

## Evidence model

| Label | Meaning |
|---|---|
| CODE-PROVEN | Confirmed by current source/repository inspection; does not prove deployed state. |
| EXECUTION-PROVEN | Actually executed successfully in a controlled environment. |
| PHYSICAL-PROVEN | Actually tested on dedicated physical Pi/K14 hardware. |
| PRODUCT-PROVEN | Observed through the real client-facing application/UI. |
| REPORT-ONLY | Historical report claim not independently reverified in this session. |
| NOT-VALIDATED | Planned, inferred or apparently supported, but not proven. |

Labels can coexist. Historical execution/physical/product labels are retained **with REPORT-ONLY** to record provenance and avoid implying CONTROL-1 repeated a test. CODE-PROVEN applies only to the specifically cited implementation, never an entire historical deployment. No runtime, hardware, database, backup or UI tests were executed in CONTROL-1. Source establishes current implementation; execution evidence establishes observed behavior at that time. Report conflicts to ChatGPT; never silently change the roadmap.

## Document authority

ChatGPT orchestrates phase sequencing and acceptance subject to user authorization. This pack governs context and scope, not executable installation steps. The commercial deployment suite under [docs/client-deployment/](../docs/client-deployment/) was formally accepted in CONTROL-SOP3 and finalized in PI-RUNTIME-2F (accepted baseline commit `715f609afdf55c773659584730b38e362231c8d1`) as the canonical operator standard for all new commercial client installations. Older [production](../docs/PRODUCTION_DEPLOYMENT.md), [Pi](../docs/RASPBERRY_PI_DEPLOYMENT.md), [backup](../docs/BACKUP_RUNBOOK.md), [deployment](../docs/CLIENT_DEPLOYMENT_CHECKLIST.md) and [acceptance](../docs/CLIENT_ACCEPTANCE_TEST.md) runbooks are reference-only / superseded.

## Supported Runtime Standard & Operational Gates

The supported commercial on-site Raspberry Pi bridge runtime is **Node.js 24 LTS** (Node.js 24.20.0 LTS, npm 11.19.0, PM2 7.0.4 under `/opt/node24` on Debian GNU/Linux 13.5 trixie ARM64), physically and execution-proven in PI-RUNTIME-2A–2E (Debian 12 bookworm was not tested and remains NOT-VALIDATED). Node 20.20.2 is EOL and remains historical rollback/reference evidence only. Controlled software reboot persistence is proven; cold power-loss / unplug-and-replug resilience remains NOT-VALIDATED. Supported Pi Runtime Qualification (Gate 1) is CLOSED.

Historical D7 Admin Credential Closure is **OPERATIONALLY CLOSED / PASS** following verified operational rotation on VPS `51.210.47.90` (admin password rotated in `SystemSettings`, old credential rejected, new credential accepted, `JWT_SECRET` rotated, dashboard container recreated with verified secret load, old sessions invalidated, owner custody confirmed, and ephemeral handover file deleted).

**Client #1 Authorization Semantics:**
**CLIENT #1 = AUTHORIZED FOR DEPLOYMENT.** The product/platform is authorized to BEGIN the canonical Client #1 deployment process starting with Phase 0 (Pre-Deployment & Client Intake). This does NOT mean Client #1 intake is complete, hardware is installed, VPS is provisioned, acceptance testing has passed, or handover has occurred; all canonical per-client SOP gates (Phases 0–7) remain mandatory.
