import { Link, useNavigate } from 'react-router-dom';
import { useCart, useCartLines } from '../cart.jsx';
import { productImage } from '../components/ProductCard.jsx';
import { Alert, Empty, Spinner, Stepper } from '../components/ui.jsx';
import { weightOf } from '../pricing.js';
import { money } from '../utils.js';

const formatDateISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function CartItem({ l, setQty, remove }) {
  const src = productImage(l.p);
  const weightLabel = weightOf(l.weight, l.p).label;

  return (
    <div className="cart-item">
      {/* Product image */}
      <Link to={`/product/${l.id}`} className="cart-item-img-wrap">
        {src
          ? <img src={src} alt={l.p.name} className="cart-item-img" />
          : <div className="cart-item-img cart-item-ph"><span>{(l.p.name || '?')[0]}</span></div>}
      </Link>

      {/* Info column */}
      <div className="cart-item-body">
        <div className="cart-item-top">
          <Link to={`/product/${l.id}`} className="cart-item-name">{l.p.name}</Link>
          <button
            className="cart-item-remove"
            onClick={() => remove(l.id, l.weight)}
            aria-label="Remove item"
          >✕</button>
        </div>

        <span className="wtag cart-item-tag">{weightLabel}</span>
        {l.problem && <small className="err">{l.problem}</small>}

        <div className="cart-item-footer">
          <Stepper value={l.qty} onChange={(n) => setQty(l.id, l.weight, n)} label="Number of packs" />
          <div className="cart-item-price">
            <b>{money(l.lineTotal)}</b>
            {l.qty > 1 && <small className="muted">{money(l.pr.unit)} each</small>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Cart() {
  const { setQty, remove, clear, deliveryDate, setDeliveryDate } = useCart();
  const { lines, subtotal, net, issues, loading } = useCartLines();
  const nav = useNavigate();

  if (loading && lines.length) return <Spinner />;
  if (!lines.length) return (
    <div className="wrap section">
      <Empty title="Your cart is empty">
        <Link to="/shop" className="btn" style={{ marginTop: '.8rem', display: 'inline-flex' }}>Browse products</Link>
      </Empty>
    </div>
  );

  const today = new Date();
  const todayStr = formatDateISO(today);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDateISO(tomorrow);
  const inTwoDays = new Date(); inTwoDays.setDate(inTwoDays.getDate() + 2);
  const inTwoDaysStr = formatDateISO(inTwoDays);
  const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + 30);
  const maxDateStr = formatDateISO(maxDate);

  const totalItems = lines.reduce((n, l) => n + l.qty, 0);

  return (
    <div className="wrap section">

      {/* Page title */}
      <div className="row between" style={{ marginBottom: '1rem' }}>
        <div>
          <h1 className="h1s" style={{ marginBottom: '.1rem' }}>Your cart</h1>
          <p className="muted" style={{ margin: 0, fontSize: '.88rem' }}>{totalItems} item{totalItems !== 1 ? 's' : ''}</p>
        </div>
        <button className="link" style={{ color: 'var(--err)', fontSize: '.88rem' }} onClick={clear}>Clear all</button>
      </div>

      <div className="cartgrid">
        {/* ── Left column: items + delivery ── */}
        <div>
          <div className="cart-items-list">
            {lines.map((l) => l.missing ? (
              <div key={l.key} className="cart-item cart-item-missing">
                <span className="muted">Item no longer available</span>
                <button className="link" onClick={() => remove(l.id, l.weight)}>Remove</button>
              </div>
            ) : (
              <CartItem key={l.key} l={l} setQty={setQty} remove={remove} />
            ))}
          </div>

          {/* Delivery date picker */}
          <section className="cart-delivery-card">
            <div className="row between" style={{ marginBottom: '.7rem' }}>
              <div>
                <h3 style={{ marginBottom: '.15rem', fontSize: '1rem' }}>📅 Preferred delivery date</h3>
                <p className="muted" style={{ margin: 0, fontSize: '.82rem' }}>
                  We'll coordinate the slot with you.
                </p>
              </div>
              {deliveryDate && (
                <button type="button" className="link" style={{ fontSize: '.8rem' }} onClick={() => setDeliveryDate('')}>
                  Clear
                </button>
              )}
            </div>

            <div className="pills" style={{ margin: '0 0 .75rem' }}>
              <button type="button" className={deliveryDate === todayStr ? 'pill on' : 'pill'} onClick={() => setDeliveryDate(todayStr)}>Today</button>
              <button type="button" className={deliveryDate === tomorrowStr ? 'pill on' : 'pill'} onClick={() => setDeliveryDate(tomorrowStr)}>Tomorrow</button>
              <button type="button" className={deliveryDate === inTwoDaysStr ? 'pill on' : 'pill'} onClick={() => setDeliveryDate(inTwoDaysStr)}>In 2 days</button>
            </div>

            <input
              type="date"
              style={{ width: 'auto', minWidth: '160px', padding: '.45rem .8rem' }}
              value={deliveryDate}
              min={todayStr}
              max={maxDateStr}
              onChange={(e) => setDeliveryDate(e.target.value)}
              aria-label="Choose delivery date"
            />

            {deliveryDate && (
              <p style={{ fontSize: '.85rem', margin: '.6rem 0 0', color: 'var(--ok)', fontWeight: 600 }}>
                ✓ Requested for {deliveryDate}
              </p>
            )}
          </section>
        </div>

        {/* ── Right column: order summary ── */}
        <aside className="cart-summary-card">
          <h3 style={{ marginBottom: '1rem' }}>Order summary</h3>

          {lines.filter((l) => !l.missing).map((l) => (
            <div key={l.key} className="sumrow" style={{ fontSize: '.88rem' }}>
              <span className="muted" style={{ maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {l.p.name} <span className="wtag" style={{ fontSize: '.7rem' }}>{weightOf(l.weight, l.p).label}</span> ×{l.qty}
              </span>
              <span>{money(l.lineTotal)}</span>
            </div>
          ))}

          <hr style={{ margin: '.8rem 0' }} />
          <div className="sumrow">
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          {deliveryDate && (
            <div className="sumrow" style={{ fontSize: '.88rem' }}>
              <span>Delivery date</span>
              <span style={{ fontWeight: 600 }}>{deliveryDate}</span>
            </div>
          )}
          <div className="sumrow tot">
            <span>Total</span>
            <span>{money(net)}</span>
          </div>

          <small className="muted" style={{ display: 'block', marginTop: '.6rem', lineHeight: 1.5 }}>
            Delivery charges (if any) added at checkout. Cash on Delivery available.
          </small>

          {issues.map((i) => <Alert key={i}>{i}</Alert>)}

          <button
            className="btn block"
            style={{ marginTop: '1rem' }}
            disabled={issues.length > 0}
            onClick={() => nav('/checkout')}
          >
            Proceed to checkout →
          </button>

          <Link to="/shop" className="btn ghost block" style={{ marginTop: '.5rem', textAlign: 'center' }}>
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
