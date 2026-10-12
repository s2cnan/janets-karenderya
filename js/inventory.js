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

    const products = AppState.state.products;
    const active = products.filter(p => p.status !== 'archived');
    const invValue = active.reduce((a, p) => a + (Number(p.purchaseCost) || 0) * (Number(p.stock) || 0), 0);
    const salesValue = active.reduce((a, p) => a + (Number(p.sellingPrice) || 0) * (Number(p.stock) || 0), 0);
    const totalUnits = active.reduce((a, p) => a + (Number(p.stock) || 0), 0);
    const lowStock = active.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= (p.minStock || 0));
    const out = active.filter(p => (p.stock || 0) === 0);

    container.appendChild(U.el('div', { class: 'stats-grid' },
      DashboardStat('Products', String(active.length), 'Total in catalog'),
      DashboardStat('Total Units', String(totalUnits), 'Items in stock', 'accent'),
      DashboardStat('Inventory Cost', U.currency(invValue), 'Purchase cost × stock', 'accent'),
      DashboardStat('Potential Sales', U.currency(salesValue), 'Selling price × stock'),
      DashboardStat('Low Stock', String(lowStock.length), lowStock.length ? 'Need reordering' : 'None', lowStock.length ? 'warn' : ''),
      DashboardStat('Out of Stock', String(out.length), out.length ? 'Action needed' : 'None', out.length ? 'danger' : ''),
    ));

    const sec = U.el('div', { class: 'section' });
    sec.appendChild(U.el('div', { class: 'section-header' },
      U.el('div', {},
        U.el('h3', { class: 'section-title' }, 'Products'),
        U.el('p', { class: 'section-sub' }, active.length ? `Manage your catalog — ${totalUnits} units in stock` : 'Add your first product to get started')
      ),
      U.el('div', { class: 'section-actions' },
        U.el('button', { class: 'btn btn-ghost btn-small', onclick: exportProductsCSV, disabled: !active.length }, U.svgIcon('download', 14), ' CSV'),
        U.el('button', { class: 'btn btn-primary', onclick: () => openEditor() }, U.svgIcon('plus', 14), ' Add Product')
      )
    ));

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
    [['name','Name A–Z'],['stock_desc','Stock ↓'],['stock_asc','Stock ↑'],['price_desc','Price ↓'],['price_asc','Price ↑'],['profit_desc','Profit ↓']].forEach(([v,l]) => {
      const o = U.el('option', { value: v }, l);
      if (v === sortBy) o.selected = true;
      sortSel.appendChild(o);
    });
    chips.appendChild(sortSel);
    sec.appendChild(chips);

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
    return U.el('button', { class: 'chip' + (active ? ' active' : ''), onclick: () => { if (type==='stock') filterStock=key; else filterCat=key; render(); } }, label);
  }
  function getFilteredSorted() {
    let list = AppState.state.products.filter(p => p.status !== 'archived');
    if (filterCat !== 'all') list = list.filter(p => p.categoryId === filterCat);
    if (filterStock === 'in') list = list.filter(p => (p.stock||0) > (p.minStock||0));
    else if (filterStock === 'low') list = list.filter(p => (p.stock||0) > 0 && (p.stock||0) <= (p.minStock||0));
    else if (filterStock === 'out') list = list.filter(p => (p.stock||0) === 0);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q) || (p.barcode||'').includes(q));
    list.sort((a,b) => {
      switch (sortBy) {
        case 'stock_desc': return (b.stock||0)-(a.stock||0);
        case 'stock_asc': return (a.stock||0)-(b.stock||0);
        case 'price_desc': return (b.sellingPrice||0)-(a.sellingPrice||0);
        case 'price_asc': return (a.sellingPrice||0)-(b.sellingPrice||0);
        case 'profit_desc': return ((b.sellingPrice-b.purchaseCost)||0)-((a.sellingPrice-a.purchaseCost)||0);
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
      const hasAny = AppState.state.products.some(p => p.status !== 'archived');
      if (!hasAny && !search && filterCat === 'all' && filterStock === 'all') {
        wrap.appendChild(U.el('div', { class: 'empty-state' },
          U.svgIcon('alert', 48),
          U.el('h3', {}, 'No products yet'),
          U.el('p', {}, 'Start building your inventory. Tap "Add Product" to add your first item.'),
          U.el('button', { class: 'btn btn-primary', onclick: () => openEditor() }, 'Add Your First Product')
        ));
      } else {
        wrap.appendChild(U.el('div', { class: 'empty-state' },
          U.svgIcon('search', 48),
          U.el('h3', {}, 'No products match'),
          U.el('p', {}, 'Try adjusting filters or add a new product.'),
          U.el('button', { class: 'btn btn-primary', onclick: () => openEditor() }, 'Add Product')
        ));
      }
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
        <th style="width:30%">Product</th><th>SKU</th><th>Category</th>
        <th class="num">Cost</th><th class="num">Price</th><th class="num">Margin</th>
        <th class="num">Stock</th><th>Status</th><th style="width:200px;text-align:right">Actions</th>
      </tr></thead><tbody></tbody>`;
      list.forEach(p => tbl.querySelector('tbody').appendChild(productRowDesktop(p)));
      tw.appendChild(tbl);
      wrap.appendChild(tw);
    }
  }

  function stockBadge(p) {
    const s = p.stock || 0;
    if (s === 0) return U.el('span', { class: 'badge badge-danger' }, 'Out');
    if (s <= (p.minStock || 0)) return U.el('span', { class: 'badge badge-warn' }, s + ' left');
    return U.el('span', { class: 'badge badge-success' }, s + ' in stock');
  }

  function productRowDesktop(p) {
    const cat = AppState.state.categories.find(c => c.id === p.categoryId);
    const margin = p.sellingPrice > 0 ? (p.sellingPrice - p.purchaseCost)/p.sellingPrice : 0;
    const tr = U.el('tr');
    tr.appendChild(U.el('td', {}, U.el('strong', {}, p.name)));
    tr.appendChild(U.el('td', { class: 'muted' }, p.sku||'—'));
    tr.appendChild(U.el('td', {}, cat ? cat.name : U.el('span', { class: 'muted' }, 'Uncategorized')));
    tr.appendChild(U.el('td', { class: 'num mono' }, U.currency(p.purchaseCost)));
    tr.appendChild(U.el('td', { class: 'num mono' }, U.el('strong', {}, U.currency(p.sellingPrice))));
    tr.appendChild(U.el('td', { class: 'num mono' }, U.percent(margin)));
    tr.appendChild(U.el('td', { class: 'num mono' }, String(p.stock||0)));
    tr.appendChild(U.el('td', {}, stockBadge(p)));
    const acts = U.el('td', { class: 'actions-cell' });
    acts.appendChild(actionBtn('Restock', () => openRestock(p), 'upload'));
    acts.appendChild(actionBtn('Edit', () => openEditor(p), 'edit'));
    const db = U.el('button', { class: 'btn btn-ghost btn-small', title: 'Delete product', style: 'color:var(--danger)', onclick: () => deleteProduct(p) });
    db.appendChild(U.svgIcon('trash', 14));
    acts.appendChild(db);
    tr.appendChild(acts);
    return tr;
  }

  function actionBtn(label, fn, icon) {
    const b = U.el('button', { class: 'btn btn-ghost btn-small', title: label, onclick: fn });
    if (icon) b.appendChild(U.svgIcon(icon, 14));
    if (label) b.appendChild(U.el('span', {}, label));
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
    if (p.sku) meta.appendChild(U.el('span', {}, p.sku));
    meta.appendChild(U.el('span', {}, cat?.name || 'Uncategorized'));
    info.appendChild(meta);
    info.appendChild(U.el('div', { class: 'm', style: {marginTop:'4px'} }, stockBadge(p)));
    card.appendChild(info);
    const right = U.el('div', { style: 'text-align:right' });
    right.appendChild(U.el('div', { class: 'price mono' }, U.currency(p.sellingPrice)));
    right.appendChild(U.el('div', { class: 'muted', style: 'font-size:11px' }, 'Cost: ' + U.currency(p.purchaseCost)));
    const br = U.el('div', { style: 'margin-top:6px;display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap' });
    br.appendChild(U.el('button', { class: 'btn btn-ghost btn-small', onclick: () => openRestock(p) }, '+ Stock'));
    br.appendChild(U.el('button', { class: 'btn btn-ghost btn-small', onclick: () => openEditor(p) }, 'Edit'));
    const dlb = U.el('button', { class: 'btn btn-ghost btn-small', style: 'color:var(--danger)', onclick: () => deleteProduct(p) });
    dlb.appendChild(U.svgIcon('trash', 12));
    br.appendChild(dlb);
    right.appendChild(br);
    card.appendChild(right);
    return card;
  }

  function deleteProduct(p) {
    DB.hasSaleHistory(p.id).then(hasHistory => {
      const msg = hasHistory
        ? `"${p.name}" has past sales. It will be archived (hidden from the catalog but preserved in reports). Continue?`
        : `Delete "${p.name}"? This cannot be undone.`;
      U.confirmDialog({
        title: hasHistory ? 'Archive product?' : 'Delete product?',
        message: msg,
        confirmText: hasHistory ? 'Archive' : 'Delete',
        danger: true,
        onConfirm: async () => {
          try {
            const r = await DB.deleteProduct(p.id);
            await AppState.refreshAll();
            render();
            U.toast(r.archived ? 'Product archived (history preserved)' : 'Product deleted', 'success');
          } catch (err) { U.toast(err.message || 'Delete failed', 'error'); }
        }
      });
    });
  }

  function field(label, control) {
    const g = U.el('div', { class: 'form-group' });
    g.appendChild(U.el('label', { class: 'form-label' }, label));
    g.appendChild(control);
    return g;
  }

  function openEditor(existing) {
    const isEdit = !!existing;
    const p = existing ? {} : {
      name: '', sku: '', barcode: '', categoryId: AppState.state.categories[0]?.id || '',
      image: '', purchaseCost: 0, sellingPrice: 0, stock: 0, minStock: 0,
      supplier: '', expiry: '', status: 'active'
    };
    if (existing) Object.keys(existing).forEach(k => p[k] = existing[k]);

    const body = U.el('div', {});

    const nameGroup = U.el('div', { class: 'form-group' });
    nameGroup.appendChild(U.el('label', { class: 'form-label' }, 'Product name *'));
    const nameInput = U.el('input', { class: 'form-input', id: 'p-name', value: p.name, placeholder: 'e.g. Tapsilog', autocomplete: 'off' });
    nameGroup.appendChild(nameInput);
    body.appendChild(nameGroup);

    const r1 = U.el('div', { class: 'form-row' });
    r1.appendChild(field('SKU / Code', U.el('input', { class: 'form-input', id: 'p-sku', value: p.sku||'', placeholder: 'Optional', autocomplete: 'off' })));
    r1.appendChild(field('Barcode', U.el('input', { class: 'form-input', id: 'p-barcode', value: p.barcode||'', placeholder: 'Optional', inputMode: 'numeric' })));
    body.appendChild(r1);

    body.appendChild(field('Category', buildCategorySelect(p.categoryId)));

    const costInput = U.el('input', { type: 'number', inputMode: 'decimal', class: 'form-input', id: 'p-cost', value: isEdit ? p.purchaseCost : '', min: 0, step: '0.01', placeholder: '0.00' });
    const priceInput = U.el('input', { type: 'number', inputMode: 'decimal', class: 'form-input', id: 'p-price', value: isEdit ? p.sellingPrice : '', min: 0, step: '0.01', placeholder: '0.00' });
    const r2 = U.el('div', { class: 'form-row' });
    r2.appendChild(field('Purchase cost (₱) *', costInput));
    r2.appendChild(field('Selling price (₱) *', priceInput));
    body.appendChild(r2);

    const stockInput = U.el('input', { type: 'number', inputMode: 'numeric', class: 'form-input', id: 'p-stock', value: isEdit ? (p.stock||0) : '0', min: 0, step: '1' });
    const minInput = U.el('input', { type: 'number', inputMode: 'numeric', class: 'form-input', id: 'p-minstock', value: isEdit ? (p.minStock||0) : '0', min: 0, step: '1' });
    const r3 = U.el('div', { class: 'form-row' });
    r3.appendChild(field(isEdit ? 'Stock on hand' : 'Initial stock', stockInput));
    r3.appendChild(field('Min stock threshold', minInput));
    body.appendChild(r3);
    if (isEdit) {
      body.appendChild(U.el('p', { class: 'form-hint' }, 'Tip: To record stock received, damaged goods, or losses, use Restock instead of editing this number directly.'));
    }
    body.appendChild(field('Supplier (optional)', U.el('input', { class: 'form-input', id: 'p-supplier', value: p.supplier||'', placeholder: 'Supplier name', autocomplete: 'off' })));

    async function save() {
      const name = nameInput.value.trim();
      const cost = Number(costInput.value);
      const price = Number(priceInput.value);
      const stock = Number(stockInput.value);
      const minStock = Number(minInput.value);
      let ok = true;
      if (!name) { nameInput.classList.add('error'); U.toast('Product name is required', 'error'); ok = false; } else nameInput.classList.remove('error');
      if (costInput.value === '' || isNaN(cost) || cost < 0) { costInput.classList.add('error'); U.toast('Enter a valid purchase cost', 'error'); ok = false; } else costInput.classList.remove('error');
      if (priceInput.value === '' || isNaN(price) || price < 0) { priceInput.classList.add('error'); U.toast('Enter a valid selling price', 'error'); ok = false; } else priceInput.classList.remove('error');
      if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) { stockInput.classList.add('error'); U.toast('Stock must be a non-negative whole number', 'error'); ok = false; } else stockInput.classList.remove('error');
      if (!ok) return;
      const btn = U.$('#save-p-btn');
      if (btn) btn.disabled = true;
      try {
        const newStock = Math.max(0, Math.floor(stock));
        const updated = {
          ...(existing || {}),
          name,
          sku: U.$('#p-sku').value.trim(),
          barcode: U.$('#p-barcode').value.trim(),
          categoryId: U.$('#p-category').value,
          purchaseCost: cost,
          sellingPrice: price,
          minStock: Math.max(0, Math.floor(minStock||0)),
          supplier: U.$('#p-supplier').value.trim(),
          status: existing?.status || 'active',
        };
        const wasNew = !isEdit;
        if (wasNew) updated.stock = newStock; else updated.stock = existing.stock || 0;
        const saved = await DB.saveProduct(updated);
        if (wasNew) {
          if (newStock > 0) await DB.adjustStock(saved.id, newStock, 'restock', 'Initial stock');
        } else {
          const diff = newStock - (existing.stock || 0);
          if (diff !== 0) await DB.adjustStock(saved.id, diff, 'adjustment', 'Edited stock quantity');
        }
        await AppState.refreshAll();
        render();
        document.querySelector('#modal-root .modal-close').click();
        U.toast(isEdit ? 'Product updated' : `"${name}" added to inventory`, 'success');
      } catch (err) {
        U.toast(err.message || 'Save failed', 'error');
        if (btn) btn.disabled = false;
      }
    }

    U.openModal({
      title: isEdit ? 'Edit product' : 'Add Product',
      body,
      footer: [
        U.el('button', { class: 'btn btn-ghost', onclick: () => document.querySelector('#modal-root .modal-close').click() }, 'Cancel'),
        U.el('button', { class: 'btn btn-primary', id: 'save-p-btn', onclick: save }, isEdit ? 'Save changes' : 'Add product')
      ],
      wide: true
    });
    setTimeout(() => nameInput.focus(), 100);
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
    if (!value) opt0.selected = true;
    return sel;
  }

  function openRestock(p) {
    const body = U.el('div', {},
      U.el('div', { class: 'form-group' },
        U.el('label', { class: 'form-label' }, 'Current stock'),
        U.el('div', { class: 'muted mono', style: 'font-size:22px;font-weight:700;padding:6px 0' }, String(p.stock||0))
      ),
      U.el('div', { class: 'form-group' },
        U.el('label', { class: 'form-label' }, 'Adjustment type'),
        U.el('select', { class: 'form-select', id: 'rs-type' },
          U.el('option', { value: 'restock' }, 'Stock received (add)'),
          U.el('option', { value: 'damaged' }, 'Damaged (subtract)'),
          U.el('option', { value: 'expired' }, 'Expired (subtract)'),
          U.el('option', { value: 'missing' }, 'Missing / Lost (subtract)'),
          U.el('option', { value: 'adjustment' }, 'Manual correction'),
        )
      ),
      U.el('div', { class: 'form-group' },
        U.el('label', { class: 'form-label' }, 'Quantity'),
        U.el('input', { type: 'number', class: 'form-input', id: 'rs-qty', value: '0', step: '1', min: 0 }),
        U.el('p', { class: 'form-hint' }, 'Enter a positive quantity. Received adds to stock; damaged/expired/missing subtract. Use Manual correction with a negative number to lower stock directly.')
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
          if (qty === 0) return U.toast('Enter a quantity', 'error');
          let delta = qty;
          if (type === 'restock') delta = Math.abs(qty);
          else if (['damaged','expired','missing'].includes(type)) {
            if (qty > (p.stock||0)) return U.toast(`Cannot remove more than available (${p.stock||0})`, 'error');
            delta = -Math.abs(qty);
          }
          await DB.adjustStock(p.id, delta, type, note);
          await AppState.refreshProducts();
          render();
          document.querySelector('#modal-root .modal-close').click();
          U.toast('Stock updated', 'success');
        }}, 'Save')
      ]
    });
  }

  function showMovements(p) {
    DB.getStockMovements(p.id).then(moves => {
      const body = U.el('div', {});
      if (!moves.length) {
        body.appendChild(U.el('div', { class: 'empty-state' }, U.el('p', {}, 'No stock movements yet.')));
      } else {
        const tw = U.el('div', { class: 'table-wrap' });
        const tbl = U.el('table', { class: 'data-table' });
        tbl.innerHTML = `<thead><tr><th>Date</th><th>Type</th><th class="num">Change</th><th class="num">After</th><th>Note</th></tr></thead><tbody></tbody>`;
        const tb = tbl.querySelector('tbody');
        moves.slice(0,100).forEach(m => {
          const tr = U.el('tr');
          tr.innerHTML = `<td>${U.formatDate(m.date,'datetime')}</td>
            <td><span class="badge badge-muted">${m.type}</span></td>
            <td class="num mono" style="color:${m.quantity<0?'var(--danger)':'var(--emerald-deep)'}">${m.quantity>0?'+':''}${m.quantity}</td>
            <td class="num mono">${m.stockAfter}</td>
            <td class="muted">${U.escapeHtml(m.note||'')}</td>`;
          tb.appendChild(tr);
        });
        tw.appendChild(tbl);
        body.appendChild(tw);
      }
      U.openModal({ title: 'Stock movements — ' + p.name, body, footer: [
        U.el('button', { class: 'btn btn-ghost', onclick: () => document.querySelector('#modal-root .modal-close').click() }, 'Close')
      ]});
    });
  }

  async function exportProductsCSV() {
    const prods = AppState.state.products.filter(p => p.status !== 'archived');
    if (!prods.length) return U.toast('No products to export', 'warn');
    const catMap = Object.fromEntries(AppState.state.categories.map(c => [c.id, c.name]));
    const csv = U.toCSV(prods, [
      { key:'sku', label:'SKU' }, { key:'name', label:'Name' },
      { key:'categoryId', label:'Category', get:p => catMap[p.categoryId]||'' },
      { key:'purchaseCost', label:'Purchase Cost' }, { key:'sellingPrice', label:'Selling Price' },
      { key:'stock', label:'Stock' }, { key:'minStock', label:'Min Stock' },
      { key:'supplier', label:'Supplier' },
    ]);
    U.downloadFile('products-'+U.dateKey(Date.now())+'.csv', csv);
    U.toast('Products exported', 'success');
  }

  global.Inventory = { render, openEditor };
})(window);
