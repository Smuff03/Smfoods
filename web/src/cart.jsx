import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useCatalog } from './catalog.jsx';
import { kgInCart, priceFor, weightOf } from './pricing.js';

const KEY = 'crunchzy_cart_v2';
const OLD_KEY = 'smfoods_cart_v1';
const Ctx = createContext(null);
export const useCart = () => useContext(Ctx);

// Each cart line is { id, weight, qty }: the same product can be in the cart in several pack sizes.
const clean = (v) => (Array.isArray(v) ? v.filter((i) => i && typeof i.id === 'string' && i.qty >= 1).map((i) => ({ id: i.id, weight: weightOf(i.weight).key, qty: Math.floor(i.qty) })) : []);
const load = () => {
  try {
    const cur = localStorage.getItem(KEY);
    if (cur) return clean(JSON.parse(cur));
    const old = localStorage.getItem(OLD_KEY); // carts saved before pack sizes existed count as 1 kg each
    return old ? clean(JSON.parse(old)) : [];
  } catch { return []; }
};
const same = (i, id, weight) => i.id === id && i.weight === weight;

export function CartProvider({ children }) {
  const [items, setItems] = useState(load);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage unavailable */ } }, [items]);

  const api = useMemo(() => ({
    items,
    count: items.reduce((n, i) => n + i.qty, 0),
    add: (id, weight, qty = 1) => setItems((cur) => (cur.some((i) => same(i, id, weight))
      ? cur.map((i) => (same(i, id, weight) ? { ...i, qty: i.qty + qty } : i))
      : [...cur, { id, weight, qty }])),
    setQty: (id, weight, qty) => setItems((cur) => cur.map((i) => (same(i, id, weight) ? { ...i, qty: Math.max(1, Math.floor(qty) || 1) } : i))),
    remove: (id, weight) => setItems((cur) => cur.filter((i) => !same(i, id, weight))),
    clear: () => setItems([]),
  }), [items]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

/** Cart joined with live catalogue data: lines, totals and anything that blocks checkout. */
export function useCartLines() {
  const { items } = useCart();
  const { byId, loading } = useCatalog();
  return useMemo(() => {
    let subtotal = 0;
    const issues = [];
    const lines = items.map(({ id, weight, qty }) => {
      const key = `${id}|${weight}`;
      const p = byId[id];
      if (!p) { if (!loading) issues.push('Some items are no longer available. Remove them to continue.'); return { key, id, weight, qty, missing: true }; }
      const pr = priceFor(p, weight);
      let problem = '';
      if (p.stockQty <= 0) problem = 'Out of stock';
      else if (kgInCart(items, id) > p.stockQty + 1e-9) problem = `Only ${p.stockQty} kg in stock — reduce the quantity`;
      else if (!pr.priced) problem = 'Price not available';
      if (problem) issues.push(`${p.name}: ${problem}`);
      subtotal += pr.unit * qty;
      return { key, id, weight, qty, p, pr, problem, lineTotal: Math.round(pr.unit * qty * 100) / 100 };
    });
    subtotal = Math.round(subtotal * 100) / 100;
    return { lines, subtotal, net: subtotal, issues: [...new Set(issues)], loading };
  }, [items, byId, loading]);
}
