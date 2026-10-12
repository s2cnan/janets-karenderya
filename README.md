# Janets Karenderya

**Offline-first POS, Inventory & Financial Analytics** for small local eateries and neighborhood stores.

Janets Karenderya is a complete Progressive Web App (PWA) that runs entirely inside the browser — no cloud, no servers, no subscriptions. Every sale, product, expense, and report lives on your device in a local IndexedDB database. It installs to your Android or iPhone home screen and works without internet.

![Design](icons/icon-192.png)

---

## ✨ Features

- **Point of Sale / Cashier**
  - Fast product grid with search and categories
  - Cart with quantity controls, discounts, subtotal/total
  - Cash, GCash, Maya, and custom payment methods
  - Cash-received calculator with change and on-screen numpad
  - Printable / shareable receipts
  - Transactional checkout: stock, sale record, and payment saved atomically

- **Inventory Management**
  - Products with SKU, barcode, category, cost, price, stock, min-stock threshold, supplier
  - Stock movements tracking (sold, received, damaged, expired, missing, returns, adjustments)
  - Low-stock and out-of-stock alerts on the dashboard
  - CSV export of your product catalog
  - Archive (don't delete) products to preserve history

- **Profit & Forecasts**
  - Gross Profit = Net Sales − Cost of Goods Sold
  - Net Profit = Gross Profit − Operating Expenses
  - Forecasts for next 7 days, next 30 days, and next 12 months
  - Historical summaries for 7/30/90 days and all-time
  - Configurable growth rate and seasonality assumptions
  - Actuals and projections are clearly labeled separately

- **Expense Tracking**
  - Predefined categories: rent, electricity, water, transportation, supplies, labor, etc.
  - Reverse (don't delete) incorrectly recorded expenses — audit trail preserved
  - Daily/weekly/monthly/yearly views with category breakdown

- **Transactions & Reports**
  - Complete sales history with void support (voids restore stock)
  - Filters by period, search, and category
  - Reports: Sales, Product Performance, Expenses, Payment Methods
  - CSV export of sales, products, and expenses

- **Data Ownership & Privacy**
  - 100% of your business data stays on your device (IndexedDB)
  - One-click full backup to a JSON file you control
  - Restore from backup with safe confirmation flow
  - Optional 4–6 digit PIN lock
  - Reset function with double confirmation

- **Premium Glass UI**
  - Signature emerald glassmorphism design
  - Works in portrait and landscape
  - Adaptive for phones, tablets, and desktops
  - Light and dark themes (follows system preference)
  - Respects `prefers-reduced-motion` and provides non-blur fallbacks

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|------------|
| Structure | HTML5 |
| Styling | CSS3 with glassmorphism, CSS Grid/Flex, safe-area insets |
| Logic | Vanilla JavaScript (ES2020+), no framework |
| Database | IndexedDB (transactional) |
| Offline | Service Worker (stale-while-revalidate) |
| Install | Web App Manifest |
| Charts | Hand-rolled canvas line/bar charts (no libraries) |
| Hosting | GitHub Pages (static only) |

Currency defaults to **Philippine Peso (₱, PHP)** and dates use **Asia/Manila** timezone.

---

## 🚀 Deployment to GitHub Pages

1. Push this repository to GitHub.
2. In repository **Settings → Pages**, set **Source** to the `main` branch (root).
3. Wait for GitHub to publish it — your app will be live at `https://<your-user>.github.io/janets-karenderya/`.
4. All asset paths in the app are relative, so it works from a subdirectory without configuration changes.

> **Important:** Because the app is 100% client-side, **GitHub Pages only serves static files**. All calculations and data storage happen on the visitor's device. No backend is required.

To develop locally:
```bash
# Any static server works — Python's built-in server is easiest:
python3 -m http.server 8080
# Then visit http://localhost:8080
```
Opening `index.html` directly via `file://` will also work, but Service Worker registration requires an HTTP server for PWA installation.

---

## 📲 Installing on Your Phone

### Android
1. Open the site in Chrome or Edge.
2. Tap the menu (⋮) and choose **Install app** or **Add to Home screen**.
3. Confirm — Janets Karenderya will appear on your home screen with its own icon and launch standalone.

### iPhone / iPad (iOS)
1. Open the site in **Safari** (PWAs only install from Safari on iOS).
2. Tap the **Share** button (rectangle with up arrow).
3. Choose **Add to Home Screen** and confirm.
4. Launch Janets from the home screen for a full-screen, standalone experience.

**iOS limitations to be aware of:**
- Safari deletes website data (including IndexedDB) after ~7 days of *not opening* the app in some scenarios — please create **regular backups** to avoid data loss.
- Push notifications and background sync are not available.
- PWA features vary slightly between iOS versions.

---

## 📴 Offline Use

- On first visit, the service worker caches the entire app shell (HTML, CSS, JS, icons, manifest).
- After that first load, opening the app works fully offline.
- An orange indicator banner appears in the app when the device is offline — all POS, inventory, and analytics functions continue working against local data.
- When a new version is published, a gentle "Update now" banner offers to reload.

---

## 💾 Backup & Restore Best Practices

Because everything is local, **two phones do not sync**. Each device keeps its own database.

- Tap **Settings & Backup → Create Backup** regularly (ideally at least once a week).
- Save the `.json` file to cloud storage (Google Drive, iCloud, email to yourself) so it survives device loss.
- To move data to another phone: install the app there, copy the backup file to that phone, then use **Restore from Backup**.
- Restoring overwrites data on the destination device; the app warns you and recommends backing up first.

---

## 🧾 Financial Formulas

| Metric | Formula |
|--------|---------|
| Subtotal | Σ (unit price × qty) |
| Discount | fixed amount + subtotal × discount% |
| Net Sales | Subtotal − Discount |
| Cost of Goods Sold (COGS) | Σ (purchase cost × qty) |
| Gross Profit | Net Sales − COGS |
| Net Profit | Gross Profit − Operating Expenses (period) |
| Margin % | Gross Profit ÷ Net Sales |

Discounts, voids, refunds, and stock losses are all accounted for. The same expense is never counted twice.

---

## 🗂️ Project Structure

```
janets-karenderya/
├── index.html            # App shell and markup
├── manifest.json         # PWA manifest
├── service-worker.js     # Offline caching
├── css/
│   └── styles.css        # Complete glass UI design system
├── js/
│   ├── db.js             # IndexedDB layer (products, sales, stock, expenses, settings)
│   ├── utils.js          # Formatters, toasts, modals, CSV, receipts
│   ├── state.js          # App state, event bus, cart helpers
│   ├── charts.js         # Lightweight canvas charts
│   ├── dashboard.js      # Home / dashboard view
│   ├── cashier.js        # POS / checkout flow
│   ├── inventory.js      # Product catalog and stock management
│   ├── forecasts.js      # Profit analytics & forecasting
│   ├── expenses.js       # Expense tracking
│   ├── transactions.js   # Sales history
│   ├── reports.js        # Reports & exports
│   ├── settings.js       # Settings, backup/restore, categories, reset
│   └── app.js            # Navigation, SW register, clock, PIN gate
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── README.md
```

---

## 🔒 Privacy

- **No data ever leaves your device** unless you choose to share a receipt, export CSV, or create a backup file.
- There are no analytics scripts, no trackers, no remote APIs, no authentication servers.
- The app does not set or transmit cookies. The service worker only caches static assets needed to run.

---

## 🧪 Testing Checklist

Before using in production, verify:
- [x] Completing a sale decrements stock and records revenue/profit correctly
- [x] Reloading the page preserves all data
- [x] Turning off Wi-Fi/mobile data allows the app to open and record new sales
- [x] Voiding a sale restores stock
- [x] Backup produces a valid `.json`; restore replaces data as expected
- [x] Installing to home screen works on Android Chrome and iOS Safari
- [x] Layout works in portrait and landscape, and adapts to tablets/desktops

---

## 📜 License

Built for Janets Karenderya. Use it freely for your own small business.
