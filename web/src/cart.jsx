import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useCatalog } from './catalog.jsx';
import { useAuth } from './auth.jsx';
import { priceFor } from './pricing.js';

const KEY = 'smfoods_cart_v1';
const Ctx = createContext(null);
export const useCart = () => useContext(Ctx);

const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

export function CartProvider({ children }) {
  const [items, setItems] = useState(load);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage unavailable */ } }, [items]);

  const api = useMemo(() => ({
    items,
    count: items.reduce((n, i) => n + i.qty, 0),
    add: (id, qty = 1) => setItems((cur) => {
      const f = cur.find((i) => i.id === id);
      return f ? cur.map((i) => (i.id === id ? { ...i, qty: i.qty + qty } : i)) : [...cur, { id, qty }];
    }),
    setQty: (id, qty) => setItems((cur) => cur.map((i) => (i.id === id ? { ...i, qty: Math.max(1, Math.floor(qty) || 1) } : i))),
    remove: (id) => setItems((cur) => cur.filter((i) => i.id !== id)),
    clear: () => setItems([]),
  }), [items]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

/** Cart joined with live catalogue data: lines, totals and anything that blocks checkout. */
export function useCartLines() {
  const { items } = useCart();
  const { byId, loading } = useCatalog();
  const { isRetailer } = useAuth();
  return useMemo(() => {
    let subtotal = 0, saving = 0;
    const issues = [];
    const lines = items.map(({ id, qty }) => {
      const p = byId[id];
      if (!p) { if (!loading) issues.push('Some items are no longer available. Remove them to continue.'); return { id, qty, missing: true }; }
      const pr = priceFor(p, isRetailer, qty);
      let problem = '';
      if (p.stockQty < 1) problem = 'Out of stock';
      else if (qty > p.stockQty) problem = `Only ${p.stockQty} in stock`;
      else if (!pr.priced) problem = 'Price not available';
      else if (isRetailer && !pr.available) problem = 'Not available at wholesale prices';
      else if (isRetailer && qty < pr.moq) problem = `Minimum order is ${pr.moq}`;
      if (problem) issues.push(`${p.name}: ${problem}`);
      subtotal += pr.list * qty;
      saving += pr.saving;
      return { id, qty, p, pr, problem, lineTotal: pr.unit * qty };
    });
    return { lines, subtotal, saving, net: subtotal - saving, issues, loading };
  }, [items, byId, isRetailer, loading]);
}
