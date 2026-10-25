/**
 * SMFoods storefront business rules. Storage-agnostic: every function receives a `ctx` with
 *   tx.get(collection, id) -> doc | null        tx.find(collection, {field: value, ...}) -> doc | null
 *   tx.set(collection, id, doc)                 tx.update(collection, id, patch)   (merge)
 *   tx.newId(collection)
 *   now  (ISO string, same format the admin panel uses)
 * Reads must all happen before writes are applied (index.js queues writes and commits them at the end).
 *
 * Source of truth for stock and prices is the ADMIN collections (adminProducts). The storefront
 * collections (products, productPricing) are derived copies, kept in sync by triggers in index.js.
 */
export class Fail extends Error {
  constructor(message, code = 'invalid-argument') { super(message); this.code = code; }
}
const bad = (m) => new Fail(m);
const num = (v) => typeof v === 'number' && Number.isFinite(v);
export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export const MAX_LINES = 50;
export const MAX_QTY = 10000;
/**
 * Pack sizes a customer can choose. A product's retailPrice is the price of 1 kg, so a pack costs
 * retailPrice × factor, and stock (adminProducts.stock) is counted in kg. Mirrors web/src/pricing.js.
 */
export const WEIGHTS = { '200g': { factor: 0.2, label: '200 g' }, '500g': { factor: 0.5, label: '500 g' }, '1kg': { factor: 1, label: '1 kg' } };
export const PHONE_RE = /^(\+91[\s-]?)?[6-9]\d{9}$/;
export const PIN_RE = /^[1-9]\d{5}$/;
export const GST_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

function text(v, name, { min = 1, max = 200, re, msg } = {}) {
  if (typeof v !== 'string') { if (min === 0 && v == null) return ''; throw bad(`${name} is required`); }
  const s = v.trim();
  if (s.length < min) throw bad(`${name} is required`);
  if (s.length > max) throw bad(`${name} is too long`);
  if (re && s && !re.test(s)) throw bad(msg || `${name} is invalid`);
  return s;
}

export function validateAddress(a) {
  if (!a || typeof a !== 'object') throw bad('Delivery address is required');
  return {
    line1: text(a.line1, 'Address line 1', { max: 200 }),
    line2: text(a.line2, 'Address line 2', { min: 0, max: 200 }),
    landmark: text(a.landmark, 'Landmark', { min: 0, max: 100 }),
    city: text(a.city, 'City', { max: 80 }),
    state: text(a.state, 'State', { max: 80 }),
    pincode: text(a.pincode, 'PIN code', { re: PIN_RE, msg: 'Enter a valid 6-digit PIN code' }),
  };
}

export function validateContact(c) {
  if (!c || typeof c !== 'object') throw bad('Contact details are required');
  return {
    name: text(c.name, 'Name', { max: 100 }),
    phone: text(c.phone, 'Phone', { re: PHONE_RE, msg: 'Enter a valid 10-digit Indian mobile number' }),
  };
}

export function validateApplication(a) {
  if (!a || typeof a !== 'object') throw bad('Shop details are required');
  const gstin = text(a.gstin, 'GSTIN', { min: 0, max: 15 }).toUpperCase();
  if (gstin && !GST_RE.test(gstin)) throw bad('Enter a valid 15-character GSTIN, or leave it blank');
  return {
    shopName: text(a.shopName, 'Shop / business name', { max: 120 }),
    ownerName: text(a.ownerName, 'Owner name', { max: 100 }),
    phone: text(a.phone, 'Phone', { re: PHONE_RE, msg: 'Enter a valid 10-digit Indian mobile number' }),
    gstin,
    address: validateAddress(a.address),
  };
}

export const isApprovedRetailer = (claims, profile) =>
  claims?.role === 'wholesaler' && profile?.wholesaleStatus === 'approved';

/** Price one line. `product` is the adminProducts doc; `pricing` the optional productPricing doc. */
export function priceLine({ type, product, pricing, qty, weight = '1kg' }) {
  if (type === 'Wholesale') {
    if (!num(product.wholesalePrice)) throw bad(`${product.name} is not available at wholesale prices`);
    const moq = Math.max(1, Math.round(Number(pricing?.moq) || 1));
    if (qty < moq) throw bad(`Minimum order for ${product.name} is ${moq} units`);
    const tier = (Array.isArray(pricing?.tiers) ? pricing.tiers : [])
      .filter((t) => num(t?.minQty) && num(t?.price) && t.price >= 0 && qty >= t.minQty)
      .sort((a, b) => b.minQty - a.minQty)[0];
    const listPrice = product.wholesalePrice;
    return { listPrice, unitPrice: tier ? Math.min(tier.price, listPrice) : listPrice };
  }
  if (!num(product.retailPrice) || product.retailPrice <= 0) throw bad(`${product.name} is not available (no retail price set)`);
  const factor = WEIGHTS[weight]?.factor ?? 1;
  const price = round2(product.retailPrice * factor);
  return { listPrice: price, unitPrice: price };
}

function nextNumber(tx, counters, key, start) {
  const n = Math.max(start, Number(counters[key]) || 0) + 1;
  tx.update('meta', 'counters', { [key]: n });
  return n;
}

/**
 * Create an order. Prices, stock and totals are all computed here from admin data;
 * nothing numeric is taken from the browser except quantities and the chosen pack size.
 * Every web order is a retail order (the wholesale / retailer programme is no longer part of the web shop).
 * Writes: orders/TMF-n (customer-facing), adminOrders/TMF-n (what the admin panel shows),
 * adminProducts.stock (kg), inventory ledger (type 'Stock out'), customers/{uid} (first order only).
 */
export async function placeOrder(ctx, user, input) {
  const { tx, now } = ctx;
  const { items, address, contact, paymentMethod, requestId, note, consent, deliveryDate } = input || {};

  const rid = text(requestId, 'Request id', { min: 8, max: 80 });
  if (!Array.isArray(items) || !items.length) throw bad('Your cart is empty');
  if (items.length > MAX_LINES) throw bad(`Orders are limited to ${MAX_LINES} products`);
  const wanted = new Map();
  for (const it of items) {
    const id = it?.productId;
    if (typeof id !== 'string' || !id || id.includes('/')) throw bad('Invalid product in cart');
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw bad('Quantities must be whole numbers of at least 1');
    const weight = it.weight == null ? '1kg' : it.weight;
    if (!Object.prototype.hasOwnProperty.call(WEIGHTS, weight)) throw bad('Please choose a valid pack size (200 g, 500 g or 1 kg)');
    const key = `${id}|${weight}`;
    const cur = wanted.get(key);
    wanted.set(key, { id, weight, qty: (cur?.qty || 0) + qty });
  }
  const addr = validateAddress(address);
  const who = validateContact(contact);
  if (consent !== true) throw bad('Please agree to share your name, mobile number and address so we can deliver your order');
  if (paymentMethod !== 'COD') throw bad('Only Cash on Delivery is available right now');
  const orderNote = text(note, 'Note', { min: 0, max: 500 });
  const requestedDeliveryDate = text(deliveryDate, 'Delivery date', { min: 0, max: 50 });

  // ---- reads ----
  const dup = await tx.find('orders', { userId: user.uid, requestId: rid });
  if (dup) return { orderId: dup.id, total: dup.total, duplicate: true };

  const settings = (await tx.get('settings', 'store')) || {};
  if (settings.codEnabled === false) throw bad('Cash on Delivery is currently unavailable');
  const type = 'Retail';

  const products = new Map();
  for (const { id } of wanted.values()) if (!products.has(id)) products.set(id, await tx.get('adminProducts', id));
  const counters = (await tx.get('meta', 'counters')) || {};
  const knownCustomer = await tx.get('customers', user.uid);

  // ---- compute ----
  const lines = [];
  const kgByProduct = new Map();
  let subtotal = 0;
  for (const { id, weight, qty } of wanted.values()) {
    const p = products.get(id);
    if (!p || p.active !== true) throw bad('A product in your cart is no longer available');
    const w = WEIGHTS[weight];
    const { listPrice, unitPrice } = priceLine({ type, product: p, weight, qty });
    const kg = round2(w.factor * qty);
    kgByProduct.set(id, round2((kgByProduct.get(id) || 0) + kg));
    subtotal += unitPrice * qty;
    lines.push({ product: p, weight, weightLabel: w.label, qty, kg, listPrice, unitPrice });
  }
  for (const [id, kg] of kgByProduct) {      // stock is checked per product, across all pack sizes
    const p = products.get(id);
    const stock = Number(p.stock) || 0;
    if (stock < kg) throw bad(stock > 0 ? `Only ${stock} kg of ${p.name} in stock` : `${p.name} is out of stock`);
  }
  subtotal = round2(subtotal);
  const discount = 0;
  const net = round2(subtotal - discount);
  const charge = num(settings.deliveryCharge) ? settings.deliveryCharge : 0;
  const freeAbove = num(settings.freeDeliveryAbove) ? settings.freeDeliveryAbove : null;
  const deliveryCharge = freeAbove !== null && net >= freeAbove ? 0 : round2(charge);
  const total = round2(net + deliveryCharge);

  // ---- writes ----
  const orderId = `TMF-${nextNumber(tx, counters, 'orders', 1000)}`;

  for (const [id, kg] of kgByProduct) {
    const p = products.get(id);
    const balance = round2((Number(p.stock) || 0) - kg);
    tx.update('adminProducts', id, { stock: balance });
    tx.update('products', id, { stockQty: balance });
    const mid = tx.newId('inventory');
    tx.set('inventory', mid, {
      id: mid, productId: id, productName: p.name, sku: p.sku,
      type: 'Stock out', quantity: kg, balance, note: `Web order ${orderId} (kg)`, createdAt: now,
    });
  }

  tx.set('orders', orderId, {
    id: orderId, userId: user.uid, requestId: rid, accountType: type,
    customer: { name: who.name, phone: who.phone, email: user.email || '' },
    shop: null, deliveryAddress: addr,
    items: lines.map((l) => ({
      productId: l.product.id, sku: l.product.sku, name: l.product.name,
      weight: l.weight, weightLabel: l.weightLabel, qty: l.qty, kg: l.kg,
      listPrice: l.listPrice, unitPrice: l.unitPrice, lineTotal: round2(l.unitPrice * l.qty),
    })),
    subtotal, discount, deliveryCharge, total,
    paymentMethod: 'COD', paymentStatus: 'Pending', orderStatus: 'Pending',
    deliveryDate: requestedDeliveryDate || null,
    consent: { dataProcessing: true, at: now },
    note: orderNote, stockRestored: false, createdAt: now, updatedAt: now,
  });

  // Exact shape the admin panel's Orders page reads (id, customer, type, amount, status, note, createdAt).
  tx.set('adminOrders', orderId, {
    id: orderId,
    customer: who.name,
    type, amount: total, status: 'Pending',
    note: `Web order · COD · ${who.phone}${requestedDeliveryDate ? ` · Delivery: ${requestedDeliveryDate}` : ''} · ${lines.map((l) => `${l.product.name} ${l.weightLabel} x${l.qty}`).join(', ')}${orderNote ? ` · ${orderNote}` : ''}`.slice(0, 500),
    deliveryDate: requestedDeliveryDate || null,
    createdAt: now, source: 'storefront', userId: user.uid, storefrontOrderId: orderId,
  });

  if (!knownCustomer) {
    tx.set('customers', user.uid, {
      id: user.uid, name: who.name, phone: who.phone, email: user.email || '', city: addr.city, createdAt: now,
    });
  }
  return { orderId, total, duplicate: false };
}

/** Admin changed an adminOrders status: mirror it to the customer's order; restock on cancel. */
export async function syncOrderStatus(ctx, before, after) {
  const { tx, now } = ctx;
  if (!after || after.source !== 'storefront' || before?.status === after.status) return;
  const order = await tx.get('orders', after.id);
  if (!order) return;
  const restock = after.status === 'Cancelled' && !order.stockRestored;
  const kgBack = new Map();                       // kg to return, per product (older orders have no kg: qty was in units of 1 kg)
  if (restock) for (const it of order.items) kgBack.set(it.productId, round2((kgBack.get(it.productId) || 0) + (Number.isFinite(it.kg) ? it.kg : it.qty)));
  const products = [];
  if (restock) for (const [id, kg] of kgBack) products.push([id, kg, await tx.get('adminProducts', id)]);

  const patch = { orderStatus: after.status, updatedAt: now };
  if (after.status === 'Delivered' && order.paymentMethod === 'COD') patch.paymentStatus = 'Paid';
  if (restock) {
    patch.stockRestored = true;
    for (const [id, kg, p] of products) {
      if (!p) continue;
      const balance = round2((Number(p.stock) || 0) + kg);
      tx.update('adminProducts', id, { stock: balance });
      tx.update('products', id, { stockQty: balance });
      const mid = tx.newId('inventory');
      tx.set('inventory', mid, {
        id: mid, productId: id, productName: p.name, sku: p.sku,
        type: 'Adjustment', quantity: kg, balance, note: `Cancelled ${order.id} (kg)`, createdAt: now,
      });
    }
  }
  tx.update('orders', after.id, patch);
}

const str = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');

/**
 * Image URLs for the storefront. The admin panel stores `imageUrl` (string) and `images` as
 * [{ path, url }]; the storefront only needs plain https URLs, primary image first, no duplicates.
 */
export function imageUrls(p) {
  const out = [];
  const add = (v) => {
    const u = typeof v === 'string' ? v.trim() : typeof v?.url === 'string' ? v.url.trim() : '';
    if (/^https:\/\//i.test(u) && !out.includes(u)) out.push(u);
  };
  add(p.imageUrl);
  if (Array.isArray(p.images)) p.images.forEach(add);
  return out;
}

/**
 * adminProducts -> storefront copies. No wholesale data ever lands in `products`.
 * `active` follows the admin's own flag. A product with no retail price is still LISTED (shown as
 * "Price on request", not purchasable); hiding it made every unpriced admin product vanish.
 * Optional fields (description, packSize, images) are written only when the admin doc has them,
 * so values added by hand on products/{id} are never wiped.
 */
export function storefrontDocs(p, existingPricing, now) {
  const priced = num(p.retailPrice) && p.retailPrice > 0;
  const imgs = imageUrls(p);
  const hasImageKeys = 'imageUrl' in p || 'images' in p;
  const optional = (...keys) => { for (const k of keys) { const v = str(p[k]); if (v) return v; } return undefined; };
  const product = {
    name: str(p.name) || 'Unnamed product',
    category: str(p.category) || 'Uncategorised',
    sku: str(p.sku),
    mrp: num(p.mrp) && p.mrp > 0 ? p.mrp : priced ? p.retailPrice : 0,
    retailPrice: priced ? p.retailPrice : 0,
    stockQty: Math.max(0, Math.round(Number(p.stock) || 0)),
    active: p.active === true,
    adminProductId: p.id, createdAt: p.createdAt || now, updatedAt: now,
    // present on the admin doc (even empty) => mirror it, so clearing the description in admin clears it on the shop too
    description: 'description' in p ? str(p.description) : optional('desc'),
    packSize: 'packSize' in p ? str(p.packSize) : optional('pack', 'size'),
    ...(hasImageKeys ? { imageUrl: imgs[0] || '', images: imgs } : {}),
  };
  const pricing = num(p.wholesalePrice)
    ? { wholesalePrice: p.wholesalePrice, moq: Number.isInteger(existingPricing?.moq) && existingPricing.moq >= 1 ? existingPricing.moq : 1, updatedAt: now }
    : null;
  return { product, pricing };
}

/** Retailer review: Firestore side (the auth claim is set by index.js). */
export async function reviewRetailer(ctx, actor, uid, status) {
  const { tx, now } = ctx;
  if (!['approved', 'rejected', 'suspended'].includes(status)) throw bad('Invalid status');
  const profile = await tx.get('users', uid);
  if (!profile?.wholesaleApplication) throw new Fail('No retailer application found for this user', 'not-found');
  const w = await tx.get('wholesalers', uid);
  const app = profile.wholesaleApplication;
  tx.update('users', uid, { wholesaleStatus: status, wholesaleReviewedAt: now, wholesaleReviewedBy: actor, updatedAt: now });
  tx.update('wholesalers', uid, {
    id: uid, userId: uid, name: app.shopName, contact: app.ownerName, phone: app.phone,
    city: app.address?.city || '', gstin: app.gstin || '',
    status: status === 'approved' ? 'Active' : 'On hold',
    ...(w ? {} : { creditLimit: 0, outstanding: 0, createdAt: now }),
  });
  if (w || status === 'approved') {
    const id = tx.newId('audit-logs');
    tx.set('audit-logs', id, { id, user: actor, action: 'Updated', entity: 'Wholesaler', detail: `${app.shopName}: retailer ${status}`, createdAt: now });
  }
}