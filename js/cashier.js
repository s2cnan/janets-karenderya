/* ==========================================================================
   Cashier / POS view
   ========================================================================== */
(function (global) {
  'use strict';

  let search = '';
  let activeCategory = 'all';
  let discountPercent = 0;
  let discountAmount = 0;
  let payMethod = 'cash';
  let checkoutOpen = false;

  function render() {
    const container = U.$('#view-container');
    U.clear(container);

    const layout = U.el('div', { class: 'cashier-layout' });

    // Left: products
    const products = U.el('div', { class: 'cashier-products' });

    // Search + categories
    const searchBar = U.el('div', { class: 'search-bar' });
    searchBar.appendChild(U.svgIcon('search'));
    const searchInput = U.el('input', {
      type: 'search', class: 'form-input', placeholder: 'Search product name or SKU…', value: search,
      oninput: U.debounce((e) => { search = e.target.value; renderProductList(); }, 150)
    });
    searchBar.appendChild(searchInput);
    products.appendChild(searchBar);

    // Categories
    const catsRow = U.el('div', { class: 'categories-row', id: 'cat-row' });
    catsRow.appendChild(catChip('All', 'all'));
    AppState.state.categories.forEach(c => catsRow.appendChild(catChip(c.emoji + ' ' + c.name, c.id)));
    products.appendChild(catsRow);

    // Product grid
    const grid = U.el('div', { class: 'product-grid', id: 'product-grid' });
    products.appendChild(grid);
    layout.appendChild(products);

    // Right: cart
    const cart = U.el('div', { class: 'cart-panel', id: 'cart-panel' });
    layout.appendChild(cart);
    container.appendChild(layout);

    renderProductList();
    renderCart();
  }

  function catChip(label, id) {
    return U.el('button', {
      class: 'cat-pill' + (activeCategory === id ? ' active' : ''),
      onclick: () => { activeCategory = id; render(); }
    }, label);
  }

  function renderProductList() {
    const grid = U.$('#product-grid');
    if (!grid) return;
    U.clear(grid);
    let list = AppState.state.products.filter(p => p.status !== 'archived');
    if (activeCategory !== 'all') list = list.filter(p => p.categoryId === activeCategory);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.includes(q))
    );
    list.sort((a, b) => a.name.localeCompare(b.name));
    if (!list.length) {
      grid.appendChild(U.el('div', { class: 'empty-state', style: { gridColumn: '1/-1' } },
        U.svgIcon('search', 48),
        U.el('h3', {}, 'No products found'),
        U.el('p', {}, 'Try a different search term or category.')
      ));
      return;
    }
    list.forEach(p => grid.appendChild(productCard(p)));
  }

  function productCard(p) {
    const out = (p.stock || 0) === 0;
    const low = (p.stock || 0) <= (p.minStock || 0) && !out;
    const cat = AppState.state.categories.find(c => c.id === p.categoryId);
    const card = U.el('div', {
      class: 'product-card' + (out ? ' out' : ''),
      onclick: () => {
        if (out) return U.toast(p.name + ' is out of stock', 'warn');
        AppState.cartAdd(p, 1);
      }
    });
    const imgWrap = U.el('div', { class: 'pimg' });
    if (p.image) { imgWrap.appendChild(U.el('img', { src: p.image, alt: '' })); }
    else { imgWrap.textContent = (cat && cat.emoji) || '🍽️'; }
    card.appendChild(imgWrap);
    if (out) card.appendChild(U.el('span', { class: 'stock-badge badge badge-danger' }, 'Out'));
    else if (low) card.appendChild(U.el('span', { class: 'stock-badge badge badge-warn' }, p.stock + ' left'));
    card.appendChild(U.el('div', { class: 'pname' }, p.name));
    card.appendChild(U.el('div', { class: 'pprice' }, U.currency(p.sellingPrice)));
    card.appendChild(U.el('div', { class: 'pstock' }, (p.stock || 0) + ' in stock'));
    return card;
  }

  function renderCart() {
    const panel = U.$('#cart-panel');
    if (!panel) return;
    U.clear(panel);
    const t = AppState.cartTotals(discountPercent, discountAmount);

    panel.appendChild(U.el('div', { class: 'cart-header' },
      U.el('h3', {}, 'Current Order'),
      U.el('div', { style: { display: 'flex', gap: '6px' } },
        U.el('button', { class: 'icon-btn', title: 'Apply discount', onclick: openDiscountDialog },
          U.el('span', { class: 'tag' }, discountPercent || discountAmount ? 'Disc' : '')),
        U.el('button', { class: 'icon-btn', title: 'Clear cart', onclick: () => {
          if (!AppState.state.cart.length) return;
          U.confirmDialog({
            title: 'Clear cart?',
            message: 'Remove all items from this order?',
            confirmText: 'Clear',
            danger: true,
            onConfirm: () => AppState.cartClear()
          });
        }}, U.svgIcon('trash', 18))
      )
    ));

    const items = U.el('div', { class: 'cart-items' });
    if (!AppState.state.cart.length) {
      items.appendChild(U.el('div', { class: 'cart-empty' },
        U.svgIcon('cart', 48),
        U.el('div', {}, 'Tap a product to add'),
        U.el('div', { style: { fontSize: '12px', marginTop: '4px' } }, 'Search or browse categories')
      ));
    } else {
      AppState.state.cart.forEach(ci => items.appendChild(cartItem(ci)));
    }
    panel.appendChild(items);

    const footer = U.el('div', { class: 'cart-footer' });
    footer.appendChild(U.el('div', { class: 'cart-row' },
      U.el('span', {}, 'Subtotal (' + t.itemCount + ')'),
      U.el('span', { class: 'val mono' }, U.currency(t.subtotal))));
    if (t.totalDiscount > 0) {
      footer.appendChild(U.el('div', { class: 'cart-row' },
        U.el('span', {}, 'Discount'),
        U.el('span', { class: 'val mono' }, '-' + U.currency(t.totalDiscount))));
    }
    footer.appendChild(U.el('div', { class: 'cart-row total' },
      U.el('span', {}, 'Total'),
      U.el('span', { class: 'val mono' }, U.currency(t.net))));

    const checkoutBtn = U.el('button', {
      class: 'btn btn-primary w-full',
      style: { padding: '14px', fontSize: '15px' },
      disabled: !AppState.state.cart.length || checkoutOpen,
      onclick: openCheckout
    }, 'Checkout · ' + U.currency(t.net));
    footer.appendChild(checkoutBtn);

    panel.appendChild(footer);
  }

  function cartItem(ci) {
    const row = U.el('div', { class: 'cart-item' });
    row.appendChild(U.el('div', {},
      U.el('div', { class: 'ci-name' }, ci.name),
      U.el('div', { class: 'ci-price mono' }, U.currency(ci.price) + ' each')
    ));
    const right = U.el('div', { class: 'ci-right' });
    right.appendChild(U.el('div', { class: 'ci-subtotal mono' }, U.currency(ci.price * ci.qty)));
    const qc = U.el('div', { class: 'qty-ctrl' });
    qc.appendChild(U.el('button', { onclick: () => AppState.cartSetQty(ci.productId, ci.qty - 1) }, '−'));
    qc.appendChild(U.el('span', { class: 'qty' }, String(ci.qty)));
    qc.appendChild(U.el('button', {
      onclick: () => {
        if (ci.qty >= (ci.stock || 0)) return U.toast('No more stock', 'warn');
        AppState.cartSetQty(ci.productId, ci.qty + 1);
      }
    }, '+'));
    right.appendChild(qc);
    row.appendChild(right);
    return row;
  }

  function openDiscountDialog() {
    const body = U.el('div', {},
      U.el('div', { class: 'form-group' },
        U.el('label', { class: 'form-label' }, 'Discount percentage (%)'),
        U.el('input', { type: 'number', class: 'form-input', id: 'disc-pct', value: discountPercent, min: 0, max: 100, step: 1 })
      ),
      U.el('div', { class: 'form-group' },
        U.el('label', { class: 'form-label' }, 'Fixed discount amount (₱)'),
        U.el('input', { type: 'number', class: 'form-input', id: 'disc-amt', value: discountAmount, min: 0, step: 1 })
      ),
      U.el('p', { class: 'form-hint' }, 'Discounts reduce the total before payment.')
    );
    U.openModal({
      title: 'Apply discount',
      body,
      footer: [
        U.el('button', { class: 'btn btn-ghost', onclick: () => { discountPercent = 0; discountAmount = 0; renderCart(); document.querySelector('#modal-root .modal-close').click(); } }, 'Clear'),
        U.el('button', { class: 'btn btn-ghost', onclick: () => document.querySelector('#modal-root .modal-close').click() }, 'Cancel'),
        U.el('button', { class: 'btn btn-primary', onclick: () => {
          discountPercent = Math.max(0, Number(U.$('#disc-pct').value) || 0);
          discountAmount = Math.max(0, Number(U.$('#disc-amt').value) || 0);
          renderCart();
          document.querySelector('#modal-root .modal-close').click();
        } }, 'Apply')
      ]
    });
  }

  function openCheckout() {
    if (!AppState.state.cart.length || checkoutOpen) return;
    checkoutOpen = true;
    const t = AppState.cartTotals(discountPercent, discountAmount);

    const body = U.el('div', {});
    body.appendChild(U.el('div', { class: 'form-group' },
      U.el('label', { class: 'form-label' }, 'Payment method'),
      U.el('div', { class: 'pay-methods' },
        payTile('Cash', 'cash', '💵'),
        payTile('GCash', 'gcash', 'G'),
        payTile('Maya', 'maya', 'M'),
        payTile('Other', 'other', '💳')
      )
    ));

    const tenderWrap = U.el('div', { id: 'tender-wrap' });
    body.appendChild(tenderWrap);

    body.appendChild(U.el('div', { class: 'form-group' },
      U.el('label', { class: 'form-label' }, 'Notes (optional)'),
      U.el('textarea', { class: 'form-textarea', id: 'pay-notes', placeholder: 'Any notes for this transaction…' })
    ));

    // Summary
    const summary = U.el('div', { class: 'glass', style: { padding: '14px', marginBottom: '12px' } });
    summary.innerHTML = `
      <div class="cart-row"><span>Subtotal</span><span class="val mono">${U.currency(t.subtotal)}</span></div>
      ${t.totalDiscount > 0 ? `<div class="cart-row"><span>Discount</span><span class="val mono">-${U.currency(t.totalDiscount)}</span></div>` : ''}
      <div class="cart-row total"><span>Total Due</span><span class="val mono">${U.currency(t.net)}</span></div>`;
    body.insertBefore(summary, body.firstChild);

    function renderTender() {
      U.clear(tenderWrap);
      if (payMethod === 'cash') {
        tenderWrap.appendChild(U.el('div', { class: 'form-group' },
          U.el('label', { class: 'form-label' }, 'Amount received'),
          U.el('div', { class: 'input-addon' },
            U.el('span', { class: 'prefix' }, '₱'),
            U.el('input', { type: 'number', inputMode: 'decimal', class: 'form-input', id: 'tendered', value: Math.ceil(t.net), step: '1' })
          )
        ));
        const changeDisp = U.el('div', { id: 'change-disp', class: 'muted', style: { fontSize: '14px', marginBottom: '10px' } });
        tenderWrap.appendChild(changeDisp);
        const updateChange = () => {
          const r = Number(U.$('#tendered').value) || 0;
          const ch = Math.max(0, r - t.net);
          changeDisp.innerHTML = `<strong>Change:</strong> <span class="mono">${U.currency(ch)}</span>`;
        };
        setTimeout(updateChange, 0);
        U.$('#tendered') && U.$('#tendered').addEventListener('input', updateChange);

        // Numpad
        const np = U.el('div', { class: 'numpad' });
        ['1','2','3','4','5','6','7','8','9','.','0','del'].forEach(k => {
          np.appendChild(U.el('button', {
            text: k === 'del' ? '⌫' : k,
            class: k === 'del' ? 'key-clear' : '',
            onclick: () => {
              const inp = U.$('#tendered');
              if (!inp) return;
              if (k === 'del') { inp.value = inp.value.slice(0, -1); }
              else if (k === '.' && inp.value.includes('.')) { return; }
              else { inp.value = (inp.value || '') + k; }
              inp.dispatchEvent(new Event('input'));
            }
          }, k === 'del' ? '⌫' : k));
        });
        tenderWrap.appendChild(np);
        // Exact & quick buttons
        const quick = U.el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginTop: '8px' } });
        [t.net, Math.ceil(t.net/10)*10, Math.ceil(t.net/50)*50].forEach(v => {
          if (v <= 0) return;
          quick.appendChild(U.el('button', {
            class: 'btn btn-ghost btn-small',
            onclick: () => { const i = U.$('#tendered'); if (i) { i.value = v; i.dispatchEvent(new Event('input')); } }
          }, U.currency(v)));
        });
        tenderWrap.appendChild(quick);
      } else {
        tenderWrap.appendChild(U.el('div', { class: 'form-hint', style: { padding: '8px 4px' } },
          payMethod === 'gcash' ? 'GCash payment recorded as received. Verification is done outside this app.' :
          payMethod === 'maya' ? 'Maya payment recorded as received. Verification is done outside this app.' :
          'Payment recorded as received.'
        ));
      }
    }
    renderTender();

    const modal = U.openModal({
      title: 'Checkout',
      subtitle: 'Complete payment for this order',
      body,
      wide: true,
      footer: [
        U.el('button', { class: 'btn btn-ghost', onclick: () => { modal.close(); checkoutOpen = false; } }, 'Cancel'),
        U.el('button', {
          class: 'btn btn-primary',
          id: 'complete-sale-btn',
          onclick: async () => {
            try {
              const cart = AppState.state.cart.map(ci => ({
                productId: ci.productId,
                qty: ci.qty,
                unitPrice: ci.price,
                unitCost: ci.cost,
              }));
              let amountReceived = t.net;
              if (payMethod === 'cash') {
                amountReceived = Number(U.$('#tendered')?.value) || 0;
                if (amountReceived < t.net) return U.toast('Insufficient amount received', 'error');
              }
              const notes = U.$('#pay-notes')?.value || '';
              const btn = U.$('#complete-sale-btn');
              if (btn) btn.disabled = true;
              const sale = await DB.completeSale(cart, { method: payMethod, amountReceived, notes }, { discountPercent, discountAmount });
              await AppState.refreshAll();
              modal.close();
              checkoutOpen = false;
              discountPercent = 0;
              discountAmount = 0;
              AppState.cartClear();
              showReceipt(sale);
              U.toast('Sale completed: ' + sale.transactionNo, 'success');
            } catch (err) {
              checkoutOpen = false;
              U.toast(err.message || 'Checkout failed', 'error');
              const btn = U.$('#complete-sale-btn');
              if (btn) btn.disabled = false;
            }
          }
        }, 'Complete Sale')
      ],
      onClose: () => { checkoutOpen = false; }
    });

    function payTile(label, key, glyph) {
      const t = U.el('button', {
        class: 'pay-tile' + (payMethod === key ? ' selected' : ''),
        onclick: () => { payMethod = key; renderTender(); U.$$('.pay-tile', body).forEach(n => n.classList.remove('selected')); t.classList.add('selected'); }
      });
      t.appendChild(U.el('div', { class: 'pi' }, glyph));
      t.appendChild(U.el('span', {}, label));
      return t;
    }
  }

  function showReceipt(sale) {
    const body = U.el('div', {});
    const r = U.el('div', { class: 'receipt' });
    body.appendChild(r);
    U.receiptText(sale).then(text => { r.textContent = text; });

    U.openModal({
      title: 'Receipt',
      subtitle: sale.transactionNo,
      body,
      wide: false,
      footer: [
        U.el('button', { class: 'btn btn-ghost', onclick: () => U.shareReceipt(sale) }, 'Share'),
        U.el('button', { class: 'btn btn-ghost', onclick: () => U.printReceipt(sale) }, 'Print'),
        U.el('button', { class: 'btn btn-primary', onclick: () => { render(); document.querySelector('#modal-root .modal-close').click(); } }, 'New Sale')
      ]
    });
  }

  function bindCartUpdates() {
    AppState.on('cartChanged', () => renderCart());
  }

  global.Cashier = { render, bindCartUpdates, showReceipt };
})(window);
