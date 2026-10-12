/* ==========================================================================
   Utilities — formatting, toasts, modals, CSV, misc.
   ========================================================================== */
(function (global) {
  'use strict';

  // ---------- Currency / Number ----------
  let _sym = '₱';
  (async () => {
    try {
      if (global.DB) {
        const s = await DB.getSetting('currencySymbol');
        if (s) _sym = s;
      }
    } catch (e) { /* ignore */ }
  })();

  function setCurrencySymbol(sym) { _sym = sym; }

  function currency(n, opts = {}) {
    n = Number(n) || 0;
    const sym = opts.symbol || _sym;
    const digits = opts.digits ?? (Number.isInteger(n) ? 0 : 2);
    return sym + n.toLocaleString('en-PH', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function num(n) {
    n = Number(n) || 0;
    return n.toLocaleString('en-PH', { maximumFractionDigits: 2 });
  }
  function percent(n, digits = 1) {
    n = Number(n) || 0;
    return (n * 100).toFixed(digits) + '%';
  }

  // ---------- Dates (Asia/Manila alignment) ----------
  const MS_DAY = 86400000;
  function todayStart() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }
  function dateKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function startOfWeek(ts = Date.now()) {
    const d = new Date(ts);
    const day = d.getDay(); // 0 = Sun
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - day);
    return d.getTime();
  }
  function startOfMonth(ts = Date.now()) {
    const d = new Date(ts);
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }
  function startOfYear(ts = Date.now()) {
    const d = new Date(ts);
    return new Date(d.getFullYear(), 0, 1).getTime();
  }
  function formatDate(ts, style = 'medium') {
    const d = new Date(ts);
    if (style === 'short') return String(d.getMonth() + 1) + '/' + d.getDate();
    if (style === 'date') return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    if (style === 'time') return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    if (style === 'datetime') return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24);
    if (d < 7) return d + 'd ago';
    return formatDate(ts, 'date');
  }
  function daysBetween(a, b) {
    return Math.round((b - a) / MS_DAY);
  }
  function addDays(ts, n) { return ts + n * MS_DAY; }
  function startOfDay(ts) {
    const d = new Date(ts);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }

  // ---------- DOM helpers ----------
  function $(sel, root = document) { return root.querySelector(sel); }
  function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
  function el(tag, props = {}, ...children) {
    const e = document.createElement(tag);
    for (const k in props) {
      if (k === 'class' || k === 'className') e.className = props[k];
      else if (k === 'style' && typeof props[k] === 'object') Object.assign(e.style, props[k]);
      else if (k.startsWith('on') && typeof props[k] === 'function') e.addEventListener(k.slice(2).toLowerCase(), props[k]);
      else if (k === 'html') e.innerHTML = props[k];
      else if (k === 'dataset') Object.assign(e.dataset, props[k]);
      else if (props[k] !== false && props[k] != null) e.setAttribute(k, props[k]);
    }
    children.flat().forEach(c => {
      if (c == null || c === false) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

  // ---------- Toasts ----------
  function toast(msg, type = 'info', duration = 2800) {
    const container = $('#toast-container');
    if (!container) return;
    const t = el('div', { class: 'toast ' + type },
      el('span', {}, msg)
    );
    container.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity 250ms ease, transform 250ms ease';
      t.style.opacity = '0';
      t.style.transform = 'translateY(8px)';
      setTimeout(() => t.remove(), 260);
    }, duration);
  }

  // ---------- Modal ----------
  function openModal({ title, subtitle, body, footer, wide = false, onClose }) {
    const root = $('#modal-root');
    clear(root);
    root.classList.remove('hidden');

    const backdrop = el('div', { class: 'modal-backdrop', onclick: close });
    const card = el('div', { class: 'modal-card' + (wide ? ' wide' : '') },
      el('div', { class: 'modal-header' },
        el('div', {},
          title ? el('h2', {}, title) : null,
          subtitle ? el('p', {}, subtitle) : null,
        ),
        el('button', { class: 'modal-close', 'aria-label': 'Close', onclick: close },
          svgIcon('x')
        )
      ),
      el('div', { class: 'modal-body' }, body)
    );
    if (footer) card.appendChild(el('div', { class: 'modal-footer' }, footer));
    root.appendChild(backdrop);
    root.appendChild(card);

    function close() {
      root.classList.add('hidden');
      clear(root);
      document.body.style.overflow = '';
      if (onClose) onClose();
    }
    document.body.style.overflow = 'hidden';
    return { close, card };
  }

  function confirmDialog({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false, onConfirm }) {
    const body = el('div', {}, el('p', { style: { margin: 0, color: 'var(--text-muted)' } }, message));
    const footer = [
      el('button', { class: 'btn btn-ghost', onclick: () => m.close() }, cancelText),
      el('button', {
        class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'),
        onclick: async () => {
          try {
            const r = onConfirm ? await onConfirm() : true;
            if (r !== false) m.close();
          } catch (err) {
            toast(err.message || 'Error', 'error');
          }
        }
      }, confirmText),
    ];
    const m = openModal({ title, body, footer });
    return m;
  }

  // ---------- Icons (inline SVG) ----------
  function svgIcon(name, size = 20) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const paths = {
      x: [['M18 6L6 18'], ['M6 6l12 12']],
      search: [['circle', { cx: 11, cy: 11, r: 8 }], ['M21 21l-4.3-4.3']],
      plus: [['M12 5v14'], ['M5 12h14']],
      minus: [['M5 12h14']],
      trash: [['M3 6h18'], ['M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2'], ['M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6']],
      edit: [['M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7'], ['M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z']],
      cart: [['circle', { cx: 9, cy: 21, r: 1 }], ['circle', { cx: 20, cy: 21, r: 1 }], ['M1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6']],
      download: [['M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4'], ['M7 10l5 5 5-5'], ['M12 15V3']],
      upload: [['M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4'], ['M17 8l-5-5-5 5'], ['M12 3v12']],
      check: [['M20 6L9 17l-5-5']],
      warning: [['circle', { cx: 12, cy: 12, r: 10 }], ['M12 8v4'], ['M12 16h.01']],
      print: [['polyline', { points: '6 9 6 2 18 2 18 9' }], ['path', { d: 'M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2' }], ['rect', { x: 6, y: 14, width: 12, height: 8 }]],
      share: [['circle', { cx: 18, cy: 5, r: 3 }], ['circle', { cx: 6, cy: 12, r: 3 }], ['circle', { cx: 18, cy: 19, r: 3 }], ['line', { x1: 8.6, y1: 13.5, x2: 15.4, y2: 17.5 }], ['line', { x1: 15.4, y1: 6.5, x2: 8.6, y2: 10.5 }]],
      chart: [['path', { d: 'M3 3v18h18' }], ['path', { d: 'M7 14l4-4 4 4 6-6' }]],
      alert: [['path', { d: 'M10.3 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.7 3.86a2 2 0 00-3.4 0z' }], ['line', { x1: 12, y1: 9, x2: 12, y2: 13 }], ['line', { x1: 12, y1: 17, x2: 12.01, y2: 17 }]],
      calendar: [['rect', { x: 3, y: 4, width: 18, height: 18, rx: 2 }], ['line', { x1: 16, y1: 2, x2: 16, y2: 6 }], ['line', { x1: 8, y1: 2, x2: 8, y2: 6 }], ['line', { x1: 3, y1: 10, x2: 21, y2: 10 }]],
      filter: [['polygon', { points: '22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3' }]],
    };
    for (const p of (paths[name] || [])) {
      if (p[0] === 'M' || p[0] === 'p' || p[0] === 'r' || p[0] === 'c' || p[0] === 'l') {
        const el = document.createElementNS(ns, 'path');
        el.setAttribute('d', p[0]);
        svg.appendChild(el);
      } else {
        const [tag, attrs] = p;
        const el = document.createElementNS(ns, tag);
        for (const k in attrs) el.setAttribute(k, attrs[k]);
        svg.appendChild(el);
      }
    }
    return svg;
  }

  // ---------- CSV ----------
  function toCSV(rows, columns) {
    const esc = (v) => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? '"' + s + '"' : s;
    };
    const header = columns.map(c => esc(c.label || c.key)).join(',');
    const body = rows.map(r => columns.map(c => esc(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(',')).join('\n');
    return header + '\n' + body;
  }
  function downloadFile(filename, content, type = 'text/csv;charset=utf-8') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 200);
  }

  // ---------- Receipt ----------
  async function receiptText(sale) {
    const settings = await DB.getAllSettings();
    const lines = [];
    lines.push(settings.businessName || 'Janets Karenderya');
    if (settings.address) lines.push(settings.address);
    if (settings.tin) lines.push('TIN: ' + settings.tin);
    lines.push('');
    lines.push('OR #: ' + sale.transactionNo);
    lines.push('Date: ' + new Date(sale.date).toLocaleString('en-PH'));
    lines.push('Cashier: Owner');
    lines.push('--------------------------------');
    sale.items.forEach(it => {
      lines.push(it.name);
      lines.push('  ' + it.qty + ' x ' + currency(it.unitPrice) + ' = ' + currency(it.lineTotal));
    });
    lines.push('--------------------------------');
    lines.push('Subtotal:        ' + currency(sale.subtotal).padStart(14));
    if (sale.discountAmount > 0) lines.push('Discount:       -' + currency(sale.discountAmount).padStart(14));
    if (sale.vat > 0) lines.push('VAT:             ' + currency(sale.vat).padStart(14));
    lines.push('TOTAL:           ' + currency(sale.netSales).padStart(14));
    lines.push('Tendered:        ' + currency(sale.amountReceived).padStart(14));
    lines.push('Change:          ' + currency(sale.change).padStart(14));
    lines.push('');
    lines.push('Payment: ' + (sale.paymentMethod || 'cash').toUpperCase());
    lines.push('');
    lines.push('Thank you for your purchase!');
    lines.push('Please come again.');
    return lines.join('\n');
  }

  function printReceipt(sale) {
    receiptText(sale).then(text => {
      const win = window.open('', '_blank', 'width=360,height=600');
      if (!win) { toast('Popup blocked. Please allow popups.', 'error'); return; }
      win.document.write('<pre style="font-family:monospace;font-size:12px;line-height:1.4;">' + escapeHtml(text) + '</pre>');
      win.document.close();
      setTimeout(() => win.print(), 300);
    });
  }

  async function shareReceipt(sale) {
    const text = await receiptText(sale);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Receipt ' + sale.transactionNo, text });
      } catch (e) { /* user cancelled */ }
    } else {
      // fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(text);
        toast('Receipt copied to clipboard', 'success');
      } catch (e) {
        downloadFile(sale.transactionNo + '.txt', text, 'text/plain');
      }
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function debounce(fn, ms = 200) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function sum(arr, key) {
    return arr.reduce((a, b) => a + (Number(typeof key === 'function' ? key(b) : b[key]) || 0), 0);
  }

  function groupByDate(items, dateKeyFn, valueFn) {
    const map = new Map();
    items.forEach(it => {
      const k = dateKeyFn(it);
      map.set(k, (map.get(k) || 0) + (valueFn ? valueFn(it) : 1));
    });
    return map;
  }

  /* ---------- Public API ---------- */
  global.U = {
    currency, num, percent, setCurrencySymbol,
    todayStart, dateKey, startOfWeek, startOfMonth, startOfYear,
    formatDate, timeAgo, daysBetween, addDays, startOfDay,
    $, $$, el, clear,
    toast, openModal, confirmDialog,
    svgIcon,
    toCSV, downloadFile,
    receiptText, printReceipt, shareReceipt,
    escapeHtml, debounce,
    sum, groupByDate,
    MS_DAY,
  };
})(window);
