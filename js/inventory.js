/* ==========================================================================
   Inventory view
   ========================================================================== */
(function (global) {
  'use strict';

  let search = '';
  let filterCat = 'all';
  let filterStock = 'all';
  let sortBy = 'name';
  let showingMobile = window.innerWidth < 720;

  window.addEventListener('resize', U.debounce(() => {
    const was = showingMobile;
    showingMobile = window.innerWidth < 720;
    if (was !== showingMobile && AppState.state.currentView === 'inventory') render();
  }, 200));

  function render() {
    const container = U.$('#view-container');
    U.clear(container);

    // Summary stats
    const products = AppState.state.products;
    const active = products.filter(p => p.status !== 'archived');
    const invValue = active.reduce((a, p) => a + (Number(p.purchaseCost) || 0) * (Number(p.stock) || 0), 0);
    const salesValue = active.reduce((a, p) => a + (Number(p.sellingPrice) || 0) * (Number(p.stock) || 0), 0);
    const lowStock = active.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= (p.minStock || 0)).length;
    const out = active.filter(p => (p.stock || 0) === 0).length;

    container.appendChild(U.el('div', { class: 'stats-grid' },
      DashboardStat('Products', String(active.length), 'Total active'),
      DashboardStat('Cost Value', U.currency(invValue), 'At purchase cost', 'accent'),
      DashboardStat('Sales Value', U.currency(salesValue), 'Potential revenue'),
      DashboardStat('Low Stock', String(lowStock), 'Need reordering', lowStock > 0 ? 'warn' : ''),
      DashboardStat('Out of Stock', String(out), 'Action needed', out > 0 ? 'danger' : ''),
    ));

    // Toolbar
    const sec = U.el('div', { class: 'section' });
    sec.appendChild(U.el('div', { class: 'section-header' },
      U.el('div', {},
        U.el('h3', { class: 'section-title' }, 'Products'),
        U.el('p', { class: 'section-sub' }, 'Manage your catalog and stock levels')
      ),
      U.el('div', { class: 'section-actions' },
        U.el('button', { class: 'btn btn-ghost btn-small', onclick: exportProductsCSV }, U.svgIcon('download', 14), ' CSV'),
        U.el('button', { class: 'btn btn-primary', onclick: () => openEditor() }, U.svgIcon('plus', 14), ' Add Product')
      )
    ));

    // Filters
    sec.appendChild(U.el('div', { class: 'search-bar', style: { marginBottom: '10px' } },
      U.svgIcon('search'),
      U.el('input', {
        type: 'search', class: 'form-input', placeholder: 'Search name, SKU, barcode…', value: search,
        oninput: U.debounce((e) => { search = e.target.value; renderList(); }, 150)
      })
    ));

    const chips = U.el('div', { class: 'chip-row' });
    chips.appendChild(chip('All', 'stock', 'all'));
    chips.appendChild(chip('In Stock', 'stock', 'in'));
    chips.appendChild(chip('Low', 'stock', 'low'));
    chips.appendChild(chip('Out', 'stock', 'out'));
    chips.appendChild(U.el('span', { style: { width: 8 } }));
    chips.appendChild(chip('All categories', 'cat', 'all'));
    AppState.state.categories.forEach(c => chips.appendChild(chip(c.emoji + ' ' + c.name, 'cat', c.id)));
    chips.appendChild(U.el('span', { style: { flex: 1 } }));
    const sortSel = U.el('select', {
      class: 'form-select',
      style: { width: 'auto', padding: '6px 10px', fontSize: '13px' },
      onchange: (e) => { sortBy = e.target.value; renderList(); }
    });
    [['name', 'Name A–Z'], ['stock_desc', 'Stock ↓'], ['stock_asc', 'Stock ↑'], ['price_desc', 'Price ↓'], ['price_asc', 'Price ↑'], ['profit_desc', 'Profit ↓']].forEach(([v, l]) => {
      const o = U.el('option', { value: v }, l);
      if (v === sortBy) o.selected = true;
      sortSel.appendChild(o);
    });
    chips.appendChild(sortSel);
    sec.appendChild(chips);

    // List area
    const listWrap = U.el('div', { id: 'inventory-list' });
    sec.appendChild(listWrap);
    container.appendChild(sec);

    renderList();
  }

  function DashboardStat(l, v, s, a) {
    return U.el('div', { class: 'stat-card ' + (a||'') },
      U.el('div', { class: 'stat-label' }, l),
      U.el('div', { class: 'stat-value' }, v),
      U.el('div', { class: 'stat-sub' }, s)
    );
  }

  function chip(label, type, key) {
    const active = (type === 'stock' && filterStock === key) || (type === 'cat' && filterCat === key);
    return U.el('button', {
      class: 'chip' + (active ? ' active' : ''),
      onclick: () => { if (type === 'stock') filterStock = key; else filterCat = key; render(); }
    }, label);
  }

  function getFilteredSorted() {
    let list = AppState.state.products.filter(p => p.status !== 'archived');
    if (filterCat !== 'all') list = list.filter(p => p.categoryId === filterCat);
    if (filterStock === 'in') list = list.filter(p => (p.stock||0) > (p.minStock||0));
    else if (filterStock === 'low') list = list.filter(p => (p.stock||0) > 0 && (p.stock||0) <= (p.minStock||0));
    else if (filterStock === 'out') list = list.filter(p => (p.stock||0) === 0);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.barcode || '').includes(q)
    );
    list.sort((a, b) => {
      switch (sortBy) {
        case 'stock_desc': return (b.stock||0) - (a.stock||0);
        case 'stock_asc': return (a.stock||0) - (b.stock||0);
        case 'price_desc': return (b.sellingPrice||0) - (a.sellingPrice||0);
        case 'price_asc': return (a.sellingPrice||0) - (b.sellingPrice||0);
        case 'profit_desc': return ((b.sellingPrice - b.purchaseCost)||0) - ((a.sellingPrice - a.purchaseCost)||0);
        default: return a.name.localeCompare(b.name);
      }
    });
    return list;
  }

  function renderList() {
    const wrap = U.$('#inventory-list');
    if (!wrap) return;
    U.clear(wrap);
    const list = getFilteredSorted();
    if (!list.length) {
      wrap.appendChild(U.el('div', { class: 'empty-state' },
        U.svgIcon('alert', 48),
        U.el('h3', {}, 'No products match'),
        U.el('p', {}, 'Try adjusting your filters or add a new product.'),
        U.el('button', { class: 'btn btn-primary', onclick: () => openEditor() }, 'Add Product')
      ));
      return;
    }

    if (showingMobile) {
      const cards = U.el('div', { class: 'product-list-cards' });
      list.forEach(p => cards.appendChild(productRowMobile(p)));
      wrap.appendChild(cards);
    } else {
      const tw = U.el('div', { class: 'table-wrap' });
      const tbl = U.el('table', { class: 'data-table' });
      tbl.innerHTML = `<thead><tr>
        <th>Product</th><th>SKU</th><th>Category</th>
        <th class="num">Cost</th><th class="num">Price</th><th class="num">Margin</th>
        <th class="num">Stock</th><th>Status</th><th></th>
      </tr></thead><tbody></tbody>`;
      const tb = tbl.querySelector('tbody');
      list.forEach(p => tb.appendChild(productRowDesktop(p)));
      tw.appendChild(tbl);
      wrap.appendChild(tw);
    }
  }

  function productRowDesktop(p) {
    const cat = AppState.state.categories.find(c => c.id === p.categoryId);
    const margin = p.sellingPrice > 0 ? (p.sellingPrice - p.purchaseCost) / p.sellingPrice : 0;
    const tr = U.el('tr');
    tr.innerHTML = `
      <td><strong>${U.escapeHtml(p.name)}</strong></td>
      <td class="muted">${U.escapeHtml(p.sku||'—')}</td>
      <td>${cat ? U.escapeHtml(cat.name) : '<span class="muted">Uncategorized</span>'}</td>
      <td class="num mono">${U.currency(p.purchaseCost)}</td>
      <td class="num mono"><strong>${U.currency(p.sellingPrice)}</strong></td>
      <td class="num mono">${U.percent(margin)}</td>
      <td class="num mono">${p.stock||0}</td>
      <td>${stockBadge(p)}</td>
      <td class="actions-cell"></td>`;
    const acts = tr.querySelector('.actions-cell');
    acts.appendChild(actionBtn('Restock', () => openRestock(p), 'upload'));
    acts.appendChild(actionBtn('Edit', () => openEditor(p), 'edit'));
    acts.appendChild(actionBtn('', () => productMenu(p), 'more'));
    return tr;
  }

  function actionBtn(label, fn, icon) {
    const b = U.el('button', {
      class: 'btn btn-ghost btn-small',
      title: label,
      onclick: fn,
      style: label ? {} : { padding: '6px 8px' }
    });
    if (icon === 'more') b.textContent = '⋯';
    else {
      if (icon) b.appendChild(U.svgIcon(icon, 14));
      if (label) b.appendChild(U.el('span', {}, label));
    }
    return b;
  }

  function productRowMobile(p) {
    const cat = AppState.state.categories.find(c => c.id === p.categoryId);
    const card = U.el('div', { class: 'product-row-card' });
    const img = U.el('div', { class: 'pimg-s' });
    if (p.image) img.appendChild(U.el('img', { src: p.image }));
    else img.textContent = cat?.emoji || '🍽️';
    card.appendChild(img);
    const info = U.el('div', { class: 'pinfo' });
    info.appendChild(U.el('div', { class: 'n' }, p.name));
    const meta = U.el('div', { class: 'm' });
    meta.appendChild(U.el('span', {}, p.sku || ''));
    meta.appendChild(U.el('span', {}, cat?.name || 'Uncategorized'));
    info.appendChild(meta);
    info.appendChild(U.el('div', { class: 'm', style: { marginTop: '4px' } }, stockBadge(p)));
    card.appendChild(info);
    const right = U.el('div', { style: { textAlign: 'right' } });
    right.appendChild(U.el('div', { class: 'price mono' }, U.currency(p.sellingPrice)));
    const btnRow = U.el('div', { style: { marginTop: '6px', display: 'flex', gap: '4px', justifyContent: 'flex-end' } });
    btnRow.appendChild(U.el('button', { class: 'btn btn-ghost btn-small', onclick: () => openRestock(p) }, '+ Stock'));
    btnRow.appendChild(U.el('button', { class: 'kebab', onclick: () => productMenu(p) }, '⋯'));
    right.appendChild(btnRow);
    card.appendChild(right);
    return card;
  }

  function stockBadge(p) {
    const s = p.stock || 0;
    if (s === 0) return U.el('span', { class: 'badge badge-danger' }, 'Out');
    if (s <= (p.minStock || 0)) return U.el('span', { class: 'badge badge-warn' }, s + ' left');
    return U.el('span', { class: 'badge badge-success' }, s + ' in stock');
  }

  function productMenu(p) {
    const body = U.el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });
    const items = [
      { label: 'Edit product', icon: 'edit', fn: () => openEditor(p) },
      { label: 'Adjust stock / Restock', icon: 'upload', fn: () => openRestock(p) },
      { label: 'View stock movements', icon: 'chart', fn: () => showMovements(p) },
    ];
    items.forEach(it => {
      body.appendChild(U.el('button', {
        class: 'btn btn-ghost', style: { justifyContent: 'flex-start', gap: '10px' },
        onclick: () => { it.fn(); document.querySelector('#modal-root .modal-close').click(); }
      }, U.svgIcon(it.icon, 16), ' ', it.label));
    });
    body.appendChild(U.el('hr', { style: { border: 'none', borderTop: '1px solid var(--glass-border)' } }));
    body.appendChild(U.el('button', {
      class: 'btn btn-ghost', style: { justifyContent: 'flex-start', gap: '10px', color: 'var(--danger)' },
      onclick: () => {
        U.confirmDialog({
          title: 'Archive product?',
          message: `"${p.name}" will be hidden from the catalog and cashier. Existing sales records are preserved.`,
          confirmText: 'Archive',
          danger: true,
          onConfirm: async () => {
            p.status = 'archived';
            await DB.saveProduct(p);
            await AppState.refreshProducts();
            render();
            U.toast('Product archived', 'success');
          }
        });
        document.querySelector('#modal-root .modal-close').click();
      }
    }, U.svgIcon('trash', 16), ' Archive product'));
    U.openModal({ title: p.name, body, footer: [] });
  }

  function openEditor(existing) {
    const isEdit = !!existing;
    const p = existing ? { ...existing } : {
      name: '', sku: '', barcode: '', categoryId: AppState.state.categories[0]?.id || '',
      image: '', purchaseCost: 0, sellingPrice: 0, stock: 0, minStock: 0,
      supplier: '', expiry: '', status: 'active'
    };
    const body = U.el('div', {});
    body.appendChild(U.el('div', { class: 'form-group' },
      U.el('label', { class: 'form-label' }, 'Product name *'),
      U.el('input', { class: 'form-input', id: 'p-name', value: p.name, placeholder: 'e.g. Tapsilog' })
    ));
    const r1 = U.el('div', { class: 'form-row' });
    r1.appendChild(U.el('div', { class: 'form-group' },
      U.el('label', { class: 'form-label' }, 'SKU / Code'),
      U.el('input', { class: 'form-input', id: 'p-sku', value: p.sku || '', placeholder: 'Optional' })
    ));
    r1.appendChild(U.el('div', { class: 'form-group' },
      U.el('label', { class: 'form-label' }, 'Barcode'),
      U.el('input', { class: 'form-input', id: 'p-barcode', value: p.barcode || '', placeholder: 'Optional', inputMode: 'numeric' })
    ));
    body.appendChild(r1);

    body.appendChild(U.el('div', { class: 'form-group' },
      U.el('label', { class: 'form-label' }, 'Category'),
      buildCategorySelect(p.categoryId)
    ));

    const r2 = U.el('div', { class: 'form-row' });
    r2.appendChild(U.el('div', { class: 'form-group' },
      U.el('label', { class: 'form-label' }, 'Purchase cost (₱)'),
      U.el('input', { type: 'number', inputMode: 'decimal', class: 'form-input', id: 'p-cost', value: p.purchaseCost, min: 0, step: '0.01' })
    ));
    r2.appendChild(U.el('div', { class: 'form-group' },
      U.el('label', { class: 'form-label' }, 'Selling price (₱)'),
      U.el('input', { type: 'number', inputMode: 'decimal', class: 'form-input', id: 'p-price', value: p.sellingPrice, min: 0, step: '0.01' })
    ));
    body.appendChild(r2);

    const r3 = U.el('div', { class: 'form-row' });
    r3.appendChild(U.el('div', { class: 'form-group' },
      U.el('label', { class: 'form-label' }, 'Opening stock'),
      U.el('input', { type: 'number', inputMode: 'numeric', class: 'form-input', id: 'p-stock', value: p.stock, min: 0, step: '1' })
    ));
    r3.appendChild(U.el('div', { class: 'form-group' },
      U.el('label', { class: 'form-label' }, 'Min stock threshold'),
      U.el('input', { type: 'number', inputMode: 'numeric', class: 'form-input', id: 'p-minstock', value: p.minStock || 0, min: 0, step: '1' })
    ));
    body.appendChild(r3);

    body.appendChild(U.el('div', { class: 'form-group' },
      U.el('label', { class: 'form-label' }, 'Supplier (optional)'),
      U.el('input', { class: 'form-input', id: 'p-supplier', value: p.supplier || '', placeholder: 'Supplier name' })
    ));

    const footer = [
      U.el('button', { class: 'btn btn-ghost', onclick: () => document.querySelector('#modal-root .modal-close').click() }, 'Cancel'),
      U.el('button', { class: 'btn btn-primary', onclick: async () => {
        const name = U.$('#p-name').value.trim();
        if (!name) { U.$('#p-name').classList.add('error'); return U.toast('Product name is required', 'error'); }
        U.$('#p-name').classList.remove('error');
        const cost = Math.max(0, Number(U.$('#p-cost').value) || 0);
        const price = Math.max(0, Number(U.$('#p-price').value) || 0);
        const stock = Math.max(0, Math.floor(Number(U.$('#p-stock').value) || 0));
        const minStock = Math.max(0, Math.floor(Number(U.$('#p-minstock').value) || 0));
        const updated = {
          ...p,
          name,
          sku: U.$('#p-sku').value.trim(),
          barcode: U.$('#p-barcode').value.trim(),
          categoryId: U.$('#p-category').value,
          purchaseCost: cost,
          sellingPrice: price,
          stock: isEdit ? p.stock : stock,
          minStock,
          supplier: U.$('#p-supplier').value.trim(),
        };
        await DB.saveProduct(updated);
        if (!isEdit && stock > 0) {
          await DB.adjustStock(updated.id, stock, 'restock', 'Initial stock');
        }
        await AppState.refreshAll();
        render();
        document.querySelector('#modal-root .modal-close').click();
        U.toast(isEdit ? 'Product updated' : 'Product added', 'success');
      }}, isEdit ? 'Save changes' : 'Add product')
    ];

    U.openModal({ title: isEdit ? 'Edit product' : 'Add product', body, footer, wide: true });
  }

  function buildCategorySelect(value) {
    const sel = U.el('select', { class: 'form-select', id: 'p-category' });
    const opt0 = U.el('option', { value: '' }, 'Uncategorized');
    sel.appendChild(opt0);
    AppState.state.categories.forEach(c => {
      const o = U.el('option', { value: c.id }, (c.emoji ? c.emoji + ' ' : '') + c.name);
      if (c.id === value) o.selected = true;
      sel.appendChild(o);
    });
    return sel;
  }

  function openRestock(p) {
    const body = U.el('div', {},
      U.el('div', { class: 'form-group' },
        U.el('label', { class: 'form-label' }, 'Current stock'),
        U.el('div', { class: 'muted mono', style: { fontSize: '22px', fontWeight: 700, padding: '6px 0' } }, String(p.stock || 0))
      ),
      U.el('div', { class: 'form-group' },
        U.el('label', { class: 'form-label' }, 'Adjustment type'),
        U.el('select', { class: 'form-select', id: 'rs-type' },
          U.el('option', { value: 'restock' }, 'Stock received (add)'),
          U.el('option', { value: 'damaged' }, 'Damaged goods (subtract)'),
          U.el('option', { value: 'expired' }, 'Expired (subtract)'),
          U.el('option', { value: 'missing' }, 'Missing / Lost (subtract)'),
          U.el('option', { value: 'adjustment' }, 'Manual adjustment (add or subtract)'),
        )
      ),
      U.el('div', { class: 'form-group' },
        U.el('label', { class: 'form-label' }, 'Quantity'),
        U.el('input', { type: 'number', class: 'form-input', id: 'rs-qty', value: '0', step: '1' }),
        U.el('p', { class: 'form-hint' }, 'For received, enter positive number. For losses, enter positive number and select the reason. For manual adjustment, use negative numbers to subtract.')
      ),
      U.el('div', { class: 'form-group' },
        U.el('label', { class: 'form-label' }, 'Notes (optional)'),
        U.el('input', { class: 'form-input', id: 'rs-note', placeholder: 'e.g. Supplier delivery batch #12' })
      )
    );
    U.openModal({
      title: 'Adjust stock — ' + p.name,
      body,
      footer: [
        U.el('button', { class: 'btn btn-ghost', onclick: () => document.querySelector('#modal-root .modal-close').click() }, 'Cancel'),
        U.el('button', { class: 'btn btn-primary', onclick: async () => {
          const type = U.$('#rs-type').value;
          let qty = Math.floor(Number(U.$('#rs-qty').value) || 0);
          const note = U.$('#rs-note').value.trim();
          if (!qty) return U.toast('Enter a quantity', 'error');
          if (['restock'].includes(type) && qty < 0) qty = Math.abs(qty);
          if (['damaged', 'expired', 'missing'].includes(type)) qty = -Math.abs(qty);
          await DB.adjustStock(p.id, qty, type, note);
          await AppState.refreshProducts();
          render();
          document.querySelector('#modal-root .modal-close').click();
          U.toast('Stock updated', 'success');
        }}, 'Save adjustment')
      ]
    });
  }

  function showMovements(p) {
    DB.getStockMovements(p.id).then(moves => {
      const body = U.el('div', {});
      if (!moves.length) {
        body.appendChild(U.el('div', { class: 'empty-state' },
          U.el('p', {}, 'No stock movements yet.')));
      } else {
        const tw = U.el('div', { class: 'table-wrap' });
        const tbl = U.el('table', { class: 'data-table' });
        tbl.innerHTML = `<thead><tr><th>Date</th><th>Type</th><th class="num">Change</th><th class="num">After</th><th>Note</th></tr></thead><tbody></tbody>`;
        const tb = tbl.querySelector('tbody');
        moves.slice(0, 100).forEach(m => {
          const tr = U.el('tr');
          tr.innerHTML = `
            <td>${U.formatDate(m.date, 'datetime')}</td>
            <td><span class="badge badge-muted">${m.type}</span></td>
            <td class="num mono" style="color:${m.quantity < 0 ? 'var(--danger)' : 'var(--emerald-deep)'};">${m.quantity > 0 ? '+' : ''}${m.quantity}</td>
            <td class="num mono">${m.stockAfter}</td>
            <td class="muted">${U.escapeHtml(m.note||'')}</td>`;
          tb.appendChild(tr);
        });
        tw.appendChild(tbl);
        body.appendChild(tw);
      }
      U.openModal({ title: 'Stock movements — ' + p.name, body, footer: [
        U.el('button', { class: 'btn btn-ghost', onclick: () => document.querySelector('#modal-root .modal-close').click() }, 'Close')
      ] });
    });
  }

  async function exportProductsCSV() {
    const prods = AppState.state.products;
    const catMap = Object.fromEntries(AppState.state.categories.map(c => [c.id, c.name]));
    const csv = U.toCSV(prods, [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Name' },
      { key: 'categoryId', label: 'Category', get: p => catMap[p.categoryId] || '' },
      { key: 'purchaseCost', label: 'Purchase Cost' },
      { key: 'sellingPrice', label: 'Selling Price' },
      { key: 'stock', label: 'Stock' },
      { key: 'minStock', label: 'Min Stock' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'status', label: 'Status' },
    ]);
    U.downloadFile('products-' + U.dateKey(Date.now()) + '.csv', csv);
    U.toast('Products exported', 'success');
  }

  // Expose openEditor for quick actions
  global.Inventory = { render, openEditor };
})(window);
