import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { Alert, Empty, Spinner, StatusBadge } from '../components/ui.jsx';
import { STATUS_STEPS, fmtDate, money } from '../utils.js';

export default function OrderDetail() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const [o, setO] = useState(undefined);
  useEffect(() => onSnapshot(doc(db, 'orders', id), (d) => setO(d.exists() ? d.data() : null), () => setO(null)), [id]);

  if (o === undefined) return <Spinner />;
  if (!o) return <div className="wrap section"><Empty title="Order not found">It may not exist, or it belongs to another account. <Link to="/orders">My orders</Link></Empty></div>;
  const cancelled = o.orderStatus === 'Cancelled';
  const at = STATUS_STEPS.indexOf(o.orderStatus);
  const a = o.deliveryAddress || {};

  return (
    <div className="wrap section narrow">
      {sp.get('placed') && <Alert kind="ok"><b>Thank you! Your order {o.id} has been placed.</b> Pay {money(o.total)} in cash on delivery. We will update the status below as it progresses.</Alert>}
      <div className="row between wrapfx"><h1 className="h1s">Order {o.id}</h1><StatusBadge status={o.orderStatus} /></div>
      <p className="muted">Placed {fmtDate(o.createdAt)} · {o.accountType === 'Wholesale' ? 'Retailer order' : 'Customer order'}</p>

      {cancelled ? <Alert>This order was cancelled.</Alert> : (
        <ol className="track" aria-label="Order progress">
          {STATUS_STEPS.map((s, i) => <li key={s} className={i <= at ? 'done' : ''}><span>{i < at ? '✓' : i + 1}</span>{s}</li>)}
        </ol>
      )}

      <section className="card"><h3>Items</h3>
        <table className="tbl"><thead><tr><th>Product</th><th>Qty</th><th>Price</th><th className="right">Total</th></tr></thead><tbody>
          {o.items.map((i) => <tr key={i.productId}><td>{i.name}<br /><small className="muted">{i.sku}</small></td><td>{i.qty}</td><td>{money(i.unitPrice)}</td><td className="right">{money(i.lineTotal)}</td></tr>)}
        </tbody></table>
        <div className="totals">
          <div className="sumrow"><span>Subtotal</span><span>{money(o.subtotal)}</span></div>
          {o.discount > 0 && <div className="sumrow ok"><span>Discount</span><span>−{money(o.discount)}</span></div>}
          <div className="sumrow"><span>Delivery</span><span>{o.deliveryCharge ? money(o.deliveryCharge) : 'Free'}</span></div>
          <div className="sumrow tot"><span>Total</span><span>{money(o.total)}</span></div>
        </div>
      </section>

      <div className="grid2">
        <section className="card"><h3>Delivery to</h3>
          <p>{o.shop?.name && <b>{o.shop.name}<br /></b>}{o.customer?.name}<br />{o.customer?.phone}<br />
            {[a.line1, a.line2, a.landmark].filter(Boolean).join(', ')}<br />{a.city}, {a.state} {a.pincode}</p></section>
        <section className="card"><h3>Payment</h3>
          <p>{o.paymentMethod === 'COD' ? 'Cash on Delivery' : o.paymentMethod}<br /><span className="muted">Status: {o.paymentStatus}</span></p>
          {o.note && <p className="muted">Note: {o.note}</p>}</section>
      </div>
    </div>
  );
}
