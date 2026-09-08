# 00 — CLIENT INFORMATION FORM
# Commercial Attendance Deployment Intake

This document serves as the mandatory pre-deployment intake questionnaire for every new commercial client installation. All `REQUIRED` fields must be completed and validated before scheduling deployment.

---

## 1. Client Identity & Legal Entity (Morocco)

| Field | Description | Status | Value / Target |
| :--- | :--- | :--- | :--- |
| **Legal Company Name** | Full registered legal entity name | `REQUIRED` | `<CLIENT_NAME>` |
| **ICE / RC Number** | Moroccan Identifiant Commun de l'Entreprise / Registre du Commerce | `REQUIRED` | `<CLIENT_ICE> / <CLIENT_RC>` |
| **Display Name** | Name displayed on dashboard header & reports | `REQUIRED` | `<CLIENT_DISPLAY_NAME>` |
| **Client Slug** | Lowercase alphanumeric identifier for hostnames and prefixes | `REQUIRED` | `<CLIENT_SLUG>` *(e.g. `acme-corp`)* |
| **Application Domain** | Fully qualified domain for web application (`APP_DOMAIN`) | `REQUIRED` | `<APP_DOMAIN>` *(e.g. `pointage.acme.ma`)* |
| **Physical Installation Address** | Physical facility address where K14 will be mounted | `REQUIRED` | `<PHYSICAL_LOCATION>` |
| **Primary Timezone** | IANA timezone identifier | `REQUIRED` | `Africa/Casablanca` |
| **Default Currency** | Currency symbol displayed in payroll and costing | `REQUIRED` | `DH` |
| **Default Language** | Primary user interface language | `REQUIRED` | `fr-FR` |
| **Company Logo** | Vector SVG or high-res PNG for dashboard header | `OPTIONAL` | `logo.png` |

---

## 2. Administrative & Operational Contacts

| Field | Description | Status | Value / Target |
| :--- | :--- | :--- | :--- |
| **Primary Administrator Full Name** | Full name of primary HR / IT manager | `REQUIRED` | `<ADMIN_FULL_NAME>` |
| **Primary Administrator Email** | Initial superadmin login email (`ADMIN_EMAIL`) | `REQUIRED` | `<ADMIN_EMAIL>` |
| **HR Operations Contact** | Secondary contact for attendance rule configuration | `OPTIONAL` | `<HR_CONTACT_NAME> / <HR_CONTACT_EMAIL>` |
| **On-Site IT / Network Contact** | Contact with physical access to router and electrical outlet | `REQUIRED` | `<IT_CONTACT_NAME> / <IT_CONTACT_PHONE>` |

---

## 3. Work Schedule, Shifts & Attendance Policy

Attendance rules, overtime multipliers, and rounding policies are structured into three distinct categories:

### A. Application Baseline Defaults (Pre-configured in Source/Schema)
* **Default Base Hours:** `8.0` hours
* **Default Saturday Hours:** `4.0` hours
* **Default Arrival Grace Period:** `15` minutes
* **Default Lunch Break Deduction:** `0` minutes *(Schema `@default(0)`; configurable per shift)*
* **Default Overtime Tier 1 Limit:** `2.0` hours *(Configurable in SystemSettings)*
* **Default Overtime Tier 1 Multiplier:** `1.50` (150%)
* **Default Overtime Tier 2 Multiplier:** `2.00` (200%)

### B. Client Policy Decisions (Configured during Onboarding)
* **Working Days:** `____________________` *(e.g. Monday – Friday or Monday – Saturday)*
* **Shift Start / End Time:** `____________________` *(e.g. 08:00 – 17:00; created via dashboard `/shifts`)*
* **Unexcused Delay Policy:** `____________________` *(e.g. Round up to next full hour)*
* **Custom Lunch Deduction:** `____________________` *(e.g. 60 minutes if daily duration > 5h)*
* **Ramadan Working Hours:** `____________________` *(e.g. 09:00 – 15:00 continuous shift)*

### C. Legally Validated Requirements (Requires Client / Legal Validation)
* **Statutory Overtime Qualification:** Requires client/legal validation against applicable Moroccan labor regulations.
* **Public Holiday Compensation:** Requires client/legal validation.
* **Night Shift Policies:** Requires client/legal validation where operational.

---

## 4. Employee Mapping & Matricule Convention

| Field | Description | Status | Value / Target |
| :--- | :--- | :--- | :--- |
| **Estimated Employee Count** | Total personnel to be enrolled on terminal | `REQUIRED` | `<TOTAL_EMPLOYEES>` |
| **HR Matricule Format** | Internal company payroll ID format (e.g. `EMP001`, `MAT-105`) | `REQUIRED` | `<MATRICULE_FORMAT>` |
| **K14 User ID Range** | Numeric IDs assigned on physical terminal (`1` to `9999`) | `REQUIRED` | `1` to `<MAX_ID>` |
| **Matricule ↔ K14 Mapping** | Mapping sheet prepared prior to enrollment | `REQUIRED` | `[  ] Prepared` |

---

## 5. Hardware & Network Topology Parameters

> [!NOTE]
> **Single Terminal Baseline:**
> The validated deployment architecture supports **exactly one K14 terminal per client**. Multi-terminal installations require a separate architectural validation phase.

| Parameter | Description | Status | Value / Collected Parameter |
| :--- | :--- | :--- | :--- |
| **Terminal Device ID** | Canonical cloud device identifier | `REQUIRED` | `DEV-<CLIENT_SLUG>-K14-01` |
| **Terminal Serial Number** | Hardware serial from device sticker/menu | `REQUIRED` | `<K14_SERIAL_NUMBER>` |
| **Terminal Physical Location** | Wall mounting location (e.g. Reception, Gate) | `REQUIRED` | `<PHYSICAL_LOCATION>` |
| **K14 Isolated Subnet** | Dedicated IPv4 subnet for Pi ↔ K14 link | `REQUIRED` | `<K14_SUBNET>` *(e.g. `192.168.100.0/24`)* |
| **Terminal Static IP** | IP assigned on physical K14 terminal | `REQUIRED` | `<K14_IP>` *(e.g. `192.168.100.201`)* |
| **Terminal Netmask** | Netmask assigned on physical K14 terminal | `REQUIRED` | `<K14_NETMASK>` *(e.g. `255.255.255.0`)* |
| **Terminal Gateway** | Gateway on K14 menu | `REQUIRED` | `0.0.0.0` *(No internet gateway)* |
| **Terminal Protocol Port** | Standalone protocol port | `REQUIRED` | `4370` |
| **Bridge Raspberry Pi Hostname** | Network hostname for bridge controller | `REQUIRED` | `attendance-<CLIENT_SLUG>-pi` |
| **Bridge Uplink Interface** | Wi-Fi or site LAN interface for cloud API | `REQUIRED` | `<PI_UPLINK_INTERFACE>` *(e.g. `wlan0`)* |
| **Bridge K14 Interface** | Direct Ethernet interface to K14 | `REQUIRED` | `<PI_K14_INTERFACE>` *(e.g. `eth0`)* |
| **Bridge Static IP on K14 Port** | IP assigned to Pi on `<PI_K14_INTERFACE>` | `REQUIRED` | `<PI_K14_IP>` *(e.g. `192.168.100.10`)* |
| **NetworkManager Profile UUID** | UUID of Ethernet connection profile on Pi | `COLLECTED ON PI` | `<NETWORKMANAGER_PROFILE_UUID>` |
| **Site Wi-Fi SSID** | On-site Wi-Fi network name for bridge uplink | `REQUIRED` | `<SITE_WIFI_SSID>` |
| **Site Wi-Fi Password** | WPA2/WPA3 passphrase | `REQUIRED` | *Entered interactively on-site (never recorded in shell history or documents)* |

---

## 6. Cloud Infrastructure & Backup Destination

| Field | Description | Status | Value / Target |
| :--- | :--- | :--- | :--- |
| **VPS Cloud Provider** | Hosting provider (e.g. OVHcloud, Hetzner, Scaleway) | `REQUIRED` | `<VPS_PROVIDER>` |
| **VPS Public IPv4** | Static server IP address | `REQUIRED` | `<VPS_IP>` |
| **VPS Operating System** | Clean Linux server image | `REQUIRED` | `Ubuntu 24.04 LTS (Target Policy)` |
| **SSH Administrator User** | Default non-root deployer user | `REQUIRED` | `ubuntu` |
| **DNS Management Provider** | Authoritative DNS provider (e.g. Cloudflare) | `REQUIRED` | `<DNS_PROVIDER>` |
| **Cloudflare R2 Bucket Name** | Unified off-site backup storage bucket *(Provider storage encryption relied upon; transport TLS active; no app-level client-side encryption)* | `REQUIRED` | `zk-k14-commercial-backups` |
| **R2 Client Prefix** | Logical directory path in bucket *(Logical organization only, not cryptographic tenant isolation)* | `GENERATED` | `client-<CLIENT_SLUG>/postgres/` |
| **R2 Remote Retention** | Days of off-site daily backups preserved | `REQUIRED` | `30` days |

---

## 7. Legal & Personal Data Protection Notice (Moroccan Law 09-08 / CNDP)

> [!WARNING]
> **Client / Data Controller Responsibility — Requires Client/Legal Validation:**
> * The client acts as the **Data Controller** under Moroccan Law 09-08 relating to the protection of personal data.
> * Deploying biometric time-and-attendance hardware requires client/legal validation regarding employee notifications, internal workplace proportionality, and applicable declarations/authorizations with the Commission Nationale de contrôle de la protection des Données à caractère Personnel (CNDP).
> * The attendance software platform and deployment engineering team provide technical infrastructure and tools, not legal advice or certification. Compliance with labor and data protection laws is the client's responsibility.
