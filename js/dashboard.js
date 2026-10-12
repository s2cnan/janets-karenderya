/* ==========================================================================
   Dashboard view
   ========================================================================== */
(function (global) {
  'use strict';

  let currentPeriod = 'today';
  let customStart = null, customEnd = null;

  function getRange() {
    const now = Date.now();
    switch (currentPeriod) {
      case 'today': return { start: U.todayStart(), end: U.todayStart() + U.MS_DAY, label: 'Today' };
      case 'week': return { start: U.startOfWeek(), end: U.todayStart() + U.MS_DAY, label: 'This week' };
      case 'month': return { start: U.startOfMonth(), end: U.todayStart() + U.MS_DAY, label: 'This month' };
      case 'year': return { start: U.startOfYear(), end: U.todayStart() + U.MS_DAY, label: 'This year' };
      case 'custom': return { start: customStart, end: customEnd + U.MS_DAY, label: 'Custom' };
      default: return { start: U.todayStart(), end: U.todayStart() + U.MS_DAY, label: 'Today' };
    }
  }

  function computeMetrics() {
    const { start, end } = getRange();
    const sales = AppState.state.sales.filter(s => s.date >= start && s.date < end && s.status !== 'void');
    const revenue = U.sum(sales, 'netSales');
    const cogs = U.sum(sales, 'costOfGoods');
    const grossProfit = revenue - cogs;
    const expenses = AppState.state.expenses
      .filter(e => e.date >= start && e.date < end && !e.reversed)
      .reduce((a, e) => a + (Number(e.amount) || 0), 0);
    const netProfit = grossProfit - expenses;
    const txCount = sales.length;
    const products = AppState.state.products;
    const inventoryValue = products.reduce((a, p) => a + (Number(p.purchaseCost) || 0) * (Number(p.stock) || 0), 0);
    const totalProducts = products.filter(p => p.status !== 'archived').length;
    const lowStock = products.filter(p => p.status !== 'archived' && (p.stock || 0) <= (p.minStock || 0) && (p.stock || 0) > 0);
    const outOfStock = products.filter(p => p.status !== 'archived' && (p.stock || 0) === 0);
    return {
      revenue, cogs, grossProfit, expenses, netProfit, txCount,
      inventoryValue, totalProducts, lowStock, outOfStock, sales,
    };
  }

  function buildSeries() {
    const { start, end } = getRange();
    const days = Math.max(1, Math.ceil((end - start) / U.MS_DAY));
    const labels = [];
    const revData = [];
    const profitData = [];
    const expData = [];
    const now = Date.now();
    const sales = AppState.state.sales.filter(s => s.status !== 'void');
    const exps = AppState.state.expenses.filter(e => !e.reversed);
    for (let i = 0; i < days; i++) {
      const dStart = start + i * U.MS_DAY;
      const dEnd = dStart + U.MS_DAY;
      const isFuture = dStart > U.todayStart();
      labels.push(U.formatDate(dStart, 'short'));
      if (isFuture && currentPeriod !== 'custom') {
        revData.push(null); profitData.push(null); expData.push(null);
      } else {
        const daySales = sales.filter(s => s.date >= dStart && s.date < dEnd);
        const dayExp = exps.filter(e => e.date >= dStart && e.date < dEnd).reduce((a, e) => a + (Number(e.amount) || 0), 0);
        const r = U.sum(daySales, 'netSales');
        const gp = U.sum(daySales, 'grossProfit');
        revData.push(r);
        profitData.push(gp - dayExp);
        expData.push(dayExp);
      }
    }
    return { labels, revData, profitData, expData };
  }

  function render() {
    const m = computeMetrics();
    const recentTx = [...m.sales].sort((a, b) => b.date - a.date).slice(0, 6);

    const container = U.$('#view-container');
    U.clear(container);

    container.appendChild(U.el('div', { class: 'stats-grid' },
      statCard('Revenue', U.currency(m.revenue), m.txCount + ' transactions', 'accent'),
      statCard('Gross Profit', U.currency(m.grossProfit), U.percent(m.revenue ? m.grossProfit / m.revenue : 0) + ' margin', 'accent'),
      statCard('Net Profit', U.currency(m.netProfit), 'After expenses', m.netProfit >= 0 ? '' : 'danger'),
      statCard('Inventory Value', U.currency(m.inventoryValue), m.totalProducts + ' products', ''),
      statCard('Transactions', String(m.txCount), getRange().label, ''),
      statCard('Low Stock', String(m.lowStock.length), (m.outOfStock.length + ' out of stock'), m.lowStock.length > 0 ? 'warn' : ''),
    ));

    // Chart
    const series = buildSeries();
    const section = U.el('div', { class: 'section' });
    section.appendChild(U.el('div', { class: 'section-header' },
      U.el('div', {},
        U.el('h3', { class: 'section-title' }, 'Sales Performance'),
        U.el('p', { class: 'section-sub' }, getRange().label + ' · Daily revenue & profit')
      ),
      U.el('div', { class: 'chip-row' },
        periodChip('Today', 'today'),
        periodChip('Week', 'week'),
        periodChip('Month', 'month'),
        periodChip('Year', 'year'),
        U.el('button', { class: 'chip' + (currentPeriod === 'custom' ? ' active' : ''), onclick: showCustomRange }, 'Custom')
      )
    ));
    const chartWrap = U.el('div', { class: 'chart-wrap' });
    const canvas = U.el('canvas');
    chartWrap.appendChild(canvas);
    section.appendChild(chartWrap);
    container.appendChild(section);

    setTimeout(() => {
      // Trim nulls from the tail
      const labels = series.labels;
      const rev = series.revData.map(v => v == null ? 0 : v);
      const profit = series.profitData.map(v => v == null ? 0 : v);
      Charts.drawLineChart(canvas, {
        labels,
        datasets: [
          { label: 'Revenue', data: rev, color: '#35A879' },
          { label: 'Net Profit', data: profit, color: '#153F32' },
        ]
      });
    }, 30);

    // Two columns: Recent transactions + Quick actions
    const two = U.el('div', { class: 'two-col' });

    // Recent transactions
    const recentSec = U.el('div', { class: 'section' });
    recentSec.appendChild(U.el('div', { class: 'section-header' },
      U.el('div', {},
        U.el('h3', { class: 'section-title' }, 'Recent Transactions'),
      ),
      U.el('button', { class: 'btn btn-ghost btn-small', onclick: () => App.setView('transactions') }, 'View all')
    ));
    if (!recentTx.length) {
      recentSec.appendChild(U.el('div', { class: 'empty-state' },
        U.svgIcon('cart', 48),
        U.el('h3', {}, 'No transactions yet'),
        U.el('p', {}, 'Open the cashier to start recording sales.'),
        U.el('button', { class: 'btn btn-primary', onclick: () => App.setView('cashier') }, 'Open Cashier')
      ));
    } else {
      const tw = U.el('div', { class: 'table-wrap' });
      const tbl = U.el('table', { class: 'data-table' });
      tbl.innerHTML = `
        <thead><tr><th>Receipt</th><th>Time</th><th>Items</th><th class="num">Total</th><th>Method</th></tr></thead>
        <tbody></tbody>`;
      const tb = tbl.querySelector('tbody');
      recentTx.forEach(s => {
        const tr = U.el('tr');
        tr.innerHTML = `
          <td><strong>${s.transactionNo}</strong></td>
          <td>${U.formatDate(s.date, 'time')}</td>
          <td>${s.items.reduce((a,i)=>a+i.qty,0)} items</td>
          <td class="num"><strong>${U.currency(s.netSales)}</strong></td>
          <td><span class="badge badge-info">${(s.paymentMethod||'cash').toUpperCase()}</span></td>`;
        tr.style.cursor = 'pointer';
        tr.onclick = () => AppState.state.sales.length && showTxDetail(s.id);
        tb.appendChild(tr);
      });
      tw.appendChild(tbl);
      recentSec.appendChild(tw);
    }
    two.appendChild(recentSec);

    // Quick actions + alerts
    const quick = U.el('div', { class: 'section' });
    quick.appendChild(U.el('h3', { class: 'section-title' }, 'Quick Actions'));
    const qgrid = U.el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', marginTop: '12px' } });
    qgrid.appendChild(quickBtn('Open Cashier', 'cart', () => App.setView('cashier'), true));
    qgrid.appendChild(quickBtn('Add Product', 'plus', () => Inventory.openEditor()));
    qgrid.appendChild(quickBtn('Restock', 'upload', () => App.setView('inventory')));
    qgrid.appendChild(quickBtn('Record Expense', 'minus', () => Expenses.openEditor()));
    qgrid.appendChild(quickBtn('View Reports', 'chart', () => App.setView('reports')));
    qgrid.appendChild(quickBtn('Backup Data', 'download', () => Settings.backupNow()));
    quick.appendChild(qgrid);

    if (m.lowStock.length || m.outOfStock.length) {
      const alerts = U.el('div', { class: 'mt-16' });
      alerts.appendChild(U.el('h4', { style: { margin: '0 0 8px', fontSize: '14px', color: 'var(--warning)' } }, '⚠ Inventory Alerts'));
      if (m.outOfStock.length) {
        alerts.appendChild(U.el('p', { class: 'muted', style: { margin: '4px 0', fontSize: '13px' } },
          m.outOfStock.length + ' out-of-stock: ' + m.outOfStock.slice(0, 4).map(p => p.name).join(', ') + (m.outOfStock.length > 4 ? '…' : '')));
      }
      if (m.lowStock.length) {
        alerts.appendChild(U.el('p', { class: 'muted', style: { margin: '4px 0', fontSize: '13px' } },
          m.lowStock.length + ' low-stock: ' + m.lowStock.slice(0, 4).map(p => p.name).join(', ') + (m.lowStock.length > 4 ? '…' : '')));
      }
      quick.appendChild(alerts);
    }
    two.appendChild(quick);
    container.appendChild(two);
  }

  function statCard(label, value, sub, accent = '') {
    return U.el('div', { class: 'stat-card ' + accent },
      U.el('div', { class: 'stat-label' }, label),
      U.el('div', { class: 'stat-value' }, value),
      U.el('div', { class: 'stat-sub' }, sub)
    );
  }

  function periodChip(label, key) {
    return U.el('button', {
      class: 'chip' + (currentPeriod === key ? ' active' : ''),
      onclick: () => { currentPeriod = key; render(); }
    }, label);
  }

  function quickBtn(label, icon, onClick, primary = false) {
    const b = U.el('button', {
      class: 'btn ' + (primary ? 'btn-primary' : 'btn-ghost'),
      style: { flexDirection: 'column', padding: '18px 10px', gap: '6px', fontSize: '13px' },
      onclick: onClick
    });
    b.appendChild(U.svgIcon(icon, 22));
    b.appendChild(U.el('span', {}, label));
    return b;
  }

  function showCustomRange() {
    const body = U.el('div', {},
      U.el('div', { class: 'form-group' },
        U.el('label', { class: 'form-label' }, 'Start date'),
        U.el('input', { type: 'date', id: 'cr-start', class: 'form-input', value: U.dateKey(U.startOfMonth()) })
      ),
      U.el('div', { class: 'form-group' },
        U.el('label', { class: 'form-label' }, 'End date'),
        U.el('input', { type: 'date', id: 'cr-end', class: 'form-input', value: U.dateKey(Date.now()) })
      )
    );
    U.openModal({
      title: 'Custom Date Range',
      body,
      footer: [
        U.el('button', { class: 'btn btn-ghost', onclick: () => document.querySelector('#modal-root .modal-close').click() }, 'Cancel'),
        U.el('button', { class: 'btn btn-primary', onclick: () => {
          const s = U.$('#cr-start').value; const e = U.$('#cr-end').value;
          if (!s || !e) return U.toast('Select start and end', 'error');
          customStart = new Date(s + 'T00:00:00').getTime();
          customEnd = new Date(e + 'T00:00:00').getTime();
          if (customEnd < customStart) return U.toast('End date must be after start', 'error');
          currentPeriod = 'custom';
          document.querySelector('#modal-root .modal-close').click();
          render();
        } }, 'Apply')
      ]
    });
  }

  function showTxDetail(id) {
    App.showTransaction(id);
  }

  global.Dashboard = { render };
})(window);
