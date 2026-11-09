(() => {
  "use strict";

  window.Gaomon = window.Gaomon || {};

  const DEFAULT_CONFIG = {
    daemon_enabled: true,
    overlay_enabled: true,
    style: "both",
    crosshair_size: 10.0,
    crosshair_gap: 3.5,
    crosshair_thickness: 1.5,
    circle_radius: 12.0,
    circle_thickness: 1.5,
    contact_dot_radius: 2.0,
    primary_color: "#FFFFFFFF",
    outline_color: "#0D0D0DF2",
    contact_color: "#00E6FFFF",
    hover_timeout_ms: 150,
    mouse_inactivity_timeout_ms: 100,
    active_poll_interval_ms: 1,
    idle_poll_interval_ms: 10,
    usb_vid: "256c",
    usb_pid: "0064",
    disable_usbcore_autosuspend: true,
    enforce_oplus_otg_switch: true,
    force_device_power_on: true,
  };

  const PALETTE_PRESETS = {
    default: {
      primary_color: "#FFFFFFFF",
      outline_color: "#0D0D0DF2",
      contact_color: "#00E6FFFF",
    },
    cyber: {
      primary_color: "#00FF88FF",
      outline_color: "#0A0F0DF2",
      contact_color: "#FFE600FF",
    },
    amber: {
      primary_color: "#FFF3D1FF",
      outline_color: "#14100AF2",
      contact_color: "#FF6B00FF",
    },
    crimson: {
      primary_color: "#FFFFFFFA",
      outline_color: "#1A080CF2",
      contact_color: "#FF2A6DFF",
    },
    stealth: {
      primary_color: "#E0E6EDEB",
      outline_color: "#080A0CE6",
      contact_color: "#38BDF8FF",
    },
  };

  function parseBool(val) {
    const s = String(val).trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(s)) return true;
    if (["0", "false", "no", "off"].includes(s)) return false;
    return null;
  }

  function normalizeHexColor(raw, fallback) {
    const clean = String(raw || "")
      .trim()
      .replace(/^#/, "")
      .toUpperCase();
    if (/^[0-9A-F]{6}$/.test(clean)) {
      return `#${clean}FF`;
    }
    if (/^[0-9A-F]{8}$/.test(clean)) {
      return `#${clean}`;
    }
    return fallback;
  }

  function hexToRgba(hex8) {
    const clean = normalizeHexColor(hex8, "#FFFFFFFF").slice(1);
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    const a = parseInt(clean.slice(6, 8), 16);
    return {
      r,
      g,
      b,
      a,
      rgbHex: `#${clean.slice(0, 6).toLowerCase()}`,
      cssRgba: `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`,
    };
  }

  function clampConfigBounds(cfg) {
    cfg.crosshair_thickness = Math.min(6.0, Math.max(0.5, Number(cfg.crosshair_thickness) || 1.5));
    cfg.crosshair_gap = Math.min(14.0, Math.max(0.0, Number(cfg.crosshair_gap) || 3.5));
    const maxArm = Math.max(2.0, 29.0 - cfg.crosshair_gap - cfg.crosshair_thickness * 0.5);
    cfg.crosshair_size = Math.min(Math.min(26.0, maxArm), Math.max(2.0, Number(cfg.crosshair_size) || 10.0));

    cfg.circle_thickness = Math.min(6.0, Math.max(0.5, Number(cfg.circle_thickness) || 1.5));
    const maxRadius = Math.max(2.0, 29.0 - cfg.circle_thickness * 0.5);
    cfg.circle_radius = Math.min(Math.min(27.0, maxRadius), Math.max(2.0, Number(cfg.circle_radius) || 12.0));

    cfg.contact_dot_radius = Math.min(16.0, Math.max(0.5, Number(cfg.contact_dot_radius) || 2.0));
    cfg.hover_timeout_ms = Math.min(5000, Math.max(20, Math.round(Number(cfg.hover_timeout_ms) || 150)));
    cfg.mouse_inactivity_timeout_ms = Math.min(
      5000,
      Math.max(10, Math.round(Number(cfg.mouse_inactivity_timeout_ms) || 100))
    );
    cfg.active_poll_interval_ms = Math.min(100, Math.max(1, Math.round(Number(cfg.active_poll_interval_ms) || 1)));
    cfg.idle_poll_interval_ms = Math.min(1000, Math.max(1, Math.round(Number(cfg.idle_poll_interval_ms) || 10)));

    cfg.primary_color = normalizeHexColor(cfg.primary_color, DEFAULT_CONFIG.primary_color);
    cfg.outline_color = normalizeHexColor(cfg.outline_color, DEFAULT_CONFIG.outline_color);
    cfg.contact_color = normalizeHexColor(cfg.contact_color, DEFAULT_CONFIG.contact_color);

    const cleanVid = String(cfg.usb_vid || "256c")
      .trim()
      .replace(/^0x/i, "")
      .toLowerCase();
    cfg.usb_vid = /^[0-9a-f]{1,4}$/.test(cleanVid) ? cleanVid.padStart(4, "0") : "256c";

    const cleanPid = String(cfg.usb_pid || "0064")
      .trim()
      .replace(/^0x/i, "")
      .toLowerCase();
    cfg.usb_pid = /^[0-9a-f]{1,4}$/.test(cleanPid) ? cleanPid.padStart(4, "0") : "0064";
  }

  function parseConfigKv(text) {
    const cfg = { ...DEFAULT_CONFIG };
    const lines = String(text || "").split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || line.startsWith(";")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx < 0) continue;
      const key = line.slice(0, eqIdx).trim();
      const val = line
        .slice(eqIdx + 1)
        .trim()
        .replace(/^["']|["']$/g, "")
        .trim();

      switch (key) {
        case "daemon_enabled": {
          const b = parseBool(val);
          if (b !== null) cfg.daemon_enabled = b;
          break;
        }
        case "overlay_enabled": {
          const b = parseBool(val);
          if (b !== null) cfg.overlay_enabled = b;
          break;
        }
        case "style":
        case "cursor_style": {
          const s = val.toLowerCase();
          if (s === "crosshair" || s === "cross") cfg.style = "crosshair";
          else if (s === "circle" || s === "ring") cfg.style = "circle";
          else if (s === "both" || s === "combined" || s === "all") cfg.style = "both";
          break;
        }
        case "crosshair_size":
        case "crosshair_gap":
        case "crosshair_thickness":
        case "circle_radius":
        case "circle_thickness":
        case "contact_dot_radius": {
          const num = parseFloat(val);
          if (Number.isFinite(num)) cfg[key] = num;
          break;
        }
        case "hover_timeout_ms":
        case "mouse_inactivity_timeout_ms":
        case "active_poll_interval_ms":
        case "idle_poll_interval_ms": {
          const num = parseInt(val, 10);
          if (Number.isFinite(num)) cfg[key] = num;
          break;
        }
        case "primary_color":
        case "outline_color":
        case "contact_color":
          cfg[key] = normalizeHexColor(val, DEFAULT_CONFIG[key]);
          break;
        case "usb_vid":
        case "usb_pid":
          cfg[key] = val;
          break;
        case "disable_usbcore_autosuspend":
        case "enforce_oplus_otg_switch":
        case "force_device_power_on": {
          const b = parseBool(val);
          if (b !== null) cfg[key] = b;
          break;
        }
        default:
          break;
      }
    }
    clampConfigBounds(cfg);
    return cfg;
  }

  function serializeConfigKv(cfg) {
    const c = { ...cfg };
    clampConfigBounds(c);
    return [
      "# Gaomon Tablet Driver & PenCursor Configuration",
      "# Managed by KernelSU WebUI",
      "",
      `daemon_enabled=${c.daemon_enabled}`,
      `overlay_enabled=${c.overlay_enabled}`,
      "",
      `style=${c.style}`,
      "",
      `crosshair_size=${c.crosshair_size.toFixed(2)}`,
      `crosshair_gap=${c.crosshair_gap.toFixed(2)}`,
      `crosshair_thickness=${c.crosshair_thickness.toFixed(2)}`,
      `circle_radius=${c.circle_radius.toFixed(2)}`,
      `circle_thickness=${c.circle_thickness.toFixed(2)}`,
      `contact_dot_radius=${c.contact_dot_radius.toFixed(2)}`,
      "",
      `primary_color=${c.primary_color}`,
      `outline_color=${c.outline_color}`,
      `contact_color=${c.contact_color}`,
      "",
      `hover_timeout_ms=${c.hover_timeout_ms}`,
      `mouse_inactivity_timeout_ms=${c.mouse_inactivity_timeout_ms}`,
      `active_poll_interval_ms=${c.active_poll_interval_ms}`,
      `idle_poll_interval_ms=${c.idle_poll_interval_ms}`,
      "",
      `usb_vid=${c.usb_vid}`,
      `usb_pid=${c.usb_pid}`,
      `disable_usbcore_autosuspend=${c.disable_usbcore_autosuspend}`,
      `enforce_oplus_otg_switch=${c.enforce_oplus_otg_switch}`,
      `force_device_power_on=${c.force_device_power_on}`,
      "",
    ].join("\n");
  }

  Gaomon.Config = {
    DEFAULT_CONFIG,
    PALETTE_PRESETS,
    parseBool,
    normalizeHexColor,
    hexToRgba,
    clampConfigBounds,
    parseConfigKv,
    serializeConfigKv,
  };
})();
