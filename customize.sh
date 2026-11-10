#!/sbin/sh
#
# Gaomon Tablet Driver, Power Manager & PenCursor Daemon - Installer Script
# Invoked by KernelSU / Magisk during module installation.
#

ui_print "- 正在安装 Gaomon Tablet IDC Driver、PenCursor Daemon 与 KernelSU WebUI"

EXISTING_MODULE_DIR="/data/adb/modules/gaomon_ksu_driver"
EXISTING_CONF="$EXISTING_MODULE_DIR/config.conf"
IDC_DATA_DIR="/data/system/devices/idc"

# Clean up any leftover hot-reload staging files or temp config files
rm -rf /data/local/tmp/gaomon_reload 2>/dev/null
rm -f /data/local/tmp/device_apply.sh 2>/dev/null
rm -f "$MODPATH/config.conf.tmp" 2>/dev/null

# Clean up obsolete fallback IDC files from an earlier version if removed in this package
if [ -d "$EXISTING_MODULE_DIR/system/usr/idc" ] && [ -d "$IDC_DATA_DIR" ]; then
    for old_idc in "$EXISTING_MODULE_DIR"/system/usr/idc/*.idc; do
        if [ -f "$old_idc" ]; then
            fname="${old_idc##*/}"
            if [ ! -f "$MODPATH/system/usr/idc/$fname" ]; then
                rm -f "$IDC_DATA_DIR/$fname"
            fi
        fi
    done
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
