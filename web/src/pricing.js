/** Display-side price helpers. The server recomputes everything at checkout; this only mirrors it. */
export function tierFor(tiers, qty) {
  return (tiers || []).filter((t) => qty >= t.minQty).sort((a, b) => b.minQty - a.minQty)[0] || null;
}

export const isPriced = (p) => Number.isFinite(p.retailPrice) && p.retailPrice > 0;

/** -> { available, priced, unit, list, moq, saving }. `priced` = there is a price to display; `available` = it can be bought. */
export function priceFor(p, retailer, qty = 1) {
  if (retailer) {
    const w = p.wholesale;
    if (!w) return { available: false, priced: isPriced(p), unit: p.retailPrice, list: p.retailPrice, moq: 1, saving: 0 };
    const t = tierFor(w.tiers, qty);
    const unit = t ? Math.min(t.price, w.price) : w.price;
    return { available: true, priced: true, unit, list: w.price, moq: w.moq, saving: (w.price - unit) * qty };
  }
  return { available: isPriced(p), priced: isPriced(p), unit: p.retailPrice, list: p.retailPrice, moq: 1, saving: 0 };
}

export const discountPct = (p) => (p.mrp > p.retailPrice && p.mrp > 0 ? Math.round((1 - p.retailPrice / p.mrp) * 100) : 0);
