/* ==========================================================================
   Janets Karenderya — IndexedDB Layer
   Stores: products, categories, sales, saleItems, stockMovements,
           expenses, payments, settings
   ========================================================================== */
(function (global) {
  'use strict';

  const DB_NAME = 'janets_karenderya';
  const DB_VERSION = 1;

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        const tx = e.target.transaction;

        // Categories
        if (!db.objectStoreNames.contains('categories')) {
          const s = db.createObjectStore('categories', { keyPath: 'id' });
          s.createIndex('name', 'name', { unique: false });
        }
        // Products
        if (!db.objectStoreNames.contains('products')) {
          const s = db.createObjectStore('products', { keyPath: 'id' });
          s.createIndex('sku', 'sku', { unique: false });
          s.createIndex('barcode', 'barcode', { unique: false });
          s.createIndex('name', 'name', { unique: false });
          s.createIndex('categoryId', 'categoryId', { unique: false });
          s.createIndex('status', 'status', { unique: false });
        }
        // Sales (header)
        if (!db.objectStoreNames.contains('sales')) {
          const s = db.createObjectStore('sales', { keyPath: 'id' });
          s.createIndex('transactionNo', 'transactionNo', { unique: true });
          s.createIndex('date', 'date', { unique: false });
          s.createIndex('status', 'status', { unique: false });
          s.createIndex('paymentMethod', 'paymentMethod', { unique: false });
        }
        // Sale items
        if (!db.objectStoreNames.contains('saleItems')) {
          const s = db.createObjectStore('saleItems', { keyPath: 'id', autoIncrement: true });
          s.createIndex('saleId', 'saleId', { unique: false });
          s.createIndex('productId', 'productId', { unique: false });
        }
        // Stock movements
        if (!db.objectStoreNames.contains('stockMovements')) {
          const s = db.createObjectStore('stockMovements', { keyPath: 'id' });
          s.createIndex('productId', 'productId', { unique: false });
          s.createIndex('date', 'date', { unique: false });
          s.createIndex('type', 'type', { unique: false });
          s.createIndex('saleId', 'saleId', { unique: false });
        }
        // Expenses
        if (!db.objectStoreNames.contains('expenses')) {
          const s = db.createObjectStore('expenses', { keyPath: 'id' });
          s.createIndex('date', 'date', { unique: false });
          s.createIndex('category', 'category', { unique: false });
          s.createIndex('reversed', 'reversed', { unique: false });
        }
        // Settings / key-value
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // Seed default categories on first run
        seedDefaults(tx);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function seedDefaults(tx) {
    const catStore = tx.objectStore('categories');
    const defaults = [
      { id: 'cat-rice', name: 'Rice Meals', color: '#35A879', emoji: '🍚' },
      { id: 'cat-ulam', name: 'Ulam', color: '#D64545', emoji: '🍛' },
      { id: 'cat-snack', name: 'Snacks', color: '#E0A23A', emoji: '🥟' },
      { id: 'cat-drink', name: 'Drinks', color: '#3A8FE0', emoji: '🥤' },
      { id: 'cat-extra', name: 'Extras', color: '#8a4fb8', emoji: '🍯' },
    ];
    defaults.forEach(c => {
      try { catStore.add(c); } catch (e) { /* ignore */ }
    });

    // Seed sample products
    const prodStore = tx.objectStore('products');
    const sampleProducts = [
      { id: 'p-tapsilog', sku: 'TAP-001', barcode: '', name: 'Tapsilog', categoryId: 'cat-rice', image: '', purchaseCost: 45, sellingPrice: 80, stock: 20, minStock: 5, supplier: '', expiry: '', status: 'active', createdAt: Date.now() },
      { id: 'p-tocilog', sku: 'TOC-001', barcode: '', name: 'Tocilog', categoryId: 'cat-rice', image: '', purchaseCost: 42, sellingPrice: 75, stock: 18, minStock: 5, supplier: '', expiry: '', status: 'active', createdAt: Date.now() },
      { id: 'p-longsilog', sku: 'LNG-001', barcode: '', name: 'Longsilog', categoryId: 'cat-rice', image: '', purchaseCost: 40, sellingPrice: 75, stock: 15, minStock: 5, supplier: '', expiry: '', status: 'active', createdAt: Date.now() },
      { id: 'p-adobo', sku: 'ADB-001', barcode: '', name: 'Adobong Manok', categoryId: 'cat-ulam', image: '', purchaseCost: 38, sellingPrice: 65, stock: 12, minStock: 4, supplier: '', expiry: '', status: 'active', createdAt: Date.now() },
      { id: 'p-sinigang', sku: 'SNG-001', barcode: '', name: 'Sinigang na Baboy', categoryId: 'cat-ulam', image: '', purchaseCost: 55, sellingPrice: 90, stock: 8, minStock: 4, supplier: '', expiry: '', status: 'active', createdAt: Date.now() },
      { id: 'p-lumpia', sku: 'LMP-001', barcode: '', name: 'Lumpiang Shanghai (6pcs)', categoryId: 'cat-snack', image: '', purchaseCost: 18, sellingPrice: 35, stock: 30, minStock: 10, supplier: '', expiry: '', status: 'active', createdAt: Date.now() },
      { id: 'p-turon', sku: 'TRN-001', barcode: '', name: 'Turon', categoryId: 'cat-snack', image: '', purchaseCost: 8, sellingPrice: 15, stock: 25, minStock: 10, supplier: '', expiry: '', status: 'active', createdAt: Date.now() },
      { id: 'p-coke', sku: 'COKE-001', barcode: '', name: 'Coca-Cola (330ml)', categoryId: 'cat-drink', image: '', purchaseCost: 32, sellingPrice: 50, stock: 24, minStock: 6, supplier: '', expiry: '', status: 'active', createdAt: Date.now() },
      { id: 'p-water', sku: 'WTR-001', barcode: '', name: 'Bottled Water (500ml)', categoryId: 'cat-drink', image: '', purchaseCost: 10, sellingPrice: 20, stock: 40, minStock: 12, supplier: '', expiry: '', status: 'active', createdAt: Date.now() },
      { id: 'p-rice', sku: 'RCE-001', barcode: '', name: 'Extra Rice', categoryId: 'cat-extra', image: '', purchaseCost: 8, sellingPrice: 15, stock: 100, minStock: 20, supplier: '', expiry: '', status: 'active', createdAt: Date.now() },
      { id: 'p-egg', sku: 'EGG-001', barcode: '', name: 'Itlog (Extra Egg)', categoryId: 'cat-extra', image: '', purchaseCost: 7, sellingPrice: 15, stock: 3, minStock: 10, supplier: '', expiry: '', status: 'active', createdAt: Date.now() },
    ];
    sampleProducts.forEach(p => {
      try { prodStore.add(p); } catch (e) { /* ignore */ }
    });

    // Default settings
    const sStore = tx.objectStore('settings');
    const defaultsSettings = [
      { key: 'businessName', value: 'Janets Karenderya' },
      { key: 'currency', value: 'PHP' },
      { key: 'currencySymbol', value: '₱' },
      { key: 'address', value: '' },
      { key: 'tin', value: '' },
      { key: 'vatEnabled', value: false },
      { key: 'vatRate', value: 0.12 },
      { key: 'pin', value: '' },
      { key: 'forecastGrowth', value: 0.05 },
      { key: 'seasonality', value: 1.0 },
      { key: 'installedAt', value: Date.now() },
      { key: 'backupReminderDays', value: 7 },
    ];
    defaultsSettings.forEach(s => {
      try { sStore.add(s); } catch (e) { /* ignore */ }
    });
  }

  /* ---------- helpers ---------- */
  function tx(storeNames, mode = 'readonly') {
    return openDB().then(db => {
      const t = db.transaction(storeNames, mode);
      return { t, stores: toStoreMap(t, storeNames) };
    });
  }
  function toStoreMap(t, storeNames) {
    const arr = Array.isArray(storeNames) ? storeNames : [storeNames];
    const map = {};
    arr.forEach(name => { map[name] = t.objectStore(name); });
    return map;
  }
  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function uid(prefix = 'id') {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- Generic CRUD ---------- */
  async function getAll(store) {
    const { stores } = await tx(store);
    return reqToPromise(stores[store].getAll());
  }
  async function getById(store, id) {
    const { stores } = await tx(store);
    return reqToPromise(stores[store].get(id));
  }
  async function put(store, value) {
    const { t, stores } = await tx(store, 'readwrite');
    const r = reqToPromise(stores[store].put(value));
    return new Promise((resolve, reject) => {
      t.oncomplete = () => resolve(value);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
      r.catch(reject);
    });
  }
  async function del(store, id) {
    const { t, stores } = await tx(store, 'readwrite');
    stores[store].delete(id);
    return new Promise((resolve, reject) => {
      t.oncomplete = () => resolve(true);
      t.onerror = () => reject(t.error);
    });
  }
  async function clear(store) {
    const { t, stores } = await tx(store, 'readwrite');
    stores[store].clear();
    return new Promise((resolve, reject) => {
      t.oncomplete = () => resolve(true);
      t.onerror = () => reject(t.error);
    });
  }

  /* ---------- Settings ---------- */
  async function getSetting(key, def = null) {
    const v = await getById('settings', key);
    return v ? v.value : def;
  }
  async function setSetting(key, value) {
    return put('settings', { key, value });
  }
  async function getAllSettings() {
    const items = await getAll('settings');
    const obj = {};
    items.forEach(i => { obj[i.key] = i.value; });
    return obj;
  }

  /* ---------- Categories ---------- */
  async function getCategories() {
    const list = await getAll('categories');
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }
  async function saveCategory(cat) {
    if (!cat.id) cat.id = uid('cat');
    return put('categories', cat);
  }
  async function deleteCategory(id) {
    // Don't allow delete if products reference it (set them to uncategorized)
    const prods = await getAll('products');
    const { t, stores } = await tx(['categories', 'products'], 'readwrite');
    stores.categories.delete(id);
    prods.forEach(p => {
      if (p.categoryId === id) {
        p.categoryId = '';
        stores.products.put(p);
      }
    });
    return new Promise((resolve, reject) => {
      t.oncomplete = () => resolve(true);
      t.onerror = () => reject(t.error);
    });
  }

  /* ---------- Products ---------- */
  async function getProducts() {
    return getAll('products');
  }
  async function getActiveProducts() {
    const all = await getAll('products');
    return all.filter(p => p.status !== 'archived');
  }
  async function saveProduct(p) {
    if (!p.id) {
      p.id = uid('p');
      p.createdAt = Date.now();
      p.status = p.status || 'active';
    }
    p.updatedAt = Date.now();
    p.purchaseCost = Number(p.purchaseCost) || 0;
    p.sellingPrice = Number(p.sellingPrice) || 0;
    p.stock = Number(p.stock) || 0;
    p.minStock = Number(p.minStock) || 0;
    return put('products', p);
  }
  async function adjustStock(productId, delta, reason, note, saleId = null, txn) {
    const run = async (t, stores) => {
      const prod = await reqToPromise(stores.products.get(productId));
      if (!prod) throw new Error('Product not found');
      const before = prod.stock;
      prod.stock = Math.max(0, (prod.stock || 0) + delta);
      await reqToPromise(stores.products.put(prod));
      const mv = {
        id: uid('mv'),
        productId,
        date: Date.now(),
        type: reason,
        quantity: delta,
        stockBefore: before,
        stockAfter: prod.stock,
        note: note || '',
        saleId,
      };
      await reqToPromise(stores.stockMovements.add(mv));
      return prod;
    };
    if (txn) return run(txn.t, txn.stores);
    const { t, stores } = await tx(['products', 'stockMovements'], 'readwrite');
    const r = run(t, stores);
    return new Promise((resolve, reject) => {
      t.oncomplete = () => r.then(resolve).catch(reject);
      t.onerror = () => reject(t.error);
    });
  }

  /* ---------- Sales / Checkout ---------- */
  async function generateTransactionNo() {
    const d = new Date();
    const ymd = d.getFullYear().toString() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    // count today's sales for serial
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const end = start + 86400000;
    const { stores } = await tx(['sales']);
    const idx = stores.sales.index('date');
    const range = IDBKeyRange.bound(start, end);
    return new Promise((resolve, reject) => {
      let count = 0;
      const cursorReq = idx.openCursor(range);
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { count++; cursor.continue(); }
        else {
          const serial = String(count + 1).padStart(4, '0');
          resolve(`JK-${ymd}-${serial}`);
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  }

  /**
   * Complete a sale transactionally.
   * cart: [{ productId, qty, unitPrice, unitCost, discount }]
   * payment: { method, amountReceived, change }
   * discounts: { discountPercent, discountAmount }
   * Returns the created sale object.
   */
  async function completeSale(cart, payment, discounts = {}) {
    if (!cart || !cart.length) throw new Error('Cart is empty');
    // Read settings and next transaction number BEFORE starting the write transaction
    // to avoid nested/parallel transaction conflicts.
    const vatEnabled = await getSetting('vatEnabled');
    const vatRate = (await getSetting('vatRate')) || 0.12;
    const transactionNo = await generateTransactionNo();
    const { t, stores } = await tx(['products', 'sales', 'saleItems', 'stockMovements'], 'readwrite');

    return new Promise(async (resolve, reject) => {
      try {
        // Reload products & validate stock
        const resolved = [];
        let subtotal = 0;
        let cogs = 0;
        for (const item of cart) {
          const p = await reqToPromise(stores.products.get(item.productId));
          if (!p) throw new Error(`Product not found: ${item.productId}`);
          if (p.status === 'archived') throw new Error(`${p.name} is not available`);
          if ((p.stock || 0) < item.qty) throw new Error(`Insufficient stock for ${p.name}. Available: ${p.stock}`);
          const unitPrice = Number(item.unitPrice ?? p.sellingPrice) || 0;
          const unitCost = Number(item.unitCost ?? p.purchaseCost) || 0;
          const qty = Math.max(1, Math.floor(item.qty));
          const lineTotal = unitPrice * qty;
          subtotal += lineTotal;
          cogs += unitCost * qty;
          resolved.push({ product: p, qty, unitPrice, unitCost, lineTotal });
        }

        const discountAmount = Number(discounts.discountAmount) || 0;
        const discountPercent = Number(discounts.discountPercent) || 0;
        const totalDiscount = discountAmount + (subtotal * discountPercent / 100);
        const netSales = Math.max(0, subtotal - totalDiscount);
        const vat = vatEnabled ? netSales * vatRate / (1 + vatRate) : 0; // VAT-inclusive
        const amountReceived = Number(payment.amountReceived ?? netSales) || netSales;
        const change = Math.max(0, amountReceived - netSales);
        const saleId = uid('s');
        const sale = {
          id: saleId,
          transactionNo,
          date: Date.now(),
          status: 'completed',
          items: resolved.map(r => ({
            productId: r.product.id,
            name: r.product.name,
            sku: r.product.sku,
            qty: r.qty,
            unitPrice: r.unitPrice,
            unitCost: r.unitCost,
            lineTotal: r.lineTotal,
          })),
          subtotal,
          discountAmount: totalDiscount,
          discountPercent,
          vatableSales: vatEnabled ? netSales - vat : netSales,
          vat,
          netSales,
          costOfGoods: cogs,
          grossProfit: netSales - cogs,
          paymentMethod: payment.method || 'cash',
          amountReceived,
          change,
          notes: payment.notes || '',
        };
        await reqToPromise(stores.sales.add(sale));

        // Deduct stock and record movements
        for (const r of resolved) {
          const before = r.product.stock;
          r.product.stock = Math.max(0, before - r.qty);
          await reqToPromise(stores.products.put(r.product));
          const mv = {
            id: uid('mv'),
            productId: r.product.id,
            date: Date.now(),
            type: 'sale',
            quantity: -r.qty,
            stockBefore: before,
            stockAfter: r.product.stock,
            note: `Sale ${transactionNo}`,
            saleId,
          };
          await reqToPromise(stores.stockMovements.add(mv));
        }

        t.oncomplete = () => resolve(sale);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error || new Error('Transaction aborted'));
      } catch (err) {
        reject(err);
        try { t.abort(); } catch (e) {}
      }
    });
  }

  async function getSales() {
    return getAll('sales');
  }
  async function getSalesInRange(start, end) {
    const all = await getAll('sales');
    return all.filter(s => s.date >= start && s.date < end && s.status !== 'void');
  }
  async function voidSale(saleId, reason) {
    const { t, stores } = await tx(['sales', 'products', 'stockMovements'], 'readwrite');
    return new Promise(async (resolve, reject) => {
      try {
        const sale = await reqToPromise(stores.sales.get(saleId));
        if (!sale) throw new Error('Sale not found');
        if (sale.status === 'void') throw new Error('Sale already voided');

        // Restore stock
        for (const item of sale.items) {
          const p = await reqToPromise(stores.products.get(item.productId));
          if (!p) continue;
          const before = p.stock;
          p.stock = (p.stock || 0) + item.qty;
          await reqToPromise(stores.products.put(p));
          await reqToPromise(stores.stockMovements.add({
            id: uid('mv'),
            productId: p.id,
            date: Date.now(),
            type: 'return',
            quantity: item.qty,
            stockBefore: before,
            stockAfter: p.stock,
            note: `Void of ${sale.transactionNo}: ${reason || ''}`,
            saleId,
          }));
        }
        sale.status = 'void';
        sale.voidedAt = Date.now();
        sale.voidReason = reason || '';
        await reqToPromise(stores.sales.put(sale));

        t.oncomplete = () => resolve(sale);
        t.onerror = () => reject(t.error);
      } catch (err) {
        reject(err);
        try { t.abort(); } catch (e) {}
      }
    });
  }

  /* ---------- Expenses ---------- */
  async function getExpenses() {
    const list = await getAll('expenses');
    return list.sort((a, b) => b.date - a.date);
  }
  async function saveExpense(e) {
    if (!e.id) {
      e.id = uid('exp');
      e.createdAt = Date.now();
    }
    e.amount = Number(e.amount) || 0;
    e.date = e.date || Date.now();
    e.reversed = !!e.reversed;
    return put('expenses', e);
  }
  async function reverseExpense(id, reason) {
    const e = await getById('expenses', id);
    if (!e) throw new Error('Expense not found');
    e.reversed = true;
    e.reversedAt = Date.now();
    e.reverseReason = reason || '';
    return put('expenses', e);
  }
  async function getExpensesInRange(start, end) {
    const all = await getExpenses();
    return all.filter(e => e.date >= start && e.date < end && !e.reversed);
  }

  /* ---------- Stock movements ---------- */
  async function getStockMovements(productId) {
    const all = await getAll('stockMovements');
    const sorted = all.sort((a, b) => b.date - a.date);
    return productId ? sorted.filter(m => m.productId === productId) : sorted;
  }

  /* ---------- Backup & Restore ---------- */
  async function exportBackup() {
    const data = {
      version: DB_VERSION,
      exportedAt: Date.now(),
      app: 'janets-karenderya',
      data: {
        categories: await getAll('categories'),
        products: await getAll('products'),
        sales: await getAll('sales'),
        saleItems: await getAll('saleItems'),
        stockMovements: await getAll('stockMovements'),
        expenses: await getAll('expenses'),
        settings: await getAll('settings'),
      }
    };
    return data;
  }

  async function restoreBackup(data) {
    if (!data || data.app !== 'janets-karenderya' || !data.data) {
      throw new Error('Invalid backup file');
    }
    const stores = ['categories', 'products', 'sales', 'saleItems', 'stockMovements', 'expenses', 'settings'];
    const { t } = await tx(stores, 'readwrite');
    return new Promise((resolve, reject) => {
      try {
        stores.forEach(s => {
          const store = t.objectStore(s);
          store.clear();
          (data.data[s] || []).forEach(item => store.put(item));
        });
        t.oncomplete = () => {
          dbPromise = null; // force reopen next time
          resolve(true);
        };
        t.onerror = () => reject(t.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async function resetAll() {
    const stores = ['categories', 'products', 'sales', 'saleItems', 'stockMovements', 'expenses', 'settings'];
    const { t } = await tx(stores, 'readwrite');
    return new Promise((resolve, reject) => {
      stores.forEach(s => t.objectStore(s).clear());
      t.oncomplete = () => {
        // Reseed
        dbPromise = null;
        openDB().then(() => resolve(true)).catch(reject);
      };
      t.onerror = () => reject(t.error);
    });
  }

  /* ---------- Public API ---------- */
  global.DB = {
    open: openDB,
    uid,
    getAll, getById, put, del, clear,
    getSetting, setSetting, getAllSettings,
    getCategories, saveCategory, deleteCategory,
    getProducts, getActiveProducts, saveProduct, adjustStock,
    completeSale, getSales, getSalesInRange, voidSale,
    getExpenses, saveExpense, reverseExpense, getExpensesInRange,
    getStockMovements,
    exportBackup, restoreBackup, resetAll,
  };
})(window);
