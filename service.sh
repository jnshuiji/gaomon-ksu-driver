#!/system/bin/sh
#
# Gaomon Tablet Driver, Power Manager & PenCursor Daemon - Late-start Service
# Executed by KernelSU in service.sh mode (runs in background during boot).
#

MODDIR="${0%/*}"
LOG_TAG="GaomonKsuDriver"
DAEMON_BIN="$MODDIR/bin/pencursor"
CONFIG_FILE="$MODDIR/config.conf"

log_info() {
    log -t "$LOG_TAG" -p i "$1"
}

is_cfg_disabled() {
    key="$1"
    if [ -f "$CONFIG_FILE" ]; then
        grep -qE "^[[:space:]]*${key}[[:space:]]*=[[:space:]]*(0|false|no|off)[[:space:]]*$" "$CONFIG_FILE" 2>/dev/null
        return $?
    fi
    return 1
}

# Wait for Android system boot completion
until [ "$(getprop sys.boot_completed)" = "1" ]; do
    sleep 2
done

log_info "Boot completed. Initializing Gaomon OTG persistence and PenCursor daemon..."

# Ensure OEM OTG support property is enabled in system settings unless disabled in config.conf
if ! is_cfg_disabled "enforce_oplus_otg_switch"; then
    settings put global persist.sys.oplus.otg_support 1 2>/dev/null
fi

# Terminate any stale daemon instance before starting supervisor
pkill -9 -x "pencursor" 2>/dev/null || true

if [ -x "$DAEMON_BIN" ]; then
    log_info "PenCursor KernelSU daemon supervisor started (config: $CONFIG_FILE)."
    while true; do
        if [ -f "$MODDIR/remove" ]; then
            log_info "Module marked for removal. Stopping PenCursor supervisor."
            break
        fi
        if [ -f "$MODDIR/disable" ] || is_cfg_disabled "daemon_enabled"; then
            sleep 5
            continue
        fi
        "$DAEMON_BIN" --config "$CONFIG_FILE" >/dev/null 2>&1
        sleep 3
    done
else
    log_info "Warning: $DAEMON_BIN not found or not executable."
fi
