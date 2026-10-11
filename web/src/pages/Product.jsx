import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import { useCatalog } from '../catalog.jsx';
import { StockBadge, Thumb } from '../components/ProductCard.jsx';
import { Alert, Empty, Spinner } from '../components/ui.jsx';
import { discountPct, priceFor } from '../pricing.js';
import { money } from '../utils.js';

export default function Product() {
  const { id } = useParams();
  const { byId, loading } = useCatalog();
  const { isRetailer } = useAuth();
  const { add } = useCart();
  const nav = useNavigate();
  const p = byId[id];
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);
  const pr = p ? priceFor(p, isRetailer, qty) : null;
  const moq = pr?.moq || 1;
  useEffect(() => { if (p) setQty(Math.min(moq, Math.max(1, p.stockQty))); }, [p?.id, moq]); // eslint-disable-line

  if (loading) return <Spinner />;
  if (!p) return <div className="wrap section"><Empty title="Product not available">This product may have been removed. <Link to="/shop">Back to shop</Link></Empty></div>;

  const images = p.images; // normalised, de-duplicated URL list (see catalog.jsx)
  const bad = qty < moq ? `Minimum order is ${moq}` : qty > p.stockQty ? `Only ${p.stockQty} in stock` : '';
  const can = p.stockQty > 0 && pr.available && !bad;
  const pct = !isRetailer ? discountPct(p) : 0;

  return (
    <div className="wrap section pdp">
      <div>
        <Thumb p={images.length ? { ...p, imageUrl: images[img] } : p} big />
        {images.length > 1 && <div className="row gap">{images.map((s, i) => <button key={s} className={`mini ${i === img ? 'on' : ''}`} onClick={() => setImg(i)}><img src={s} alt="" /></button>)}</div>}
      </div>
      <div>
        <Link to={`/shop?cat=${encodeURIComponent(p.category)}`} className="chip">{p.category}</Link>
        <h1>{p.name}</h1>
        <div className="price big">{pr.priced ? <strong>{money(pr.unit)}</strong> : <strong className="muted">Price on request</strong>}{!isRetailer && pr.priced && p.mrp > p.retailPrice && <><s className="muted">{money(p.mrp)}</s><span className="badge in">{pct}% off</span></>}</div>
        {isRetailer && pr.available && <p className="muted">Wholesale price · retail {money(p.retailPrice)}</p>}
        {isRetailer && !pr.available && <Alert>This product is not offered at wholesale prices.</Alert>}
        {!pr.priced && <Alert kind="info">The price for this product has not been set yet, so it cannot be ordered online. Please contact SMFoods.</Alert>}
        <p><StockBadge qty={p.stockQty} /></p>
        {p.description && <p>{p.description}</p>}
        <dl className="specs">
          {p.sku && <><dt>SKU</dt><dd>{p.sku}</dd></>}
          {p.packSize && <><dt>Pack size</dt><dd>{p.packSize}</dd></>}
          <dt>Category</dt><dd>{p.category}</dd>
          {isRetailer && pr.available && <><dt>Minimum order</dt><dd>{moq} units</dd></>}
        </dl>
        {isRetailer && p.wholesale?.tiers.length > 0 && (
          <table className="tbl"><thead><tr><th>Quantity</th><th>Price / unit</th></tr></thead><tbody>
            <tr><td>{moq}+</td><td>{money(p.wholesale.price)}</td></tr>
            {[...p.wholesale.tiers].sort((a, b) => a.minQty - b.minQty).map((t) => <tr key={t.minQty}><td>{t.minQty}+</td><td>{money(t.price)}</td></tr>)}
          </tbody></table>
        )}
        <div className="row gap qtyrow">
          <div className="qty">
            <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease">−</button>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value)) || 1))} aria-label="Quantity" />
            <button onClick={() => setQty(qty + 1)} aria-label="Increase">+</button>
          </div>
          <button className="btn" disabled={!can} onClick={() => add(p.id, qty)}>Add to cart</button>
          <button className="btn ghost" disabled={!can} onClick={() => { add(p.id, qty); nav('/cart'); }}>Buy now</button>
        </div>
        {bad && p.stockQty > 0 && <small className="err">{bad}</small>}
        {can && <p className="muted">Line total: <b>{money(pr.unit * qty)}</b></p>}
      </div>
    </div>
  );
}
