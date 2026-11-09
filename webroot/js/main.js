(() => {
  "use strict";

  window.Gaomon = window.Gaomon || {};

  const MODULE_DIR = "/data/adb/modules/gaomon_ksu_driver";
  const CONFIG_PATH = `${MODULE_DIR}/config.conf`;
  const DAEMON_BIN = `${MODULE_DIR}/bin/pencursor`;

  let currentConfig = { ...Gaomon.Config.DEFAULT_CONFIG };
  let savedConfigSnapshot = "";
  let previewBgMode = "dark";
  const interactiveState = {
    x: 320,
    y: 75,
    isContact: false,
    inRange: true,
    strokes: [],
  };

  function getCurrentConfig() {
    return currentConfig;
  }

  function renderAllPreviews() {
    const hoverCanvas = document.getElementById("canvas-hover");
    const contactCanvas = document.getElementById("canvas-contact");
    const interCanvas = document.getElementById("canvas-interactive");

    if (hoverCanvas) {
      const ctx = hoverCanvas.getContext("2d");
      ctx.clearRect(0, 0, hoverCanvas.width, hoverCanvas.height);
      const scale = hoverCanvas.width / 64;
      Gaomon.Preview.drawPixelGrid64(ctx, scale, previewBgMode);
      Gaomon.Preview.renderHoverVector(ctx, 32 * scale, 32 * scale, scale, currentConfig);
    }

    if (contactCanvas) {
      const ctx = contactCanvas.getContext("2d");
      ctx.clearRect(0, 0, contactCanvas.width, contactCanvas.height);
      const scale = contactCanvas.width / 64;
      Gaomon.Preview.drawPixelGrid64(ctx, scale, previewBgMode);
      Gaomon.Preview.renderContactVector(ctx, 32 * scale, 32 * scale, scale, currentConfig);
    }

    if (interCanvas) {
      const ctx = interCanvas.getContext("2d");
      ctx.clearRect(0, 0, interCanvas.width, interCanvas.height);

      if (interactiveState.strokes.length > 1) {
        ctx.save();
        ctx.strokeStyle = Gaomon.Config.hexToRgba(currentConfig.contact_color).cssRgba;
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        for (let i = 0; i < interactiveState.strokes.length; i++) {
          const pt = interactiveState.strokes[i];
          if (pt.move) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.restore();
      }

      if (currentConfig.overlay_enabled && interactiveState.inRange) {
        if (interactiveState.isContact) {
          Gaomon.Preview.renderContactVector(
            ctx,
            interactiveState.x,
            interactiveState.y,
            1.0,
            currentConfig
          );
        } else {
          Gaomon.Preview.renderHoverVector(
            ctx,
            interactiveState.x,
            interactiveState.y,
            1.0,
            currentConfig
          );
        }
      }
    }

    const boundLabel = document.getElementById("hover-bound-info");
    if (boundLabel) {
      const crossExtent =
        currentConfig.crosshair_gap +
        currentConfig.crosshair_size +
        (currentConfig.crosshair_thickness + 1.6) * 0.5;
      const circleExtent =
        currentConfig.circle_radius +
        (currentConfig.circle_thickness + 1.6) * 0.5;
      let maxR = 0;
      if (currentConfig.style === "crosshair") maxR = crossExtent;
      else if (currentConfig.style === "circle") maxR = circleExtent;
      else maxR = Math.max(crossExtent, circleExtent);
      boundLabel.textContent = `半径 ${maxR.toFixed(1)}/32 像素`;
    }
  }

  function syncUiFromConfig() {
    Gaomon.Config.clampConfigBounds(currentConfig);

    document.getElementById("cfg-daemon-enabled").checked = currentConfig.daemon_enabled;
    document.getElementById("cfg-overlay-enabled").checked = currentConfig.overlay_enabled;

    document.querySelectorAll("#style-selector .style-option").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.style === currentConfig.style);
    });

    const showCross = currentConfig.style === "both" || currentConfig.style === "crosshair";
    const showCircle = currentConfig.style === "both" || currentConfig.style === "circle";
    ["row-crosshair-size", "row-crosshair-gap", "row-crosshair-thickness"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle("dimmed", !showCross);
    });
    ["row-circle-radius", "row-circle-thickness"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle("dimmed", !showCircle);
    });

    const sliderPairs = [
      ["cfg-crosshair-size", "num-crosshair-size", currentConfig.crosshair_size],
      ["cfg-crosshair-gap", "num-crosshair-gap", currentConfig.crosshair_gap],
      ["cfg-crosshair-thickness", "num-crosshair-thickness", currentConfig.crosshair_thickness],
      ["cfg-circle-radius", "num-circle-radius", currentConfig.circle_radius],
      ["cfg-circle-thickness", "num-circle-thickness", currentConfig.circle_thickness],
      ["cfg-contact-dot-radius", "num-contact-dot-radius", currentConfig.contact_dot_radius],
      ["cfg-hover-timeout", "num-hover-timeout", currentConfig.hover_timeout_ms],
      ["cfg-mouse-timeout", "num-mouse-timeout", currentConfig.mouse_inactivity_timeout_ms],
    ];
    for (const [rangeId, numId, val] of sliderPairs) {
      const rEl = document.getElementById(rangeId);
      const nEl = document.getElementById(numId);
      if (rEl) rEl.value = val;
      if (nEl) nEl.value = val;
    }

    const colorBindings = [
      ["primary", currentConfig.primary_color],
      ["outline", currentConfig.outline_color],
      ["contact", currentConfig.contact_color],
    ];
    for (const [prefix, hexVal] of colorBindings) {
      const rgba = Gaomon.Config.hexToRgba(hexVal);
      document.getElementById(`picker-${prefix}`).value = rgba.rgbHex;
      document.getElementById(`alpha-${prefix}`).value = rgba.a;
      document.getElementById(`hex-${prefix}`).value = hexVal;
    }

    document.getElementById("cfg-disable-usbcore").checked =
      currentConfig.disable_usbcore_autosuspend;
    document.getElementById("cfg-enforce-otg").checked =
      currentConfig.enforce_oplus_otg_switch;
    document.getElementById("cfg-force-dev-on").checked =
      currentConfig.force_device_power_on;
    document.getElementById("cfg-usb-vid").value = currentConfig.usb_vid;
    document.getElementById("cfg-usb-pid").value = currentConfig.usb_pid;

    const targetVidPidEl = document.getElementById("hw-target-vidpid");
    if (targetVidPidEl) {
      targetVidPidEl.textContent = `${currentConfig.usb_vid} : ${currentConfig.usb_pid}`;
    }

    const serialized = Gaomon.Config.serializeConfigKv(currentConfig);
    const rawPreview = document.getElementById("raw-config-preview");
    if (rawPreview) rawPreview.textContent = serialized;

    const isDirty = savedConfigSnapshot !== "" && serialized !== savedConfigSnapshot;
    const unsavedBadge = document.getElementById("unsaved-badge");
    if (unsavedBadge) unsavedBadge.classList.toggle("hidden", !isDirty);

    renderAllPreviews();
  }

  async function loadConfigFromDevice() {
    const cmd = `if [ -f '${CONFIG_PATH}' ]; then cat '${CONFIG_PATH}'; fi`;
    const res = await Gaomon.Bridge.ksuExec(cmd);
    if (res.errno === 0 && (res.stdout || "").trim().length > 0) {
      currentConfig = Gaomon.Config.parseConfigKv(res.stdout);
      savedConfigSnapshot = Gaomon.Config.serializeConfigKv(currentConfig);
      Gaomon.Bridge.appendLog(`已从 ${CONFIG_PATH} 加载模块配置`);
    } else {
      currentConfig = { ...Gaomon.Config.DEFAULT_CONFIG };
      savedConfigSnapshot = Gaomon.Config.serializeConfigKv(currentConfig);
      Gaomon.Bridge.appendLog("未检测到已有配置文件，已加载默认配置");
    }
    syncUiFromConfig();
  }

  async function saveAndApplyConfig() {
    Gaomon.Config.clampConfigBounds(currentConfig);
    const kvContent = Gaomon.Config.serializeConfigKv(currentConfig);
    const escapedKv = kvContent.replace(/'/g, "'\\''");

    if (!Gaomon.Bridge.hasKsu()) {
      localStorage.setItem("gaomon_mock_config", kvContent);
    }

    const autosuspendVal = currentConfig.disable_usbcore_autosuspend ? "-1" : "2";
    const devControlVal = currentConfig.force_device_power_on ? "on" : "auto";
    const devDelayVal = currentConfig.force_device_power_on ? "-1" : "60000";

    const applyScript = `
mkdir -p '${MODULE_DIR}'
cat << 'GAOMON_EOF' > '${CONFIG_PATH}.tmp'
${escapedKv}
GAOMON_EOF
chmod 0644 '${CONFIG_PATH}.tmp'
mv -f '${CONFIG_PATH}.tmp' '${CONFIG_PATH}'

if [ -w /sys/module/usbcore/parameters/autosuspend ]; then
  echo '${autosuspendVal}' > /sys/module/usbcore/parameters/autosuspend 2>/dev/null || true
fi

if [ '${currentConfig.enforce_oplus_otg_switch ? "1" : "0"}' = '1' ]; then
  if [ -w /sys/devices/virtual/oplus_chg/usb/otg_switch ]; then
    echo 1 > /sys/devices/virtual/oplus_chg/usb/otg_switch 2>/dev/null || true
  fi
  settings put global persist.sys.oplus.otg_support 1 2>/dev/null || true
fi

for dev in /sys/bus/usb/devices/*; do
  if [ -f "$dev/idVendor" ] && [ -f "$dev/idProduct" ]; then
    vid=$(cat "$dev/idVendor" 2>/dev/null | tr 'A-Z' 'a-z')
    pid=$(cat "$dev/idProduct" 2>/dev/null | tr 'A-Z' 'a-z')
    if [ "$vid" = '${currentConfig.usb_vid}' ] && [ "$pid" = '${currentConfig.usb_pid}' ]; then
      echo '${devControlVal}' > "$dev/power/control" 2>/dev/null || true
      echo '${devDelayVal}' > "$dev/power/autosuspend_delay_ms" 2>/dev/null || true
      if [ '${currentConfig.force_device_power_on ? "1" : "0"}' = '1' ]; then
        echo enabled > "$dev/power/wakeup" 2>/dev/null || true
      fi
    fi
  fi
done

if [ '${currentConfig.daemon_enabled ? "1" : "0"}' = '1' ]; then
  if ! (pidof pencursor >/dev/null 2>&1 || pgrep -x "pencursor" >/dev/null 2>&1); then
    if [ -x '${DAEMON_BIN}' ]; then
      nohup '${DAEMON_BIN}' --config '${CONFIG_PATH}' </dev/null >/dev/null 2>&1 &
    fi
  fi
else
  pkill -9 -x pencursor 2>/dev/null || true
fi
echo "SAVE_OK"
`;

    const res = await Gaomon.Bridge.ksuExec(applyScript);
    if (res.errno === 0) {
      savedConfigSnapshot = kvContent;
      syncUiFromConfig();
      Gaomon.Bridge.showToast("配置已保存并即时生效");
      Gaomon.Bridge.appendLog(`已保存配置至 ${CONFIG_PATH}`);
      const footerMsg = document.getElementById("footer-msg");
      if (footerMsg) {
        footerMsg.textContent = `已于 ${new Date().toLocaleTimeString("zh-CN", { hour12: false })} 保存并更新`;
      }
      await Gaomon.Hardware.probeHardwareStatus(currentConfig);
    } else {
      Gaomon.Bridge.showToast(`保存失败: ${res.stderr || res.errno}`);
      Gaomon.Bridge.appendLog(`保存配置失败 (errno=${res.errno}): ${res.stderr}`);
    }
  }

  async function toggleDaemonProcess() {
    const check = await Gaomon.Bridge.ksuExec(
      "pidof pencursor 2>/dev/null || pgrep -x 'pencursor' 2>/dev/null || true"
    );
    const isRunning = (check.stdout || "").trim().length > 0;
    if (isRunning) {
      currentConfig.daemon_enabled = false;
      await saveAndApplyConfig();
      Gaomon.Bridge.showToast("已停止后台服务");
    } else {
      currentConfig.daemon_enabled = true;
      await saveAndApplyConfig();
      Gaomon.Bridge.showToast("已启动后台服务");
    }
  }

  async function restartDaemonProcess() {
    currentConfig.daemon_enabled = true;
    await saveAndApplyConfig();
    const cmd = `
pkill -9 -x pencursor 2>/dev/null || true
sleep 0.2
if [ -x '${DAEMON_BIN}' ]; then
  nohup '${DAEMON_BIN}' --config '${CONFIG_PATH}' </dev/null >/dev/null 2>&1 &
fi
`;
    await Gaomon.Bridge.ksuExec(cmd);
    Gaomon.Bridge.showToast("已重启后台服务");
    Gaomon.Bridge.appendLog("后台服务重启完成");
    await Gaomon.Hardware.probeHardwareStatus(currentConfig);
  }

  function updateEnvBadge() {
    const envBadge = document.getElementById("env-badge");
    if (!envBadge) return;
    if (Gaomon.Bridge.hasKsu()) {
      envBadge.textContent = "已连接 KernelSU";
      envBadge.className = "pill pill-ok";
      if (typeof window.ksu.fullScreen === "function") {
        try {
          window.ksu.fullScreen(true);
        } catch (_) {}
      }
    } else {
      envBadge.textContent = "浏览器预览模式";
      envBadge.className = "pill pill-info";
    }
  }

  function bindUiEvents() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.dataset.tab;
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
        document.querySelectorAll(".tab-panel").forEach((panel) => {
          panel.classList.toggle("active", panel.id === targetId);
        });
      });
    });

    document.querySelectorAll("#preview-bg-group .seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        previewBgMode = btn.dataset.bg || "dark";
        document
          .querySelectorAll("#preview-bg-group .seg-btn")
          .forEach((b) => b.classList.toggle("active", b === btn));
        ["wrap-hover", "wrap-contact", "wrap-interactive"].forEach((id) => {
          const wrap = document.getElementById(id);
          if (wrap) {
            wrap.classList.remove("bg-dark", "bg-light", "bg-grid");
            wrap.classList.add(`bg-${previewBgMode}`);
          }
        });
        renderAllPreviews();
      });
    });

    const interCanvas = document.getElementById("canvas-interactive");
    const coordLabel = document.getElementById("interactive-coords");
    if (interCanvas) {
      const updatePointer = (ev, isDownTransition = null) => {
        const rect = interCanvas.getBoundingClientRect();
        const scaleX = interCanvas.width / rect.width;
        const scaleY = interCanvas.height / rect.height;
        const x = Math.max(0, Math.min(interCanvas.width, (ev.clientX - rect.left) * scaleX));
        const y = Math.max(0, Math.min(interCanvas.height, (ev.clientY - rect.top) * scaleY));
        interactiveState.x = x;
        interactiveState.y = y;
        interactiveState.inRange = true;
        if (isDownTransition === true) {
          interactiveState.isContact = true;
          interactiveState.strokes.push({ x, y, move: true });
        } else if (isDownTransition === false) {
          interactiveState.isContact = false;
        } else if (interactiveState.isContact) {
          interactiveState.strokes.push({ x, y, move: false });
          if (interactiveState.strokes.length > 180) {
            interactiveState.strokes.shift();
            interactiveState.strokes[0].move = true;
          }
        }
        if (coordLabel) {
          coordLabel.textContent = `坐标：X ${Math.round(x)}，Y ${Math.round(y)} · 状态：${
            interactiveState.isContact ? "接触" : "悬浮"
          }`;
        }
        renderAllPreviews();
      };

      interCanvas.addEventListener("pointerdown", (ev) => {
        interCanvas.setPointerCapture(ev.pointerId);
        updatePointer(ev, true);
      });
      interCanvas.addEventListener("pointermove", (ev) => {
        updatePointer(ev, null);
      });
      interCanvas.addEventListener("pointerup", (ev) => {
        updatePointer(ev, false);
      });
      interCanvas.addEventListener("pointercancel", (ev) => {
        updatePointer(ev, false);
      });
    }

    document.getElementById("cfg-daemon-enabled").addEventListener("change", (e) => {
      currentConfig.daemon_enabled = e.target.checked;
      syncUiFromConfig();
    });
    document.getElementById("cfg-overlay-enabled").addEventListener("change", (e) => {
      currentConfig.overlay_enabled = e.target.checked;
      syncUiFromConfig();
    });

    document.querySelectorAll("#style-selector .style-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentConfig.style = btn.dataset.style;
        syncUiFromConfig();
      });
    });

    const bindSliderAndNumber = (rangeId, numId, configKey, isInt = false) => {
      const rEl = document.getElementById(rangeId);
      const nEl = document.getElementById(numId);
      const applyVal = (raw) => {
        const v = isInt ? parseInt(raw, 10) : parseFloat(raw);
        if (Number.isFinite(v)) {
          currentConfig[configKey] = v;
          syncUiFromConfig();
        }
      };
      if (rEl) rEl.addEventListener("input", (e) => applyVal(e.target.value));
      if (nEl) nEl.addEventListener("change", (e) => applyVal(e.target.value));
    };

    bindSliderAndNumber("cfg-crosshair-size", "num-crosshair-size", "crosshair_size");
    bindSliderAndNumber("cfg-crosshair-gap", "num-crosshair-gap", "crosshair_gap");
    bindSliderAndNumber("cfg-crosshair-thickness", "num-crosshair-thickness", "crosshair_thickness");
    bindSliderAndNumber("cfg-circle-radius", "num-circle-radius", "circle_radius");
    bindSliderAndNumber("cfg-circle-thickness", "num-circle-thickness", "circle_thickness");
    bindSliderAndNumber("cfg-contact-dot-radius", "num-contact-dot-radius", "contact_dot_radius");
    bindSliderAndNumber("cfg-hover-timeout", "num-hover-timeout", "hover_timeout_ms", true);
    bindSliderAndNumber(
      "cfg-mouse-timeout",
      "num-mouse-timeout",
      "mouse_inactivity_timeout_ms",
      true
    );

    document.querySelectorAll("#palette-presets .chip-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const preset = Gaomon.Config.PALETTE_PRESETS[btn.dataset.preset];
        if (preset) {
          Object.assign(currentConfig, preset);
          syncUiFromConfig();
          Gaomon.Bridge.showToast(`已应用「${btn.textContent}」配色`);
        }
      });
    });

    const bindColorRow = (prefix, configKey) => {
      const picker = document.getElementById(`picker-${prefix}`);
      const alpha = document.getElementById(`alpha-${prefix}`);
      const hexInput = document.getElementById(`hex-${prefix}`);

      const updateFromPickerAndAlpha = () => {
        const rgb = picker.value.replace(/^#/, "").toUpperCase();
        const aHex = Math.min(255, Math.max(0, parseInt(alpha.value, 10) || 255))
          .toString(16)
          .padStart(2, "0")
          .toUpperCase();
        currentConfig[configKey] = `#${rgb}${aHex}`;
        syncUiFromConfig();
      };

      picker.addEventListener("input", updateFromPickerAndAlpha);
      alpha.addEventListener("input", updateFromPickerAndAlpha);
      hexInput.addEventListener("change", () => {
        currentConfig[configKey] = Gaomon.Config.normalizeHexColor(
          hexInput.value,
          currentConfig[configKey]
        );
        syncUiFromConfig();
      });
    };

    bindColorRow("primary", "primary_color");
    bindColorRow("outline", "outline_color");
    bindColorRow("contact", "contact_color");

    document.getElementById("cfg-disable-usbcore").addEventListener("change", (e) => {
      currentConfig.disable_usbcore_autosuspend = e.target.checked;
      syncUiFromConfig();
    });
    document.getElementById("cfg-enforce-otg").addEventListener("change", (e) => {
      currentConfig.enforce_oplus_otg_switch = e.target.checked;
      syncUiFromConfig();
    });
    document.getElementById("cfg-force-dev-on").addEventListener("change", (e) => {
      currentConfig.force_device_power_on = e.target.checked;
      syncUiFromConfig();
    });
    document.getElementById("cfg-usb-vid").addEventListener("change", (e) => {
      currentConfig.usb_vid = e.target.value;
      syncUiFromConfig();
    });
    document.getElementById("cfg-usb-pid").addEventListener("change", (e) => {
      currentConfig.usb_pid = e.target.value;
      syncUiFromConfig();
    });

    document.getElementById("btn-save-top").addEventListener("click", saveAndApplyConfig);
    document.getElementById("btn-save-bottom").addEventListener("click", saveAndApplyConfig);
    document.getElementById("btn-apply-power-now").addEventListener("click", saveAndApplyConfig);

    document.getElementById("btn-refresh").addEventListener("click", async () => {
      updateEnvBadge();
      await Gaomon.Hardware.probeHardwareStatus(currentConfig);
      Gaomon.Bridge.showToast("硬件与守护进程状态已刷新");
    });
    document.getElementById("btn-probe-hw").addEventListener("click", async () => {
      updateEnvBadge();
      await Gaomon.Hardware.probeHardwareStatus(currentConfig);
      Gaomon.Bridge.showToast("已完成硬件状态重探测");
    });

    document.getElementById("btn-daemon-toggle").addEventListener("click", toggleDaemonProcess);
    document.getElementById("btn-daemon-restart").addEventListener("click", restartDaemonProcess);
    document.getElementById("btn-usb-rebind").addEventListener("click", () =>
      Gaomon.Hardware.rebindUsbDevice(currentConfig)
    );
    document.getElementById("btn-detect-vidpid").addEventListener("click", () => {
      Gaomon.Hardware.scanConnectedUsbCandidates((v, p) => {
        currentConfig.usb_vid = v;
        currentConfig.usb_pid = p;
        syncUiFromConfig();
        Gaomon.Bridge.showToast(`已填入设备 ${v}:${p}`);
      });
    });
    document.getElementById("btn-reset-vidpid").addEventListener("click", () => {
      currentConfig.usb_vid = "256c";
      currentConfig.usb_pid = "0064";
      syncUiFromConfig();
      Gaomon.Bridge.showToast("已恢复默认识别码 256c:0064");
    });

    document.getElementById("btn-reset-bottom").addEventListener("click", () => {
      if (savedConfigSnapshot) {
        currentConfig = Gaomon.Config.parseConfigKv(savedConfigSnapshot);
        syncUiFromConfig();
        Gaomon.Bridge.showToast("已放弃未保存修改");
      }
    });

    document.getElementById("btn-reload-conf").addEventListener("click", async () => {
      await loadConfigFromDevice();
      Gaomon.Bridge.showToast("已重新载入配置文件");
    });

    document.getElementById("btn-reset-defaults").addEventListener("click", async () => {
      currentConfig = { ...Gaomon.Config.DEFAULT_CONFIG };
      syncUiFromConfig();
      await saveAndApplyConfig();
      Gaomon.Bridge.showToast("已恢复出厂配置并保存");
    });

    document.getElementById("btn-clear-log").addEventListener("click", () => {
      const box = document.getElementById("diag-log-box");
      if (box) box.textContent = "";
    });
  }

  async function init() {
    bindUiEvents();
    updateEnvBadge();
    Gaomon.Bridge.appendLog("配置中心初始化完成");

    try {
      await loadConfigFromDevice();
    } catch (err) {
      Gaomon.Bridge.appendLog("载入配置文件异常: " + err);
    }

    try {
      await Gaomon.Hardware.probeHardwareStatus(currentConfig);
    } catch (err) {
      Gaomon.Bridge.appendLog("探测硬件状态异常: " + err);
    }
  }

  Gaomon.Main = {
    getCurrentConfig,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
