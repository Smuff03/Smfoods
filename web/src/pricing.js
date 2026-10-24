/**
 * Display-side price helpers. The server recomputes everything at checkout; this only mirrors it.
 *
 * Pack sizes: customers choose 200 g, 500 g or 1 kg.
 * `retailPrice` on a product is the price of 1 kg; a pack costs retailPrice × factor.
 * `stockQty` is counted in kg. The same rule lives in functions/src/logic.js.
 */
export const WEIGHTS = [
  { key: '200g', label: '200 g', factor: 0.2 },
  { key: '500g', label: '500 g', factor: 0.5 },
  { key: '1kg', label: '1 kg', factor: 1 },
];
export const DEFAULT_WEIGHT = '200g';
export const weightOf = (key) => WEIGHTS.find((w) => w.key === key) || WEIGHTS[2];

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const isPriced = (p) => Number.isFinite(p.retailPrice) && p.retailPrice > 0;

/** -> { priced, available, unit, mrpUnit, perKg, kg, label } for ONE pack of the chosen weight. */
export function priceFor(p, weightKey = DEFAULT_WEIGHT) {
  const w = weightOf(weightKey);
  const priced = isPriced(p);
  return {
    priced, available: priced,
    unit: priced ? round2(p.retailPrice * w.factor) : 0,
    mrpUnit: p.mrp > p.retailPrice ? round2(p.mrp * w.factor) : 0,
    perKg: p.retailPrice, kg: w.factor, label: w.label, key: w.key,
  };
}

export const discountPct = (p) => (p.mrp > p.retailPrice && p.mrp > 0 ? Math.round((1 - p.retailPrice / p.mrp) * 100) : 0);

/** kg of a product already in the cart, across all pack sizes. */
export const kgInCart = (items, id) => items.reduce((n, i) => (i.id === id ? n + weightOf(i.weight).factor * i.qty : n), 0);

/** "1 kg, +2 items · 500 g, +1 item" — what is in the cart for this product. */
export function inCartText(items, id) {
  return WEIGHTS
    .map((w) => ({ w, qty: items.find((i) => i.id === id && i.weight === w.key)?.qty || 0 }))
    .filter((r) => r.qty > 0)
    .map((r) => `${r.w.label}, +${r.qty} item${r.qty > 1 ? 's' : ''}`)
    .join(' · ');
}
