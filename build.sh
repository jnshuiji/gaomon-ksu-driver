#!/usr/bin/env bash
#
# Gaomon Tablet Driver & Power Manager - Packaging Script
# Compiles module components into a flashable KernelSU/Magisk ZIP package.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${SCRIPT_DIR}/out"
PACKAGE_NAME="gaomon-ksu-driver.zip"

echo "[*] Packaging Gaomon Tablet Fix KernelSU module..."

mkdir -p "${OUTPUT_DIR}"
rm -f "${OUTPUT_DIR}/${PACKAGE_NAME}"

python3 - <<EOF
import os
import zipfile

script_dir = "${SCRIPT_DIR}"
output_zip = os.path.join("${OUTPUT_DIR}", "${PACKAGE_NAME}")

files_to_pack = [
    "module.prop",
    "system.prop",
    "service.sh",
    "post-fs-data.sh",
    "customize.sh",
    "uninstall.sh",
]

with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zf:
    for filename in files_to_pack:
        file_path = os.path.join(script_dir, filename)
        if os.path.isfile(file_path):
            zf.write(file_path, arcname=filename)

    system_dir = os.path.join(script_dir, "system")
    for root, dirs, files in os.walk(system_dir):
        for f in files:
            full_path = os.path.join(root, f)
            arcname = os.path.relpath(full_path, script_dir)
            zf.write(full_path, arcname=arcname)

print("[+] Module package generated successfully at:")
print(f"    {output_zip}")
EOF
