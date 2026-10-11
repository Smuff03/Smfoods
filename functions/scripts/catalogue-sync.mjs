// Read-only comparison of adminProducts (admin panel) vs products (storefront). Add --apply to copy.
//   node functions/scripts/catalogue-sync.mjs           -> report only, writes NOTHING
//   node functions/scripts/catalogue-sync.mjs --apply   -> same copy that sfSyncAllProducts performs
// Needs credentials for project smfoods-8eb21:  gcloud auth application-default login
//   (or GOOGLE_APPLICATION_CREDENTIALS=path-to-service-account.json — never commit that file).
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { storefrontDocs } from '../src/logic.js';

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'smfoods-8eb21';
initializeApp({ projectId });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });
const apply = process.argv.includes('--apply');

const admin = await db.collection('adminProducts').get();
console.log(`Project ${projectId}: ${admin.size} admin product(s)`);
const now = new Date().toISOString();
for (const d of admin.docs) {
  const p = d.data();
  const shop = (await db.collection('products').doc(d.id).get()).data();
  const existing = (await db.collection('productPricing').doc(d.id).get()).data();
  const { product, pricing } = storefrontDocs({ ...p, id: d.id }, existing, now);
  const state = !shop ? 'MISSING in products' : shop.active !== true ? 'hidden (inactive)' : shop.retailPrice > 0 ? 'visible' : 'visible, price on request';
  console.log(`- ${d.id} "${p.name}" retailPrice=${p.retailPrice} active=${p.active} images=${Array.isArray(p.images) ? p.images.length : 0} -> storefront: ${state}`);
  if (apply) {
    await db.collection('products').doc(d.id).set(product, { merge: true });
    if (pricing) await db.collection('productPricing').doc(d.id).set(pricing, { merge: true });
    console.log('  copied');
  }
}
if (!apply) console.log('\n(report only — run with --apply to copy)');
