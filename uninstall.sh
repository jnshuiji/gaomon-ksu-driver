#!/system/bin/sh
#
# Gaomon Tablet Driver, Power Manager & PenCursor Daemon - Uninstallation Script
# Executed by KernelSU / Magisk during module removal.
#

case "$0" in
    */*) MODDIR="$(cd "${0%/*}" 2>/dev/null && pwd)" ;;
    *) MODDIR="$(pwd)" ;;
esac
CONFIG_FILE="$MODDIR/config.conf"
IDC_DATA_DIR="/data/system/devices/idc"

# Stop only this module's PenCursor daemon and service supervisor
pkill -9 -x "pencursor" 2>/dev/null || true
pkill -9 -f "$MODDIR/service.sh" 2>/dev/null || true
pkill -9 -f "/data/adb/modules/gaomon_ksu_driver/service.sh" 2>/dev/null || true

# Clean up fallback IDC files deployed in /data/system/devices/idc
if [ -d "$IDC_DATA_DIR" ]; then
    for idc_file in "$MODDIR"/system/usr/idc/*.idc; do
        if [ -f "$idc_file" ]; then
            rm -f "$IDC_DATA_DIR/${idc_file##*/}"
        fi
    done
    rm -f "$IDC_DATA_DIR/Vendor_256c_Product_0064.idc"
    rm -f "$IDC_DATA_DIR/Vendor_256c_Product_0064_Version_0110.idc"
    rm -f "$IDC_DATA_DIR/GAOMON_Gaomon_Tablet_M8_Pen.idc"
    rmdir "$IDC_DATA_DIR" 2>/dev/null || true
fi

# Clean up any temporary hot-reload or staging files
rm -rf /data/local/tmp/gaomon_reload 2>/dev/null || true
rm -f /data/local/tmp/device_apply.sh 2>/dev/null || true
rm -f "$MODDIR/config.conf.tmp" 2>/dev/null || true

# Restore volatile kernel USB runtime power defaults immediately
if [ -w "/sys/module/usbcore/parameters/autosuspend" ]; then
    echo 2 > /sys/module/usbcore/parameters/autosuspend 2>/dev/null || true
fi

TARGET_VID="256c"
TARGET_PID="0064"
if [ -f "$CONFIG_FILE" ]; then
    cfg_vid=$(grep -E '^[[:space:]]*usb_vid[[:space:]]*=' "$CONFIG_FILE" 2>/dev/null | head -n 1 | cut -d'=' -f2 | tr -d '[:space:]"'\''' | sed 's/^0[xX]//' | tr 'A-Z' 'a-z')
    cfg_pid=$(grep -E '^[[:space:]]*usb_pid[[:space:]]*=' "$CONFIG_FILE" 2>/dev/null | head -n 1 | cut -d'=' -f2 | tr -d '[:space:]"'\''' | sed 's/^0[xX]//' | tr 'A-Z' 'a-z')
    [ -n "$cfg_vid" ] && TARGET_VID="$cfg_vid"
    [ -n "$cfg_pid" ] && TARGET_PID="$cfg_pid"
fi

for dev in /sys/bus/usb/devices/*; do
    if [ -f "$dev/idVendor" ] && [ -f "$dev/idProduct" ]; then
        vid=$(cat "$dev/idVendor" 2>/dev/null | tr -d '[:space:]' | tr 'A-Z' 'a-z')
        pid=$(cat "$dev/idProduct" 2>/dev/null | tr -d '[:space:]' | tr 'A-Z' 'a-z')
        if { [ "$vid" = "$TARGET_VID" ] && [ "$pid" = "$TARGET_PID" ]; } || { [ "$vid" = "256c" ] && [ "$pid" = "0064" ]; }; then
            echo auto > "$dev/power/control" 2>/dev/null || true
            echo 60000 > "$dev/power/autosuspend_delay_ms" 2>/dev/null || true
        fi
    fi
done
