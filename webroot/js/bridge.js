(() => {
  "use strict";

  window.Gaomon = window.Gaomon || {};

  function hasKsu() {
    return (
      typeof window.ksu !== "undefined" &&
      typeof window.ksu.exec === "function"
    );
  }

  let ksuCbCounter = 0;

  function ksuExec(cmd, options = {}) {
    return new Promise((resolve) => {
      if (hasKsu()) {
        const cbName = `__gaomon_ksu_cb_${Date.now()}_${++ksuCbCounter}`;

        // 8 秒超时看门狗，防止底层进程无响应导致前端挂起
        const timer = setTimeout(() => {
          if (window[cbName]) {
            delete window[cbName];
            resolve({ errno: -1, stdout: "", stderr: "执行超时" });
          }
        }, 8000);

        window[cbName] = (errno, stdout, stderr) => {
          clearTimeout(timer);
          delete window[cbName];
          resolve({
            errno: Number(errno) || 0,
            stdout: String(stdout != null ? stdout : ""),
            stderr: String(stderr != null ? stderr : ""),
          });
        };

        try {
          window.ksu.exec(cmd, JSON.stringify(options), cbName);
        } catch (err) {
          clearTimeout(timer);
          delete window[cbName];
          resolve({ errno: -1, stdout: "", stderr: String(err) });
        }
      } else {
        resolve(mockBrowserExec(cmd));
      }
    });
  }

  function showToast(msg) {
    if (hasKsu() && typeof window.ksu.toast === "function") {
      try {
        window.ksu.toast(msg);
      } catch (_) {
        // 忽略宿主接口调用异常
      }
    }
    const container = document.getElementById("toast-container");
    if (!container) return;
    const el = document.createElement("div");
    el.className = "toast-item";
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 2600);
  }

  function appendLog(msg) {
    const box = document.getElementById("diag-log-box");
    if (!box) return;
    const now = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    box.textContent = `[${now}] ${msg}\n` + box.textContent;
  }

  function mockBrowserExec(cmd) {
    if (cmd.includes("cat ") && cmd.includes("config.conf")) {
      const stored = localStorage.getItem("gaomon_mock_config");
      return {
        errno: 0,
        stdout: stored || "",
        stderr: "",
      };
    }
    if (cmd.includes("GAOMON_HW_PROBE")) {
      return {
        errno: 0,
        stdout: [
          "DAEMON_PID=6577",
          "USB_DEV=1-1",
          "USB_PRODUCT=GAOMON Gaomon Tablet_M8",
          "DEV_POWER_CONTROL=on",
          "DEV_AUTOSUSPEND=-1",
          "USBCORE_AUTOSUSPEND=-1",
          "OTG_SWITCH=1",
          "EVDEV_NODES=/dev/input/event7 (GAOMON Gaomon Tablet_M8 Pen)",
          "IDC_STATUS=已部署（3 份）",
          "VIEWPORT=3392x2400",
        ].join("\n"),
        stderr: "",
      };
    }
    if (cmd.includes("GAOMON_SCAN_USB")) {
      return {
        errno: 0,
        stdout: "256c:0064|GAOMON Gaomon Tablet_M8 (1-1)\n",
        stderr: "",
      };
    }
    return { errno: 0, stdout: "OK", stderr: "" };
  }

  Gaomon.Bridge = {
    hasKsu,
    ksuExec,
    showToast,
    appendLog,
  };
})();
