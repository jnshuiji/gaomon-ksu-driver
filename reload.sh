#!/usr/bin/env bash
#
# Gaomon Tablet Driver & Power Manager - Live Hot-Reload Script
# Synchronizes module files to target device and rebinds input devices without rebooting.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_MODULE_DIR="/data/adb/modules/gaomon_ksu_driver"
TARGET_IDC_DIR="/data/system/devices/idc"
TMP_DIR="/data/local/tmp/gaomon_reload"

echo "[*] Pushing updated files to device temporary staging..."

adb shell "rm -rf '${TMP_DIR}' && mkdir -p '${TMP_DIR}/system/usr/idc'"

# Push all module files to staging area
adb push "${SCRIPT_DIR}/module.prop" "${TMP_DIR}/" >/dev/null
adb push "${SCRIPT_DIR}/system.prop" "${TMP_DIR}/" >/dev/null
adb push "${SCRIPT_DIR}/service.sh" "${TMP_DIR}/" >/dev/null
adb push "${SCRIPT_DIR}/post-fs-data.sh" "${TMP_DIR}/" >/dev/null
adb push "${SCRIPT_DIR}/customize.sh" "${TMP_DIR}/" >/dev/null
adb push "${SCRIPT_DIR}/uninstall.sh" "${TMP_DIR}/" >/dev/null

for idc in "${SCRIPT_DIR}/system/usr/idc"/*.idc; do
    fname="$(basename "$idc")"
    adb push "$idc" "${TMP_DIR}/system/usr/idc/${fname}" >/dev/null
done

# Generate staging apply script
cat << 'EOF' > "${SCRIPT_DIR}/.device_apply.sh"
#!/system/bin/sh
set -e

TMP_DIR="/data/local/tmp/gaomon_reload"
TARGET_MODULE_DIR="/data/adb/modules/gaomon_ksu_driver"
TARGET_IDC_DIR="/data/system/devices/idc"

echo "[+] Applying updated files to KernelSU module and system..."
mkdir -p "${TARGET_MODULE_DIR}/system/usr/idc"
mkdir -p "${TARGET_IDC_DIR}"

cp -f "${TMP_DIR}/module.prop" "${TARGET_MODULE_DIR}/"
cp -f "${TMP_DIR}/system.prop" "${TARGET_MODULE_DIR}/"
cp -f "${TMP_DIR}/service.sh" "${TARGET_MODULE_DIR}/"
cp -f "${TMP_DIR}/post-fs-data.sh" "${TARGET_MODULE_DIR}/"
cp -f "${TMP_DIR}/customize.sh" "${TARGET_MODULE_DIR}/"
cp -f "${TMP_DIR}/uninstall.sh" "${TARGET_MODULE_DIR}/"

chmod 0755 "${TARGET_MODULE_DIR}"/*.sh

# Copy updated IDC files to module directory and active fallback path
for idc in "${TMP_DIR}/system/usr/idc"/*.idc; do
    fname=$(basename "$idc")
    cp -f "$idc" "${TARGET_MODULE_DIR}/system/usr/idc/${fname}"
    cp -f "$idc" "${TARGET_IDC_DIR}/${fname}"
    chmod 0644 "${TARGET_MODULE_DIR}/system/usr/idc/${fname}"
    chmod 0644 "${TARGET_IDC_DIR}/${fname}"
    chown system:system "${TARGET_IDC_DIR}/${fname}" 2>/dev/null || true
done

rm -rf "${TMP_DIR}"

echo "[+] Applying runtime USB power configuration..."
if [ -w "/sys/module/usbcore/parameters/autosuspend" ]; then
    echo -1 > /sys/module/usbcore/parameters/autosuspend
fi
settings put global persist.sys.oplus.otg_support 1 2>/dev/null || true

# Rebind USB devices to force EventHub to reload updated IDC
echo "[+] Triggering device rebind to reload IDC..."
reloaded=0
for dev in /sys/bus/usb/devices/*; do
    if [ -f "$dev/idVendor" ] && [ -f "$dev/idProduct" ]; then
        vid=$(cat "$dev/idVendor" 2>/dev/null || true)
        pid=$(cat "$dev/idProduct" 2>/dev/null || true)
        if [ "$vid" = "256c" ] && [ "$pid" = "0064" ]; then
            devname=$(basename "$dev")
            echo on > "$dev/power/control" 2>/dev/null || true
            echo -1 > "$dev/power/autosuspend_delay_ms" 2>/dev/null || true
            echo "$devname" > /sys/bus/usb/drivers/usb/unbind 2>/dev/null || true
            sleep 0.5
            echo "$devname" > /sys/bus/usb/drivers/usb/bind 2>/dev/null || true
            echo "[+] Rebound USB device: $devname"
            reloaded=1
        fi
    fi
done

if [ "$reloaded" -eq 0 ]; then
    echo "[!] Tablet is currently not connected via USB. The new configuration will automatically apply upon connection."
fi

# Restart background service monitor
pkill -f "service.sh" 2>/dev/null || true
nohup sh "${TARGET_MODULE_DIR}/service.sh" </dev/null >/dev/null 2>&1 &

echo "[+] Live hot-reload completed successfully."
EOF

adb push "${SCRIPT_DIR}/.device_apply.sh" "/data/local/tmp/device_apply.sh" >/dev/null
rm -f "${SCRIPT_DIR}/.device_apply.sh"

adb shell "su -c 'sh /data/local/tmp/device_apply.sh && rm -f /data/local/tmp/device_apply.sh'"
