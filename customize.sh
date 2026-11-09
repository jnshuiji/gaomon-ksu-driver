#!/sbin/sh
#
# Gaomon Tablet Driver, Power Manager & PenCursor Daemon - Installer Script
# Invoked by KernelSU / Magisk during module installation.
#

ui_print "- 正在安装 Gaomon Tablet IDC Driver 与 PenCursor Daemon"

# Ensure correct permissions for scripts, daemon binary, and configuration files
set_perm "$MODPATH/service.sh" 0 0 0755
set_perm "$MODPATH/post-fs-data.sh" 0 0 0755
set_perm "$MODPATH/uninstall.sh" 0 0 0755
if [ -d "$MODPATH/bin" ]; then
    set_perm_recursive "$MODPATH/bin" 0 0 0755 0755
fi
set_perm_recursive "$MODPATH/system" 0 0 0755 0644

ui_print "- 已部署 IDC 配置文件"
ui_print "- 已配置 PenCursor SurfaceFlinger Overlay 与 USB Power Daemon"
ui_print "- 安装完成"
