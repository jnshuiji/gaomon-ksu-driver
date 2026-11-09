#!/system/bin/sh
#
# Gaomon Tablet Driver & Power Manager - Late-start Service Daemon
# Executed by KernelSU in service.sh mode (runs in background during boot).
#
# Target Hardware Specifications:
# ==============================================================================
# Peripheral Device:
#   Manufacturer: GAOMON (USB String: GAOMON, Huion OEM Architecture)
#   Product String: Gaomon Tablet_M8
#   USB VID:PID: 256c:0064
#   Device Version: 0x0110 (bcdDevice 0111)
#   Power Rating: 480mA, USB 2.0 Full-Speed (12 Mbps), Bus-Powered
#   Stylus Transducer: EMR Passive Resonance (Battery-free, RF powered)
#
# Host Platform:
#   Market Name: OnePlus Pad 3 Pro
#   Device Model: OPD2513 (Product: OPD2513, Device: OP6547L1, Platform: canoe)
#   Application Processor (SoC): Qualcomm Snapdragon 8 Elite
#                                (SM8850P, soc_id 661, 3nm process, Oryon architecture)
#   Kernel: Linux 6.12.69 (Android 16 GKI, android16-6.12)
#   Operating System: Android 17 (ColorOS V17.0.0, API Level 37, Build OPD2513_17.0.0.105(CN01))
# ==============================================================================
#

MODDIR="${0%/*}"
LOG_TAG="GaomonKsuDriver"

log_info() {
    log -t "$LOG_TAG" -p i "$1"
}

# Wait for system services to initialize
until [ "$(getprop sys.boot_completed)" = "1" ]; do
    sleep 2
done

log_info "Boot completed. Initializing Gaomon tablet power management..."

# 1. Globally disable USB core autosuspend
if [ -w "/sys/module/usbcore/parameters/autosuspend" ]; then
    echo -1 > /sys/module/usbcore/parameters/autosuspend 2>/dev/null
    log_info "Disabled usbcore.autosuspend globally (-1)"
fi

# 2. Maintain OTG power state in system settings
settings put global persist.sys.oplus.otg_support 1 2>/dev/null
if [ -w "/sys/devices/virtual/oplus_chg/usb/otg_switch" ]; then
    echo 1 > /sys/devices/virtual/oplus_chg/usb/otg_switch 2>/dev/null
fi

# 3. Target Vendor and Product IDs for Gaomon/Huion architecture
TARGET_VID="256c"
TARGET_PID="0064"

apply_device_power_policy() {
    for dev in /sys/bus/usb/devices/*; do
        if [ -f "$dev/idVendor" ] && [ -f "$dev/idProduct" ]; then
            vid=$(cat "$dev/idVendor" 2>/dev/null)
            pid=$(cat "$dev/idProduct" 2>/dev/null)

            if [ "$vid" = "$TARGET_VID" ] && [ "$pid" = "$TARGET_PID" ]; then
                # Prevent runtime suspend (keeps VBUS and internal EMR oscillator active)
                if [ -f "$dev/power/control" ]; then
                    current_ctrl=$(cat "$dev/power/control" 2>/dev/null)
                    if [ "$current_ctrl" != "on" ]; then
                        echo on > "$dev/power/control" 2>/dev/null
                        log_info "Configured power/control to 'on' for USB device: $dev"
                    fi
                fi

                # Disable autosuspend delay
                if [ -f "$dev/power/autosuspend_delay_ms" ]; then
                    echo -1 > "$dev/power/autosuspend_delay_ms" 2>/dev/null
                fi

                # Enable remote wakeup if supported
                if [ -f "$dev/power/wakeup" ]; then
                    echo enabled > "$dev/power/wakeup" 2>/dev/null
                fi
            fi
        fi
    done
}

# Apply immediately for already connected devices
apply_device_power_policy

# 4. Background daemon to monitor hotplug events and preserve power state
(
    while true; do
        apply_device_power_policy
        sleep 3
    done
) &

log_info "Background USB power monitor daemon started successfully."
