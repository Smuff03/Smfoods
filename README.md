# SMFoods storefront

Customer + Retailer (wholesale) storefront for the **same Firebase project** as your TMF BizHub admin panel, served from a **different domain**.

- `web/` React 18 + Vite + React Router + Firebase JS SDK (live `onSnapshot` listeners)
- `functions/` Cloud Functions codebase **`shop`** (functions are prefixed `sf…`, so deploying never touches the admin panel's `adminMutate` or any existing function)
- `firestore.rules` your original rules, unchanged (see "Rules"), `storage.rules` and `firestore.indexes.json` your originals

## How it connects to the admin panel

Your admin panel keeps its data in private collections (`adminProducts`, `adminOrders`, `inventory`, `wholesalers`, `customers`, `meta/counters`, `audit-logs`). `adminProducts` contains wholesale prices, so it cannot be public. The storefront therefore reads the public storefront collections that your rules already define, and Cloud Functions keep the two sides in sync:

| Direction | What happens | Function |
| --- | --- | --- |
| Admin → shop | Any create/edit of an `adminProducts` doc is copied to `products/{id}` (`name, category, sku, mrp, retailPrice, stockQty ← stock, active`) and `productPricing/{id}` (`wholesalePrice`, `moq`). No wholesale data is ever put in `products`. Real time. | `sfSyncProduct` (+ `sfSyncAllProducts` for the first backfill) |
| Shop → admin | An order creates `orders/TMF-n` (customer-facing, full detail) **and** `adminOrders/TMF-n` in the admin schema (`id, customer, type Retail/Wholesale, amount, status Pending, note, createdAt`) using the admin's own counter `meta/counters.orders`, so it shows in the admin Orders page and dashboard. Stock is deducted from `adminProducts.stock` with an `inventory` ledger row (`Stock out`, note "Web order TMF-n"), in one transaction. | `sfPlaceOrder` |
| Admin → customer | Changing an order's status in the admin panel updates `orders/TMF-n.orderStatus`, so the customer's tracking page changes live. Delivered + COD marks payment Paid. Cancelled returns the stock once (an `Adjustment` ledger row). | `sfSyncOrderStatus` |
| Retailers | A retailer registers and submits shop details (`users/{uid}.wholesaleApplication`, status `pending`). An admin approves in **Admin tools** (`/admin` on the shop site). Approval sets the `role: wholesaler` custom claim, and creates/updates the admin's `wholesalers/{uid}` record (name, GSTIN, status Active/On hold, credit fields start at 0). | `sfApplyWholesale`, `sfSetWholesaleStatus` |

Order totals, prices, MOQs, tiers, stock and the retailer role are all decided on the server. The browser only sends product ids and quantities. Duplicate submissions are blocked by a per-checkout `requestId`.

Status strings are the admin's own: `Pending / Processing / Dispatched / Delivered / Cancelled`.

## Rules

**No change to your rules was needed.** Your existing `firestore.rules` already gives the storefront exactly what it needs and nothing more:

- `products`: public read of active items only; `productPricing`: only `role == wholesaler` or admin
- `users/{uid}`: owner reads; owner may edit only `name, phone, addresses, updatedAt` (cannot touch role or retailer status)
- `orders`: owner/admin read, **no client writes**; `settings`: public read

The file in this project is your original, byte-for-byte, plus a comment block at the end. Do not open `adminProducts`/`adminOrders` to the public. A different domain needs no rule change. `storage.rules` and `firestore.indexes.json` are also unchanged (the storefront needs no new index).

## Setup (once)

Requires Node 20+ and `npm i -g firebase-tools` + `firebase login`.

```bash
cp .env.example .env          # copy the same VITE_FIREBASE_* values as the admin panel's .env
npm run setup                 # installs functions + web (do NOT run plain `npm install` at the root)
npm test                      # 14 business-logic tests (no emulator needed)
npm run dev                   # http://localhost:5173 (talks to the REAL project unless VITE_USE_EMULATORS=true)
npm run build
```

### Firebase console (manual steps)

1. **Authentication → Sign-in method**: enable **Email/Password** and **Google** (set the public-facing name and support email).
2. **Authentication → Settings → Authorized domains**: add your shop domain (e.g. `shop.example.com`) and `localhost`. Google sign-in fails with `auth/unauthorized-domain` otherwise.
3. If your web API key has HTTP-referrer restrictions (Google Cloud → APIs & Services → Credentials), add the shop domain.
4. Optional `settings/store` document (public read; admin can create it in the console):
   `{ "deliveryCharge": 40, "freeDeliveryAbove": 500, "codEnabled": true }`. If absent: delivery is free and COD is on.
5. Optional wholesale **MOQ / quantity discounts**: the admin panel has no MOQ field, so MOQ defaults to 1. To set it, edit `productPricing/{productId}` in the console: `moq` (integer ≥ 1) and `tiers` e.g. `[{ "minQty": 20, "price": 70 }, { "minQty": 50, "price": 65 }]`. Syncing preserves both. (If you remove a product's wholesale price in admin, its `productPricing` doc is deleted, including moq/tiers.)
6. Optional product `description`, `packSize`, `imageUrl` / `images[]` (URLs, e.g. uploaded under Storage `products/`) can be added to a `products/{id}` doc; they are shown when present and sync never overwrites them.

### Deploy

```bash
firebase use smfoods-8eb21
npm run deploy:functions                    # touches only the "shop" codebase
# optional, only if you want to re-publish rules (identical to the live ones + a comment):
firebase deploy --only firestore:rules

# Hosting: either a new Firebase Hosting site...
firebase hosting:sites:create smfoods-shop
firebase target:apply hosting shop smfoods-shop
npm run deploy:web                          # then Hosting → Add custom domain in the console
# ...or upload web/dist to any static host (Netlify, Vercel, S3…) with an SPA fallback to /index.html.
```

Optional: lock the callables to your domain by creating `functions/.env` from `functions/.env.example` (`SHOP_ORIGINS=https://shop.example.com`) before deploying.

### First run

1. Make sure your admin user has the admin claim (`npm run set-admin -- you@example.com` in the admin project). Sign out/in on the shop site.
2. Open `/admin` on the shop site, click **Sync all products now** (copies existing `adminProducts` to the storefront; after this it is automatic).
3. Retailer test: register at `/register/retailer` → status "Pending approval" → approve in `/admin` → the retailer's page flips to Approved and wholesale prices appear without a reload.

## Behaviour notes / limits

- Pending, rejected or suspended retailers shop at **retail prices** as customers; wholesale needs the claim **and** an approved profile (checked on the server at checkout).
- Suspending removes the claim; Firestore rules stop honouring it when the user's ID token refreshes (up to ~1 hour), but orders are re-checked server-side on every order, so retail pricing applies immediately.
- A product with no `retailPrice` in admin is hidden from the storefront. A missing `mrp` is shown as the retail price (no "% off").
- Cancelling restocks storefront orders only (admin orders created in the admin panel behave exactly as before). Moving an order *out of* Cancelled does not deduct stock again; deleting an `adminOrders` doc does not change the customer's order.
- "Bestsellers" is not shown: there is no sales field in the admin data and customers cannot read other orders. "Featured" uses a `featured: true` flag on `products/{id}` if you add one, otherwise in-stock items.
- Login is by **email** + password or Google. Username login was not built (it needs a username→email lookup that leaks which usernames exist).
- Online payment is **not** implemented; checkout is Cash on Delivery only.
- Lists show up to 500 active products (paged 24 at a time); order history shows the latest 50.
- Order timestamps are ISO strings (same as the admin panel).

## What has and has not been tested

Tested here: business logic (14 tests: server pricing, retail vs wholesale, MOQ + tiers, stock/overselling, duplicate submit, admin-schema mirror + counter, inventory ledger, status sync, restock-once, retailer review, catalogue sync, input validation), production build of the web app, and that your original rules are untouched.

**Not tested** (no Firebase emulators, browser or real project in the build sandbox): the rules against a live Firestore, Google Sign-In, real sign-in/claims, live `onSnapshot` updates, the deployed functions, the UI in a browser. Please run through: register customer → browse → order (COD) → see it in the admin Orders page and `inventory` → change its status in admin → watch the customer's tracking page; then the retailer flow above, and try ordering more than the stock.
