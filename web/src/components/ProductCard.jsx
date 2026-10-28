import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../cart.jsx';
import { LOW_STOCK, money } from '../utils.js';
import { DEFAULT_WEIGHT, WEIGHTS, discountPct, inCartText, kgInCart, priceFor, startingWeight, weightsFor } from '../pricing.js';

export const productImage = (p) => p.imageUrl || (Array.isArray(p.images) && p.images[0]) || '';

export function Thumb({ p, big }) {
  const src = productImage(p);
  return src
    ? <img className={`thumb ${big ? 'big' : ''}`} src={src} alt={p.name} loading="lazy" />
    : <div className={`thumb ph ${big ? 'big' : ''}`} aria-hidden="true"><span>{(p.name || '?').slice(0, 1)}</span></div>;
}

export function StockBadge({ qty }) {
  if (qty === 0) return <span className="badge out">Out of stock</span>;
  if (qty != null && qty <= 5) return <span className="badge low">Only {qty} left</span>;
  return <span className="badge in">In stock</span>;
}

/** Pack-size dropdown. All configured pack sizes are selectable. */
export function WeightSelect({ value, onChange, id, weights = WEIGHTS }) {
  return (
    <select className="wsel" id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Select quantity">
      {weights.map((w) => (
        <option key={w.key} value={w.key}>
          {w.label}{w.retailPrice ? ` · ${money(w.retailPrice)}` : ''}
        </option>
      ))}
    </select>
  );
}

export default function ProductCard({ p }) {
  const { items, add } = useCart();
  const weights = weightsFor(p);
  const def = startingWeight(p);
  const [wk, setWk] = useState(def);
  const [done, setDone] = useState(false);

  useEffect(() => { setWk(startingWeight(p)); }, [p?.id, p?.startingQuantity]);

  const pr = priceFor(p, wk);
  const pct = discountPct(pr.mrpUnit, pr.unit);
  const inCart = inCartText(items, p.id, p);
  const can = pr.available;

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
        </div>
        {pr.priced && <small className="price-for">for {pr.label}{pr.kg > 0 ? ` · ${money(pr.perKg)}/kg` : ''}</small>}
        <div className="buyrow">
          <WeightSelect value={wk} onChange={setWk} weights={weights} />
          <button
            className={`btn small add-btn${done ? ' added' : ''}`}
            disabled={!can}
            onClick={() => { add(p.id, wk, 1); setDone(true); }}
          >
            {done ? '✓' : '+'}
          </button>
        </div>
        {inCart && <small className="incart">✓ In cart: {inCart}</small>}
        <StockBadge qty={p.stockQty} />
      </div>
    </article>
  );
}
