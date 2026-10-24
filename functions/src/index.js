import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { Fail, placeOrder, storefrontDocs, syncOrderStatus } from './logic.js';

// Callable functions: same region as the admin panel's adminMutate function.
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });
// Firestore triggers must run in the Firestore database's own location (asia-south1 for smfoods-8eb21).
const DB_REGION = 'asia-south1';

initializeApp();
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const origins = (process.env.SHOP_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const callable = { cors: origins.length ? origins : true };

/** Firestore-transaction adapter for logic.js. Writes are queued and applied after all reads. */
function adapter(t) {
  const writes = [];
  const ref = (c, id) => db.collection(c).doc(id);
  const tx = {
    get: async (c, id) => { const s = await t.get(ref(c, id)); return s.exists ? s.data() : null; },
    find: async (c, where) => {
      let q = db.collection(c);
      for (const [k, v] of Object.entries(where)) q = q.where(k, '==', v);
      const s = await t.get(q.limit(1));
      return s.empty ? null : s.docs[0].data();
    },
    set: (c, id, doc) => writes.push(() => t.set(ref(c, id), doc)),
    update: (c, id, patch) => writes.push(() => t.set(ref(c, id), patch, { merge: true })),
    newId: (c) => db.collection(c).doc().id,
  };
  return { tx, commit: () => writes.forEach((w) => w()) };
}

async function run(fn) {
  return db.runTransaction(async (t) => {
    const { tx, commit } = adapter(t);
    const result = await fn({ tx, now: new Date().toISOString() });
    commit();
    return result;
  });
}

function asHttps(e, what) {
  if (e instanceof Fail) return new HttpsError(e.code, e.message);
  if (e instanceof HttpsError) return e;
  logger.error(`${what} failed`, e);
  return new HttpsError('internal', 'Something went wrong. Please try again.');
}
const needAuth = (r) => { if (!r.auth) throw new HttpsError('unauthenticated', 'Please sign in.'); };
const needAdmin = (r) => { needAuth(r); if (r.auth.token.role !== 'admin') throw new HttpsError('permission-denied', 'Admin access required.'); };

/** Place an order. Role comes from the verified token + the users doc, never from the request body. */
export const sfPlaceOrder = onCall(callable, async (request) => {
  needAuth(request);
  const user = { uid: request.auth.uid, email: request.auth.token.email || '', claims: request.auth.token };
  if (user.claims.role === 'admin') throw new HttpsError('permission-denied', 'Admin accounts cannot place orders.');
  try {
    return await run((ctx) => placeOrder(ctx, user, request.data));
  } catch (e) { throw asHttps(e, 'sfPlaceOrder'); }
});

/** Admin: (re)build the storefront catalogue from adminProducts. Run once after deploying. */
export const sfSyncAllProducts = onCall({ ...callable, timeoutSeconds: 300 }, async (request) => {
  needAdmin(request);
  try {
    const now = new Date().toISOString();
    const snap = await db.collection('adminProducts').get();
    const writer = db.bulkWriter();
    let n = 0;
    for (const d of snap.docs) {
      const p = d.data();
      const existing = (await db.collection('productPricing').doc(d.id).get()).data();
      const { product, pricing } = storefrontDocs({ ...p, id: d.id }, existing, now);
      writer.set(db.collection('products').doc(d.id), product, { merge: true });
      if (pricing) writer.set(db.collection('productPricing').doc(d.id), pricing, { merge: true });
      else writer.delete(db.collection('productPricing').doc(d.id));
      n += 1;
    }
    await writer.close();
    return { synced: n };
  } catch (e) { throw asHttps(e, 'sfSyncAllProducts'); }
});

/** Keep the public catalogue (price, stock, active) in step with every admin product change. */
export const sfSyncProduct = onDocumentWritten({ document: 'adminProducts/{id}', region: DB_REGION }, async (event) => {
  const id = event.params.id;
  const after = event.data?.after;
  const pricingRef = db.collection('productPricing').doc(id);
  const productRef = db.collection('products').doc(id);
  const now = new Date().toISOString();
  if (!after?.exists) {
    // Deleted in admin: hide it (the storefront never hard-deletes) and drop wholesale pricing.
    await productRef.set({ active: false, stockQty: 0, updatedAt: now }, { merge: true });
    await pricingRef.delete();
    return;
  }
  const { product, pricing } = storefrontDocs({ ...after.data(), id }, (await pricingRef.get()).data(), now);
  await productRef.set(product, { merge: true });
  if (pricing) await pricingRef.set(pricing, { merge: true });
  else await pricingRef.delete();
});

/** Admin changed an order's status in the admin panel: reflect it on the customer's tracking page. */
export const sfSyncOrderStatus = onDocumentUpdated({ document: 'adminOrders/{id}', region: DB_REGION }, async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!after || after.source !== 'storefront' || before?.status === after.status) return;
  await run((ctx) => syncOrderStatus(ctx, before, { ...after, id: event.params.id }));
});

