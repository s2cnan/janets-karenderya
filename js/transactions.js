/* ==========================================================================
   Transactions history
   ========================================================================== */
(function (global) {
  'use strict';

  let filterPeriod = 'all';
  let search = '';
  let showingMobile = window.innerWidth < 720;

  window.addEventListener('resize', U.debounce(() => {
    const was = showingMobile;
    showingMobile = window.innerWidth < 720;
    if (was !== showingMobile && AppState.state.currentView === 'transactions') render();
  }, 200));

  function render() {
    const container = U.$('#view-container');
    U.clear(container);

    const now = Date.now();
    const range = {
      today: { start: U.todayStart(), end: U.todayStart() + U.MS_DAY, label: 'Today' },
      week: { start: U.startOfWeek(), end: U.todayStart() + U.MS_DAY, label: 'This week' },
      month: { start: U.startOfMonth(), end: U.todayStart() + U.MS_DAY, label: 'This month' },
      year: { start: U.startOfYear(), end: U.todayStart() + U.MS_DAY, label: 'This year' },
      all: { start: 0, end: Infinity, label: 'All time' },
    }[filterPeriod];

    let sales = AppState.state.sales.slice();
    if (range.start !== 0 || isFinite(range.end)) sales = sales.filter(s => s.date >= range.start && s.date < range.end);
    const q = search.trim().toLowerCase();
    if (q) sales = sales.filter(s => s.transactionNo.toLowerCase().includes(q) || s.items.some(i => i.name.toLowerCase().includes(q)));
    sales.sort((a, b) => b.date - a.date);

    const completed = sales.filter(s => s.status !== 'void');
    const totalRev = U.sum(completed, 'netSales');
    const totalGP = U.sum(completed, 'grossProfit');
    const voidCount = sales.length - completed.length;

    container.appendChild(U.el('div', { class: 'stats-grid' },
      stat('Transactions', String(completed.length), range.label),
      stat('Revenue', U.currency(totalRev), 'Total net sales', 'accent'),
      stat('Gross Profit', U.currency(totalGP), U.percent(totalRev ? totalGP / totalRev : 0) + ' margin', 'accent'),
      stat('Voids', String(voidCount), voidCount ? 'Refunds/voids' : 'None', voidCount ? 'danger' : ''),
    ));

    const sec = U.el('div', { class: 'section' });
    sec.appendChild(U.el('div', { class: 'section-header' },
      U.el('div', {},
        U.el('h3', { class: 'section-title' }, 'Transactions'),
        U.el('p', { class: 'section-sub' }, 'Completed sales, voids, and refunds')
      ),
      U.el('div', { class: 'section-actions' },
        U.el('button', { class: 'btn btn-ghost btn-small', onclick: exportSalesCSV }, U.svgIcon('download', 14), ' Export CSV')
      )
    ));

    sec.appendChild(U.el('div', { class: 'search-bar', style: { marginBottom: '10px' } },
      U.svgIcon('search'),
      U.el('input', { type: 'search', class: 'form-input', placeholder: 'Search receipt # or items…', value: search,
        oninput: U.debounce((e) => { search = e.target.value; renderList(); }, 150) })
    ));

    sec.appendChild(U.el('div', { class: 'chip-row' },
      chip('Today', 'today'), chip('Week', 'week'), chip('Month', 'month'),
      chip('Year', 'year'), chip('All', 'all')
    ));

    const wrap = U.el('div', { id: 'tx-list' });
    sec.appendChild(wrap);
    container.appendChild(sec);

    renderList();
  }

  function stat(l, v, s, a) {
    return U.el('div', { class: 'stat-card ' + (a||'') },
      U.el('div', { class: 'stat-label' }, l),
      U.el('div', { class: 'stat-value' }, v),
      U.el('div', { class: 'stat-sub' }, s)
    );
  }
  function chip(label, key) {
    return U.el('button', { class: 'chip' + (filterPeriod === key ? ' active' : ''), onclick: () => { filterPeriod = key; render(); } }, label);
  }

  function getFiltered() {
    const now = Date.now();
    const range = {
      today: { start: U.todayStart(), end: U.todayStart() + U.MS_DAY },
      week: { start: U.startOfWeek(), end: U.todayStart() + U.MS_DAY },
      month: { start: U.startOfMonth(), end: U.todayStart() + U.MS_DAY },
      year: { start: U.startOfYear(), end: U.todayStart() + U.MS_DAY },
      all: { start: 0, end: Infinity },
    }[filterPeriod];
    let sales = AppState.state.sales.slice();
    if (range.start !== 0 || isFinite(range.end)) sales = sales.filter(s => s.date >= range.start && s.date < range.end);
    const q = search.trim().toLowerCase();
    if (q) sales = sales.filter(s => s.transactionNo.toLowerCase().includes(q) || s.items.some(i => i.name.toLowerCase().includes(q)));
    return sales.sort((a,b) => b.date - a.date);
  }

  function renderList() {
    const wrap = U.$('#tx-list');
    if (!wrap) return;
    U.clear(wrap);
    const sales = getFiltered();
    if (!sales.length) {
      wrap.appendChild(U.el('div', { class: 'empty-state' },
        U.svgIcon('cart', 48),
        U.el('h3', {}, 'No transactions found'),
        U.el('p', {}, 'Transactions will appear here after checkout.')));
      return;
    }
    if (showingMobile) {
      const cards = U.el('div', { class: 'product-list-cards' });
      sales.forEach(s => cards.appendChild(txCard(s)));
      wrap.appendChild(cards);
    } else {
      const tw = U.el('div', { class: 'table-wrap' });
      const tbl = U.el('table', { class: 'data-table' });
      tbl.innerHTML = `<thead><tr>
        <th>Receipt</th><th>Date</th><th>Items</th><th class="num">Subtotal</th>
        <th class="num">Discount</th><th class="num">Total</th><th>Method</th><th>Status</th><th></th>
      </tr></thead><tbody></tbody>`;
      sales.forEach(s => tbl.querySelector('tbody').appendChild(txRow(s)));
      tw.appendChild(tbl);
      wrap.appendChild(tw);
    }
  }

  function txRow(s) {
    const tr = U.el('tr', { style: s.status === 'void' ? 'opacity:0.6;' : '' });
    tr.innerHTML = `
      <td><strong>${s.transactionNo}</strong></td>
      <td>${U.formatDate(s.date, 'datetime')}</td>
      <td>${s.items.reduce((a,i)=>a+i.qty,0)}</td>
      <td class="num mono">${U.currency(s.subtotal)}</td>
      <td class="num mono">${s.discountAmount > 0 ? U.currency(s.discountAmount) : '—'}</td>
      <td class="num mono"><strong>${U.currency(s.netSales)}</strong></td>
      <td><span class="badge badge-info">${(s.paymentMethod||'cash').toUpperCase()}</span></td>
      <td>${s.status === 'void' ? '<span class="badge badge-danger">Void</span>' : '<span class="badge badge-success">Completed</span>'}</td>
      <td class="actions-cell"></td>`;
    const ac = tr.querySelector('.actions-cell');
    ac.appendChild(U.el('button', { class: 'btn btn-ghost btn-small', onclick: () => App.showTransaction(s.id) }, 'View'));
    return tr;
  }

  function txCard(s) {
    const card = U.el('div', { class: 'product-row-card', style: s.status === 'void' ? 'opacity:0.65;' : '' });
    card.appendChild(U.el('div', { class: 'pimg-s', style: { background: 'linear-gradient(135deg, var(--mint), rgba(53,168,121,0.25));' } },
      U.el('span', { style: { fontSize: '22px' } }, '🧾')
    ));
    const info = U.el('div', { class: 'pinfo' });
    info.appendChild(U.el('div', { class: 'n' }, s.transactionNo));
    info.appendChild(U.el('div', { class: 'm' },
      U.el('span', {}, U.formatDate(s.date, 'datetime')),
      U.el('span', {}, s.items.reduce((a,i)=>a+i.qty,0) + ' items'),
      s.status === 'void' ? U.el('span', { class: 'badge badge-danger' }, 'VOID') : null
    ));
    card.appendChild(info);
    const right = U.el('div', { style: { textAlign: 'right' } });
    right.appendChild(U.el('div', { class: 'price mono' }, U.currency(s.netSales)));
    const btnRow = U.el('div', { style: { marginTop: '6px', display: 'flex', gap: '4px', justifyContent: 'flex-end' } });
    btnRow.appendChild(U.el('button', { class: 'btn btn-ghost btn-small', onclick: () => App.showTransaction(s.id) }, 'View'));
    right.appendChild(btnRow);
    card.appendChild(right);
    return card;
  }

  function exportSalesCSV() {
    const sales = getFiltered();
    const csv = U.toCSV(sales, [
      { key: 'transactionNo', label: 'Receipt #' },
      { key: 'date', label: 'Date', get: s => new Date(s.date).toLocaleString('en-PH') },
      { key: 'items', label: 'Items', get: s => s.items.map(i => `${i.qty}x ${i.name}`).join('; ') },
      { key: 'subtotal', label: 'Subtotal' },
      { key: 'discountAmount', label: 'Discount' },
      { key: 'netSales', label: 'Total' },
      { key: 'costOfGoods', label: 'COGS' },
      { key: 'grossProfit', label: 'Gross Profit' },
      { key: 'paymentMethod', label: 'Payment Method' },
      { key: 'amountReceived', label: 'Amount Received' },
      { key: 'change', label: 'Change' },
      { key: 'status', label: 'Status' },
    ]);
    U.downloadFile('transactions-' + U.dateKey(Date.now()) + '.csv', csv);
    U.toast('Transactions exported', 'success');
  }

  global.Transactions = { render };
})(window);
