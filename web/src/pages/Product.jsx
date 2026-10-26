import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCart } from '../cart.jsx';
import { useCatalog } from '../catalog.jsx';
import { StockBadge, Thumb, WeightSelect } from '../components/ProductCard.jsx';
import { Alert, Empty, Spinner, Stepper } from '../components/ui.jsx';
import { discountPct, inCartText, isSameWeight, kgInCart, priceFor, startingWeight, weightsFor } from '../pricing.js';
import { money } from '../utils.js';

export default function Product() {
  const { id } = useParams();
  const { byId, loading } = useCatalog();
  const { items, add } = useCart();
  const nav = useNavigate();
  const p = byId[id];

  const weights = weightsFor(p);
  const def = startingWeight(p);
  const [wk, setWk] = useState(def);
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (p) {
      setWk(startingWeight(p));
      setQty(1);
      setImg(0);
    }
  }, [id, p?.startingQuantity]);

  useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(() => setDone(false), 1600);
    return () => clearTimeout(t);
  }, [done]);

  if (loading) return <Spinner />;
  if (!p) return <div className="wrap section"><Empty title="Product not available">This product may have been removed. <Link to="/shop">Back to shop</Link></Empty></div>;

  const pr = priceFor(p, wk);
  const images = p.images;
  const pct = discountPct(pr.mrpUnit, pr.unit);
  const inCart = inCartText(items, p.id, p);
  const can = pr.available && qty >= 1;

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
          {pr.priced && pr.mrpUnit > pr.unit && <><s className="muted">{money(pr.mrpUnit)}</s><span className="badge in">{pct}% off</span></>}
        </div>
        {pr.priced && pr.kg > 0 && (
          <p className="muted">
            {money(pr.perKg)} per kg
            {pr.mrpUnit > pr.unit && <> · you save {money(pr.mrpUnit - pr.unit)} on this pack</>}
          </p>
        )}
        {!pr.priced && <Alert kind="info">The price for this product has not been set yet, so it cannot be ordered online. Please contact Crunchzy.</Alert>}
        <p><StockBadge qty={p.stockQty} /></p>

        {/* Interactive Pack Size Selector */}
        {weights.length > 1 && (
          <div className="pack-selector-wrap">
            <span className="bfield-label">Available Quantities &amp; Prices:</span>
            <div className="pack-pills-row">
              {weights.map((w) => {
                const itemPr = priceFor(p, w.key);
                const isSelected = isSameWeight(wk, w.key);
                const savings = itemPr.mrpUnit > itemPr.unit ? itemPr.mrpUnit - itemPr.unit : 0;
                const savePct = discountPct(itemPr.mrpUnit, itemPr.unit);
                return (
                  <button
                    key={w.key}
                    type="button"
                    className={`pack-pill-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => { setWk(w.key); setQty(1); }}
                    aria-label={`Select ${w.label} for ${itemPr.priced ? money(itemPr.unit) : 'unpriced'}`}
                  >
                    <span className="pack-pill-weight">{w.label}</span>
                    <span className="pack-pill-price">{itemPr.priced ? money(itemPr.unit) : '—'}</span>
                    {savings > 0 ? (
                      <span className="pack-pill-save">Save {money(savings)} ({savePct}% off)</span>
                    ) : itemPr.mrpUnit > 0 ? (
                      <span className="pack-pill-mrp">MRP {money(itemPr.mrpUnit)}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {p.description?.trim() && (
          <section className="pdesc">
            <h3>About this product</h3>
            <p>{p.description}</p>
          </section>
        )}
        <dl className="specs">
          {p.sku && <><dt>SKU</dt><dd>{p.sku}</dd></>}
          <dt>Pack sizes</dt><dd>{weights.map((w) => w.label).join(' · ')}</dd>
          <dt>Category</dt><dd>{p.category}</dd>
        </dl>

        <div className="buybox">
          <div className="bfield">
            <label htmlFor="pw">Selected Pack Size</label>
            <WeightSelect id="pw" value={wk} onChange={(v) => { setWk(v); setQty(1); }} weights={weights} />
          </div>
          <div className="bfield">
            <label>Number of packs</label>
            <Stepper value={qty} onChange={setQty} min={1} label="Number of packs" />
          </div>
        </div>
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
