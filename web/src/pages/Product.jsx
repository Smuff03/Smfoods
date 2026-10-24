import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCart } from '../cart.jsx';
import { useCatalog } from '../catalog.jsx';
import { StockBadge, Thumb, WeightSelect } from '../components/ProductCard.jsx';
import { Alert, Empty, Spinner, Stepper } from '../components/ui.jsx';
import { DEFAULT_WEIGHT, WEIGHTS, discountPct, inCartText, kgInCart, priceFor } from '../pricing.js';
import { money } from '../utils.js';

export default function Product() {
  const { id } = useParams();
  const { byId, loading } = useCatalog();
  const { items, add } = useCart();
  const nav = useNavigate();
  const p = byId[id];
  const [wk, setWk] = useState(DEFAULT_WEIGHT);
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => { setWk(DEFAULT_WEIGHT); setQty(1); setImg(0); }, [id]);
  useEffect(() => { if (!done) return undefined; const t = setTimeout(() => setDone(false), 1600); return () => clearTimeout(t); }, [done]);

  if (loading) return <Spinner />;
  if (!p) return <div className="wrap section"><Empty title="Product not available">This product may have been removed. <Link to="/shop">Back to shop</Link></Empty></div>;

  const pr = priceFor(p, wk);
  const images = p.images;
  const pct = discountPct(p);
  const inCart = inCartText(items, p.id);
  const room = p.stockQty - kgInCart(items, p.id);           // kg still available to add
  const maxQty = Math.max(0, Math.floor(room / pr.kg + 1e-9));
  const bad = p.stockQty <= 0 ? '' : qty > maxQty ? (maxQty > 0 ? `You can add up to ${maxQty} more of ${pr.label}` : `No more ${pr.label} packs available (${p.stockQty} kg in stock)`) : '';
  const can = p.stockQty > 0 && pr.available && qty >= 1 && !bad;

  return (
    <div className="wrap section pdp">
      <div>
        <Thumb p={images.length ? { ...p, imageUrl: images[img] } : p} big />
        {images.length > 1 && <div className="row gap">{images.map((s, i) => <button key={s} className={`mini ${i === img ? 'on' : ''}`} onClick={() => setImg(i)}><img src={s} alt="" /></button>)}</div>}
      </div>
      <div>
        <Link to={`/shop?cat=${encodeURIComponent(p.category)}`} className="chip">{p.category}</Link>
        <h1>{p.name}</h1>
        <div className="price big">
          {pr.priced ? <strong>{money(pr.unit)}</strong> : <strong className="muted">Price on request</strong>}
          {pr.priced && <small className="muted">for {pr.label}</small>}
          {pr.priced && pr.mrpUnit > 0 && <><s className="muted">{money(pr.mrpUnit)}</s><span className="badge in">{pct}% off</span></>}
        </div>
        {pr.priced && <p className="muted">{money(pr.perKg)} per kg{pct > 0 && <> · you save {money(p.mrp - p.retailPrice)} per kg</>}</p>}
        {!pr.priced && <Alert kind="info">The price for this product has not been set yet, so it cannot be ordered online. Please contact Crunchzy.</Alert>}
        <p><StockBadge qty={p.stockQty} /></p>
        {p.description?.trim() && (
          <section className="pdesc">
            <h3>About this product</h3>
            <p>{p.description}</p>
          </section>
        )}
        <dl className="specs">
          {p.sku && <><dt>SKU</dt><dd>{p.sku}</dd></>}
          <dt>Pack sizes</dt><dd>{WEIGHTS.map((w) => w.label).join(' · ')}</dd>
          <dt>Category</dt><dd>{p.category}</dd>
        </dl>

        <div className="buybox">
          <div className="bfield">
            <label htmlFor="pw">Quantity (pack size)</label>
            <WeightSelect id="pw" value={wk} onChange={(v) => { setWk(v); setQty(1); }} stockKg={p.stockQty} />
          </div>
          <div className="bfield">
            <label>Number of packs</label>
            <Stepper value={qty} onChange={setQty} min={1} max={Math.max(1, maxQty)} label="Number of packs" />
          </div>
        </div>
        {bad && <small className="err">{bad}</small>}
        {can && <p className="muted">{qty} × {pr.label} = <b>{money(pr.unit * qty)}</b></p>}
        <div className="row gap qtyrow">
          <button className="btn" disabled={!can} onClick={() => { add(p.id, wk, qty); setDone(true); }}>{done ? 'Added ✓' : 'Add to cart'}</button>
          <button className="btn ghost" disabled={!can} onClick={() => { add(p.id, wk, qty); nav('/cart'); }}>Buy now</button>
        </div>
        {inCart && <p className="incart">In cart: {inCart} · <Link to="/cart">View cart</Link></p>}
      </div>
    </div>
  );
}
