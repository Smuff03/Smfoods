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
const order = (o = {}) => ({ items: [{ productId: 'p1', qty: 2 }], address: addr, contact, paymentMethod: 'COD', requestId: 'req-12345678', ...o });
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
  await assert.rejects(placeOrder(mk({ stock: 1 }), customer, order()), /Only 1 units of Chivda/);
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

test('claim alone is not enough: wholesaler claim without approved profile is retail', async () => {
  const f = fake({ 'adminProducts/p1': product(), 'users/r1': { wholesaleStatus: 'suspended' } });
  await placeOrder(f, retailer, order());
  assert.equal(f.store.get('adminOrders/TMF-1001').type, 'Retail');
  assert.equal(f.store.get('orders/TMF-1001').total, 200);
});

test('approved retailer: wholesale price, shop name, MOQ and tiers', async () => {
  const seed = () => fake({
    'adminProducts/p1': product(), 'users/r1': approved,
    'productPricing/p1': { wholesalePrice: 80, moq: 10, tiers: [{ minQty: 20, price: 70 }, { minQty: 40, price: 65 }] },
  });
  await assert.rejects(placeOrder(seed(), retailer, order()), /Minimum order for Chivda is 10/);
  const f = seed();
  const r = await placeOrder(f, retailer, order({ items: [{ productId: 'p1', qty: 25 }] }));
  const o = f.store.get(`orders/${r.orderId}`);
  assert.deepEqual([o.accountType, o.items[0].unitPrice, o.subtotal, o.discount, o.total], ['Wholesale', 70, 2000, 250, 1750]);
  assert.equal(o.shop.name, 'Asha Stores');
  const a = f.store.get(`adminOrders/${r.orderId}`);
  assert.deepEqual([a.customer, a.type, a.amount], ['Asha Stores', 'Wholesale', 1750]);
  assert.equal(f.store.has('customers/r1'), false);
  const g = fake({ 'adminProducts/p1': product({ wholesalePrice: null }), 'users/r1': approved });
  await assert.rejects(placeOrder(g, retailer, order()), /not available at wholesale/);
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
