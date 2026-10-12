/* ==========================================================================
   Settings, Backup & Categories
   ========================================================================== */
(function (global) {
  'use strict';

  function render() {
    const container = U.$('#view-container');
    U.clear(container);

    // Header
    container.appendChild(U.el('div', { class: 'section' },
      U.el('div', { class: 'section-header' },
        U.el('div', {},
          U.el('h3', { class: 'section-title' }, 'Settings & Backup'),
          U.el('p', { class: 'section-sub' }, 'Manage business information, security, categories, and data')
        )
      )
    ));

    // Business profile
    const s = AppState.state.settings;
    container.appendChild(settingsSection('Business Information', [
      { id: 'set-name', label: 'Business name', type: 'text', value: s.businessName || 'Janets Karenderya' },
      { id: 'set-address', label: 'Address', type: 'text', value: s.address || '' },
      { id: 'set-tin', label: 'TIN (optional)', type: 'text', value: s.tin || '' },
    ]));

    // Currency & VAT
    const curSec = settingsSection('Currency & Tax', [
      { id: 'set-currency', label: 'Currency code', type: 'text', value: s.currency || 'PHP' },
      { id: 'set-symbol', label: 'Currency symbol', type: 'text', value: s.currencySymbol || '₱' },
      { id: 'set-vatrate', label: 'VAT rate (%)', type: 'number', value: Math.round((s.vatRate || 0) * 100) },
    ], [
      { id: 'set-vat', label: 'Enable VAT-inclusive pricing', type: 'checkbox', value: !!s.vatEnabled }
    ]);
    container.appendChild(curSec);

    // Forecasting
    container.appendChild(settingsSection('Forecasting Assumptions', [
      { id: 'set-growth', label: 'Expected monthly growth (%)', type: 'number', value: Math.round((s.forecastGrowth || 0) * 100) },
      { id: 'set-seasonality', label: 'Seasonality multiplier (1.0 = baseline)', type: 'number', value: s.seasonality || 1.0, step: '0.05' },
    ]));

    // Security
    const secSec = settingsSection('Security', [
      { id: 'set-pin', label: 'App lock PIN (4-6 digits, optional)', type: 'password', value: s.pin ? '******' : '', placeholder: 'Leave empty to disable' },
    ]);
    container.appendChild(secSec);

    // Save button
    container.appendChild(U.el('div', { class: 'section' },
      U.el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
        U.el('button', { class: 'btn btn-primary', onclick: saveSettings }, 'Save Settings'),
        U.el('button', { class: 'btn btn-ghost', onclick: render }, 'Reset')
      )
    ));

    // Categories
    const catSec = U.el('div', { class: 'section' });
    catSec.appendChild(U.el('div', { class: 'section-header' },
      U.el('div', {},
        U.el('h3', { class: 'section-title' }, 'Categories'),
        U.el('p', { class: 'section-sub' }, 'Organize your product catalog')
      ),
      U.el('button', { class: 'btn btn-primary btn-small', onclick: addCategory }, U.svgIcon('plus', 14), ' Add category')
    ));
    const catGrid = U.el('div', { style: { display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))' } });
    AppState.state.categories.forEach(c => catGrid.appendChild(categoryCard(c)));
    catSec.appendChild(catGrid);
    container.appendChild(catSec);

    // Backup & restore
    const backup = U.el('div', { class: 'section' });
    backup.appendChild(U.el('div', { class: 'section-header' },
      U.el('div', {},
        U.el('h3', { class: 'section-title' }, 'Backup & Restore'),
        U.el('p', { class: 'section-sub' }, 'All data is stored locally on this device. Create regular backups to avoid data loss.')
      )
    ));
    backup.appendChild(U.el('div', { class: 'glass', style: { padding: '14px', marginBottom: '14px', background: 'rgba(224,162,58,0.08); border-color: rgba(224,162,58,0.2)' } },
      U.el('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-start' } },
        U.el('div', { style: { fontSize: '20px' } }, '⚠️'),
        U.el('div', {},
          U.el('p', { style: { margin: 0, fontSize: '13px', fontWeight: 600 } }, 'Important reminder'),
          U.el('p', { class: 'muted', style: { margin: '4px 0 0', fontSize: '12px' } },
            'Local browser data can be lost if you uninstall the app, clear browser storage, or reset your device. ' +
            'Backups never leave your device unless you share or copy the file yourself.')
        )
      )
    ));
    const bRow = U.el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } });
    bRow.appendChild(U.el('button', { class: 'btn btn-primary', onclick: backupNow }, U.svgIcon('download', 16), ' Create Backup'));
    bRow.appendChild(U.el('button', { class: 'btn btn-ghost', onclick: restoreDialog }, U.svgIcon('upload', 16), ' Restore from Backup'));
    bRow.appendChild(U.el('button', { class: 'btn btn-ghost', onclick: exportAllCSV }, U.svgIcon('download', 16), ' Export All CSV'));
    backup.appendChild(bRow);
    container.appendChild(backup);

    // Data management
    const dm = U.el('div', { class: 'section' });
    dm.appendChild(U.el('h3', { class: 'section-title' }, 'Data Management'));
    dm.appendChild(U.el('p', { class: 'muted', style: { margin: '4px 0 12px', fontSize: '13px' } }, 'Destructive actions cannot be undone. Create a backup first.'));
    dm.appendChild(U.el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
      U.el('button', { class: 'btn btn-danger', onclick: resetAll }, 'Reset All Data')
    ));
    container.appendChild(dm);

    // About
    const about = U.el('div', { class: 'section' });
    about.appendChild(U.el('h3', { class: 'section-title' }, 'About Janets Karenderya'));
    about.appendChild(U.el('p', { class: 'muted', style: { fontSize: '13px' } },
      'Version 1.0.0 · Offline-first POS & business management. All data is stored locally on this device using IndexedDB. No cloud, no accounts, no tracking.'));
    about.appendChild(U.el('div', { style: { display: 'flex', gap: '14px', marginTop: '10px', fontSize: '13px', flexWrap: 'wrap' } },
      U.el('span', { class: 'tag' }, 'PWA'),
      U.el('span', { class: 'tag' }, 'Offline-first'),
      U.el('span', { class: 'tag' }, 'Local-only'),
      U.el('span', { class: 'tag' }, '₱ PHP'),
    ));
    container.appendChild(about);
  }

  function settingsSection(title, fields, checks = []) {
    const sec = U.el('div', { class: 'section' });
    sec.appendChild(U.el('h3', { class: 'section-title' }, title));
    fields.forEach(f => {
      const g = U.el('div', { class: 'form-group' });
      g.appendChild(U.el('label', { class: 'form-label' }, f.label));
      const inp = U.el('input', { type: f.type, class: 'form-input', id: f.id, value: f.value ?? '', placeholder: f.placeholder || '', step: f.step || (f.type === 'number' ? '0.01' : undefined) });
      g.appendChild(inp);
      sec.appendChild(g);
    });
    checks.forEach(f => {
      const g = U.el('div', { class: 'form-group', style: { flexDirection: 'row', alignItems: 'center', gap: '10px' } });
      const inp = U.el('input', { type: 'checkbox', id: f.id });
      inp.checked = !!f.value;
      inp.style.width = '18px'; inp.style.height = '18px';
      g.appendChild(inp);
      g.appendChild(U.el('label', { class: 'form-label', style: { margin: 0, textTransform: 'none', letterSpacing: '0', fontSize: '14px', fontWeight: 500, color: 'var(--text)' }, for: f.id }, f.label));
      sec.appendChild(g);
    });
    return sec;
  }

  function categoryCard(c) {
    const card = U.el('div', { class: 'glass', style: { padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' } });
    card.appendChild(U.el('div', { class: 'pimg-s', style: { width: '40px', height: '40px', background: c.color ? hexBg(c.color) : undefined, fontSize: '20px' } }, c.emoji || '📦'));
    const info = U.el('div', { style: { flex: 1 } });
    info.appendChild(U.el('div', { style: { fontWeight: 600, fontSize: '14px' } }, c.name));
    card.appendChild(info);
    const acts = U.el('div', { style: { display: 'flex', gap: '4px' } });
    acts.appendChild(U.el('button', { class: 'kebab', onclick: () => editCategory(c) }, '⋯'));
    card.appendChild(acts);
    return card;
  }
  function hexBg(hex) {
    return 'linear-gradient(135deg,' + hex + '33,' + hex + '66)';
  }

  function addCategory() { editCategory(null); }
  function editCategory(c) {
    const body = U.el('div', {},
      U.el('div', { class: 'form-group' },
        U.el('label', { class: 'form-label' }, 'Name'),
        U.el('input', { class: 'form-input', id: 'cat-name', value: c?.name || '', placeholder: 'e.g. Desserts' })
      ),
      U.el('div', { class: 'form-row' },
        U.el('div', { class: 'form-group' },
          U.el('label', { class: 'form-label' }, 'Emoji'),
          U.el('input', { class: 'form-input', id: 'cat-emoji', value: c?.emoji || '🍽️', maxlength: 4 })
        ),
        U.el('div', { class: 'form-group' },
          U.el('label', { class: 'form-label' }, 'Color'),
          U.el('input', { type: 'color', class: 'form-input', id: 'cat-color', value: c?.color || '#35A879', style: { padding: '4px', height: '42px' } })
        )
      )
    );
    const footer = [
      c ? U.el('button', { class: 'btn btn-ghost', style: { color: 'var(--danger)', marginRight: 'auto' }, onclick: () => {
        U.confirmDialog({ title: 'Delete category?', message: 'Products in this category will become uncategorized. This does not delete products.', confirmText: 'Delete', danger: true, onConfirm: async () => {
          await DB.deleteCategory(c.id); await AppState.refreshAll(); render(); U.toast('Category deleted', 'success');
        }});
      }}, 'Delete') : null,
      U.el('button', { class: 'btn btn-ghost', onclick: () => document.querySelector('#modal-root .modal-close').click() }, 'Cancel'),
      U.el('button', { class: 'btn btn-primary', onclick: async () => {
        const name = U.$('#cat-name').value.trim();
        if (!name) return U.toast('Enter a name', 'error');
        await DB.saveCategory({ id: c?.id, name, emoji: U.$('#cat-emoji').value || '🍽️', color: U.$('#cat-color').value });
        await AppState.refreshAll(); render();
        document.querySelector('#modal-root .modal-close').click();
        U.toast(c ? 'Category updated' : 'Category added', 'success');
      }}, c ? 'Save' : 'Add')
    ];
    U.openModal({ title: c ? 'Edit category' : 'Add category', body, footer });
  }

  async function saveSettings() {
    const name = U.$('#set-name').value.trim() || 'Janets Karenderya';
    const addr = U.$('#set-address').value.trim();
    const tin = U.$('#set-tin').value.trim();
    const currency = U.$('#set-currency').value.trim() || 'PHP';
    const symbol = U.$('#set-symbol').value.trim() || '₱';
    const vatRate = Math.max(0, (Number(U.$('#set-vatrate').value) || 0) / 100);
    const vatEnabled = U.$('#set-vat').checked;
    const growth = Math.max(0, (Number(U.$('#set-growth').value) || 0) / 100);
    const seasonality = Math.max(0.1, Number(U.$('#set-seasonality').value) || 1.0);
    const pinInp = U.$('#set-pin').value;
    let pin = AppState.state.settings.pin;
    if (pinInp === '' || pinInp === '******') { /* keep existing or clear */
      if (pinInp === '') pin = '';
    } else {
      if (!/^\d{4,6}$/.test(pinInp)) return U.toast('PIN must be 4-6 digits', 'error');
      pin = pinInp;
    }

    await DB.setSetting('businessName', name);
    await DB.setSetting('address', addr);
    await DB.setSetting('tin', tin);
    await DB.setSetting('currency', currency);
    await DB.setSetting('currencySymbol', symbol);
    await DB.setSetting('vatRate', vatRate);
    await DB.setSetting('vatEnabled', vatEnabled);
    await DB.setSetting('forecastGrowth', growth);
    await DB.setSetting('seasonality', seasonality);
    await DB.setSetting('pin', pin);

    await AppState.refreshAll();
    U.setCurrencySymbol(symbol);
    U.toast('Settings saved', 'success');
    render();
  }

  async function backupNow() {
    try {
      const data = await DB.exportBackup();
      const stamp = U.dateKey(new Date()) + '-' + new Date().toTimeString().slice(0,5).replace(':','');
      U.downloadFile(`janets-karenderya-backup-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json');
      await DB.setSetting('lastBackupAt', Date.now());
      U.toast('Backup downloaded. Keep it safe!', 'success');
    } catch (err) {
      U.toast('Backup failed: ' + err.message, 'error');
    }
  }

  function restoreDialog() {
    const body = U.el('div', {},
      U.el('div', { class: 'glass', style: { padding: '14px', marginBottom: '14px', background: 'rgba(214,69,69,0.08); border-color: rgba(214,69,69,0.2)' } },
        U.el('p', { style: { margin: 0, fontSize: '13px' } },
          U.el('strong', {}, 'Warning: '), 'Restoring replaces all current data (products, sales, expenses, settings). We recommend creating a backup of your current data first.')
      ),
      U.el('div', { class: 'form-group' },
        U.el('label', { class: 'form-label' }, 'Select backup file (.json)'),
        U.el('input', { type: 'file', class: 'form-input', id: 'restore-file', accept: '.json,application/json' })
      )
    );
    U.openModal({
      title: 'Restore from backup',
      body,
      footer: [
        U.el('button', { class: 'btn btn-ghost', onclick: () => document.querySelector('#modal-root .modal-close').click() }, 'Cancel'),
        U.el('button', { class: 'btn btn-danger', onclick: async () => {
          const file = U.$('#restore-file').files[0];
          if (!file) return U.toast('Select a backup file', 'error');
          try {
            const text = await file.text();
            const data = JSON.parse(text);
            // Confirmation
            U.confirmDialog({
              title: 'Replace all current data?',
              message: 'This will overwrite products, transactions, expenses, and settings. This cannot be undone.',
              confirmText: 'Restore',
              danger: true,
              onConfirm: async () => {
                await DB.restoreBackup(data);
                await AppState.refreshAll();
                render();
                document.querySelector('#modal-root .modal-close').click();
                U.toast('Backup restored successfully', 'success');
              }
            });
          } catch (err) {
            U.toast('Invalid backup file: ' + err.message, 'error');
          }
        }}, 'Restore')
      ]
    });
  }

  async function exportAllCSV() {
    const products = AppState.state.products;
    const sales = AppState.state.sales;
    const expenses = AppState.state.expenses;
    const catMap = Object.fromEntries(AppState.state.categories.map(c => [c.id, c.name]));
    const prodsCSV = U.toCSV(products, [
      { key: 'sku', label: 'SKU' }, { key: 'name', label: 'Name' },
      { key: 'categoryId', label: 'Category', get: p => catMap[p.categoryId] || '' },
      { key: 'purchaseCost', label: 'Cost' }, { key: 'sellingPrice', label: 'Price' },
      { key: 'stock', label: 'Stock' }, { key: 'minStock', label: 'Min Stock' },
      { key: 'supplier', label: 'Supplier' }, { key: 'status', label: 'Status' },
    ]);
    const salesCSV = U.toCSV(sales.filter(s => s.status !== 'void'), [
      { key: 'transactionNo', label: 'Receipt' },
      { key: 'date', label: 'Date', get: s => new Date(s.date).toLocaleString('en-PH') },
      { key: 'items', label: 'Items', get: s => s.items.map(i => `${i.qty}x ${i.name}`).join('; ') },
      { key: 'subtotal', label: 'Subtotal' }, { key: 'discountAmount', label: 'Discount' },
      { key: 'netSales', label: 'Total' }, { key: 'paymentMethod', label: 'Method' },
    ]);
    const expCSV = U.toCSV(expenses, [
      { key: 'date', label: 'Date', get: e => new Date(e.date).toLocaleDateString('en-PH') },
      { key: 'category', label: 'Category' }, { key: 'description', label: 'Description' },
      { key: 'amount', label: 'Amount' }, { key: 'reversed', label: 'Reversed' },
    ]);
    const stamp = U.dateKey(new Date());
    U.downloadFile(`products-${stamp}.csv`, prodsCSV);
    setTimeout(() => U.downloadFile(`sales-${stamp}.csv`, salesCSV), 200);
    setTimeout(() => U.downloadFile(`expenses-${stamp}.csv`, expCSV), 400);
    U.toast('CSV files downloaded', 'success');
  }

  function resetAll() {
    U.confirmDialog({
      title: 'Reset all data?',
      message: 'This permanently deletes all products, transactions, expenses, and settings. This action cannot be undone. A backup is recommended.',
      confirmText: 'Reset everything',
      danger: true,
      onConfirm: () => {
        U.confirmDialog({
          title: 'Are you absolutely sure?',
          message: 'All business records will be erased and the app will return to its default state.',
          confirmText: 'Yes, delete everything',
          danger: true,
          onConfirm: async () => {
            await DB.resetAll();
            await AppState.refreshAll();
            render();
            U.toast('All data has been reset', 'success');
          }
        });
      }
    });
  }

  global.Settings = { render, backupNow };
})(window);
