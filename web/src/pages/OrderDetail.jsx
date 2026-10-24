import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { Alert, Empty, Logo, Spinner, StatusBadge } from '../components/ui.jsx';
import { STATUS_LABEL, STATUS_STEPS, fmtDate, money } from '../utils.js';

const packLabel = (i) => i.weightLabel || (i.weight ? i.weight : '—');

export default function OrderDetail() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const [o, setO] = useState(undefined);
  useEffect(() => onSnapshot(doc(db, 'orders', id), (d) => setO(d.exists() ? d.data() : null), () => setO(null)), [id]);

  if (o === undefined) return <Spinner />;
  if (!o) return <div className="wrap section"><Empty title="Order not found">It may not exist, or it belongs to another account. <Link to="/orders">My orders</Link></Empty></div>;
  const placed = Boolean(sp.get('placed'));
  const cancelled = o.orderStatus === 'Cancelled';
  const at = STATUS_STEPS.indexOf(o.orderStatus);
  const a = o.deliveryAddress || {};

  return (
    <div className="wrap section narrow">
      {placed && (
        <section className="success" role="status">
          <div className="tick" aria-hidden="true">✓</div>
          <h1>Order placed successfully!</h1>
          <p className="lead">Thank you{o.customer?.name ? `, ${o.customer.name.split(' ')[0]}` : ''}! Your order <b>{o.id}</b> has been received.</p>
          <p>Our team will connect with you shortly on <b>{o.customer?.phone}</b> to confirm your order and delivery time.
            Please keep <b>{money(o.total)}</b> ready to pay in cash on delivery.</p>
          <p className="muted">Your bill is shown below, and you can follow every step of your delivery on this page or any time under <Link to="/orders">My orders</Link>.</p>
          <div className="row gap center-row">
            <a href="#bill" className="btn ghost">View my bill</a>
            <a href="#tracking" className="btn">Track my order</a>
          </div>
        </section>
      )}

      <div className="row between wrapfx noprint"><h1 className="h1s">Order {o.id}</h1><StatusBadge status={STATUS_LABEL[o.orderStatus] || o.orderStatus} /></div>
      <p className="muted noprint">Placed {fmtDate(o.createdAt)}</p>

      <section className="card noprint" id="tracking"><h3>Order tracking</h3>
        {cancelled ? <Alert>This order was cancelled.</Alert> : (
          <ol className="track" aria-label="Order progress">
            {STATUS_STEPS.map((s, i) => <li key={s} className={i <= at ? 'done' : ''}><span>{i < at ? '✓' : i + 1}</span>{STATUS_LABEL[s]}</li>)}
          </ol>
        )}
        {!cancelled && at < 3 && <p className="muted center">This page updates automatically when our team moves your order to the next step.</p>}
      </section>

      <section className="card bill" id="bill">
        <div className="billhead">
          <div><Logo className="billlogo" /><small className="muted">Good Taste Travels</small></div>
          <div className="right"><h3>Bill / Invoice</h3><b>{o.id}</b><div className="muted">{fmtDate(o.createdAt)}</div></div>
        </div>
        <div className="billto">
          <div><small className="muted">Billed to</small><p><b>{o.customer?.name}</b><br />{o.customer?.phone}{o.customer?.email ? <><br />{o.customer.email}</> : null}</p></div>
          <div><small className="muted">Deliver to</small><p>{[a.line1, a.line2, a.landmark].filter(Boolean).join(', ')}<br />{a.city}, {a.state} {a.pincode}</p></div>
        </div>
        <div className="scroll-x">
          <table className="tbl"><thead><tr><th>Product</th><th>Pack</th><th>Items</th><th>Price / pack</th><th className="right">Total</th></tr></thead><tbody>
            {o.items.map((i) => <tr key={`${i.productId}|${i.weight || ''}`}><td>{i.name}{i.sku && <><br /><small className="muted">{i.sku}</small></>}</td><td>{packLabel(i)}</td><td>{i.qty}</td><td>{money(i.unitPrice)}</td><td className="right">{money(i.lineTotal)}</td></tr>)}
          </tbody></table>
        </div>
        <div className="totals">
          <div className="sumrow"><span>Subtotal</span><span>{money(o.subtotal)}</span></div>
          {o.discount > 0 && <div className="sumrow ok"><span>Discount</span><span>−{money(o.discount)}</span></div>}
          <div className="sumrow"><span>Delivery</span><span>{o.deliveryCharge ? money(o.deliveryCharge) : 'Free'}</span></div>
          <div className="sumrow tot"><span>Total to pay</span><span>{money(o.total)}</span></div>
        </div>
        <p className="muted">Payment: {o.paymentMethod === 'COD' ? 'Cash on Delivery' : o.paymentMethod} · Status: {o.paymentStatus}</p>
        {o.note && <p className="muted">Note: {o.note}</p>}
        <div className="noprint"><button className="btn ghost small" onClick={() => window.print()}>🖨 Print / save bill as PDF</button></div>
      </section>
    </div>
  );
}
