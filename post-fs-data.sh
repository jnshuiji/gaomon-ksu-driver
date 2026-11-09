#!/system/bin/sh
#
# Gaomon Tablet Driver & Power Manager - post-fs-data initialization
# Executed by KernelSU in post-fs-data mode before zygote initialization.
#

MODDIR="${0%/*}"

# Ensure fallback IDC directory exists in /data/system/devices/idc
# Android EventHub checks this directory in addition to /system/usr/idc.
IDC_DATA_DIR="/data/system/devices/idc"
if [ ! -d "$IDC_DATA_DIR" ]; then
    mkdir -p "$IDC_DATA_DIR"
    chmod 0755 "$IDC_DATA_DIR"
    chown system:system "$IDC_DATA_DIR" 2>/dev/null
fi

# Copy IDC configurations to /data/system/devices/idc as a fallback
for idc_file in "$MODDIR"/system/usr/idc/*.idc; do
    if [ -f "$idc_file" ]; then
        filename="${idc_file##*/}"
        target="$IDC_DATA_DIR/$filename"
        cp -f "$idc_file" "$target"
        chmod 0644 "$target"
        chown system:system "$target" 2>/dev/null
    fi
done

# Pre-disable USB core autosuspend parameter if sysfs is accessible
if [ -w "/sys/module/usbcore/parameters/autosuspend" ]; then
    echo -1 > /sys/module/usbcore/parameters/autosuspend 2>/dev/null
fi
