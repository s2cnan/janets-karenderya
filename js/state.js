/* ==========================================================================
   Application State & Event Bus
   ========================================================================== */
(function (global) {
  'use strict';

  const state = {
    currentView: 'dashboard',
    products: [],
    categories: [],
    sales: [],
    expenses: [],
    settings: {},
    cart: [],
    filters: {
      period: 'today',
      start: null,
      end: null,
    },
    listeners: new Map(),
  };

  const events = new EventTarget();

  async function refreshAll() {
    state.categories = await DB.getCategories();
    state.products = await DB.getProducts();
    state.sales = await DB.getSales();
    state.expenses = await DB.getExpenses();
    state.settings = await DB.getAllSettings();
    U.setCurrencySymbol(state.settings.currencySymbol || '₱');
    emit('dataChanged', state);
  }

  async function refreshProducts() {
    state.products = await DB.getProducts();
    emit('productsChanged', state.products);
  }
  async function refreshSales() {
    state.sales = await DB.getSales();
    emit('salesChanged', state.sales);
  }
  async function refreshExpenses() {
    state.expenses = await DB.getExpenses();
    emit('expensesChanged', state.expenses);
  }

  function on(evt, fn) { events.addEventListener(evt, (e) => fn(e.detail)); }
  function emit(evt, detail) { events.dispatchEvent(new CustomEvent(evt, { detail })); }

  // Cart helpers
  function cartAdd(product, qty = 1) {
    const existing = state.cart.find(c => c.productId === product.id);
    if (existing) {
      existing.qty = Math.min((product.stock || 0), existing.qty + qty);
    } else {
      state.cart.push({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        price: product.sellingPrice,
        cost: product.purchaseCost,
        qty: Math.min(qty, product.stock || 0),
        stock: product.stock,
      });
    }
    emit('cartChanged', state.cart);
  }
  function cartSetQty(productId, qty) {
    const idx = state.cart.findIndex(c => c.productId === productId);
    if (idx < 0) return;
    if (qty <= 0) {
      state.cart.splice(idx, 1);
    } else {
      state.cart[idx].qty = Math.min(state.cart[idx].stock || 999, qty);
    }
    emit('cartChanged', state.cart);
  }
  function cartRemove(productId) {
    state.cart = state.cart.filter(c => c.productId !== productId);
    emit('cartChanged', state.cart);
  }
  function cartClear() {
    state.cart = [];
    emit('cartChanged', state.cart);
  }
  function cartTotals(discountPercent = 0, discountAmount = 0) {
    const subtotal = U.sum(state.cart, c => c.price * c.qty);
    const cogs = U.sum(state.cart, c => c.cost * c.qty);
    const discPct = subtotal * (discountPercent / 100);
    const totalDiscount = discPct + discountAmount;
    const net = Math.max(0, subtotal - totalDiscount);
    return { subtotal, cogs, totalDiscount, net, itemCount: state.cart.reduce((a, c) => a + c.qty, 0) };
  }

  global.State = state;
  global.AppState = {
    state,
    refreshAll, refreshProducts, refreshSales, refreshExpenses,
    on, emit,
    cartAdd, cartSetQty, cartRemove, cartClear, cartTotals,
  };
})(window);
