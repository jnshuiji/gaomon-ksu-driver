#!/usr/bin/env bash
#
# Gaomon Tablet Driver, Power Manager & PenCursor Daemon - Packaging Script
# Compiles the PenCursor Android ARM64 daemon and packages all module components
# into a flashable KernelSU/Magisk ZIP archive.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PENCURSOR_DIR="${SCRIPT_DIR}/pencursor"
DAEMON_TARGET_TRIPLE="aarch64-linux-android"
DAEMON_BIN_PATH="${PENCURSOR_DIR}/target/${DAEMON_TARGET_TRIPLE}/release/pencursor"
OUTPUT_DIR="${SCRIPT_DIR}/out"
PACKAGE_NAME="gaomon-ksu-driver.zip"

echo "[*] 正在编译 PenCursor Android Daemon (${DAEMON_TARGET_TRIPLE})..."
(
    cd "${PENCURSOR_DIR}"
    cargo build --release --target "${DAEMON_TARGET_TRIPLE}"
)

if [ ! -f "${DAEMON_BIN_PATH}" ]; then
    echo "[!] 错误: 未找到 Daemon 编译产物 ${DAEMON_BIN_PATH}" >&2
    exit 1
fi

echo "[*] 正在打包 Gaomon KSU Driver Module..."

mkdir -p "${OUTPUT_DIR}"
rm -f "${OUTPUT_DIR}/${PACKAGE_NAME}"

python3 - <<EOF
import os
import stat
import zipfile

script_dir = "${SCRIPT_DIR}"
daemon_bin_path = "${DAEMON_BIN_PATH}"
output_zip = os.path.join("${OUTPUT_DIR}", "${PACKAGE_NAME}")

files_to_pack = [
    ("module.prop", 0o644),
    ("system.prop", 0o644),
    ("config.conf", 0o644),
    ("service.sh", 0o755),
    ("post-fs-data.sh", 0o755),
    ("customize.sh", 0o755),
    ("uninstall.sh", 0o755),
]

def write_with_mode(zf, src_path, arcname, mode):
    with open(src_path, "rb") as f:
        data = f.read()
    info = zipfile.ZipInfo(arcname)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = (stat.S_IFREG | mode) << 16
    zf.writestr(info, data)

with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zf:
    for filename, mode in files_to_pack:
        file_path = os.path.join(script_dir, filename)
        if os.path.isfile(file_path):
            write_with_mode(zf, file_path, filename, mode)

    write_with_mode(zf, daemon_bin_path, "bin/pencursor", 0o755)

    for folder in ("system", "webroot"):
        target_dir = os.path.join(script_dir, folder)
        if not os.path.isdir(target_dir):
            continue
        for root, dirs, files in os.walk(target_dir):
            for f in files:
                full_path = os.path.join(root, f)
                arcname = os.path.relpath(full_path, script_dir)
                write_with_mode(zf, full_path, arcname, 0o644)

print("[+] KernelSU Module 打包完成:")
print(f"    {output_zip}")
EOF
