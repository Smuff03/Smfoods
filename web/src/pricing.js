/**
 * Display-side price and packaging helpers.
 * Reads admin-defined pack sizes, starting quantity, and DMart-style variant pricing.
 * Server recomputes everything at checkout (in functions/src/logic.js); this mirrors it.
 */

export const parseWeightKg = (variant) => {
  if (!variant) return 1;
  const s = String(variant).toLowerCase().trim();
  if (s.includes('1/2') || s === '500 gm' || s === '500g' || s === '500 g') return 0.5;
  if (s.includes('200')) return 0.2;
  if (s.includes('250')) return 0.25;
  if (s.includes('1 kg') || s === '1kg' || s === '1 k.g.' || s === '1000g' || s === '1000 gm') return 1.0;
  if (s.includes('2 kg') || s === '2kg') return 2.0;
  if (s.includes('5 kg') || s === '5kg') return 5.0;
  const num = parseFloat(s);
  if (s.includes('gm') || s.includes('g')) return (num || 0) / 1000;
  if (s.includes('kg')) return num || 0;
  return num > 0 ? num : 1;
};

export const isSameWeight = (w1, w2) => {
  if (!w1 || !w2) return false;
  if (w1 === w2) return true;
  const s1 = String(w1).toLowerCase().replace(/\s+/g, '').replace('gm', 'g');
  const s2 = String(w2).toLowerCase().replace(/\s+/g, '').replace('gm', 'g');
  if (s1 === s2) return true;
  return Math.abs(parseWeightKg(w1) - parseWeightKg(w2)) < 1e-4;
};

export const DEFAULT_WEIGHTS = [
  { key: '200 gm', label: '200 gm', factor: 0.2 },
  { key: '500 gm', label: '500 gm', factor: 0.5 },
  { key: '1 kg', label: '1 kg', factor: 1.0 },
];
export const WEIGHTS = DEFAULT_WEIGHTS;
export const DEFAULT_WEIGHT = '200 gm';

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const isPriced = (p) => (Number.isFinite(p?.retailPrice) && p.retailPrice > 0) || (Array.isArray(p?.variantPricing) && p.variantPricing.some((v) => Number(v.retailPrice) > 0));

/** All available pack sizes for a product, derived from admin configuration. */
export function weightsFor(p) {
  if (!p) return DEFAULT_WEIGHTS;

  if (Array.isArray(p.variantPricing) && p.variantPricing.length > 0) {
    return p.variantPricing
      .filter((v) => v && v.weight)
      .map((v) => {
        const factor = parseWeightKg(v.weight);
        const retailPrice = Number(v.retailPrice) || 0;
        const mrp = Number(v.mrp) || 0;
        return {
          key: v.weight,
          label: v.weight,
          factor,
          retailPrice,
          mrp,
        };
      });
  }

  if (Array.isArray(p.availableQuantities) && p.availableQuantities.length > 0) {
    return p.availableQuantities.map((q) => {
      const factor = parseWeightKg(q);
      const retailPrice = isPriced(p) ? round2(p.retailPrice * factor) : 0;
      const mrp = p.mrp > p.retailPrice ? round2(p.mrp * factor) : 0;
      return {
        key: q,
        label: q,
        factor,
        retailPrice,
        mrp,
      };
    });
  }

  if (typeof p.packSize === 'string' && p.packSize.trim()) {
    const parts = p.packSize.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts.map((q) => {
        const factor = parseWeightKg(q);
        const retailPrice = isPriced(p) ? round2(p.retailPrice * factor) : 0;
        const mrp = p.mrp > p.retailPrice ? round2(p.mrp * factor) : 0;
        return {
          key: q,
          label: q,
          factor,
          retailPrice,
          mrp,
        };
      });
    }
  }

  return DEFAULT_WEIGHTS;
}

/** Starting pack size for a product (e.g. '200 gm' or '500 gm'). */
export function startingWeight(p) {
  if (!p) return DEFAULT_WEIGHT;
  const weights = weightsFor(p);
  if (p.startingQuantity) {
    const found = weights.find((w) => isSameWeight(w.key, p.startingQuantity));
    if (found) return found.key;
  }
  return weights[0]?.key || DEFAULT_WEIGHT;
}

export function weightOf(key, p) {
  if (p) {
    const weights = weightsFor(p);
    const found = weights.find((w) => isSameWeight(w.key, key));
    if (found) return found;
  }
  const foundDefault = DEFAULT_WEIGHTS.find((w) => isSameWeight(w.key, key));
  if (foundDefault) return foundDefault;
  const factor = parseWeightKg(key);
  return { key: key || DEFAULT_WEIGHT, label: key || DEFAULT_WEIGHT, factor };
}

/** -> { priced, available, unit, mrpUnit, perKg, kg, label, key } for ONE pack of the chosen weight. */
export function priceFor(p, weightKey) {
  if (!p) return { priced: false, available: false, unit: 0, mrpUnit: 0, perKg: 0, kg: 1, label: '', key: '' };
  const key = weightKey || startingWeight(p);
  const weights = weightsFor(p);
  const match = weights.find((w) => isSameWeight(w.key, key)) || weightOf(key, p);

  // 1. Check explicit variant in variantPricing
  const variant = Array.isArray(p.variantPricing)
    ? p.variantPricing.find((v) => isSameWeight(v.weight, key))
    : null;

  let unit = 0;
  let mrpUnit = 0;
  const factor = match.factor || parseWeightKg(key);

  if (variant && Number(variant.retailPrice) > 0) {
    unit = round2(Number(variant.retailPrice));
    mrpUnit = Number(variant.mrp) > unit ? round2(Number(variant.mrp)) : 0;
  } else if (isPriced(p)) {
    unit = round2(p.retailPrice * factor);
    mrpUnit = p.mrp > p.retailPrice ? round2(p.mrp * factor) : 0;
  }

  const priced = unit > 0;
  const perKg = factor > 0 ? round2(unit / factor) : (p.retailPrice || 0);

  return {
    priced,
    available: priced,
    unit,
    mrpUnit,
    perKg,
    kg: factor,
    label: match.label || key,
    key: match.key || key,
  };
}

export const discountPct = (pOrMrp, unit) => {
  if (typeof pOrMrp === 'object' && pOrMrp !== null) {
    const mrp = Number(pOrMrp.mrp) || 0;
    const retail = Number(pOrMrp.retailPrice) || 0;
    return mrp > retail && mrp > 0 ? Math.round((1 - retail / mrp) * 100) : 0;
  }
  const mrp = Number(pOrMrp) || 0;
  const u = Number(unit) || 0;
  return mrp > u && mrp > 0 ? Math.round((1 - u / mrp) * 100) : 0;
};

/** kg of a product already in the cart, across all pack sizes. */
export const kgInCart = (items, id) => items.reduce((n, i) => (i.id === id ? n + parseWeightKg(i.weight) * i.qty : n), 0);

/** "1 kg, +2 items · 500 g, +1 item" — what is in the cart for this product. */
export function inCartText(items, id, p) {
  const relevant = items.filter((i) => i.id === id);
  if (!relevant.length) return '';
  return relevant
    .map((r) => `${weightOf(r.weight, p).label}, +${r.qty} item${r.qty > 1 ? 's' : ''}`)
    .join(' · ');
}
