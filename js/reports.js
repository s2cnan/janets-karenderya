/* ==========================================================================
   Reports
   ========================================================================== */
(function (global) {
  'use strict';

  let reportType = 'sales';
  let period = 'month';
  let customStart = null, customEnd = null;

  function render() {
    const container = U.$('#view-container');
    U.clear(container);

    container.appendChild(U.el('div', { class: 'section' },
      U.el('div', { class: 'section-header' },
        U.el('div', {},
          U.el('h3', { class: 'section-title' }, 'Reports'),
          U.el('p', { class: 'section-sub' }, 'Detailed reports on sales, products, and expenses')
        ),
      ),
      U.el('div', { class: 'chip-row' },
        chip('Sales', 'sales'),
        chip('Products', 'products'),
        chip('Expenses', 'expenses'),
        chip('Payments', 'payments'),
      ),
      U.el('div', { class: 'chip-row' },
        periodChip('Today', 'today'),
        periodChip('Week', 'week'),
        periodChip('Month', 'month'),
        periodChip('Year', 'year'),
        U.el('button', { class: 'chip' + (period === 'custom' ? ' active' : ''), onclick: showRangePicker }, 'Custom…')
      )
    ));

    const range = getRange();
    const sales = AppState.state.sales.filter(s => s.date >= range.start && s.date < range.end && s.status !== 'void');
    const exps = AppState.state.expenses.filter(e => e.date >= range.start && e.date < range.end && !e.reversed);

    // Summary metrics
    const rev = U.sum(sales, 'netSales');
    const cogs = U.sum(sales, 'costOfGoods');
    const gross = rev - cogs;
    const expTotal = exps.reduce((a,e)=>a+(Number(e.amount)||0),0);
    const net = gross - expTotal;
    const itemsSold = sales.reduce((a,s)=>a+s.items.reduce((b,i)=>b+i.qty,0),0);

    container.appendChild(U.el('div', { class: 'stats-grid' },
      stat('Revenue', U.currency(rev), sales.length + ' transactions'),
      stat('Gross Profit', U.currency(gross), U.percent(rev ? gross/rev : 0) + ' margin', 'accent'),
      stat('Net Profit', U.currency(net), 'After expenses', net >= 0 ? '' : 'danger'),
      stat('Items Sold', String(itemsSold), 'Total units'),
    ));

    // Chart
    const sec = U.el('div', { class: 'section' });
    const cw = U.el('div', { class: 'chart-wrap', style: { height: '240px' } });
    const canvas = U.el('canvas');
    cw.appendChild(canvas);
    sec.appendChild(cw);
    container.appendChild(sec);

    // Build daily series
    const days = Math.max(1, Math.min(365, Math.ceil((range.end - range.start) / U.MS_DAY)));
    const labels = [], revData = [], expData2 = [];
    for (let i = 0; i < days; i++) {
      const ds = range.start + i * U.MS_DAY;
      const de = ds + U.MS_DAY;
      labels.push(days > 45 ? new Date(ds).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : U.formatDate(ds, 'short'));
      const dSales = sales.filter(s => s.date >= ds && s.date < de);
      const dExp = exps.filter(e => e.date >= ds && e.date < de).reduce((a,e)=>a+(Number(e.amount)||0),0);
      revData.push(U.sum(dSales, 'netSales'));
      expData2.push(dExp);
    }
    setTimeout(() => {
      if (reportType === 'expenses') {
        Charts.drawBarChart(canvas, { labels, datasets: [{ label: 'Expenses', data: expData2, color: '#D64545' }] });
      } else {
        Charts.drawLineChart(canvas, { labels, datasets: [
          { label: 'Revenue', data: revData, color: '#35A879' },
          { label: 'Expenses', data: expData2, color: '#D64545' }
        ]});
      }
    }, 30);

    // Report tables
    const details = U.el('div', { class: 'section' });
    details.appendChild(U.el('h3', { class: 'section-title', style: { marginBottom: 12 } }, titleForReport()));

    if (reportType === 'sales') {
      details.appendChild(buildSalesTable(sales));
    } else if (reportType === 'products') {
      details.appendChild(buildProductsTable(sales));
    } else if (reportType === 'expenses') {
      details.appendChild(buildExpensesTable(exps));
    } else if (reportType === 'payments') {
      details.appendChild(buildPaymentsTable(sales));
    }
    container.appendChild(details);
  }

  function titleForReport() {
    return { sales: 'Sales Transactions', products: 'Product Performance', expenses: 'Expense Breakdown', payments: 'Payment Methods' }[reportType];
  }

  function stat(l, v, s, a) {
    return U.el('div', { class: 'stat-card ' + (a||'') },
      U.el('div', { class: 'stat-label' }, l),
      U.el('div', { class: 'stat-value' }, v),
      U.el('div', { class: 'stat-sub' }, s)
    );
  }
  function chip(label, key) {
    return U.el('button', { class: 'chip' + (reportType === key ? ' active' : ''), onclick: () => { reportType = key; render(); } }, label);
  }
  function periodChip(label, key) {
    return U.el('button', { class: 'chip' + (period === key ? ' active' : ''), onclick: () => { period = key; render(); } }, label);
  }

  function getRange() {
    const now = Date.now();
    switch (period) {
      case 'today': return { start: U.todayStart(), end: U.todayStart() + U.MS_DAY };
      case 'week': return { start: U.startOfWeek(), end: U.todayStart() + U.MS_DAY };
      case 'month': return { start: U.startOfMonth(), end: U.todayStart() + U.MS_DAY };
      case 'year': return { start: U.startOfYear(), end: U.todayStart() + U.MS_DAY };
      case 'custom':
        if (customStart && customEnd) return { start: customStart, end: customEnd + U.MS_DAY };
        return { start: U.startOfMonth(), end: U.todayStart() + U.MS_DAY };
      default: return { start: U.startOfMonth(), end: U.todayStart() + U.MS_DAY };
    }
  }

  function showRangePicker() {
    const body = U.el('div', {},
      U.el('div', { class: 'form-group' },
        U.el('label', { class: 'form-label' }, 'Start date'),
        U.el('input', { type: 'date', id: 'rp-start', class: 'form-input', value: U.dateKey(U.startOfMonth()) })
      ),
      U.el('div', { class: 'form-group' },
        U.el('label', { class: 'form-label' }, 'End date'),
        U.el('input', { type: 'date', id: 'rp-end', class: 'form-input', value: U.dateKey(Date.now()) })
      )
    );
    U.openModal({
      title: 'Custom date range', body, footer: [
        U.el('button', { class: 'btn btn-ghost', onclick: () => document.querySelector('#modal-root .modal-close').click() }, 'Cancel'),
        U.el('button', { class: 'btn btn-primary', onclick: () => {
          const s = U.$('#rp-start').value; const e = U.$('#rp-end').value;
          if (!s || !e) return U.toast('Select dates', 'error');
          customStart = new Date(s + 'T00:00:00').getTime();
          customEnd = new Date(e + 'T00:00:00').getTime();
          if (customEnd < customStart) return U.toast('Invalid range', 'error');
          period = 'custom';
          document.querySelector('#modal-root .modal-close').click();
          render();
        }}, 'Apply')
      ]
    });
  }

  function buildSalesTable(sales) {
    if (!sales.length) return emptyBlock('No sales in this period');
    const tw = U.el('div', { class: 'table-wrap' });
    const tbl = U.el('table', { class: 'data-table' });
    tbl.innerHTML = `<thead><tr><th>Receipt</th><th>Date</th><th class="num">Items</th><th class="num">Total</th><th class="num">Profit</th><th>Method</th></tr></thead><tbody></tbody>`;
    const tb = tbl.querySelector('tbody');
    sales.sort((a,b)=>b.date-a.date).forEach(s => {
      const tr = U.el('tr');
      tr.innerHTML = `
        <td><strong>${s.transactionNo}</strong></td>
        <td>${U.formatDate(s.date, 'datetime')}</td>
        <td class="num">${s.items.reduce((a,i)=>a+i.qty,0)}</td>
        <td class="num mono"><strong>${U.currency(s.netSales)}</strong></td>
        <td class="num mono">${U.currency(s.grossProfit)}</td>
        <td><span class="badge badge-info">${(s.paymentMethod||'cash').toUpperCase()}</span></td>`;
      tr.style.cursor = 'pointer';
      tr.onclick = () => App.showTransaction(s.id);
      tb.appendChild(tr);
    });
    tw.appendChild(tbl);
    return tw;
  }

  function buildProductsTable(sales) {
    const map = new Map();
    sales.forEach(s => s.items.forEach(i => {
      const key = i.productId;
      if (!map.has(key)) map.set(key, { name: i.name, sku: i.sku, qty: 0, revenue: 0, cogs: 0 });
      const e = map.get(key);
      e.qty += i.qty;
      e.revenue += i.lineTotal;
      e.cogs += i.unitCost * i.qty;
    }));
    const arr = Array.from(map.values()).map(r => ({ ...r, profit: r.revenue - r.cogs })).sort((a,b) => b.qty - a.qty);
    if (!arr.length) return emptyBlock('No product sales in this period');
    const tw = U.el('div', { class: 'table-wrap' });
    const tbl = U.el('table', { class: 'data-table' });
    tbl.innerHTML = `<thead><tr><th>Product</th><th class="num">Sold</th><th class="num">Revenue</th><th class="num">Profit</th></tr></thead><tbody></tbody>`;
    const tb = tbl.querySelector('tbody');
    arr.forEach(r => {
      const tr = U.el('tr');
      tr.innerHTML = `
        <td><strong>${U.escapeHtml(r.name)}</strong><br><span class="muted" style="font-size:11px">${U.escapeHtml(r.sku||'')}</span></td>
        <td class="num mono">${r.qty}</td>
        <td class="num mono">${U.currency(r.revenue)}</td>
        <td class="num mono">${U.currency(r.profit)}</td>`;
      tb.appendChild(tr);
    });
    tw.appendChild(tbl);
    return tw;
  }

  function buildExpensesTable(exps) {
    if (!exps.length) return emptyBlock('No expenses in this period');
    const tw = U.el('div', { class: 'table-wrap' });
    const tbl = U.el('table', { class: 'data-table' });
    tbl.innerHTML = `<thead><tr><th>Date</th><th>Category</th><th>Description</th><th class="num">Amount</th></tr></thead><tbody></tbody>`;
    const tb = tbl.querySelector('tbody');
    exps.sort((a,b)=>b.date-a.date).forEach(e => {
      const tr = U.el('tr');
      tr.innerHTML = `
        <td>${U.formatDate(e.date, 'date')}</td>
        <td>${Expenses.getCatLabel ? getCat(e.category) : e.category}</td>
        <td>${U.escapeHtml(e.description||'—')}</td>
        <td class="num mono">${U.currency(e.amount)}</td>`;
      tb.appendChild(tr);
    });
    tw.appendChild(tbl);
    return tw;
  }
  function getCat(id) {
    const c = (Expenses.EXPENSE_CATEGORIES || []).find(c => c.id === id);
    return c ? (c.emoji + ' ' + c.label) : id;
  }

  function buildPaymentsTable(sales) {
    const methods = {};
    sales.forEach(s => {
      const m = s.paymentMethod || 'cash';
      if (!methods[m]) methods[m] = { count: 0, total: 0 };
      methods[m].count++;
      methods[m].total += s.netSales;
    });
    const keys = Object.keys(methods);
    if (!keys.length) return emptyBlock('No payments in this period');
    const tw = U.el('div', { class: 'table-wrap' });
    const tbl = U.el('table', { class: 'data-table' });
    tbl.innerHTML = `<thead><tr><th>Method</th><th class="num">Transactions</th><th class="num">Total</th><th class="num">%</th></tr></thead><tbody></tbody>`;
    const tb = tbl.querySelector('tbody');
    const total = keys.reduce((a,k)=>a+methods[k].total,0);
    keys.forEach(k => {
      const tr = U.el('tr');
      tr.innerHTML = `
        <td><span class="badge badge-info">${k.toUpperCase()}</span></td>
        <td class="num mono">${methods[k].count}</td>
        <td class="num mono"><strong>${U.currency(methods[k].total)}</strong></td>
        <td class="num mono">${U.percent(total ? methods[k].total/total : 0)}</td>`;
      tb.appendChild(tr);
    });
    tw.appendChild(tbl);
    return tw;
  }

  function emptyBlock(msg) {
    return U.el('div', { class: 'empty-state' },
      U.svgIcon('chart', 48),
      U.el('h3', {}, msg),
      U.el('p', {}, 'Try changing the report type or date range.')
    );
  }

  global.Reports = { render };
})(window);
