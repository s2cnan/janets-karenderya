/* ==========================================================================
   Cashier / POS view — simple calculator flow
   ========================================================================== */
(function (global) {
  'use strict';

  let search = '';
  let activeCategory = 'all';
  let discountPercent = 0;
  let discountAmount = 0;
  let payMethod = 'cash';
  let checkoutOpen = false;
  let submitting = false;

  function render() {
    const container = U.$('#view-container');
    U.clear(container);
    const products = AppState.state.products.filter(p => p.status !== 'archived');

    if (!products.length) {
      container.appendChild(U.el('div', { class: 'empty-state', style: 'padding:60px 20px' },
        U.svgIcon('cart', 56),
        U.el('h3', {}, 'No products in inventory'),
        U.el('p', {}, 'Add products before using the cashier.'),
        U.el('div', { style: 'display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap' },
          U.el('button', { class: 'btn btn-primary', onclick: () => Inventory.openEditor() }, U.svgIcon('plus',16), ' Add Product'),
          U.el('button', { class: 'btn btn-ghost', onclick: () => App.setView('inventory') }, 'Go to Inventory')
        )
      ));
      return;
    }

    const layout = U.el('div', { class: 'cashier-layout' });
    const prodPanel = U.el('div', { class: 'cashier-products' });
    const searchBar = U.el('div', { class: 'search-bar' });
    searchBar.appendChild(U.svgIcon('search'));
    const searchInput = U.el('input', {
      type:'search', class:'form-input', placeholder:'Search product…', value: search,
      oninput: U.debounce((e) => { search = e.target.value; renderProductList(); }, 120)
    });
    searchBar.appendChild(searchInput);
    prodPanel.appendChild(searchBar);

    const catsRow = U.el('div', { class: 'categories-row', id: 'cat-row' });
    catsRow.appendChild(catChip('All', 'all'));
    AppState.state.categories.forEach(c => catsRow.appendChild(catChip(c.emoji + ' ' + c.name, c.id)));
    prodPanel.appendChild(catsRow);
    const grid = U.el('div', { class: 'product-grid', id: 'product-grid' });
    prodPanel.appendChild(grid);
    layout.appendChild(prodPanel);

    const cart = U.el('div', { class: 'cart-panel', id: 'cart-panel' });
    layout.appendChild(cart);
    container.appendChild(layout);
    renderProductList();
    renderCart();
    setTimeout(() => searchInput.focus(), 50);
  }

  function catChip(label, id) {
    return U.el('button', { class:'cat-pill'+(activeCategory===id?' active':''), onclick: () => { activeCategory=id; render(); } }, label);
  }

  function renderProductList() {
    const grid = U.$('#product-grid');
    if (!grid) return;
    U.clear(grid);
    let list = AppState.state.products.filter(p => p.status !== 'archived');
    if (activeCategory !== 'all') list = list.filter(p => p.categoryId === activeCategory);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q) || (p.barcode||'').includes(q));
    list.sort((a,b) => a.name.localeCompare(b.name));
    if (!list.length) {
      grid.appendChild(U.el('div', { class:'empty-state', style:'grid-column:1/-1' },
        U.svgIcon('search',48),
        U.el('h3',{},'No products match your search'),
        U.el('p',{},'Try a different keyword or category.')));
      return;
    }
    list.forEach(p => grid.appendChild(productCard(p)));
  }

  function productCard(p) {
    const out = (p.stock||0) === 0;
    const low = (p.stock||0) <= (p.minStock||0) && !out;
    const cat = AppState.state.categories.find(c => c.id === p.categoryId);
    const card = U.el('div', { class:'product-card'+(out?' out':''), onclick: () => {
      if (out) return U.toast(p.name + ' is out of stock', 'warn');
      askQuantity(p);
    }});
    const imgWrap = U.el('div', { class:'pimg' });
    if (p.image) imgWrap.appendChild(U.el('img', { src: p.image }));
    else imgWrap.textContent = (cat && cat.emoji) || '🍽️';
    card.appendChild(imgWrap);
    if (out) card.appendChild(U.el('span', { class:'stock-badge badge badge-danger' }, 'Out'));
    else if (low) card.appendChild(U.el('span', { class:'stock-badge badge badge-warn' }, p.stock+' left'));
    card.appendChild(U.el('div', { class:'pname' }, p.name));
    card.appendChild(U.el('div', { class:'pprice' }, U.currency(p.sellingPrice)));
    card.appendChild(U.el('div', { class:'pstock' }, (p.stock||0) + ' in stock'));
    return card;
  }

  function askQuantity(p) {
    const body = U.el('div', {});
    body.appendChild(U.el('div', { class:'text-center', style:'margin-bottom:12px' },
      U.el('div', { style:'font-size:16px;font-weight:700' }, p.name),
      U.el('div', { class:'muted', style:'font-size:13px' }, 'Price: ' + U.currency(p.sellingPrice) + ' · Stock: ' + (p.stock||0))
    ));
    body.appendChild(U.el('div', { class:'form-group' },
      U.el('label', { class:'form-label' }, 'Quantity'),
      U.el('input', { type:'number', class:'form-input', id:'qty-input', value:'1', min:1, max:p.stock||1, step:1, inputMode:'numeric', style:'text-align:center;font-size:18px;font-weight:700' })
    ));
    const np = U.el('div', { class:'numpad' });
    ['1','2','3','4','5','6','7','8','9','','0','del'].forEach(k => {
      if (k === '') { np.appendChild(U.el('div')); return; }
      np.appendChild(U.el('button', {
        class: k==='del'?'key-clear':'',
        onclick: () => {
          const inp = U.$('#qty-input');
          if (!inp) return;
          if (k === 'del') inp.value = inp.value.slice(0,-1);
          else inp.value = (inp.value==='0'?k:(inp.value||'')+k);
        }
      }, k==='del'?'⌫':k));
    });
    body.appendChild(np);

    const { close } = U.openModal({
      title: 'Add to order',
      body,
      footer: [
        U.el('button', { class:'btn btn-ghost', onclick: () => close() }, 'Cancel'),
        U.el('button', { class:'btn btn-primary', onclick: () => {
          const inp = U.$('#qty-input');
          const n = Math.floor(Number(inp?.value)||0);
          if (n < 1) return U.toast('Enter quantity of at least 1', 'error');
          if (n > (p.stock||0)) return U.toast('Only ' + (p.stock||0) + ' in stock', 'error');
          AppState.cartAdd(p, n);
          close();
          U.toast(n + ' × ' + p.name + ' added', 'success');
        }}, 'Add to order')
      ]
    });
    setTimeout(() => { const i = U.$('#qty-input'); if (i) { i.select(); i.focus(); } }, 50);
  }

  function renderCart() {
    const panel = U.$('#cart-panel');
    if (!panel) return;
    U.clear(panel);
    const t = AppState.cartTotals(discountPercent, discountAmount);
    panel.appendChild(U.el('div', { class:'cart-header' },
      U.el('h3', {}, 'Current Order'),
      U.el('div', { style:'display:flex;gap:6px' },
        U.el('button', { class:'icon-btn', title:'Discount', onclick: openDiscountDialog },
          (discountPercent||discountAmount) ? U.el('span',{class:'tag'},'Disc') : U.el('span',{class:'muted',style:'font-size:12px'},'Discount')),
        U.el('button', { class:'icon-btn', title:'Clear', onclick: () => {
          if (!AppState.state.cart.length) return;
          U.confirmDialog({ title:'Clear order?', message:'Remove all items?', confirmText:'Clear', danger:true, onConfirm: () => AppState.cartClear() });
        }}, U.svgIcon('trash',18))
      )
    ));
    const items = U.el('div', { class:'cart-items' });
    if (!AppState.state.cart.length) {
      items.appendChild(U.el('div', { class:'cart-empty' }, U.svgIcon('cart',48),
        U.el('div',{},'Tap a product to begin'),
        U.el('div',{style:'font-size:12px;margin-top:4px'},'Search or pick a category')));
    } else {
      AppState.state.cart.forEach(ci => items.appendChild(cartItem(ci)));
    }
    panel.appendChild(items);
    const footer = U.el('div', { class:'cart-footer' });
    footer.appendChild(U.el('div', { class:'cart-row' },
      U.el('span',{},'Subtotal ('+t.itemCount+' item'+(t.itemCount===1?'':'s')+')'),
      U.el('span',{class:'val mono'},U.currency(t.subtotal))));
    if (t.totalDiscount > 0) {
      footer.appendChild(U.el('div', { class:'cart-row' }, U.el('span',{},'Discount'), U.el('span',{class:'val mono'},'-'+U.currency(t.totalDiscount))));
    }
    footer.appendChild(U.el('div', { class:'cart-row total' }, U.el('span',{},'Total Due'), U.el('span',{class:'val mono'},U.currency(t.net))));
    footer.appendChild(U.el('button', {
      class:'btn btn-primary w-full', style:'padding:14px;font-size:15px',
      disabled: !AppState.state.cart.length || checkoutOpen || submitting,
      onclick: openCheckout
    }, AppState.state.cart.length ? ('Checkout · '+U.currency(t.net)) : 'Add items to start'));
    panel.appendChild(footer);
  }

  function cartItem(ci) {
    const row = U.el('div', { class:'cart-item' });
    row.appendChild(U.el('div', {},
      U.el('div', { class:'ci-name' }, ci.name),
      U.el('div', { class:'ci-price mono' }, U.currency(ci.price)+' × '+ci.qty+' = '+U.currency(ci.price*ci.qty))
    ));
    const right = U.el('div', { class:'ci-right' });
    right.appendChild(U.el('div', { class:'ci-subtotal mono' }, U.currency(ci.price*ci.qty)));
    const qc = U.el('div', { class:'qty-ctrl' });
    qc.appendChild(U.el('button', { onclick: () => AppState.cartSetQty(ci.productId, ci.qty-1) }, '−'));
    qc.appendChild(U.el('span', { class:'qty' }, String(ci.qty)));
    qc.appendChild(U.el('button', { onclick: () => { if (ci.qty>=(ci.stock||0)) return U.toast('No more stock','warn'); AppState.cartSetQty(ci.productId, ci.qty+1); } }, '+'));
    right.appendChild(qc);
    row.appendChild(right);
    row.appendChild(U.el('button', {
      style:'grid-column:1/-1;text-align:right;font-size:12px;color:var(--danger);background:none;border:none;cursor:pointer;padding:0 4px;margin-top:-2px',
      onclick: () => AppState.cartRemove(ci.productId)
    }, 'Remove item'));
    return row;
  }

  function openDiscountDialog() {
    const body = U.el('div', {},
      U.el('div', { class:'form-group' }, U.el('label',{class:'form-label'},'Discount percentage (%)'),
        U.el('input',{type:'number',class:'form-input',id:'disc-pct',value:discountPercent,min:0,max:100,step:1})),
      U.el('div', { class:'form-group' }, U.el('label',{class:'form-label'},'Fixed discount (₱)'),
        U.el('input',{type:'number',class:'form-input',id:'disc-amt',value:discountAmount,min:0,step:1}))
    );
    U.openModal({ title:'Discount', body, footer:[
      U.el('button', {class:'btn btn-ghost', onclick:()=>{discountPercent=0;discountAmount=0;renderCart();document.querySelector('#modal-root .modal-close').click();}}, 'Clear'),
      U.el('button', {class:'btn btn-ghost', onclick:()=>document.querySelector('#modal-root .modal-close').click()}, 'Cancel'),
      U.el('button', {class:'btn btn-primary', onclick:()=>{
        discountPercent=Math.max(0,Number(U.$('#disc-pct').value)||0);
        discountAmount=Math.max(0,Number(U.$('#disc-amt').value)||0);
        renderCart();
        document.querySelector('#modal-root .modal-close').click();
      }}, 'Apply')
    ]});
  }

  function openCheckout() {
    if (!AppState.state.cart.length || checkoutOpen || submitting) return;
    checkoutOpen = true;
    const t = AppState.cartTotals(discountPercent, discountAmount);
    const body = U.el('div', {});
    const summary = U.el('div', { class:'glass', style:'padding:14px;margin-bottom:12px' });
    summary.innerHTML = `<div class="cart-row"><span>Subtotal</span><span class="val mono">${U.currency(t.subtotal)}</span></div>` +
      (t.totalDiscount>0?`<div class="cart-row"><span>Discount</span><span class="val mono">-${U.currency(t.totalDiscount)}</span></div>`:'') +
      `<div class="cart-row total"><span>Total Due</span><span class="val mono">${U.currency(t.net)}</span></div>`;
    body.appendChild(summary);

    body.appendChild(U.el('div', { class:'form-group' },
      U.el('label',{class:'form-label'},'Payment method'),
      U.el('div',{class:'pay-methods'},
        payTile('Cash','cash','₱'), payTile('GCash','gcash','G'), payTile('Maya','maya','M'), payTile('Other','other','💳')
      )
    ));
    const tenderWrap = U.el('div', { id:'tender-wrap' });
    body.appendChild(tenderWrap);
    body.appendChild(U.el('div',{class:'form-group'},U.el('label',{class:'form-label'},'Notes (optional)'),
      U.el('textarea',{class:'form-textarea',id:'pay-notes',placeholder:'Any notes for this transaction…'})));

    function renderTender() {
      U.clear(tenderWrap);
      if (payMethod === 'cash') {
        tenderWrap.appendChild(U.el('div',{class:'form-group'},
          U.el('label',{class:'form-label'},'Amount received'),
          U.el('div',{class:'input-addon'},
            U.el('span',{class:'prefix'},'₱'),
            U.el('input',{type:'number',inputMode:'decimal',class:'form-input',id:'tendered',value:t.net,step:'1'})
          )));
        const changeDisp = U.el('div', { class:'glass', style:'padding:10px 14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center' });
        changeDisp.innerHTML = `<span>Change due:</span> <strong class="mono" id="change-val" style="font-size:18px;color:var(--emerald-deep)">${U.currency(0)}</strong>`;
        tenderWrap.appendChild(changeDisp);
        const updateChange = () => {
          const r = Number(U.$('#tendered').value)||0;
          const v = U.$('#change-val'); if (v) v.textContent = U.currency(Math.max(0, r-t.net));
        };
        setTimeout(updateChange, 0);
        setTimeout(() => { const i = U.$('#tendered'); if (i) i.addEventListener('input', updateChange); }, 0);
        const quick = U.el('div',{style:'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px'});
        [t.net, Math.ceil(t.net/50)*50, Math.ceil(t.net/100)*100, Math.ceil(t.net/20)*20, Math.ceil(t.net/10)*10, Math.ceil(t.net/50)*50+100]
          .filter((v,i,a)=>v>0 && a.indexOf(v)===i).slice(0,6).forEach(v => {
          quick.appendChild(U.el('button',{class:'btn btn-ghost btn-small', onclick:()=>{const i=U.$('#tendered');if(i){i.value=v;i.dispatchEvent(new Event('input'));i.focus();}}}, U.currency(v)));
        });
        tenderWrap.appendChild(quick);
        const np = U.el('div',{class:'numpad'});
        ['1','2','3','4','5','6','7','8','9','.','0','del'].forEach(k => {
          np.appendChild(U.el('button',{class:k==='del'?'key-clear':'',onclick:()=>{
            const inp=U.$('#tendered');if(!inp)return;
            if(k==='del')inp.value=inp.value.slice(0,-1);
            else if(k==='.'&&inp.value.includes('.'))return;
            else inp.value=(inp.value==='0'?k:(inp.value||'')+k);
            inp.dispatchEvent(new Event('input'));
          }}, k==='del'?'⌫':k));
        });
        np.appendChild(U.el('div'));
        np.appendChild(U.el('button',{class:'key-ok',onclick:complete},'✓'));
        tenderWrap.appendChild(np);
      } else {
        tenderWrap.appendChild(U.el('div',{class:'form-hint',style:'padding:8px 4px;line-height:1.5'},
          payMethod==='gcash' ? 'GCash payment recorded as received. Confirm in your GCash app before completing.' :
          payMethod==='maya' ? 'Maya payment recorded as received. Confirm in your Maya app before completing.' :
          'Payment recorded as received.'));
      }
    }
    renderTender();

    function payTile(label,key,glyph) {
      const t = U.el('button',{class:'pay-tile'+(payMethod===key?' selected':''), onclick:()=>{payMethod=key;renderTender();U.$$('.pay-tile',body).forEach(n=>n.classList.remove('selected'));t.classList.add('selected');}});
      t.appendChild(U.el('div',{class:'pi'},glyph));
      t.appendChild(U.el('span',{},label));
      return t;
    }

    async function complete() {
      if (submitting) return;
      try {
        const cart = AppState.state.cart.map(ci => ({ productId: ci.productId, qty: ci.qty, unitPrice: ci.price, unitCost: ci.cost }));
        let amountReceived = t.net;
        if (payMethod === 'cash') {
          amountReceived = Number(U.$('#tendered')?.value)||0;
          if (amountReceived < t.net - 0.001) return U.toast('Amount received is less than total due','error');
        }
        const notes = U.$('#pay-notes')?.value||'';
        submitting = true;
        const btn = U.$('#complete-sale-btn'); if (btn) btn.disabled = true;
        const sale = await DB.completeSale(cart, { method: payMethod, amountReceived, notes }, { discountPercent, discountAmount });
        await AppState.refreshAll();
        modal.close();
        checkoutOpen = false; submitting = false;
        discountPercent = 0; discountAmount = 0;
        AppState.cartClear();
        showReceipt(sale);
        U.toast('✓ Sale completed: '+sale.transactionNo, 'success');
      } catch(err) {
        submitting = false; checkoutOpen = false;
        U.toast(err.message||'Checkout failed','error');
        const btn=U.$('#complete-sale-btn'); if (btn) btn.disabled=false;
      }
    }

    const modal = U.openModal({
      title:'Checkout', subtitle:'Review total and confirm payment', body, wide:true,
      footer:[
        U.el('button',{class:'btn btn-ghost',onclick:()=>{modal.close();checkoutOpen=false;}},'Cancel'),
        U.el('button',{class:'btn btn-primary',id:'complete-sale-btn',onclick:complete},'Complete Sale · '+U.currency(t.net))
      ],
      onClose: () => { checkoutOpen=false; submitting=false; }
    });
  }

  function showReceipt(sale) {
    const body = U.el('div',{});
    const r = U.el('div',{class:'receipt'});
    body.appendChild(r);
    U.receiptText(sale).then(t => r.textContent = t);
    U.openModal({
      title:'Receipt — '+sale.transactionNo, subtitle:U.formatDate(sale.date,'datetime'), body,
      footer:[
        U.el('button',{class:'btn btn-ghost',onclick:()=>U.shareReceipt(sale)},'Share'),
        U.el('button',{class:'btn btn-ghost',onclick:()=>U.printReceipt(sale)},'Print'),
        U.el('button',{class:'btn btn-primary',onclick:()=>{render();document.querySelector('#modal-root .modal-close').click();}},'New Sale')
      ]
    });
  }

  function bindCartUpdates() { AppState.on('cartChanged', () => renderCart()); }
  global.Cashier = { render, bindCartUpdates, showReceipt };
})(window);
