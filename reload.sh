#!/usr/bin/env bash
#
# Gaomon Tablet Driver, Power Manager & PenCursor Daemon - Live Hot-Reload Script
# Compiles the latest PenCursor Android daemon, synchronizes module files to the
# target device, rebinds USB input devices, and restarts the daemon without rebooting.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PENCURSOR_DIR="${SCRIPT_DIR}/pencursor"
DAEMON_TARGET_TRIPLE="aarch64-linux-android"
DAEMON_BIN_PATH="${PENCURSOR_DIR}/target/${DAEMON_TARGET_TRIPLE}/release/pencursor"
TMP_DIR="/data/local/tmp/gaomon_reload"
DEVICE_APPLY_PATH="/data/local/tmp/device_apply.sh"
LOCAL_APPLY_SCRIPT="$(mktemp)"
PUSHED_TO_DEVICE=0

cleanup() {
    rm -f "${LOCAL_APPLY_SCRIPT}"
    if [ "${PUSHED_TO_DEVICE}" -eq 1 ]; then
        adb shell "rm -rf '${TMP_DIR}' '${DEVICE_APPLY_PATH}'" >/dev/null 2>&1 || true
    fi
}
trap cleanup EXIT

echo "[*] 正在编译 PenCursor Android Daemon (${DAEMON_TARGET_TRIPLE})..."
(
    cd "${PENCURSOR_DIR}"
    cargo build --release --target "${DAEMON_TARGET_TRIPLE}"
)

echo "[*] 正在推送文件至设备 Staging 目录..."

PUSHED_TO_DEVICE=1
adb shell "rm -rf '${TMP_DIR}' && mkdir -p '${TMP_DIR}/bin' '${TMP_DIR}/system/usr/idc' '${TMP_DIR}/webroot'"

# Push runtime module files and compiled daemon binary to staging area
adb push "${SCRIPT_DIR}/module.prop" "${TMP_DIR}/" >/dev/null
adb push "${SCRIPT_DIR}/system.prop" "${TMP_DIR}/" >/dev/null
adb push "${SCRIPT_DIR}/config.conf" "${TMP_DIR}/" >/dev/null
adb push "${SCRIPT_DIR}/service.sh" "${TMP_DIR}/" >/dev/null
adb push "${SCRIPT_DIR}/post-fs-data.sh" "${TMP_DIR}/" >/dev/null
adb push "${SCRIPT_DIR}/uninstall.sh" "${TMP_DIR}/" >/dev/null
adb push "${DAEMON_BIN_PATH}" "${TMP_DIR}/bin/pencursor" >/dev/null
adb push "${SCRIPT_DIR}/webroot/." "${TMP_DIR}/webroot/" >/dev/null

for idc in "${SCRIPT_DIR}/system/usr/idc"/*.idc; do
    fname="$(basename "$idc")"
    adb push "$idc" "${TMP_DIR}/system/usr/idc/${fname}" >/dev/null
done

# Generate temporary staging apply script outside the repository working tree
cat << 'EOF' > "${LOCAL_APPLY_SCRIPT}"
#!/system/bin/sh
set -e

TMP_DIR="/data/local/tmp/gaomon_reload"
DEVICE_APPLY_PATH="/data/local/tmp/device_apply.sh"
TARGET_MODULE_DIR="/data/adb/modules/gaomon_ksu_driver"
TARGET_IDC_DIR="/data/system/devices/idc"

cleanup_device() {
    rm -rf "${TMP_DIR}" "${DEVICE_APPLY_PATH}" 2>/dev/null || true
}
trap cleanup_device EXIT

echo "[+] 正在更新 KernelSU Module、WebUI 与 IDC 文件..."
mkdir -p "${TARGET_MODULE_DIR}"
mkdir -p "${TARGET_IDC_DIR}"

# Terminate only this module's daemon and supervisor instances before updating files
pkill -9 -x "pencursor" 2>/dev/null || true
pkill -9 -f "${TARGET_MODULE_DIR}/service.sh" 2>/dev/null || true

# Clean up any installer-only or interrupted temporary files from the live module directory
rm -f "${TARGET_MODULE_DIR}/customize.sh" "${TARGET_MODULE_DIR}/config.conf.tmp" 2>/dev/null || true

cp -f "${TMP_DIR}/module.prop" "${TARGET_MODULE_DIR}/"
cp -f "${TMP_DIR}/system.prop" "${TARGET_MODULE_DIR}/"
if [ ! -f "${TARGET_MODULE_DIR}/config.conf" ]; then
    cp -f "${TMP_DIR}/config.conf" "${TARGET_MODULE_DIR}/config.conf"
    chmod 0644 "${TARGET_MODULE_DIR}/config.conf"
fi
cp -f "${TMP_DIR}/service.sh" "${TARGET_MODULE_DIR}/"
cp -f "${TMP_DIR}/post-fs-data.sh" "${TARGET_MODULE_DIR}/"
cp -f "${TMP_DIR}/uninstall.sh" "${TARGET_MODULE_DIR}/"

rm -rf "${TARGET_MODULE_DIR}/bin"
mkdir -p "${TARGET_MODULE_DIR}/bin"
cp -f "${TMP_DIR}/bin/pencursor" "${TARGET_MODULE_DIR}/bin/pencursor"

rm -rf "${TARGET_MODULE_DIR}/webroot"
mkdir -p "${TARGET_MODULE_DIR}/webroot"
cp -rf "${TMP_DIR}/webroot/." "${TARGET_MODULE_DIR}/webroot/"

chmod 0755 "${TARGET_MODULE_DIR}"/*.sh
chmod 0755 "${TARGET_MODULE_DIR}/bin/pencursor"
chmod -R 0755 "${TARGET_MODULE_DIR}/webroot"
find "${TARGET_MODULE_DIR}/webroot" -type f -exec chmod 0644 {} + 2>/dev/null || true

# Purge previously deployed module IDC fallbacks before syncing updated IDC files
if [ -d "${TARGET_MODULE_DIR}/system/usr/idc" ]; then
    for old_idc in "${TARGET_MODULE_DIR}/system/usr/idc"/*.idc; do
        [ -f "$old_idc" ] && rm -f "${TARGET_IDC_DIR}/${old_idc##*/}"
    done
fi
rm -rf "${TARGET_MODULE_DIR}/system/usr/idc"
mkdir -p "${TARGET_MODULE_DIR}/system/usr/idc"

for idc in "${TMP_DIR}/system/usr/idc"/*.idc; do
    if [ -f "$idc" ]; then
        fname="${idc##*/}"
        cp -f "$idc" "${TARGET_MODULE_DIR}/system/usr/idc/${fname}"
        cp -f "$idc" "${TARGET_IDC_DIR}/${fname}"
        chmod 0644 "${TARGET_MODULE_DIR}/system/usr/idc/${fname}"
        chmod 0644 "${TARGET_IDC_DIR}/${fname}"
        chown system:system "${TARGET_IDC_DIR}/${fname}" 2>/dev/null || true
    fi
done

CONF_FILE="${TARGET_MODULE_DIR}/config.conf"
is_cfg_disabled() {
    key="$1"
    [ -f "$CONF_FILE" ] && grep -qE "^[[:space:]]*${key}[[:space:]]*=[[:space:]]*(0|false|no|off)[[:space:]]*$" "$CONF_FILE" 2>/dev/null
}

TARGET_VID="256c"
TARGET_PID="0064"
if [ -f "$CONF_FILE" ]; then
    cfg_vid=$(grep -E '^[[:space:]]*usb_vid[[:space:]]*=' "$CONF_FILE" 2>/dev/null | head -n 1 | cut -d'=' -f2 | tr -d '[:space:]"'\''' | sed 's/^0[xX]//' | tr 'A-Z' 'a-z')
    cfg_pid=$(grep -E '^[[:space:]]*usb_pid[[:space:]]*=' "$CONF_FILE" 2>/dev/null | head -n 1 | cut -d'=' -f2 | tr -d '[:space:]"'\''' | sed 's/^0[xX]//' | tr 'A-Z' 'a-z')
    [ -n "$cfg_vid" ] && TARGET_VID="$cfg_vid"
    [ -n "$cfg_pid" ] && TARGET_PID="$cfg_pid"
fi

echo "[+] 正在应用 USB Power Runtime 配置..."
if ! is_cfg_disabled "disable_usbcore_autosuspend" && [ -w "/sys/module/usbcore/parameters/autosuspend" ]; then
    echo -1 > /sys/module/usbcore/parameters/autosuspend 2>/dev/null || true
fi
if ! is_cfg_disabled "enforce_oplus_otg_switch"; then
    settings put global persist.sys.oplus.otg_support 1 2>/dev/null || true
fi

# Rebind USB devices to force EventHub to reload updated IDC
echo "[+] 正在触发 USB Device Rebind 以重载 IDC..."
reloaded=0
for dev in /sys/bus/usb/devices/*; do
    if [ -f "$dev/idVendor" ] && [ -f "$dev/idProduct" ]; then
        vid=$(cat "$dev/idVendor" 2>/dev/null | tr -d '[:space:]' | tr 'A-Z' 'a-z')
        pid=$(cat "$dev/idProduct" 2>/dev/null | tr -d '[:space:]' | tr 'A-Z' 'a-z')
        if [ "$vid" = "$TARGET_VID" ] && [ "$pid" = "$TARGET_PID" ]; then
            devname=$(basename "$dev")
            if ! is_cfg_disabled "force_device_power_on"; then
                echo on > "$dev/power/control" 2>/dev/null || true
                echo -1 > "$dev/power/autosuspend_delay_ms" 2>/dev/null || true
            fi
            echo "$devname" > /sys/bus/usb/drivers/usb/unbind 2>/dev/null || true
            sleep 0.5
            echo "$devname" > /sys/bus/usb/drivers/usb/bind 2>/dev/null || true
            echo "[+] 已完成 USB Device Rebind: $devname"
            reloaded=1
        fi
    fi
done

if [ "$reloaded" -eq 0 ]; then
    echo "[!] 当前未检测到 USB 连接的 Tablet，配置将在连接时自动生效"
fi

# Restart background service & PenCursor daemon if module is enabled
if [ ! -f "${TARGET_MODULE_DIR}/disable" ] && [ ! -f "${TARGET_MODULE_DIR}/remove" ]; then
    nohup sh "${TARGET_MODULE_DIR}/service.sh" </dev/null >/dev/null 2>&1 &
fi

echo "[+] Live Hot-Reload 完成"
EOF

adb push "${LOCAL_APPLY_SCRIPT}" "${DEVICE_APPLY_PATH}" >/dev/null
adb shell "su -c 'sh ${DEVICE_APPLY_PATH}'"
PUSHED_TO_DEVICE=0
