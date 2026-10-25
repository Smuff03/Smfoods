import test from 'node:test';
import assert from 'node:assert/strict';
import { Fail, imageUrls, placeOrder, priceLine, reviewRetailer, storefrontDocs, syncOrderStatus } from '../src/logic.js';

/** In-memory tx. Throws if a read happens after a write (Firestore's rule). */
function fake(seed = {}) {
  const store = new Map(Object.entries(seed));
  let wrote = false, ids = 0;
  const key = (c, id) => `${c}/${id}`;
  const tx = {
    get: async (c, id) => { assert.ok(!wrote, 'read after write'); const v = store.get(key(c, id)); return v ? structuredClone(v) : null; },
    find: async (c, where) => {
      assert.ok(!wrote, 'read after write');
      for (const [k, v] of store) if (k.startsWith(c + '/') && Object.entries(where).every(([f, x]) => v[f] === x)) return structuredClone(v);
      return null;
    },
    set: (c, id, d) => { wrote = true; store.set(key(c, id), structuredClone(d)); },
    update: (c, id, p) => { wrote = true; store.set(key(c, id), { ...(store.get(key(c, id)) || {}), ...structuredClone(p) }); },
    newId: () => `gen${++ids}`,
  };
  return { tx, store, now: '2026-10-11T10:00:00.000Z' };
}

const product = (o = {}) => ({ id: 'p1', sku: 'TMF-CHI-001', name: 'Chivda', category: 'Chivda', mrp: 120, retailPrice: 100, wholesalePrice: 80, stock: 50, active: true, ...o });
const addr = { line1: '12 MG Road', city: 'Pune', state: 'Maharashtra', pincode: '411001' };
const contact = { name: 'Asha', phone: '9876543210' };
const order = (o = {}) => ({ items: [{ productId: 'p1', qty: 2 }], address: addr, contact, paymentMethod: 'COD', consent: true, requestId: 'req-12345678', ...o });
const customer = { uid: 'u1', email: 'a@x.com', claims: {} };
const retailer = { uid: 'r1', email: 'r@x.com', claims: { role: 'wholesaler' } };
const approved = { wholesaleStatus: 'approved', wholesaleApplication: { shopName: 'Asha Stores', ownerName: 'Asha', phone: '9876543210', gstin: '' } };

test('retail order: server prices, stock-out ledger, admin mirror, counter', async () => {
  const f = fake({ 'adminProducts/p1': product(), 'meta/counters': { orders: 1048 } });
  const r = await placeOrder(f, customer, order());
  assert.deepEqual([r.orderId, r.total], ['TMF-1049', 200]);
  assert.equal(f.store.get('adminProducts/p1').stock, 48);
  assert.equal(f.store.get('meta/counters').orders, 1049);
  const inv = f.store.get('inventory/gen1');
  assert.deepEqual([inv.type, inv.quantity, inv.balance], ['Stock out', 2, 48]);
  const a = f.store.get('adminOrders/TMF-1049');
  assert.deepEqual([a.customer, a.type, a.amount, a.status], ['Asha', 'Retail', 200, 'Pending']);
  const o = f.store.get('orders/TMF-1049');
  assert.deepEqual([o.userId, o.orderStatus, o.paymentStatus, o.items[0].unitPrice], ['u1', 'Pending', 'Pending', 100]);
  assert.ok(f.store.get('customers/u1'));
});

test('orders start at TMF-1001 without a counter', async () => {
  const f = fake({ 'adminProducts/p1': product() });
  assert.equal((await placeOrder(f, customer, order())).orderId, 'TMF-1001');
});

test('duplicate submission with same requestId returns the same order, no double stock-out', async () => {
  const f = fake({ 'adminProducts/p1': product() });
  const first = await placeOrder(f, customer, order());
  const g = fake(Object.fromEntries(f.store)); // a retry is a fresh transaction
  const second = await placeOrder(g, customer, order());
  assert.equal(second.orderId, first.orderId);
  assert.equal(second.duplicate, true);
  assert.equal(g.store.get('adminProducts/p1').stock, 48);
  assert.equal(g.store.get('meta/counters').orders, 1001);
});

test('rejects overselling, inactive products, bad input, non-COD', async () => {
  const mk = (p) => fake({ 'adminProducts/p1': product(p) });
  await assert.rejects(placeOrder(mk({ stock: 1 }), customer, order()), /Only 1 kg of Chivda/);
  await assert.rejects(placeOrder(mk({ stock: 0 }), customer, order()), /out of stock/);
  await assert.rejects(placeOrder(mk({ active: false }), customer, order()), /no longer available/);
  await assert.rejects(placeOrder(mk(), customer, order({ items: [{ productId: 'p1', qty: 0 }] })), /whole numbers/);
  await assert.rejects(placeOrder(mk(), customer, order({ items: [{ productId: 'p1', qty: 1.5 }] })), /whole numbers/);
  await assert.rejects(placeOrder(mk(), customer, order({ items: [] })), /empty/);
  await assert.rejects(placeOrder(mk(), customer, order({ paymentMethod: 'UPI' })), /Cash on Delivery/);
  await assert.rejects(placeOrder(mk(), customer, order({ address: { ...addr, pincode: '12' } })), /PIN/);
  await assert.rejects(placeOrder(mk(), customer, order({ contact: { ...contact, phone: '123' } })), /mobile/);
  await assert.rejects(placeOrder(mk({ retailPrice: null }), customer, order()), /not available/);
});

test('browser-supplied price or type is ignored', async () => {
  const f = fake({ 'adminProducts/p1': product() });
  const r = await placeOrder(f, customer, order({ items: [{ productId: 'p1', qty: 1, price: 1, unitPrice: 1 }], total: 1, accountType: 'Wholesale' }));
  assert.equal(r.total, 100);
  assert.equal(f.store.get('orders/TMF-1001').accountType, 'Retail');
});

test('web orders are always retail, even for an account that still has a wholesaler claim', async () => {
  const f = fake({ 'adminProducts/p1': product(), 'users/r1': approved, 'productPricing/p1': { wholesalePrice: 80, moq: 1 } });
  await placeOrder(f, retailer, order());
  assert.equal(f.store.get('adminOrders/TMF-1001').type, 'Retail');
  const o = f.store.get('orders/TMF-1001');
  assert.deepEqual([o.accountType, o.total, o.shop], ['Retail', 200, null]);
});

test('delivery date is stored on orders and adminOrders when provided', async () => {
  const f = fake({ 'adminProducts/p1': product() });
  await placeOrder(f, customer, order({ deliveryDate: '2026-10-30' }));
  const o = f.store.get('orders/TMF-1001');
  assert.equal(o.deliveryDate, '2026-10-30');
  const a = f.store.get('adminOrders/TMF-1001');
  assert.equal(a.deliveryDate, '2026-10-30');
  assert.ok(a.note.includes('Delivery: 2026-10-30'));
});

test('pack sizes: 200 g / 500 g / 1 kg are priced from the per-kg price and deducted from stock in kg', async () => {
  const f = fake({ 'adminProducts/p1': product({ retailPrice: 100, stock: 10 }) });
  const r = await placeOrder(f, customer, order({ items: [
    { productId: 'p1', weight: '200g', qty: 2 }, { productId: 'p1', weight: '500g', qty: 1 }, { productId: 'p1', weight: '1kg', qty: 1 },
  ] }));
  const o = f.store.get(`orders/${r.orderId}`);
  assert.deepEqual(o.items.map((i) => [i.weight, i.weightLabel, i.qty, i.unitPrice, i.lineTotal, i.kg]),
    [['200g', '200 g', 2, 20, 40, 0.4], ['500g', '500 g', 1, 50, 50, 0.5], ['1kg', '1 kg', 1, 100, 100, 1]]);
  assert.equal(o.total, 190);
  assert.equal(f.store.get('adminProducts/p1').stock, 8.1);       // 0.4 + 0.5 + 1 = 1.9 kg
  const inv = f.store.get('inventory/gen1');
  assert.deepEqual([inv.type, inv.quantity, inv.balance], ['Stock out', 1.9, 8.1]);
  assert.match(f.store.get(`adminOrders/${r.orderId}`).note, /Chivda 200 g x2/);
});

test('pack sizes: stock is checked in kg across all sizes; unknown sizes are rejected', async () => {
  const mk = (stock) => fake({ 'adminProducts/p1': product({ stock }) });
  await assert.rejects(placeOrder(mk(1), customer, order({ items: [{ productId: 'p1', weight: '1kg', qty: 1 }, { productId: 'p1', weight: '200g', qty: 1 }] })), /Only 1 kg of Chivda/);
  await placeOrder(mk(1), customer, order({ items: [{ productId: 'p1', weight: '500g', qty: 2 }] }));          // exactly 1 kg: fine
  await assert.rejects(placeOrder(mk(50), customer, order({ items: [{ productId: 'p1', weight: '250g', qty: 1 }] })), /pack size/);
  await assert.rejects(placeOrder(mk(50), customer, order({ items: [{ productId: 'p1', weight: '2kg', qty: 1 }] })), /pack size/);
});

test('consent to share name, mobile and address is required and recorded on the order', async () => {
  const f = fake({ 'adminProducts/p1': product() });
  await assert.rejects(placeOrder(f, customer, order({ consent: false })), /agree to share/);
  await assert.rejects(placeOrder(fake({ 'adminProducts/p1': product() }), customer, order({ consent: undefined })), /agree to share/);
  const g = fake({ 'adminProducts/p1': product() });
  await placeOrder(g, customer, order());
  assert.deepEqual(g.store.get('orders/TMF-1001').consent, { dataProcessing: true, at: '2026-10-11T10:00:00.000Z' });
});

test('same product on two lines is merged for stock check', async () => {
  const f = fake({ 'adminProducts/p1': product({ stock: 5 }) });
  await assert.rejects(placeOrder(f, customer, order({ items: [{ productId: 'p1', qty: 3 }, { productId: 'p1', qty: 3 }] })), /Only 5/);
});

test('delivery charge and free-delivery threshold come from settings/store', async () => {
  const f = fake({ 'adminProducts/p1': product(), 'settings/store': { deliveryCharge: 40, freeDeliveryAbove: 500 } });
  assert.equal((await placeOrder(f, customer, order())).total, 240);
  const g = fake({ 'adminProducts/p1': product(), 'settings/store': { deliveryCharge: 40, freeDeliveryAbove: 150 } });
  assert.equal((await placeOrder(g, customer, order())).total, 200);
  const h = fake({ 'adminProducts/p1': product(), 'settings/store': { codEnabled: false } });
  await assert.rejects(placeOrder(h, customer, order()), /unavailable/);
});

test('admin status change syncs to customer order; delivered COD => paid', async () => {
  const f = fake({ 'adminProducts/p1': product() });
  await placeOrder(f, customer, order());
  const s = fake(Object.fromEntries(f.store));
  await syncOrderStatus(s, { status: 'Pending' }, { ...s.store.get('adminOrders/TMF-1001'), status: 'Delivered' });
  const o = s.store.get('orders/TMF-1001');
  assert.deepEqual([o.orderStatus, o.paymentStatus], ['Delivered', 'Paid']);
  await syncOrderStatus(s, { status: 'Pending' }, { id: 'X', status: 'Delivered' }); // non-storefront: ignored
});

test('cancelling restocks once with an Adjustment ledger entry', async () => {
  const f = fake({ 'adminProducts/p1': product() });
  await placeOrder(f, customer, order());
  const s = fake(Object.fromEntries(f.store));
  const adm = { ...s.store.get('adminOrders/TMF-1001'), status: 'Cancelled' };
  await syncOrderStatus(s, { status: 'Pending' }, adm);
  assert.equal(s.store.get('adminProducts/p1').stock, 50);
  assert.equal(s.store.get('orders/TMF-1001').stockRestored, true);
  assert.equal(s.store.get('inventory/gen1').type, 'Adjustment');
  const s2 = fake(Object.fromEntries(s.store));
  await syncOrderStatus(s2, { status: 'Processing' }, adm);
  assert.equal(s2.store.get('adminProducts/p1').stock, 50);
});

test('cancelling an order with pack sizes returns the exact kg once', async () => {
  const f = fake({ 'adminProducts/p1': product({ stock: 10 }) });
  await placeOrder(f, customer, order({ items: [{ productId: 'p1', weight: '200g', qty: 3 }, { productId: 'p1', weight: '500g', qty: 1 }] }));
  assert.equal(f.store.get('adminProducts/p1').stock, 8.9);
  const s = fake(Object.fromEntries(f.store));
  await syncOrderStatus(s, { status: 'Pending' }, { ...s.store.get('adminOrders/TMF-1001'), status: 'Cancelled' });
  assert.equal(s.store.get('adminProducts/p1').stock, 10);
  assert.equal(s.store.get('inventory/gen1').quantity, 1.1);
});

test('storefrontDocs: no wholesale data in public product; moq preserved', () => {
  const { product: p, pricing } = storefrontDocs(product(), { moq: 12 }, 'T');
  assert.equal('wholesalePrice' in p, false);
  assert.deepEqual([p.stockQty, p.active, pricing.wholesalePrice, pricing.moq], [50, true, 80, 12]);
  assert.equal(storefrontDocs(product({ wholesalePrice: null }), null, 'T').pricing, null);
  // regression: an admin product with a null retail price must stay listed (it used to be hidden)
  const unpriced = storefrontDocs(product({ retailPrice: null, mrp: null }), null, 'T').product;
  assert.deepEqual([unpriced.active, unpriced.retailPrice, unpriced.mrp], [true, 0, 0]);
  assert.equal(storefrontDocs(product({ active: false }), null, 'T').product.active, false);
  assert.equal(storefrontDocs(product({ mrp: null }), null, 'T').product.mrp, 100);
  assert.equal(storefrontDocs(product({ stock: -3 }), null, 'T').product.stockQty, 0);
  assert.equal(storefrontDocs(product(), null, 'T').pricing.moq, 1);
});

test('retailer review writes users + admin wholesalers (keeps credit fields) + audit', async () => {
  const seed = { 'users/r1': { wholesaleApplication: approved.wholesaleApplication, wholesaleStatus: 'pending' } };
  const f = fake(seed);
  await reviewRetailer(f, 'admin@x.com', 'r1', 'approved');
  assert.equal(f.store.get('users/r1').wholesaleStatus, 'approved');
  const w = f.store.get('wholesalers/r1');
  assert.deepEqual([w.name, w.status, w.creditLimit], ['Asha Stores', 'Active', 0]);
  assert.equal(f.store.get('audit-logs/gen1').user, 'admin@x.com');
  const g = fake({ ...seed, 'wholesalers/r1': { name: 'Asha Stores', creditLimit: 5000, outstanding: 10, createdAt: 'old' } });
  await reviewRetailer(g, 'admin@x.com', 'r1', 'suspended');
  const w2 = g.store.get('wholesalers/r1');
  assert.deepEqual([w2.status, w2.creditLimit, w2.createdAt], ['On hold', 5000, 'old']);
  await assert.rejects(reviewRetailer(fake({}), 'a', 'zz', 'approved'), Fail);
  await assert.rejects(reviewRetailer(f, 'a', 'r1', 'admin'), /Invalid status/);
});

test('priceLine (retail) scales the per-kg price by pack size', () => {
  assert.equal(priceLine({ type: 'Retail', product: product({ retailPrice: 90 }), weight: '200g', qty: 1 }).unitPrice, 18);
  assert.equal(priceLine({ type: 'Retail', product: product({ retailPrice: 90 }), weight: '500g', qty: 1 }).unitPrice, 45);
  assert.equal(priceLine({ type: 'Retail', product: product({ retailPrice: 90 }), qty: 1 }).unitPrice, 90);
});

test('priceLine picks highest matching tier and never exceeds list price', () => {
  const pricing = { moq: 1, tiers: [{ minQty: 10, price: 90 }, { minQty: 50, price: 75 }] };
  const p = product();
  assert.equal(priceLine({ type: 'Wholesale', product: p, pricing, qty: 9 }).unitPrice, 80);
  assert.equal(priceLine({ type: 'Wholesale', product: p, pricing, qty: 10 }).unitPrice, 80);
  assert.equal(priceLine({ type: 'Wholesale', product: p, pricing, qty: 60 }).unitPrice, 75);
});

test('storefrontDocs: admin image objects become plain URLs; optional fields never wipe manual data', () => {
  const adminDoc = product({
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/b/o/a.jpg?alt=media',
    images: [{ path: 'products/a.jpg', url: 'https://firebasestorage.googleapis.com/v0/b/b/o/a.jpg?alt=media' }, { path: 'p/b.jpg', url: 'https://x.test/b.jpg' }, { url: 'http://insecure.test/c.jpg' }],
  });
  const { product: p } = storefrontDocs(adminDoc, null, 'T');
  assert.deepEqual(p.images, ['https://firebasestorage.googleapis.com/v0/b/b/o/a.jpg?alt=media', 'https://x.test/b.jpg']);
  assert.equal(p.imageUrl, p.images[0]);
  assert.equal(p.description, undefined);
  assert.equal(p.packSize, undefined);
  assert.equal('imageUrl' in storefrontDocs(product(), null, 'T').product, false); // no image keys in admin doc -> untouched
  assert.deepEqual(imageUrls({ images: ['https://a.test/1.png'] }), ['https://a.test/1.png']);
  const d = storefrontDocs(product({ description: ' Crunchy ', packSize: '250 g' }), null, 'T').product;
  assert.deepEqual([d.description, d.packSize], ['Crunchy', '250 g']);
});

test('priceLine: retail order for a product without a retail price is rejected', () => {
  assert.throws(() => priceLine({ type: 'Retail', product: product({ retailPrice: null }), qty: 1 }), Fail);
  assert.throws(() => priceLine({ type: 'Retail', product: product({ retailPrice: 0 }), qty: 1 }), Fail);
});
