import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useAuth } from '../auth.jsx';
import { db } from '../firebase.js';
import { Alert, Empty, Spinner, StatusBadge } from '../components/ui.jsx';
import { STATUS_LABEL, errMsg, fmtDate, money } from '../utils.js';

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => onSnapshot(
    query(collection(db, 'orders'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(50)),
    (s) => setOrders(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => { setErr(errMsg(e)); setOrders([]); },
  ), [user.uid]);

  return (
    <div className="wrap section narrow">
      <h1 className="h1s">My orders</h1>
      <Alert>{err}</Alert>
      {!orders ? <Spinner /> : !orders.length ? <Empty title="No orders yet"><Link to="/shop">Start shopping</Link></Empty> : orders.map((o) => (
        <Link to={`/orders/${o.id}`} key={o.id} className="card orow">
          <div><b>{o.id}</b><div className="muted">{fmtDate(o.createdAt)} · {o.items?.length || 0} item{o.items?.length === 1 ? '' : 's'}{o.deliveryDate ? ` · Delivery: ${o.deliveryDate}` : ''}</div><small className="more">Track order &amp; view bill →</small></div>
          <div className="right"><StatusBadge status={STATUS_LABEL[o.orderStatus] || o.orderStatus} /><div><b>{money(o.total)}</b></div></div>
        </Link>
      ))}
    </div>
  );
}
