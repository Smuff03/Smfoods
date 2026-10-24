import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase.js';
import { errMsg } from './utils.js';

const Ctx = createContext(null);
export const useCatalog = () => useContext(Ctx);
const LIMIT = 500; // storefront shows up to 500 active products; lists paginate on screen
const SLOW_MS = 8000;

// Logs the Firebase error code/message only (never config, tokens or user data).
const log = (what, e) => console.error(`[Crunchzy] ${what}:`, e?.code || 'unknown', e?.message || '');

/** Plain https image URLs, primary first. Accepts strings or the admin's { path, url } objects. */
export function normalizeImages(p) {
  const out = [];
  const add = (v) => {
    const u = typeof v === 'string' ? v.trim() : typeof v?.url === 'string' ? v.url.trim() : '';
    if (u && !out.includes(u)) out.push(u);
  };
  add(p.imageUrl);
  if (Array.isArray(p.images)) p.images.forEach(add);
  return out;
}

/**
 * Live catalogue straight from Firestore collection `products` (active items only).
 * The admin panel writes to the private `adminProducts` collection; the `sfSyncProduct` Cloud Function
 * copies each product to `products` (see README). `retailPrice` is the price of 1 kg and `stockQty` is in kg.
 *
 * status: 'loading' | 'ready' | 'empty' | 'error' | 'offline'
 */
export function CatalogProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState(false);
  const [slow, setSlow] = useState(false);
  const [err, setErr] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setLoaded(false); setErr(null); setSlow(false);
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    const off = onSnapshot(
      query(collection(db, 'products'), where('active', '==', true), limit(LIMIT)),
      { includeMetadataChanges: true },
      (snap) => {
        // An empty snapshot served from the local cache is "no connection yet", not "no products".
        const unconfirmed = snap.metadata.fromCache && snap.empty;
        setOffline(snap.metadata.fromCache);
        if (unconfirmed) return;
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setErr(null); setLoaded(true); clearTimeout(timer);
      },
      (e) => { log('products listener failed', e); setErr(e); setLoaded(true); clearTimeout(timer); },
    );
    return () => { clearTimeout(timer); off(); };
  }, [attempt]);

  useEffect(() => onSnapshot(doc(db, 'settings', 'store'),
    (d) => setSettings(d.exists() ? d.data() : {}),
    (e) => { log('settings listener failed', e); setSettings({}); }), []);

  const list = useMemo(() => products.map((p) => {
    const images = normalizeImages(p);
    return {
      ...p,
      name: p.name || 'Unnamed product', category: p.category || 'Uncategorised',
      retailPrice: Number(p.retailPrice) || 0, mrp: Number(p.mrp) || 0,
      stockQty: Number(p.stockQty) || 0,
      images, imageUrl: images[0] || '',
    };
  }), [products]);

  const status = err ? 'error' : !loaded ? (offline && slow ? 'offline' : 'loading') : list.length ? 'ready' : 'empty';
  const loading = status === 'loading';

  const value = useMemo(() => ({
    products: list, byId: Object.fromEntries(list.map((p) => [p.id, p])), settings,
    status, loading, offline: offline && loaded, slow,
    error: err ? errMsg(err) : '', errorCode: err?.code || '',
    retry: () => setAttempt((n) => n + 1),
    categories: [...new Set(list.map((p) => p.category).filter(Boolean))].sort(),
  }), [list, settings, status, loading, offline, loaded, slow, err]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
