/* ==========================================================================
   App bootstrap — navigation, SW, clock, transaction detail, PIN
   ========================================================================== */
(function (global) {
  'use strict';

  const VIEWS = {
    dashboard: { title: 'Dashboard', sub: 'Today\'s overview', render: () => Dashboard.render() },
    cashier: { title: 'Cashier', sub: 'Point of sale', render: () => Cashier.render() },
    inventory: { title: 'Inventory', sub: 'Products & stock', render: () => Inventory.render() },
    forecasts: { title: 'Profit & Forecasts', sub: 'Analytics & projections', render: () => Forecasts.render() },
    expenses: { title: 'Expenses', sub: 'Operating costs', render: () => Expenses.render() },
    transactions: { title: 'Transactions', sub: 'Sales history', render: () => Transactions.render() },
    reports: { title: 'Reports', sub: 'Detailed reporting', render: () => Reports.render() },
    settings: { title: 'Settings & Backup', sub: 'Business setup & data', render: () => Settings.render() },
  };

  const App = {
    async init() {
      // Open DB and load initial data
      try {
        await DB.open();
      } catch (e) {
        console.error('DB open failed', e);
      }
      await AppState.refreshAll();

      // Bind navigation
      bindNav();
      Cashier.bindCartUpdates();

      // Clock
      tickClock();
      setInterval(tickClock, 30000);

      // Connectivity
      updateOnlineStatus();
      window.addEventListener('online', updateOnlineStatus);
      window.addEventListener('offline', updateOnlineStatus);

      // PIN gate (if set)
      const pin = await DB.getSetting('pin');
      if (pin) showPinGate(pin);

      // Initial view
      this.setView('dashboard');

      // Service worker
      if ('serviceWorker' in navigator) {
        registerSW();
      }

      // Backup reminder (once per session check)
      setTimeout(checkBackupReminder, 2000);

      // Close sidebar on backdrop click
      const bd = U.el('div', { class: 'sidebar-backdrop', id: 'sidebar-backdrop' });
      bd.addEventListener('click', closeSidebar);
      document.body.appendChild(bd);
    },

    setView(name) {
      if (!VIEWS[name]) name = 'dashboard';
      AppState.state.currentView = name;
      // Update nav items
      U.$$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));
      U.$$('.bnav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));
      // Title
      const v = VIEWS[name];
      U.$('#page-title').textContent = v.title;
      U.$('#page-subtitle').textContent = v.sub;
      closeSidebar();
      v.render();
      window.scrollTo(0, 0);
    },

    showTransaction(id) {
      const sale = AppState.state.sales.find(s => s.id === id);
      if (!sale) return U.toast('Transaction not found', 'error');
      const body = U.el('div', {});
      const r = U.el('div', { class: 'receipt', id: 'rx-receipt' });
      body.appendChild(r);
      U.receiptText(sale).then(t => r.textContent = t);

      U.openModal({
        title: sale.transactionNo + ' — ' + U.formatDate(sale.date, 'datetime'),
        subtitle: sale.status === 'void' ? 'VOIDED: ' + (sale.voidReason || '') : 'Completed sale',
        body,
        wide: false,
        footer: [
          sale.status !== 'void' ? U.el('button', {
            class: 'btn btn-ghost', style: { color: 'var(--danger)', marginRight: 'auto' },
            onclick: () => {
              U.confirmDialog({
                title: 'Void this sale?',
                message: 'This will reverse inventory and mark the transaction as void. Original records are preserved.',
                confirmText: 'Void sale',
                danger: true,
                onConfirm: async () => {
                  try {
                    await DB.voidSale(sale.id, 'Manual void');
                    await AppState.refreshAll();
                    document.querySelector('#modal-root .modal-close').click();
                    if (AppState.state.currentView === 'transactions') Transactions.render();
                    else if (AppState.state.currentView === 'dashboard') Dashboard.render();
                    U.toast('Sale voided', 'success');
                  } catch (err) { U.toast(err.message, 'error'); }
                }
              });
            }
          }, 'Void Sale') : null,
          U.el('button', { class: 'btn btn-ghost', onclick: () => U.shareReceipt(sale) }, 'Share'),
          U.el('button', { class: 'btn btn-ghost', onclick: () => U.printReceipt(sale) }, 'Print'),
          U.el('button', { class: 'btn btn-primary', onclick: () => document.querySelector('#modal-root .modal-close').click() }, 'Close')
        ]
      });
    }
  };

  function bindNav() {
    U.$$('.nav-item').forEach(b => b.addEventListener('click', () => App.setView(b.dataset.view)));
    U.$$('.bnav-item').forEach(b => b.addEventListener('click', () => App.setView(b.dataset.view)));
    U.$$('.bnav-fab').forEach(b => b.addEventListener('click', () => App.setView('cashier')));
    U.$('#quick-cashier').addEventListener('click', () => App.setView('cashier'));
    U.$('#menu-toggle').addEventListener('click', toggleSidebar);
  }

  function toggleSidebar() {
    U.$('#sidebar').classList.toggle('open');
    U.$('#sidebar-backdrop').classList.toggle('show');
  }
  function closeSidebar() {
    U.$('#sidebar')?.classList.remove('open');
    U.$('#sidebar-backdrop')?.classList.remove('show');
  }

  function tickClock() {
    const el = U.$('#clock');
    if (!el) return;
    const d = new Date();
    el.textContent = d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) + ' · ' + d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  }

  function updateOnlineStatus() {
    const online = navigator.onLine;
    const banner = U.$('#offline-banner');
    const dot = U.$('#db-status .status-dot');
    const txt = U.$('#db-status span:last-child');
    if (online) {
      banner.classList.remove('show');
      if (dot) { dot.className = 'status-dot online'; }
      if (txt) txt.textContent = 'Local data active';
    } else {
      banner.classList.add('show');
      if (dot) { dot.className = 'status-dot offline'; }
      if (txt) txt.textContent = 'Offline mode — local data active';
    }
  }

  function registerSW() {
    navigator.serviceWorker.register('service-worker.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(reg);
          }
        });
      });
      if (reg.waiting) showUpdateBanner(reg);
    }).catch(err => console.error('SW registration failed', err));
  }

  function showUpdateBanner(reg) {
    const banner = U.$('#update-banner');
    banner.classList.add('show');
    U.$('#update-app-btn').onclick = () => {
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        reg.waiting.addEventListener('statechange', () => {
          if (reg.waiting === null) window.location.reload();
        });
      } else {
        window.location.reload();
      }
    };
    U.$('#dismiss-update-btn').onclick = () => banner.classList.remove('show');
  }

  function showPinGate(pin) {
    let entered = '';
    const body = U.el('div', { class: 'text-center' },
      U.el('div', { style: { fontSize: '48px', marginBottom: '12px' } }, '🔒'),
      U.el('h3', { style: { margin: '0 0 6px' } }, 'Enter your PIN'),
      U.el('p', { class: 'muted', style: { margin: '0 0 16px' } }, 'Janets Karenderya is locked'),
      U.el('div', { id: 'pin-dots', style: { fontSize: '28px', letterSpacing: '12px', marginBottom: '16px', color: 'var(--emerald-deep)' } }, '○○○○'),
      U.el('div', { class: 'numpad', id: 'pin-numpad' })
    );
    const root = U.$('#modal-root');
    U.clear(root);
    root.classList.remove('hidden');
    const backdrop = U.el('div', { class: 'modal-backdrop' });
    const card = U.el('div', { class: 'modal-card', style: { maxWidth: '360px' } });
    card.appendChild(body);
    root.appendChild(backdrop);
    root.appendChild(card);

    function updateDots() {
      const dots = U.$('#pin-dots');
      dots.textContent = '●'.repeat(entered.length) + '○'.repeat(Math.max(0, 4 - entered.length));
    }
    function press(k) {
      if (k === 'del') { entered = entered.slice(0, -1); }
      else if (entered.length < 6) { entered += k; if (entered === pin) { unlock(); } else if (entered.length >= 6) { U.toast('Incorrect PIN', 'error'); entered = ''; } }
      updateDots();
    }
    function unlock() {
      root.classList.add('hidden');
      U.clear(root);
      document.body.style.overflow = '';
      U.toast('Welcome back', 'success');
    }
    const np = U.$('#pin-numpad');
    ['1','2','3','4','5','6','7','8','9','del','0','ok'].forEach(k => {
      const b = U.el('button', {
        style: k === 'ok' ? 'background: linear-gradient(135deg, var(--emerald), var(--emerald-deep)); color: white;' : '',
        class: k === 'del' ? 'key-clear' : (k === 'ok' ? 'key-ok' : ''),
        onclick: () => { if (k === 'ok') { if (entered === pin) unlock(); else { U.toast('Incorrect PIN', 'error'); entered = ''; updateDots(); } } else press(k); }
      }, k === 'del' ? '⌫' : (k === 'ok' ? '✓' : k));
      np.appendChild(b);
    });
    document.body.style.overflow = 'hidden';
  }

  async function checkBackupReminder() {
    const last = await DB.getSetting('lastBackupAt');
    const days = Number(await DB.getSetting('backupReminderDays')) || 7;
    if (!last) return;
    const age = (Date.now() - last) / (1000 * 60 * 60 * 24);
    if (age > days) {
      U.toast('Reminder: It\'s been ' + Math.round(age) + ' days since your last backup', 'warn', 5000);
    }
  }

  global.App = App;

  document.addEventListener('DOMContentLoaded', () => App.init());
})(window);
