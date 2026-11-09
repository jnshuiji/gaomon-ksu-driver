#!/system/bin/sh
#
# Gaomon Tablet Driver, Power Manager & PenCursor Daemon - Late-start Service
# Executed by KernelSU in service.sh mode (runs in background during boot).
#

MODDIR="${0%/*}"
LOG_TAG="GaomonKsuDriver"
DAEMON_BIN="$MODDIR/bin/pencursor"

log_info() {
    log -t "$LOG_TAG" -p i "$1"
}

# Wait for Android system boot completion
until [ "$(getprop sys.boot_completed)" = "1" ]; do
    sleep 2
done

log_info "Boot completed. Initializing Gaomon OTG persistence and PenCursor daemon..."

# Ensure OEM OTG support property is enabled in system settings
settings put global persist.sys.oplus.otg_support 1 2>/dev/null

# Terminate any stale daemon instance before starting supervisor
pkill -x "pencursord" 2>/dev/null || true

if [ -x "$DAEMON_BIN" ]; then
    (
        while true; do
            "$DAEMON_BIN" >/dev/null 2>&1
            sleep 3
        done
    ) &
    log_info "PenCursor KernelSU daemon supervisor started."
else
    log_info "Warning: $DAEMON_BIN not found or not executable."
fi
