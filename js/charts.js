/* ==========================================================================
   Lightweight Canvas Charts (no dependencies)
   Supports: line, bar, stackedBar
   ========================================================================== */
(function (global) {
  'use strict';

  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, w: rect.width, h: rect.height };
  }

  function getTextColor() {
    return getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#7A857E';
  }
  function getEmerald() { return '#35A879'; }
  function getForest() { return '#153F32'; }

  function drawLineChart(canvas, { labels, datasets, showDots = true, showGrid = true, fill = true }) {
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const pad = { top: 16, right: 16, bottom: 32, left: 48 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;
    if (cw <= 0 || ch <= 0) return;

    // Determine max value across all datasets
    let max = 1;
    let min = 0;
    datasets.forEach(ds => {
      ds.data.forEach(v => { if (v > max) max = v; if (v < min) min = v; });
    });
    // nice round max
    const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, max))));
    max = Math.ceil(max / mag) * mag * 1.1;

    const muted = getTextColor();
    const forest = getForest();

    // Grid + y labels
    ctx.strokeStyle = 'rgba(122,133,126,0.15)';
    ctx.fillStyle = muted;
    ctx.font = '11px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const v = min + ((max - min) * i / ySteps);
      const y = pad.top + ch - (ch * i / ySteps);
      if (showGrid) {
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(pad.left + cw, y);
        ctx.stroke();
      }
      ctx.fillText(formatVal(v), pad.left - 8, y);
    }

    // X labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xStep = labels.length > 1 ? cw / (labels.length - 1) : 0;
    const labelStep = Math.max(1, Math.ceil(labels.length / 8));
    labels.forEach((lb, i) => {
      const x = pad.left + i * xStep;
      if (i % labelStep === 0 || i === labels.length - 1) {
        ctx.fillText(lb, x, pad.top + ch + 8);
      }
    });

    // Datasets
    datasets.forEach((ds, di) => {
      const color = ds.color || getEmerald();
      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
      grad.addColorStop(0, hexWithAlpha(color, 0.35));
      grad.addColorStop(1, hexWithAlpha(color, 0));

      ctx.beginPath();
      const pts = [];
      ds.data.forEach((v, i) => {
        const x = pad.left + i * xStep;
        const y = pad.top + ch - ch * ((v - min) / (max - min));
        pts.push({ x, y });
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      if (fill) {
        ctx.lineTo(pts[pts.length - 1].x, pad.top + ch);
        ctx.lineTo(pts[0].x, pad.top + ch);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Line
      ctx.beginPath();
      pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.stroke();

      if (showDots) {
        ctx.fillStyle = color;
        pts.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });
  }

  function drawBarChart(canvas, { labels, datasets, stacked = false }) {
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const pad = { top: 16, right: 16, bottom: 32, left: 48 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;
    if (cw <= 0 || ch <= 0) return;

    let max = 1;
    if (stacked) {
      labels.forEach((_, i) => {
        const total = datasets.reduce((a, ds) => a + (Number(ds.data[i]) || 0), 0);
        if (total > max) max = total;
      });
    } else {
      datasets.forEach(ds => ds.data.forEach(v => { if (v > max) max = v; }));
    }
    const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, max))));
    max = Math.ceil(max / mag) * mag * 1.15;

    const muted = getTextColor();
    ctx.strokeStyle = 'rgba(122,133,126,0.15)';
    ctx.fillStyle = muted;
    ctx.font = '11px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const v = (max * i / ySteps);
      const y = pad.top + ch - (ch * i / ySteps);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + cw, y);
      ctx.stroke();
      ctx.fillText(formatVal(v), pad.left - 8, y);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const groupW = cw / labels.length;
    const dsCount = datasets.length;
    const labelStep = Math.max(1, Math.ceil(labels.length / 8));

    labels.forEach((lb, i) => {
      const gx = pad.left + i * groupW + groupW / 2;
      const barArea = groupW * 0.7;
      let cumY = 0;
      datasets.forEach((ds, di) => {
        const v = Number(ds.data[i]) || 0;
        const barH = ch * (v / max);
        let bw, bx;
        if (stacked) {
          bw = barArea;
          bx = gx - bw / 2;
        } else {
          bw = barArea / dsCount - 2;
          bx = gx - barArea / 2 + di * (bw + 2);
        }
        const by = pad.top + ch - barH - cumY;
        ctx.fillStyle = ds.color || getEmerald();
        roundedRect(ctx, bx, by, bw, barH, 4);
        ctx.fill();
        if (stacked) cumY += barH;
      });
      if (i % labelStep === 0 || i === labels.length - 1) {
        ctx.fillStyle = muted;
        ctx.fillText(lb, gx, pad.top + ch + 8);
      }
    });

    // Legend
    if (datasets.length > 1) {
      const lx = pad.left;
      let ly = 4;
      ctx.font = '11px Inter, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      datasets.forEach((ds) => {
        ctx.fillStyle = ds.color || getEmerald();
        ctx.fillRect(lx, ly, 10, 10);
        ctx.fillStyle = muted;
        ctx.fillText(ds.label, lx + 14, ly + 5);
      });
    }
  }

  function roundedRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function hexWithAlpha(hex, a) {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const r = parseInt(full.slice(0, 2), 16),
          g = parseInt(full.slice(2, 4), 16),
          b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function formatVal(v) {
    if (Math.abs(v) >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k';
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(1);
  }

  global.Charts = { drawLineChart, drawBarChart };
})(window);
