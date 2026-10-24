import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../cart.jsx';
import { LOW_STOCK, money } from '../utils.js';
import { DEFAULT_WEIGHT, WEIGHTS, discountPct, inCartText, kgInCart, priceFor } from '../pricing.js';

export const productImage = (p) => p.imageUrl || (Array.isArray(p.images) && p.images[0]) || '';

export function Thumb({ p, big }) {
  const src = productImage(p);
  return src
    ? <img className={`thumb ${big ? 'big' : ''}`} src={src} alt={p.name} loading="lazy" />
    : <div className={`thumb ph ${big ? 'big' : ''}`} aria-hidden="true"><span>{(p.name || '?').slice(0, 1)}</span></div>;
}

export function StockBadge({ qty }) {
  if (qty <= 0) return <span className="badge out">Out of stock</span>;
  if (qty <= LOW_STOCK) return <span className="badge low">Only {qty} kg left</span>;
  return <span className="badge in">In stock</span>;
}

/** Pack-size dropdown. Sizes larger than the remaining stock are disabled. */
export function WeightSelect({ value, onChange, stockKg, id }) {
  return (
    <select className="wsel" id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Select quantity">
      {WEIGHTS.map((w) => <option key={w.key} value={w.key} disabled={w.factor > stockKg + 1e-9}>{w.label}</option>)}
    </select>
  );
}

export default function ProductCard({ p }) {
  const { items, add } = useCart();
  const [wk, setWk] = useState(DEFAULT_WEIGHT);
  const [done, setDone] = useState(false);
  const pr = priceFor(p, wk);
  const pct = discountPct(p);
  const inCart = inCartText(items, p.id);
  const can = p.stockQty > 0 && pr.available && kgInCart(items, p.id) + pr.kg <= p.stockQty + 1e-9;

  useEffect(() => { if (!done) return undefined; const t = setTimeout(() => setDone(false), 1400); return () => clearTimeout(t); }, [done]);

  return (
    <article className="card product">
      <Link to={`/product/${p.id}`} className="pimg">
        <Thumb p={p} />
        {pct > 0 && <span className="ribbon">{pct}% off</span>}
      </Link>
      <div className="pbody">
        <span className="chip">{p.category}</span>
        <Link to={`/product/${p.id}`} className="pname">{p.name}</Link>
        <div className="price">
          {pr.priced ? <strong>{money(pr.unit)}</strong> : <strong className="muted">Price on request</strong>}
          {pr.priced && pr.mrpUnit > 0 && <s className="muted">{money(pr.mrpUnit)}</s>}
          {pr.priced && <small className="muted">for {pr.label}</small>}
        </div>
        {pr.priced && <small className="muted">{money(pr.perKg)} / kg</small>}
        <div className="row between buyrow">
          <WeightSelect value={wk} onChange={setWk} stockKg={p.stockQty} />
          <button className="btn small" disabled={!can} onClick={() => { add(p.id, wk, 1); setDone(true); }}>{done ? 'Added ✓' : 'Add'}</button>
        </div>
        {inCart && <small className="incart">In cart: {inCart}</small>}
        <StockBadge qty={p.stockQty} />
      </div>
    </article>
  );
}
