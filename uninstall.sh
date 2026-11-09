#!/system/bin/sh
#
# Gaomon Tablet Driver, Power Manager & PenCursor Daemon - Uninstallation Script
# Executed by KernelSU / Magisk during module removal.
#

# Stop running PenCursor daemon
pkill -x "pencursord" 2>/dev/null || true

# Clean up fallback IDC files deployed in /data/system/devices/idc
IDC_DATA_DIR="/data/system/devices/idc"
if [ -d "$IDC_DATA_DIR" ]; then
    rm -f "$IDC_DATA_DIR/Vendor_256c_Product_0064.idc"
    rm -f "$IDC_DATA_DIR/Vendor_256c_Product_0064_Version_0110.idc"
    rm -f "$IDC_DATA_DIR/GAOMON_Gaomon_Tablet_M8_Pen.idc"
fi
