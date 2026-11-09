(() => {
  "use strict";

  window.Gaomon = window.Gaomon || {};

  function setMetricStatus(dotId, valId, stateClass, text) {
    const dot = document.getElementById(dotId);
    const val = document.getElementById(valId);
    if (dot) dot.className = `metric-dot ${stateClass}`;
    if (val) val.textContent = text;
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  async function probeHardwareStatus(cfg) {
    const c =
      cfg ||
      (Gaomon.Main ? Gaomon.Main.getCurrentConfig() : null) ||
      Gaomon.Config.DEFAULT_CONFIG;

    const vid = String(c.usb_vid || "256c")
      .trim()
      .replace(/^0x/i, "")
      .toLowerCase();
    const pid = String(c.usb_pid || "0064")
      .trim()
      .replace(/^0x/i, "")
      .toLowerCase();

    const probeCmd = `
DAEMON_PID=$(pidof pencursor 2>/dev/null || pgrep -x "pencursor" 2>/dev/null || pgrep -f "pencursor" 2>/dev/null | head -n 1)
echo "DAEMON_PID=$DAEMON_PID"

USB_DEV=""
USB_PRODUCT=""
DEV_POWER_CONTROL=""
DEV_AUTOSUSPEND=""
for dev in /sys/bus/usb/devices/*; do
  if [ -f "$dev/idVendor" ] && [ -f "$dev/idProduct" ]; then
    v=$(cat "$dev/idVendor" 2>/dev/null | tr 'A-Z' 'a-z')
    p=$(cat "$dev/idProduct" 2>/dev/null | tr 'A-Z' 'a-z')
    if [ "$v" = "${vid}" ] && [ "$p" = "${pid}" ]; then
      USB_DEV=$(basename "$dev")
      mfg=$(cat "$dev/manufacturer" 2>/dev/null || true)
      prd=$(cat "$dev/product" 2>/dev/null || true)
      USB_PRODUCT="$mfg $prd"
      DEV_POWER_CONTROL=$(cat "$dev/power/control" 2>/dev/null || true)
      DEV_AUTOSUSPEND=$(cat "$dev/power/autosuspend_delay_ms" 2>/dev/null || true)
      break
    fi
  fi
done
echo "USB_DEV=$USB_DEV"
echo "USB_PRODUCT=$USB_PRODUCT"
echo "DEV_POWER_CONTROL=$DEV_POWER_CONTROL"
echo "DEV_AUTOSUSPEND=$DEV_AUTOSUSPEND"

USBCORE_AUTOSUSPEND=$(cat /sys/module/usbcore/parameters/autosuspend 2>/dev/null || echo "默认")
echo "USBCORE_AUTOSUSPEND=$USBCORE_AUTOSUSPEND"

OTG_SW=$(cat /sys/devices/virtual/oplus_chg/usb/otg_switch 2>/dev/null || echo "默认")
echo "OTG_SWITCH=$OTG_SW"

EVDEV_LIST=""
for sys_ev in /sys/class/input/event*; do
  if [ -f "$sys_ev/device/name" ]; then
    ev_name=$(cat "$sys_ev/device/name" 2>/dev/null || true)
    ev_vid=$(cat "$sys_ev/device/id/vendor" 2>/dev/null | tr 'A-Z' 'a-z' || true)
    ev_pid=$(cat "$sys_ev/device/id/product" 2>/dev/null | tr 'A-Z' 'a-z' || true)
    if [ "$ev_vid" = "${vid}" ] && [ "$ev_pid" = "${pid}" ]; then
      ev_node="/dev/input/$(basename "$sys_ev")"
      EVDEV_LIST="$ev_node ($ev_name)"
      break
    fi
    case "$ev_name" in
      *Gaomon*|*GAOMON*|*Huion*|*HUION*|*Tablet*|*Pen*|*Stylus*)
        ev_node="/dev/input/$(basename "$sys_ev")"
        EVDEV_LIST="$ev_node ($ev_name)"
        break
        ;;
    esac
  fi
done
echo "EVDEV_NODES=$EVDEV_LIST"

IDC_CNT=$(ls -1 /data/system/devices/idc/*.idc 2>/dev/null | wc -l | tr -d ' ')
echo "IDC_STATUS=已部署（\${IDC_CNT} 份）"

VP=""
for m in /sys/class/drm/*/modes; do
  if [ -f "$m" ]; then
    line=$(head -n 1 "$m" 2>/dev/null | cut -d'-' -f1 | cut -d'@' -f1)
    if [ -n "$line" ]; then
      VP="$line"
      break
    fi
  fi
done
if [ -z "$VP" ]; then
  VP=$(wm size 2>/dev/null | tail -n 1 | awk -F': ' '{print $2}')
fi
echo "VIEWPORT=$VP"
`;

    const res = await Gaomon.Bridge.ksuExec(probeCmd);
    const info = {};
    for (const line of (res.stdout || "").split(/\r?\n/)) {
      const idx = line.indexOf("=");
      if (idx > 0) {
        info[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
    }

    const daemonRunning = Boolean(info.DAEMON_PID);
    const usbConnected = Boolean(info.USB_DEV);
    const evdevReady = Boolean(info.EVDEV_NODES);
    const powerLocked = info.USBCORE_AUTOSUSPEND === "-1";

    setMetricStatus(
      "dot-daemon",
      "val-daemon-status",
      daemonRunning ? "ok" : "warn",
      daemonRunning ? `运行中（进程号：${info.DAEMON_PID}）` : "未运行"
    );
    setMetricStatus(
      "dot-usb",
      "val-usb-status",
      usbConnected ? "ok" : "warn",
      usbConnected ? `已连接（${info.USB_DEV}）` : "未连接"
    );
    setMetricStatus(
      "dot-evdev",
      "val-evdev-status",
      evdevReady ? "ok" : "warn",
      evdevReady ? info.EVDEV_NODES : "未就绪"
    );
    setMetricStatus(
      "dot-power",
      "val-power-status",
      powerLocked ? "ok" : "warn",
      powerLocked ? "持续供电" : "默认休眠"
    );

    setText(
      "hw-daemon-detail",
      daemonRunning ? `运行中（进程号：${info.DAEMON_PID}）` : "未运行"
    );
    setText(
      "hw-usb-path",
      usbConnected ? `/sys/bus/usb/devices/${info.USB_DEV}` : "未连接"
    );
    setText("hw-usb-product", info.USB_PRODUCT || "未检测到匹配设备");
    setText("hw-dev-power-control", info.DEV_POWER_CONTROL || "未连接");
    setText("hw-dev-autosuspend", info.DEV_AUTOSUSPEND || "未连接");
    setText("hw-usbcore-autosuspend", info.USBCORE_AUTOSUSPEND || "默认");
    setText("hw-otg-switch", info.OTG_SWITCH || "默认");
    setText("hw-evdev-nodes", info.EVDEV_NODES || "未检测到手写笔节点");
    setText("hw-idc-status", info.IDC_STATUS || "未知");
    setText("hw-viewport", info.VIEWPORT || "默认分辨率");
  }

  async function rebindUsbDevice(cfg) {
    const c =
      cfg ||
      (Gaomon.Main ? Gaomon.Main.getCurrentConfig() : null) ||
      Gaomon.Config.DEFAULT_CONFIG;
    const vid = c.usb_vid;
    const pid = c.usb_pid;
    const cmd = `
rebound=0
for dev in /sys/bus/usb/devices/*; do
  if [ -f "$dev/idVendor" ] && [ -f "$dev/idProduct" ]; then
    v=$(cat "$dev/idVendor" 2>/dev/null | tr 'A-Z' 'a-z')
    p=$(cat "$dev/idProduct" 2>/dev/null | tr 'A-Z' 'a-z')
    if [ "$v" = "${vid}" ] && [ "$p" = "${pid}" ]; then
      devname=$(basename "$dev")
      echo on > "$dev/power/control" 2>/dev/null || true
      echo -1 > "$dev/power/autosuspend_delay_ms" 2>/dev/null || true
      echo "$devname" > /sys/bus/usb/drivers/usb/unbind 2>/dev/null || true
      sleep 0.4
      echo "$devname" > /sys/bus/usb/drivers/usb/bind 2>/dev/null || true
      echo "REBOUND:$devname"
      rebound=1
    fi
  fi
done
if [ "$rebound" -eq 0 ]; then
  echo "NOT_FOUND"
fi
`;
    const res = await Gaomon.Bridge.ksuExec(cmd);
    if ((res.stdout || "").includes("REBOUND:")) {
      Gaomon.Bridge.showToast("数位板已重新连接并重载驱动映射");
      Gaomon.Bridge.appendLog(`数位板重新连接成功: ${res.stdout.trim()}`);
    } else {
      Gaomon.Bridge.showToast("未检测到已连接的数位板");
      Gaomon.Bridge.appendLog(`重新连接跳过：当前未连接目标设备 ${vid}:${pid}`);
    }
    await probeHardwareStatus(c);
  }

  async function scanConnectedUsbCandidates(onSelect) {
    const box = document.getElementById("usb-candidates-box");
    if (!box) return;
    const cmd = `
for dev in /sys/bus/usb/devices/*; do
  if [ -f "$dev/idVendor" ] && [ -f "$dev/idProduct" ]; then
    v=$(cat "$dev/idVendor" 2>/dev/null | tr 'A-Z' 'a-z')
    p=$(cat "$dev/idProduct" 2>/dev/null | tr 'A-Z' 'a-z')
    cls=$(cat "$dev/bDeviceClass" 2>/dev/null || echo "")
    if [ "$v" != "1d6b" ] && [ "$cls" != "09" ]; then
      mfg=$(cat "$dev/manufacturer" 2>/dev/null || true)
      prd=$(cat "$dev/product" 2>/dev/null || true)
      echo "$v:$p|$mfg $prd ($(basename "$dev"))"
    fi
  fi
done
`;
    const res = await Gaomon.Bridge.ksuExec(cmd);
    const lines = (res.stdout || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    box.innerHTML = "";
    box.classList.remove("hidden");

    if (lines.length === 0) {
      box.innerHTML = `<span class="card-desc">未发现已接入的数位板外设，请检查数据线连接。</span>`;
      return;
    }

    for (const line of lines) {
      const [vidpid, desc] = line.split("|");
      const [v, p] = (vidpid || "").split(":");
      if (!v || !p) continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "candidate-btn";
      btn.textContent = `选用 ${v}:${p} — ${desc || "外接设备"}`;
      btn.addEventListener("click", () => {
        box.classList.add("hidden");
        onSelect(v, p);
      });
      box.appendChild(btn);
    }
  }

  Gaomon.Hardware = {
    probeHardwareStatus,
    rebindUsbDevice,
    scanConnectedUsbCandidates,
  };
})();
