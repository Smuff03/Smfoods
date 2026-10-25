import { Link, useNavigate } from 'react-router-dom';
import { useCart, useCartLines } from '../cart.jsx';
import { Thumb } from '../components/ProductCard.jsx';
import { Alert, Empty, Spinner, Stepper } from '../components/ui.jsx';
import { weightOf } from '../pricing.js';
import { money } from '../utils.js';

const formatDateISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function Cart() {
  const { setQty, remove, clear, deliveryDate, setDeliveryDate } = useCart();
  const { lines, subtotal, net, issues, loading } = useCartLines();
  const nav = useNavigate();
  if (loading && lines.length) return <Spinner />;
  if (!lines.length) return <div className="wrap section"><Empty title="Your cart is empty"><Link to="/shop">Browse products</Link></Empty></div>;

  const today = new Date();
  const todayStr = formatDateISO(today);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDateISO(tomorrow);
  const inTwoDays = new Date(); inTwoDays.setDate(inTwoDays.getDate() + 2);
  const inTwoDaysStr = formatDateISO(inTwoDays);
  const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + 30);
  const maxDateStr = formatDateISO(maxDate);

  return (
    <div className="wrap section cartgrid">
      <div>
        <div className="row between"><h1 className="h1s">Your cart</h1><button className="link" onClick={clear}>Clear cart</button></div>
        {lines.map((l) => l.missing ? (
          <div key={l.key} className="line"><span className="muted">Item no longer available</span><button className="link" onClick={() => remove(l.id, l.weight)}>Remove</button></div>
        ) : (
          <div key={l.key} className="line">
            <Thumb p={l.p} />
            <div className="grow">
              <Link to={`/product/${l.id}`} className="pname">{l.p.name}</Link>
              <div><span className="wtag">{weightOf(l.weight, l.p).label}</span> <span className="muted">+{l.qty} item{l.qty > 1 ? 's' : ''} · {money(l.pr.unit)} each</span></div>
              {l.problem && <small className="err">{l.problem}</small>}
            </div>
            <Stepper value={l.qty} onChange={(n) => setQty(l.id, l.weight, n)} label="Number of packs" />
            <b className="ltotal">{money(l.lineTotal)}</b>
            <button className="link" onClick={() => remove(l.id, l.weight)} aria-label="Remove">✕</button>
          </div>
        ))}

        <section className="card delivery-card" style={{ marginTop: '1.2rem' }}>
          <div className="row between">
            <div>
              <h3 style={{ marginBottom: '.25rem' }}>📅 Preferred delivery date</h3>
              <p className="muted" style={{ margin: 0, fontSize: '.88rem' }}>
                Select when you would like this order delivered. Our team will coordinate your delivery slot.
              </p>
            </div>
            {deliveryDate && <button type="button" className="link small" onClick={() => setDeliveryDate('')}>Clear</button>}
          </div>
          <div style={{ marginTop: '.8rem', display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="date"
              style={{ width: 'auto', minWidth: '160px', padding: '.45rem .8rem' }}
              value={deliveryDate}
              min={todayStr}
              max={maxDateStr}
              onChange={(e) => setDeliveryDate(e.target.value)}
              aria-label="Choose delivery date"
            />
            <div className="pills" style={{ margin: 0 }}>
              <button
                type="button"
                className={deliveryDate === todayStr ? 'pill on' : 'pill'}
                onClick={() => setDeliveryDate(todayStr)}
              >
                Today
              </button>
              <button
                type="button"
                className={deliveryDate === tomorrowStr ? 'pill on' : 'pill'}
                onClick={() => setDeliveryDate(tomorrowStr)}
              >
                Tomorrow
              </button>
              <button
                type="button"
                className={deliveryDate === inTwoDaysStr ? 'pill on' : 'pill'}
                onClick={() => setDeliveryDate(inTwoDaysStr)}
              >
                In 2 days
              </button>
            </div>
          </div>
          {deliveryDate && (
            <p className="ok" style={{ fontSize: '.85rem', margin: '.6rem 0 0' }}>
              ✓ Requested for delivery on <b>{deliveryDate}</b>
            </p>
          )}
        </section>
      </div>
      <aside className="card summary">
        <h3>Summary</h3>
        <div className="sumrow"><span>Subtotal</span><span>{money(subtotal)}</span></div>
        {deliveryDate && <div className="sumrow"><span>Delivery date</span><span style={{ fontWeight: 600 }}>{deliveryDate}</span></div>}
        <div className="sumrow tot"><span>Total</span><span>{money(net)}</span></div>
        <small className="muted">Delivery charges (if any) are added at checkout. Pay by Cash on Delivery.</small>
        {issues.map((i) => <Alert key={i}>{i}</Alert>)}
        <button className="btn block" disabled={issues.length > 0} onClick={() => nav('/checkout')}>Proceed to checkout</button>
      </aside>
    </div>
  );
}

