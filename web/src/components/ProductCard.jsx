import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import { LOW_STOCK, money } from '../utils.js';
import { discountPct, priceFor } from '../pricing.js';

export const productImage = (p) => p.imageUrl || (Array.isArray(p.images) && p.images[0]) || '';

export function Thumb({ p, big }) {
  const src = productImage(p);
  return src
    ? <img className={`thumb ${big ? 'big' : ''}`} src={src} alt={p.name} loading="lazy" />
    : <div className={`thumb ph ${big ? 'big' : ''}`} aria-hidden="true"><span>{(p.name || '?').slice(0, 1)}</span></div>;
}

export function StockBadge({ qty }) {
  if (qty < 1) return <span className="badge out">Out of stock</span>;
  if (qty <= LOW_STOCK) return <span className="badge low">Only {qty} left</span>;
  return <span className="badge in">In stock</span>;
}

export default function ProductCard({ p }) {
  const { isRetailer } = useAuth();
  const { add } = useCart();
  const pr = priceFor(p, isRetailer, 1);
  const pct = !isRetailer ? discountPct(p) : 0;
  const can = p.stockQty > 0 && pr.available;
  const startQty = Math.min(pr.moq, p.stockQty) || 1;
  return (
    <article className="card product">
      <Link to={`/product/${p.id}`} className="pimg">
        <Thumb p={p} />
        {pct > 0 && <span className="ribbon">{pct}% off</span>}
      </Link>
      <div className="pbody">
        <span className="chip">{p.category}</span>
        {p.packSize && <small className="muted">{p.packSize}</small>}
        <Link to={`/product/${p.id}`} className="pname">{p.name}</Link>
        <div className="price">
          {pr.priced ? <strong>{money(pr.unit)}</strong> : <strong className="muted">Price on request</strong>}
          {!isRetailer && pr.priced && p.mrp > p.retailPrice && <s className="muted">{money(p.mrp)}</s>}
          {isRetailer && pr.available && <small className="muted">retail {money(p.retailPrice)}</small>}
        </div>
        {isRetailer && (pr.available
          ? <small className="muted">Min. order {pr.moq}{p.wholesale.tiers.length ? ' · bulk discounts' : ''}</small>
          : <small className="err">Not offered at wholesale</small>)}
        <div className="row between">
          <StockBadge qty={p.stockQty} />
          <button className="btn small" disabled={!can || startQty > p.stockQty} onClick={() => add(p.id, startQty)}>
            {isRetailer && pr.moq > 1 ? `Add ${startQty}` : 'Add'}
          </button>
        </div>
      </div>
    </article>
  );
}
