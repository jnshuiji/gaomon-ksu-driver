#!/sbin/sh
#
# Gaomon Tablet Driver & Power Manager - Installer Script
# Invoked by KernelSU / Magisk during module installation.
#

ui_print "- Installing Gaomon Drawing Tablet Adapter"

# Ensure correct permissions for scripts and configuration files
set_perm "$MODPATH/service.sh" 0 0 0755
set_perm "$MODPATH/post-fs-data.sh" 0 0 0755
set_perm_recursive "$MODPATH/system" 0 0 0755 0644

ui_print "- Configured dedicated IDC input configurations"
ui_print "- Configured USB power management and autosuspend blocker"
ui_print "- Installation completed successfully."
