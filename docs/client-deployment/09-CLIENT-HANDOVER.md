# 09 — CLIENT HANDOVER
# Operational Delivery Package & Client Acceptance Sign-Off

This document formalizes the delivery of the commercial attendance system to the client's administrative team upon successful completion of all acceptance testing.

---

## 1. Deliverables & System Identification Record

| Item | Client Specification |
| :--- | :--- |
| **Commercial Platform Name** | Pointage RH & Paie |
| **Web Dashboard URL** | `https://<APP_DOMAIN>` |
| **Primary Administrator Login** | `<ADMIN_EMAIL>` |
| **Assigned Biometric Device ID** | `DEV-<CLIENT_SLUG>-K14-01` |
| **Terminal Physical Location** | `<PHYSICAL_LOCATION>` |
| **Bridge Raspberry Pi Hostname** | `attendance-<CLIENT_SLUG>-pi` |
| **Daily Backup Schedule** | Daily at 03:00 Africa/Casablanca (Local + Cloudflare R2 Off-Site) |
| **Technical Support Contact** | `<SUPPORT_EMAIL>` *(e.g. support@domain.ma)* |

> [!IMPORTANT]
> **Zero Plaintext Passwords in Documentation:**
> Administrative login passwords, database passwords, and SSH keys are never included in printed or shared handover documents. Credentials must be transferred exclusively via an encrypted password vault or an ephemeral single-view secret link.

---

## 2. Administrator Quick-Start Guide

### A. Employee Enrollment & Mapping Workflow
1. **On ZKTeco Terminal:**
   * Press `[ M/OK ]` $\rightarrow$ Select `User Mgt.` $\rightarrow$ Select `New User`.
   * Assign unique numeric **User ID** (e.g. `101`, `102`) matching the HR mapping sheet.
   * Enter employee name using keypad.
   * Select `Fingerprint` $\rightarrow$ Place finger 3 times on optical sensor $\rightarrow$ Press `[ M/OK ]` $\rightarrow$ `[ ESC ]`.
2. **Automatic Synchronization:**
   * The bridge worker syncs new employees to the cloud automatically during the next 15-minute cycle (or immediately on manual sync).
3. **On Web Dashboard (`https://<APP_DOMAIN>`):**
   * Navigate to **Gestion des Horaires** (`/shifts`) to verify or create operational shifts.
   * Navigate to **Gestion des Artisans** (`/artisans`) to assign employee contract type, hourly rate, monthly salary, and shift schedule.

### B. Daily Monitoring & Anomaly Handling
* **Live Overview:** View active personnel on the **Tableau de Bord** (`/`).
* **Anomalies Page (`/anomalies`):** Identifies single uncompleted punches or unexcused absences requiring manager review.

### C. Monthly Payroll & Attendance Export
* Navigate to **Centre d'Exportations & Rapports** (`/reports`).
* Select date range (e.g. `01/09/2026` to `30/09/2026`).
* Click **`Exporter vers Excel (Multi-Onglets)`** to generate formatted multi-tab payroll reports (Synthèse, Journal Quotidien, Cumul Heures Sup 150%/200%).

---

## 3. Mandatory Handover Gating & Operational Responsibility Matrix

> [!IMPORTANT]
> **Mandatory Handover Gate Rule:**
> Every operational domain below constitutes a formal **HANDOVER GATE**. If an item indicates `REQUIRES CONTRACT / CLIENT AGREEMENT`, formal handover is **BLOCKED** for that item until the client contract explicitly defines the terms, responsible parties, and operational SLA parameters.

| Handover Gate / Domain | Client Administrator Role | Technical Support Provider Role | Handover Gate Status |
| :--- | :--- | :--- | :--- |
| **1. Domain & DNS Ownership** | Owns registrar account & DNS zone | Configuration assistance only | `MANDATORY GATE` |
| **2. VPS Hosting Custody** | Owns VPS account & billing | Technical maintenance support | `MANDATORY GATE` |
| **3. Cloudflare R2 Storage** | Owns Cloudflare R2 bucket & account | Backup configuration support | `MANDATORY GATE` |
| **4. Credential & Key Custody** | Secure vault for admin passwords & recovery keys | Emergency recovery key holder | `MANDATORY GATE` |
| **5. Backup Monitoring Review** | Designates reviewer: `<BACKUP_REVIEW_OWNER>`, Frequency: `<BACKUP_REVIEW_FREQUENCY>` | Configures monitoring hooks | `REQUIRES CONTRACT / CLIENT AGREEMENT` |
| **6. Alert Destination & Escalation** | Recipient: `<ALERT_RECIPIENT>`, Endpoint: `<ALERT_DESTINATION>`, Escalation: `<ESCALATION_CONTACT>` | Level 2 emergency escalation | `REQUIRES CONTRACT / CLIENT AGREEMENT` (Must test alert destination before sign-off) |
| **7. Agreed RPO (Recovery Point)** | Defines target maximum data loss: `<AGREED_RPO>` | Configures backup frequency | `REQUIRES CONTRACT / CLIENT AGREEMENT` |
| **8. Agreed RTO (Recovery Time)** | Defines target restore duration: `<AGREED_RTO>` | Executes restore runbook | `REQUIRES CONTRACT / CLIENT AGREEMENT` |
| **9. Support Hours & SLA** | Operational contact within working hours | Level 2 response within agreed SLA | `REQUIRES CONTRACT / CLIENT AGREEMENT` |
| **10. Maintenance & Update Policy** | Approves scheduled maintenance windows | Executes verified updates | `REQUIRES CONTRACT / CLIENT AGREEMENT` |
| **11. Disaster Recovery Authorization** | Executive sign-off to initiate restore | Technical execution of DR runbook | `MANDATORY GATE` |
| **12. Restore Execution Ownership** | Approves restored data acceptance | Executes `07-BACKUP-AND-DR.md` | `MANDATORY GATE` |
| **13. Hardware Replacement Policy** | Facility physical custody & procurement | Re-provisions bridge via runbooks | `REQUIRES CONTRACT / CLIENT AGREEMENT` |
| **14. Data Export Responsibility** | Requests export / owns exported files | Executes export extraction runbook | `MANDATORY GATE` |
| **15. Contract Exit & Decommissioning** | Formally terminates service & requests wipe | Executes dedicated decommissioning | `REQUIRES CONTRACT / CLIENT AGREEMENT` |
| **16. Environment Reconstruction** | Authorizes replacement infrastructure | Executes full deployment suite | `MANDATORY GATE` |

---

## 4. Standard Operational Procedures for Lifecycle Events

### A. Protected Client Data Export Procedure
To produce a standalone export of client data for compliance, auditing, or contract exit without exposing plaintext records in public paths:
```bash
# 1. Allocate unique private temporary export directory (Fail-Closed)
EXPORT_DIR=$(mktemp -d /tmp/zk_export_XXXXXX) || { echo "ERROR: mktemp -d failed"; exit 1; }
chmod 700 "$EXPORT_DIR" || { echo "ERROR: chmod 700 failed"; rm -rf "$EXPORT_DIR"; exit 1; }

test -d "$EXPORT_DIR" && test ! -L "$EXPORT_DIR" && test "$(stat -c '%u' "$EXPORT_DIR")" = "$(id -u)" || {
  echo "ERROR: Invalid export directory validation. Aborting." >&2
  rm -rf "$EXPORT_DIR"
  exit 1
}

# 2. Generate database custom-format dump into private export directory:
cd /opt/attendance/zk-k14-commercial
DUMP_FILE="${EXPORT_DIR}/client_export_$(date +%Y%m%d_%H%M%S).dump"
docker compose --env-file .env.docker exec -T postgres pg_dump -U attendance_user -Fc attendance > "$DUMP_FILE"
chmod 600 "$DUMP_FILE"

# 3. Generate SHA-256 integrity checksum sidecar:
sha256sum "$DUMP_FILE" > "${DUMP_FILE}.sha256"

# 4. Optional: Generate CSV table exports for HR/auditing into private directory:
docker compose --env-file .env.docker exec -T postgres psql -U attendance_user -d attendance -c "
\copy \"User\" TO STDOUT WITH CSV HEADER;
" > "${EXPORT_DIR}/users_export.csv"
chmod 600 "${EXPORT_DIR}/users_export.csv"

echo "Export artifacts generated in private directory: ${EXPORT_DIR}"
echo "Transfer archive securely to client password vault/storage, confirm custody receipt, then delete: rm -rf \"${EXPORT_DIR}\""
```

### B. Hardware Replacement Protocol (Pi or K14 Failure)
1. **Terminal Hardware Failure (K14):**
   * Mount replacement ZKTeco K14 terminal.
   * Configure static IP parameters on device keypad matching `05-K14-CONNECTION.md`.
   * **Important Enrollment Note:** Replacement K14 requires separately restoring/re-enrolling terminal users and hardware configuration according to an authorized migration procedure. The bridge synchronization worker polls attendance logs and users from the hardware, but does not automatically push cloud user records into a blank terminal.
2. **Bridge Controller Failure (Raspberry Pi):**
   * Provision replacement Raspberry Pi following `04-RASPBERRY-PI-INSTALLATION.md`.
   * Re-assign device static IP and install approved Node.js runtime.
   * Retrieve existing `DEVICE_TOKEN` securely or generate new device token using `03-APPLICATION-PROVISIONING.md`.

### C. Full Environment Reconstruction Protocol
In case of catastrophic cloud infrastructure loss (e.g. VPS destruction), full environment reconstruction requires the following essential materials and runbooks:
1. **Required Reconstruction Materials:**
   * **Source Code:** Exact commercial branch commit or release tag.
   * **Protected Environment Configuration:** Restored `.env.docker` containing `POSTGRES_PASSWORD`, `JWT_SECRET`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`, and `APP_DOMAIN`.
   * **Backup Configuration:** Restored `.env.backup` containing Cloudflare R2 credentials and bucket parameters.
   * **Database Backup:** Verified PostgreSQL `.dump` custom archive from Cloudflare R2 and matching `.sha256` checksum.
   * **DNS & Domain Access:** Authorized registrar/DNS records pointing `<APP_DOMAIN>` to the new VPS public IP.
   * **Caddy & TLS Configuration:** Automatic HTTPS certificate generation handled via Caddy upon DNS resolution.
   * **Bridge Controller Environment:** On-site Raspberry Pi bridge `.env` and PM2 configuration.
   * **Terminal Hardware Configuration:** On-site ZKTeco K14 static IP, port, and biometric enrollment data.
   * **SSH Keys:** Client-specific Ed25519 administrative and emergency recovery keys.
   * **Tenant Policy Data:** Operational Shift definitions, artisan mappings, and regional settings.
2. **Execution Sequence:**
   * Provision fresh Cloud VPS following `01-PRE-DEPLOYMENT-CHECKLIST.md` and `02-VPS-INSTALLATION.md`.
   * Restore PostgreSQL database archive following `07-BACKUP-AND-DR.md`.
   * Execute full acceptance verification suite using `06-CLIENT-ACCEPTANCE-TEST.md`.

### D. Contract Termination & Decommissioning Governance (DESTRUCTIVE PROCEDURE)
> [!CAUTION]
> **DESTRUCTIVE PROCEDURE — DO NOT EXECUTE DURING NORMAL HANDOVER**
> 
> Permanent decommissioning and data erasure is a strictly controlled, separate destructive workflow. It must **NEVER** be executed during normal deployment, maintenance, or handover.
> 
> Destructive teardown may be executed ONLY after satisfying all 12 mandatory prerequisites:
> 1. Formal written contract termination received from client executive.
> 2. Separate written client authorization explicitly instructing permanent data destruction.
> 3. Exact client name, display slug, and environment identification verified.
> 4. Exact VPS cloud server IP, hostname, and provider instance ID verified.
> 5. Exact Cloudflare R2 backup bucket and client prefix (`client-<CLIENT_SLUG>/`) verified.
> 6. Final comprehensive data export (Procedure A) executed and verified.
> 7. SHA-256 integrity checksum verification completed on export package.
> 8. Authorized client representative confirms receipt and custody of export package.
> 9. Legal, regulatory, and tax data retention obligations reviewed and satisfied.
> 10. Rollback and restore requirement explicitly waived in writing by client executive.
> 11. Destructive execution plan reviewed and signed off by lead engineer.
> 12. Two-person authorization confirmed prior to issuing cloud instance termination commands.
> 
> *When all 12 gates are satisfied, execute data destruction using a dedicated, separately authorized Decommissioning Runbook with exact client-scoped parameters.*

---

## 5. Formal Client Acceptance Certificate

```
================================================================================
                    COMMERCIAL ATTENDANCE SYSTEM
                    FINAL CLIENT ACCEPTANCE CERTIFICATE
================================================================================

CLIENT INFORMATION:
Company Legal Name:   <CLIENT_NAME>
Operational Domain:   https://<APP_DOMAIN>
Installation Site:    <PHYSICAL_LOCATION>
Installation Date:    _____ / _____ / 2026

DELIVERABLES VERIFIED & ACCEPTED:
[  ] 1. Cloud Web Dashboard operational over secure HTTPS (TLS Certificate Active).
[  ] 2. ZKTeco K14 Biometric Terminal installed, cabled, and communicating with Bridge.
[  ] 3. Raspberry Pi Bridge operational with automated background synchronization.
[  ] 4. Test fingerprint punch successfully recorded, ingested, and displayed on Dashboard.
[  ] 5. Timezone accuracy verified (Africa/Casablanca local time matching physical punches).
[  ] 6. Daily automated backup and off-site Cloudflare R2 replication verified.
[  ] 7. Primary Administrator account active and administrative credentials received securely.
[  ] 8. Administrator user guide and training delivered to client representative.
[  ] 9. Operational Handover Gating Matrix and responsibilities formally agreed.

CLIENT SIGN-OFF:

Client Representative: _______________________________________________________

Title / Role:          _______________________________________________________

Signature:             _____________________________    Date: ________________

DEPLOYMENT ENGINEER:

Lead Engineer:         _______________________________________________________

Signature:             _____________________________    Date: ________________

================================================================================
```
