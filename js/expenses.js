/* ==========================================================================
   Expenses management
   ========================================================================== */
(function (global) {
  'use strict';

  const EXPENSE_CATEGORIES = [
    { id: 'rent', label: 'Rent', emoji: '🏠' },
    { id: 'electricity', label: 'Electricity', emoji: '💡' },
    { id: 'water', label: 'Water', emoji: '💧' },
    { id: 'transport', label: 'Transportation', emoji: '🛵' },
    { id: 'supplies', label: 'Supplies / Packaging', emoji: '📦' },
    { id: 'salary', label: 'Salary / Labor', emoji: '👤' },
    { id: 'taxes', label: 'Taxes / Permits', emoji: '📋' },
    { id: 'marketing', label: 'Marketing', emoji: '📢' },
    { id: 'maintenance', label: 'Maintenance', emoji: '🔧' },
    { id: 'misc', label: 'Miscellaneous', emoji: '🗒️' },
  ];

  let filterPeriod = 'month';

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

    const exps = AppState.state.expenses.filter(e => !e.reversed && e.date >= range.start && e.date < range.end);
    const total = exps.reduce((a,e) => a + (Number(e.amount)||0), 0);
    const daily = range.end !== Infinity && range.start ? total / Math.max(1, Math.ceil((U.todayStart()+U.MS_DAY - range.start)/U.MS_DAY)) : total / Math.max(1, AppState.state.expenses.length);

    // Category breakdown
    const byCat = {};
    exps.forEach(e => { byCat[e.category] = (byCat[e.category]||0) + (Number(e.amount)||0); });
    const catEntries = Object.entries(byCat).sort((a,b) => b[1] - a[1]);

    container.appendChild(U.el('div', { class: 'stats-grid' },
      stat('Total Expenses', U.currency(total), range.label, 'warn'),
      stat('Average per day', U.currency(daily), 'Estimated'),
      stat('Entries', String(exps.length), 'Recorded expenses'),
      stat('Top category', catEntries[0] ? getCatLabel(catEntries[0][0]) : '—', catEntries[0] ? U.currency(catEntries[0][1]) : ''),
    ));

    const sec = U.el('div', { class: 'section' });
    sec.appendChild(U.el('div', { class: 'section-header' },
      U.el('div', {},
        U.el('h3', { class: 'section-title' }, 'Expense Records'),
        U.el('p', { class: 'section-sub' }, 'Track business operating costs')
      ),
      U.el('div', { class: 'section-actions' },
        U.el('div', { class: 'chip-row' },
          periodChip('Today', 'today'), periodChip('Week', 'week'), periodChip('Month', 'month'),
          periodChip('Year', 'year'), periodChip('All', 'all')),
        U.el('button', { class: 'btn btn-primary', onclick: () => openEditor() }, U.svgIcon('plus', 14), ' Record Expense')
      )
    ));

    // Category breakdown as small bars
    if (catEntries.length) {
      const breakdown = U.el('div', { style: { marginBottom: '16px' } });
      catEntries.slice(0, 6).forEach(([cid, amt]) => {
        const pct = total > 0 ? amt / total : 0;
        const row = U.el('div', { style: { marginBottom: '8px' } });
        row.appendChild(U.el('div', { class: 'row-between', style: { fontSize: '13px', marginBottom: '4px' } },
          U.el('span', {}, getCatEmoji(cid) + ' ' + getCatLabel(cid)),
          U.el('span', { class: 'mono' }, U.currency(amt) + ' · ' + U.percent(pct, 0))
        ));
        const bar = U.el('div', { style: { height: '6px', borderRadius: '999px', background: 'rgba(122,133,126,0.15)', overflow: 'hidden' } });
        bar.appendChild(U.el('div', { style: { height: '100%', width: (pct*100)+'%', background: 'linear-gradient(90deg, #E0A23A, #d48a1c)', borderRadius: '999px' } }));
        row.appendChild(bar);
        breakdown.appendChild(row);
      });
      sec.appendChild(breakdown);
    }

    // List (responsive)
    const list = U.el('div', { class: 'product-list-cards' });
    if (!exps.length) {
      sec.appendChild(U.el('div', { class: 'empty-state' },
        U.svgIcon('minus', 48),
        U.el('h3', {}, 'No expenses recorded'),
        U.el('p', {}, 'Record your first business expense to see accurate net profit.'),
        U.el('button', { class: 'btn btn-primary', onclick: () => openEditor() }, 'Record Expense')
      ));
    } else {
      exps.sort((a,b) => b.date - a.date).forEach(e => list.appendChild(expenseCard(e)));
      sec.appendChild(list);
    }
    container.appendChild(sec);
  }

  function stat(l, v, s, a) {
    return U.el('div', { class: 'stat-card ' + (a||'') },
      U.el('div', { class: 'stat-label' }, l),
      U.el('div', { class: 'stat-value' }, v),
      U.el('div', { class: 'stat-sub' }, s)
    );
  }
  function periodChip(label, key) {
    return U.el('button', { class: 'chip' + (filterPeriod === key ? ' active' : ''), onclick: () => { filterPeriod = key; render(); } }, label);
  }
  function getCatLabel(id) { return (EXPENSE_CATEGORIES.find(c => c.id === id) || { label: id }).label; }
  function getCatEmoji(id) { return (EXPENSE_CATEGORIES.find(c => c.id === id) || { emoji: '💳' }).emoji; }

  function expenseCard(e) {
    const card = U.el('div', { class: 'product-row-card' });
    card.appendChild(U.el('div', { class: 'pimg-s', style: { background: 'linear-gradient(135deg, #fce7c4, #f0c87a)' } }, getCatEmoji(e.category)));
    const info = U.el('div', { class: 'pinfo' });
    info.appendChild(U.el('div', { class: 'n' }, getCatLabel(e.category) + (e.description ? ' — ' + e.description : '')));
    info.appendChild(U.el('div', { class: 'm' },
      U.el('span', {}, U.formatDate(e.date, 'date')),
      e.reversed ? U.el('span', { class: 'badge badge-danger' }, 'Reversed') : null
    ));
    card.appendChild(info);
    const right = U.el('div', { style: { textAlign: 'right' } });
    right.appendChild(U.el('div', { class: 'price mono', style: { color: e.reversed ? 'var(--muted-gray)' : undefined } }, (e.reversed ? '(' : '') + U.currency(e.amount) + (e.reversed ? ')' : '')));
    const btn = U.el('div', { style: { marginTop: '6px', display: 'flex', gap: '4px', justifyContent: 'flex-end' } });
    if (!e.reversed) {
      btn.appendChild(U.el('button', { class: 'btn btn-ghost btn-small', onclick: () => reverseExpense(e) }, 'Reverse'));
      btn.appendChild(U.el('button', { class: 'kebab', onclick: () => openEditor(e) }, '⋯'));
    }
    right.appendChild(btn);
    card.appendChild(right);
    return card;
  }

  function openEditor(existing) {
    const e = existing ? { ...existing } : { amount: 0, category: 'misc', date: Date.now(), description: '' };
    const body = U.el('div', {});
    body.appendChild(U.el('div', { class: 'form-group' },
      U.el('label', { class: 'form-label' }, 'Amount (₱) *'),
      U.el('input', { type: 'number', inputMode: 'decimal', class: 'form-input', id: 'e-amount', value: e.amount, min: 0, step: '0.01' })
    ));
    body.appendChild(U.el('div', { class: 'form-group' },
      U.el('label', { class: 'form-label' }, 'Category'),
      buildCatSelect(e.category)
    ));
    const dateObj = new Date(e.date);
    body.appendChild(U.el('div', { class: 'form-group' },
      U.el('label', { class: 'form-label' }, 'Date'),
      U.el('input', { type: 'date', class: 'form-input', id: 'e-date', value: U.dateKey(e.date) })
    ));
    body.appendChild(U.el('div', { class: 'form-group' },
      U.el('label', { class: 'form-label' }, 'Description (optional)'),
      U.el('input', { class: 'form-input', id: 'e-desc', value: e.description || '', placeholder: 'Short note about this expense' })
    ));
    U.openModal({
      title: existing ? 'Edit expense' : 'Record expense',
      body,
      footer: [
        U.el('button', { class: 'btn btn-ghost', onclick: () => document.querySelector('#modal-root .modal-close').click() }, 'Cancel'),
        U.el('button', { class: 'btn btn-primary', onclick: async () => {
          const amount = Math.max(0, Number(U.$('#e-amount').value) || 0);
          if (!amount) return U.toast('Enter a valid amount', 'error');
          const d = U.$('#e-date').value;
          const dt = d ? new Date(d + 'T12:00:00').getTime() : Date.now();
          await DB.saveExpense({
            ...e,
            amount,
            category: U.$('#e-cat').value,
            date: dt,
            description: U.$('#e-desc').value.trim(),
          });
          await AppState.refreshExpenses();
          render();
          document.querySelector('#modal-root .modal-close').click();
          U.toast(existing ? 'Expense updated' : 'Expense added', 'success');
        }}, existing ? 'Save' : 'Record')
      ]
    });
  }

  function buildCatSelect(value) {
    const sel = U.el('select', { class: 'form-select', id: 'e-cat' });
    EXPENSE_CATEGORIES.forEach(c => {
      const o = U.el('option', { value: c.id }, c.emoji + ' ' + c.label);
      if (c.id === value) o.selected = true;
      sel.appendChild(o);
    });
    return sel;
  }

  function reverseExpense(e) {
    U.confirmDialog({
      title: 'Reverse expense?',
      message: `This will mark ${U.currency(e.amount)} (${getCatLabel(e.category)}) as reversed. Net profit will be adjusted. An audit trail is preserved.`,
      confirmText: 'Reverse',
      danger: true,
      onConfirm: async () => {
        await DB.reverseExpense(e.id, 'Reversed by user');
        await AppState.refreshExpenses();
        render();
        U.toast('Expense reversed', 'success');
      }
    });
  }

  global.Expenses = { render, openEditor, EXPENSE_CATEGORIES };
})(window);
