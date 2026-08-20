#!/usr/bin/env bash
# ==============================================================================
# Commercial Attendance Stack - Production Backup Scheduler Installer
# Installs/Manages automated daily backup schedule via systemd timer or cron
# Target: Daily at 03:00 Africa/Casablanca (Idempotent & non-destructive)
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

ACTION="${1:---help}"

show_help() {
    echo "Usage: $0 [--systemd | --cron | --status | --uninstall | --help]"
    echo ""
    echo "Commands:"
    echo "  --systemd    Install systemd timer and service (/etc/systemd/system)"
    echo "  --cron       Install cron entry with explicit Africa/Casablanca timezone"
    echo "  --status     Display current schedule status and next trigger time"
    echo "  --uninstall  Safely remove systemd or cron backup scheduling"
    echo "  --help       Show this help message"
    echo ""
}

check_status() {
    echo "============================================================"
    echo " Backup Schedule Status"
    echo " Repository: ${ROOT_DIR}"
    echo "============================================================"
    
    # 1. Check Systemd
    if command -v systemctl >/dev/null 2>&1; then
        if systemctl list-timers --all 2>/dev/null | grep -q "zk-commercial-backup.timer"; then
            echo "[+] Systemd Timer: INSTALLED & ACTIVE"
            systemctl list-timers zk-commercial-backup.timer --no-pager || true
        else
            echo "[-] Systemd Timer: NOT INSTALLED"
        fi
    else
        echo "[i] Systemd: NOT AVAILABLE on this operating system"
    fi

    # 2. Check Cron
    if command -v crontab >/dev/null 2>&1; then
        if crontab -l 2>/dev/null | grep -q "backup-full.sh\|npm run backup:full"; then
            echo "[+] Host Crontab: INSTALLED"
            crontab -l | grep "backup-full.sh\|npm run backup:full" || true
        else
            echo "[-] Host Crontab: NOT CONFIGURED"
        fi
    fi
    echo "============================================================"
}

install_systemd() {
    if ! command -v systemctl >/dev/null 2>&1; then
        echo "[-] ERROR: systemctl not found. This host does not use systemd. Use --cron instead." >&2
        exit 1
    fi

    if [[ "$(id -u)" -ne 0 ]]; then
        echo "[-] ERROR: Root privileges required to write to /etc/systemd/system. Please run with sudo." >&2
        exit 1
    fi

    echo "[+] Installing systemd backup service & timer (Daily 03:00 Africa/Casablanca)..."

    SERVICE_FILE="/etc/systemd/system/zk-commercial-backup.service"
    TIMER_FILE="/etc/systemd/system/zk-commercial-backup.timer"

    cat <<EOF > "${SERVICE_FILE}"
[Unit]
Description=Commercial Attendance Database Backup & Off-Site R2 Sync
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=${ROOT_DIR}
ExecStart=${ROOT_DIR}/scripts/backup-full.sh
StandardOutput=journal
StandardError=journal
SyslogIdentifier=zk-attendance-backup

[Install]
WantedBy=multi-user.target
EOF

    cat <<EOF > "${TIMER_FILE}"
[Unit]
Description=Daily Commercial Attendance Backup Timer (03:00 Africa/Casablanca)

[Timer]
OnCalendar=*-*-* 03:00:00 Africa/Casablanca
Persistent=true
RandomizedDelaySec=60

[Install]
WantedBy=timers.target
EOF

    chmod 644 "${SERVICE_FILE}" "${TIMER_FILE}"
    systemctl daemon-reload
    systemctl enable --now zk-commercial-backup.timer

    echo "[+] SUCCESS: systemd timer installed and activated."
    systemctl list-timers zk-commercial-backup.timer --no-pager
}

install_cron() {
    echo "[+] Configuring crontab with explicit Africa/Casablanca timezone..."
    
    NPM_BIN="$(command -v npm 2>/dev/null || echo "/usr/local/bin/npm")"
    CRON_LINE="CRON_TZ=Africa/Casablanca"
    CRON_JOB="0 3 * * * cd ${ROOT_DIR} && ${NPM_BIN} run backup:full >> /var/log/attendance-backup.log 2>&1"

    # Fetch existing crontab
    CURRENT_CRON="$(crontab -l 2>/dev/null || true)"

    # Remove previous attendance backup entries if already present to ensure idempotency
    CLEANED_CRON="$(echo "${CURRENT_CRON}" | grep -v "${ROOT_DIR}/scripts/backup-full.sh" | grep -v "zk-attendance-backup" | grep -v "npm run backup:full" || true)"

    # Append new entry
    NEW_CRON=$(cat <<EOF
${CLEANED_CRON}
# Attendance Daily Backup (03:00 Africa/Casablanca)
${CRON_LINE}
${CRON_JOB}
EOF
)
    echo "${NEW_CRON}" | crontab -
    echo "[+] SUCCESS: Crontab updated idempotently."
    crontab -l | grep "backup:full"
}

uninstall_schedule() {
    echo "[+] Uninstalling backup schedules..."

    # Uninstall Systemd
    if command -v systemctl >/dev/null 2>&1; then
        if [[ -f "/etc/systemd/system/zk-commercial-backup.timer" ]]; then
            if [[ "$(id -u)" -eq 0 ]]; then
                systemctl disable --now zk-commercial-backup.timer 2>/dev/null || true
                rm -f /etc/systemd/system/zk-commercial-backup.service /etc/systemd/system/zk-commercial-backup.timer
                systemctl daemon-reload
                echo "[+] Systemd timer removed."
            else
                echo "[-] Notice: Root privileges required to remove systemd units."
            fi
        fi
    fi

    # Uninstall Cron
    if command -v crontab >/dev/null 2>&1; then
        CURRENT_CRON="$(crontab -l 2>/dev/null || true)"
        if echo "${CURRENT_CRON}" | grep -q "backup:full\|backup-full.sh"; then
            CLEANED_CRON="$(echo "${CURRENT_CRON}" | grep -v "${ROOT_DIR}/scripts/backup-full.sh" | grep -v "zk-attendance-backup" | grep -v "npm run backup:full" | grep -v "CRON_TZ=Africa/Casablanca" || true)"
            echo "${CLEANED_CRON}" | crontab -
            echo "[+] Crontab entries removed."
        fi
    fi

    echo "[+] Schedule uninstall complete."
}

case "${ACTION}" in
    --status)
        check_status
        ;;
    --systemd)
        install_systemd
        ;;
    --cron)
        install_cron
        ;;
    --uninstall)
        uninstall_schedule
        ;;
    --help|*)
        show_help
        ;;
esac
