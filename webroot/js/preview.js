(() => {
  "use strict";

  window.Gaomon = window.Gaomon || {};

  function drawPixelGrid64(ctx, scale, previewBgMode) {
    ctx.save();
    ctx.strokeStyle =
      previewBgMode === "light"
        ? "rgba(15, 23, 42, 0.06)"
        : "rgba(148, 163, 184, 0.07)";
    ctx.lineWidth = 1;
    for (let i = 8; i < 64; i += 8) {
      const pos = i * scale;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, 64 * scale);
      ctx.moveTo(0, pos);
      ctx.lineTo(64 * scale, pos);
      ctx.stroke();
    }
    ctx.strokeStyle =
      previewBgMode === "light"
        ? "rgba(2, 132, 199, 0.16)"
        : "rgba(56, 189, 248, 0.16)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(32 * scale, 0);
    ctx.lineTo(32 * scale, 64 * scale);
    ctx.moveTo(0, 32 * scale);
    ctx.lineTo(64 * scale, 32 * scale);
    ctx.stroke();
    ctx.restore();
  }

  function renderHoverVector(ctx, cx, cy, scale, cfg) {
    const primary = Gaomon.Config.hexToRgba(cfg.primary_color).cssRgba;
    const outline = Gaomon.Config.hexToRgba(cfg.outline_color).cssRgba;

    ctx.save();

    const drawCirclePart = () => {
      const r = cfg.circle_radius * scale;
      const innerW = cfg.circle_thickness * scale;
      const outlineW = (cfg.circle_thickness + 1.6) * scale;

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = outline;
      ctx.lineWidth = outlineW;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = primary;
      ctx.lineWidth = innerW;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 1.6 * scale, 0, Math.PI * 2);
      ctx.fillStyle = outline;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, 1.0 * scale, 0, Math.PI * 2);
      ctx.fillStyle = primary;
      ctx.fill();
    };

    const drawCrosshairPart = () => {
      const gap = cfg.crosshair_gap * scale;
      const size = cfg.crosshair_size * scale;
      const innerW = cfg.crosshair_thickness * scale;
      const outlineW = (cfg.crosshair_thickness + 1.6) * scale;

      const traceArms = () => {
        ctx.beginPath();
        ctx.moveTo(cx, cy - gap - size);
        ctx.lineTo(cx, cy - gap);
        ctx.moveTo(cx, cy + gap);
        ctx.lineTo(cx, cy + gap + size);
        ctx.moveTo(cx - gap - size, cy);
        ctx.lineTo(cx - gap, cy);
        ctx.moveTo(cx + gap, cy);
        ctx.lineTo(cx + gap + size, cy);
      };

      ctx.lineCap = "round";
      traceArms();
      ctx.strokeStyle = outline;
      ctx.lineWidth = outlineW;
      ctx.stroke();

      traceArms();
      ctx.strokeStyle = primary;
      ctx.lineWidth = innerW;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 1.0 * scale, 0, Math.PI * 2);
      ctx.fillStyle = primary;
      ctx.fill();
    };

    if (cfg.style === "circle") {
      drawCirclePart();
    } else if (cfg.style === "crosshair") {
      drawCrosshairPart();
    } else {
      drawCirclePart();
      drawCrosshairPart();
    }

    ctx.restore();
  }

  function renderContactVector(ctx, cx, cy, scale, cfg) {
    const contact = Gaomon.Config.hexToRgba(cfg.contact_color).cssRgba;
    const outline = Gaomon.Config.hexToRgba(cfg.outline_color).cssRgba;
    const innerR = cfg.contact_dot_radius * scale;
    const outerR = (cfg.contact_dot_radius + 1.2) * scale;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.fillStyle = outline;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fillStyle = contact;
    ctx.fill();
    ctx.restore();
  }

  Gaomon.Preview = {
    drawPixelGrid64,
    renderHoverVector,
    renderContactVector,
  };
})();
