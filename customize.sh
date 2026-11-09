#!/sbin/sh
#
# Gaomon Tablet Driver, Power Manager & PenCursor Daemon - Installer Script
# Invoked by KernelSU / Magisk during module installation.
#

ui_print "- 正在安装 Gaomon Tablet IDC Driver、PenCursor Daemon 与 KernelSU WebUI"

EXISTING_CONF="/data/adb/modules/gaomon_ksu_driver/config.conf"
OLD_MODULE_DIR="/data/adb/modules/gaomon_tablet_fix"

# Clean old module directory if migrating
if [ -d "$OLD_MODULE_DIR" ]; then
    ui_print "- 检测到旧版模块目录 gaomon_tablet_fix，正在清理迁移"
    if [ ! -f "$EXISTING_CONF" ] && [ -f "$OLD_MODULE_DIR/config.conf" ]; then
        cp -f "$OLD_MODULE_DIR/config.conf" "$MODPATH/config.conf"
    fi
    rm -rf "$OLD_MODULE_DIR"
fi

# Preserve existing user configuration across module upgrades
if [ -f "$EXISTING_CONF" ]; then
    ui_print "- 检测到已有配置文件，正在保留用户自定义配置"
    cp -f "$EXISTING_CONF" "$MODPATH/config.conf"
fi

# Ensure correct permissions for scripts, daemon binary, WebUI, and configuration files
set_perm "$MODPATH/service.sh" 0 0 0755
set_perm "$MODPATH/post-fs-data.sh" 0 0 0755
set_perm "$MODPATH/uninstall.sh" 0 0 0755
if [ -f "$MODPATH/config.conf" ]; then
    set_perm "$MODPATH/config.conf" 0 0 0644
fi
if [ -d "$MODPATH/bin" ]; then
    set_perm_recursive "$MODPATH/bin" 0 0 0755 0755
fi
if [ -d "$MODPATH/webroot" ]; then
    set_perm_recursive "$MODPATH/webroot" 0 0 0755 0644
fi
set_perm_recursive "$MODPATH/system" 0 0 0755 0644

ui_print "- 已部署 IDC 配置文件"
ui_print "- 已配置 PenCursor SurfaceFlinger Overlay 与 USB Power Daemon"
ui_print "- 已启用 KernelSU WebUI 可视化配置中心"
ui_print "- 安装完成"
