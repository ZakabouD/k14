# 03 — APPLICATION PROVISIONING
# Tenant Settings, Device Authorization & Shift Configuration

This guide details the procedure for verifying tenant configuration, authorizing on-site biometric devices via the canonical provisioning CLI, and configuring operational shifts in the commercial attendance platform.

---

## 1. SystemSettings & Initial Seed Verification

During initial container startup, the `migrate` service executes Prisma migrations and `src/scripts/seed.ts`. This populates the singleton `SystemSettings` row with company metadata and regional settings.

> [!IMPORTANT]
> **Seed Scope Boundary:**
> `src/scripts/seed.ts` creates **ONLY** the singleton `SystemSettings` record. It does **NOT** create default shifts or employee records. Shifts must be explicitly created via the authenticated dashboard interface.

### Verification Command (via Docker Compose):
```bash
cd /opt/attendance/zk-k14-commercial

docker compose --env-file .env.docker exec postgres psql -U attendance_user -d attendance -x -c "
SELECT \"id\", \"companyName\", \"adminEmail\", \"timezone\", \"currency\", \"gracePeriod\" 
FROM \"SystemSettings\";
"
```

### Expected Output:
```text
-[ RECORD 1 ]+------------------
id          | singleton
companyName | <CLIENT_DISPLAY_NAME>
adminEmail  | <ADMIN_EMAIL>
timezone    | Africa/Casablanca
currency    | DH
gracePeriod | 15
```

---

## 2. Canonical Biometric Device Provisioning

Every on-site Raspberry Pi bridge connects to the cloud API using an authorized `DEVICE_ID` and a pre-shared cryptographic `DEVICE_TOKEN`.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Technician prepares private capture file (Mode 600, umask 077)           │
│ 2. Executes canonical provisioning CLI:                                     │
│    npm run docker:device:create -- --id ... --name ... > "$CAPTURE_FILE"   │
│    (Executes ts-node src/scripts/device-create.ts inside migrator container)│
└───────────────────────┬───────────────────────────────┬─────────────────────┘
                        │                               │
                        ▼ (Computes SHA-256 Hash)       ▼ (Redirects raw token to private file)
┌─────────────────────────────────┐           ┌─────────────────────────┐
│ Cloud PostgreSQL Database       │           │ On-Site Raspberry Pi    │
│ Device.tokenHash = sha256(TOKEN)│           │ DEVICE_TOKEN in .env    │
│ (Raw token NEVER stored in DB)  │           │ (Mode 600, root/admin)  │
└─────────────────────────────────┘           └─────────────────────────┘
```

### Protected Provisioning Execution Protocol:

> [!WARNING]
> **CRITICAL SECRET CUSTODY & TOKEN PROTECTION CONTRACT:**
> 1. **Private Session Requirement:** Execute only in a private terminal session with shell tracing disabled (`set +x`), no active screen/terminal recording, no shared session logging (e.g. shared tmux/screen logs), and no transcript capture tools.
> 2. **Token Generation Event (Source Contract):** `src/scripts/device-create.ts` generates a 64-character random hex token, stores its SHA-256 hash in PostgreSQL, and prints the raw plaintext token to stdout. **Do NOT run this command directly to open terminal stdout or copy/paste raw tokens into chat transcripts, issue tickets, or shared documentation.**
> 3. **Token Rotation on Re-Run:** Executing this command with an existing `<DEVICE_ID>` **ROTATES** the token in the database.
> 4. **Do Not Run for Inspection:** Never run `device:create` merely to "check" if a device exists. Use the safe inspection query below instead.

```bash
cd /opt/attendance/zk-k14-commercial

# Fail-Closed Device Provisioning & Token Capture Workflow
(
  umask 077
  set +x

  TOKEN_CAPTURE_FILE=""

  cleanup_token_cap() {
    [ -n "$TOKEN_CAPTURE_FILE" ] && [ -f "$TOKEN_CAPTURE_FILE" ] && rm -f "$TOKEN_CAPTURE_FILE"
  }
  trap cleanup_token_cap ERR

  # Step 1: Prepare unique private capture file before execution
  TOKEN_CAPTURE_FILE=$(mktemp ~/.zk_token_cap.XXXXXX) || { echo "ERROR: mktemp failed for token capture file" >&2; exit 1; }
  chmod 600 "$TOKEN_CAPTURE_FILE" || { echo "ERROR: chmod failed on token capture file" >&2; exit 1; }

  # Validate regular file, ownership, mode, and no symlinks
  if [ ! -f "$TOKEN_CAPTURE_FILE" ] || [ -L "$TOKEN_CAPTURE_FILE" ] || [ ! -O "$TOKEN_CAPTURE_FILE" ]; then
    echo "ERROR: Invalid token capture file permissions/ownership. Aborting." >&2
    exit 1
  fi

  # Step 2: Execute provisioning CLI with stdout/stderr redirected to private capture file
  npm run docker:device:create -- --id "DEV-<CLIENT_SLUG>-K14-01" --name "Pointeuse Principale K14" > "$TOKEN_CAPTURE_FILE" 2>&1 || {
    echo "ERROR: Device provisioning command failed (exit non-zero). Inspecting error without secret exposure:" >&2
    head -n 5 "$TOKEN_CAPTURE_FILE" >&2
    exit 1
  }

  # Verify capture file is non-empty
  if [ ! -s "$TOKEN_CAPTURE_FILE" ]; then
    echo "ERROR: Token capture file is empty after provisioning execution. Halting." >&2
    exit 1
  fi

  echo "Device provisioning succeeded. Raw output captured to private file: ${TOKEN_CAPTURE_FILE}"
  echo "Transfer token to on-site Raspberry Pi bridge vault, confirm recipient custody, then delete immediately:"
  echo "  rm -f \"${TOKEN_CAPTURE_FILE}\""
)
```

### Safe Device Inspection (Excludes Sensitive Hashes):
```bash
docker compose --env-file .env.docker exec postgres psql -U attendance_user -d attendance -x -c "
SELECT \"id\", \"deviceId\", \"name\", \"isActive\", \"lastHeartbeat\", \"lastSeenAt\", \"syncStatus\", \"createdAt\" 
FROM \"Device\" WHERE \"deviceId\" = 'DEV-<CLIENT_SLUG>-K14-01';
"
```
* **Pass Criteria:** Record exists with `isActive: true` and non-null `deviceId`. (Note: `tokenHash` is deliberately excluded from inspection output).

> [!NOTE]
> **Single-Terminal Architecture Constraint:**
> The database schema enforces punch deduplication via `@@unique([zktecoUserId, recordTime])` on `RawPunch`. There is no `deviceId` column in `RawPunch`. Multi-terminal deployments with overlapping employee IDs are unsupported without an architectural schema change.

---

## 3. Shift Creation & Personnel Assignment

Operational shifts must be explicitly created through the authenticated dashboard:

1. Log in to the web dashboard at `https://<APP_DOMAIN>` using `<ADMIN_EMAIL>`.
2. Navigate to **Gestion des Horaires** (`/shifts`).
3. Click **Ajouter un Shift** and configure the client's approved parameters:
   * **Nom du Shift:** e.g. `Shift Standard`
   * **Heure de Début:** e.g. `08:00`
   * **Heure de Fin:** e.g. `17:00`
   * **Heures de Base:** e.g. `8.0`
   * **Pause Déjeuner (min):** e.g. `60` *(Schema default is `0` minutes)*
   * **Tolérance de Retard (min):** e.g. `15`
   * **Heures Samedi:** e.g. `4.0`
   * **Fermeture Automatique:** `Désactivé` *(Default `false`)*
4. Navigate to **Gestion des Artisans** (`/artisans`) to assign employees to their respective shifts.

### Verification of Created Shifts:
```bash
docker compose --env-file .env.docker exec postgres psql -U attendance_user -d attendance -c "
SELECT \"id\", \"name\", \"startTime\", \"endTime\", \"baseHours\", \"lunchBreak\", \"gracePeriod\", \"saturdayHours\" 
FROM \"Shift\";
"
```

---

## 4. Backup Tenant Configuration (`.env.backup`)

### Step 1: Write Non-Sensitive Base Configuration (With Path & Precedence Validation)
Create `/opt/attendance/zk-k14-commercial/.env.backup` with strict permissions and non-sensitive parameters:

```bash
ENV_BACKUP_FILE="/opt/attendance/zk-k14-commercial/.env.backup"

# If file exists, validate path safety before modification:
if [ -e "$ENV_BACKUP_FILE" ]; then
  if [ ! -f "$ENV_BACKUP_FILE" ] || [ -L "$ENV_BACKUP_FILE" ] || [ ! -O "$ENV_BACKUP_FILE" ]; then
    echo "ERROR: Existing .env.backup has invalid file type, is a symlink, or wrong ownership. Halting." >&2
    exit 1
  fi
fi

(
  umask 077
  touch "$ENV_BACKUP_FILE" || { echo "ERROR: Cannot create .env.backup"; exit 1; }
  chmod 600 "$ENV_BACKUP_FILE" || { echo "ERROR: chmod 600 failed on .env.backup"; exit 1; }
)

cat << 'EOF' > /opt/attendance/zk-k14-commercial/.env.backup
# Cloudflare R2 Off-Site Backup Configuration
BACKUP_REMOTE_ENABLED=true
BACKUP_CLIENT_ID=client-<CLIENT_SLUG>
R2_BUCKET=zk-k14-commercial-backups
R2_ENDPOINT=https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
BACKUP_REMOTE_RETENTION_DAYS=30
EOF
```

### Step 2: Protected R2 Secret Credential Injection (Fail-Closed)
> [!WARNING]
> **R2 Secret Protection:**
> * Never paste raw R2 Access Keys or Secret Access Keys into reusable heredoc templates, scripts, or shared chat channels.
> * Inject credentials using silent interactive prompts into pre-validated `.env.backup`:

```bash
# Validate destination file before secret write
ENV_BACKUP_FILE="/opt/attendance/zk-k14-commercial/.env.backup"
if [ ! -f "$ENV_BACKUP_FILE" ] || [ -L "$ENV_BACKUP_FILE" ] || [ ! -O "$ENV_BACKUP_FILE" ]; then
  echo "ERROR: Destination file $ENV_BACKUP_FILE is invalid or insecure. Aborting secret write." >&2
  exit 1
fi

set +x

# Protected Silent Interactive Input:
read -s -r -p "Enter R2_ACCESS_KEY_ID: " R2_KEY_ID
echo ""
read -s -r -p "Enter R2_SECRET_ACCESS_KEY: " R2_SECRET_KEY
echo ""

(
  umask 077
  printf "R2_ACCESS_KEY_ID=%s\n" "$R2_KEY_ID" >> "$ENV_BACKUP_FILE" || { echo "ERROR: Failed writing R2_ACCESS_KEY_ID"; exit 1; }
  printf "R2_SECRET_ACCESS_KEY=%s\n" "$R2_SECRET_KEY" >> "$ENV_BACKUP_FILE" || { echo "ERROR: Failed writing R2_SECRET_ACCESS_KEY"; exit 1; }
  chmod 600 "$ENV_BACKUP_FILE" || { echo "ERROR: chmod 600 failed on $ENV_BACKUP_FILE"; exit 1; }
)
unset R2_KEY_ID R2_SECRET_KEY
```

> [!NOTE]
> **R2 Security & Storage Boundaries:**
> * **Storage Encryption:** Cloudflare R2 provider-level storage encryption is relied upon as a provider property; this repository does not configure independent application-level client-side encryption.
> * **Transport:** All backup replication occurs over HTTPS/TLS.
> * **Prefix Scope:** The `BACKUP_CLIENT_ID` (`client-<CLIENT_SLUG>`) provides logical directory organization within the bucket, not cryptographic credential-level isolation.

### Step 3: Safe Credential Presence Verification (Without Value Exposure):
```bash
# Verify non-empty credential presence and permissions:
test -n "$(grep -E '^R2_ACCESS_KEY_ID=.+' /opt/attendance/zk-k14-commercial/.env.backup)" || { echo "ERROR: R2_ACCESS_KEY_ID missing"; exit 1; }
test -n "$(grep -E '^R2_SECRET_ACCESS_KEY=.+' /opt/attendance/zk-k14-commercial/.env.backup)" || { echo "ERROR: R2_SECRET_ACCESS_KEY missing"; exit 1; }
echo "R2 Credentials: OK (Configured & Protected)"
ls -la /opt/attendance/zk-k14-commercial/.env.backup
```

---

## 5. Provisioning Verification Summary

| Item | Component | Verification Command | Expected Result |
| :--- | :--- | :--- | :--- |
| **5.1** | `SystemSettings` | `SELECT count(*) FROM "SystemSettings"` | Exactly `1` row |
| **5.2** | `Device` | `SELECT "deviceId", "isActive" FROM "Device"` | `DEV-<CLIENT_SLUG>-K14-01` (`true`) |
| **5.3** | `Shift` | `SELECT count(*) FROM "Shift"` | $\ge 1$ shift configured via UI |
| **5.4** | `.env.backup` | `ls -la /opt/attendance/zk-k14-commercial/.env.backup` | Mode `-rw-------` (`600`), owned by operator |
