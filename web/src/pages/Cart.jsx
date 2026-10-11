import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useCart, useCartLines } from '../cart.jsx';
import { Thumb } from '../components/ProductCard.jsx';
import { Alert, Empty, Spinner } from '../components/ui.jsx';
import { money } from '../utils.js';

export default function Cart() {
  const { setQty, remove, clear } = useCart();
  const { lines, subtotal, saving, net, issues, loading } = useCartLines();
  const { isRetailer } = useAuth();
  const nav = useNavigate();
  if (loading && lines.length) return <Spinner />;
  if (!lines.length) return <div className="wrap section"><Empty title="Your cart is empty"><Link to="/shop">Browse products</Link></Empty></div>;

  return (
    <div className="wrap section cartgrid">
      <div>
        <div className="row between"><h1 className="h1s">Your cart</h1><button className="link" onClick={clear}>Clear cart</button></div>
        {lines.map((l) => l.missing ? (
          <div key={l.id} className="line"><span className="muted">Item no longer available</span><button className="link" onClick={() => remove(l.id)}>Remove</button></div>
        ) : (
          <div key={l.id} className="line">
            <Thumb p={l.p} />
            <div className="grow">
              <Link to={`/product/${l.id}`} className="pname">{l.p.name}</Link>
              <div className="muted">{money(l.pr.unit)} each{isRetailer && l.pr.moq > 1 ? ` · min ${l.pr.moq}` : ''}</div>
              {l.problem && <small className="err">{l.problem}</small>}
            </div>
            <div className="qty">
              <button onClick={() => setQty(l.id, l.qty - 1)} aria-label="Decrease">−</button>
              <input type="number" min={1} value={l.qty} onChange={(e) => setQty(l.id, Number(e.target.value))} aria-label="Quantity" />
              <button onClick={() => setQty(l.id, l.qty + 1)} aria-label="Increase">+</button>
            </div>
            <b className="ltotal">{money(l.lineTotal)}</b>
            <button className="link" onClick={() => remove(l.id)} aria-label="Remove">✕</button>
          </div>
        ))}
      </div>
      <aside className="card summary">
        <h3>Summary</h3>
        <div className="sumrow"><span>Subtotal</span><span>{money(subtotal)}</span></div>
        {saving > 0 && <div className="sumrow ok"><span>Bulk discount</span><span>−{money(saving)}</span></div>}
        <div className="sumrow tot"><span>Total</span><span>{money(net)}</span></div>
        <small className="muted">Delivery charges (if any) are added at checkout.</small>
        {issues.map((i) => <Alert key={i}>{i}</Alert>)}
        <button className="btn block" disabled={issues.length > 0} onClick={() => nav('/checkout')}>Proceed to checkout</button>
      </aside>
    </div>
  );
}
