import { Link, useNavigate } from 'react-router-dom';
import { useCart, useCartLines } from '../cart.jsx';
import { Thumb } from '../components/ProductCard.jsx';
import { Alert, Empty, Spinner, Stepper } from '../components/ui.jsx';
import { weightOf } from '../pricing.js';
import { money } from '../utils.js';

export default function Cart() {
  const { setQty, remove, clear } = useCart();
  const { lines, subtotal, net, issues, loading } = useCartLines();
  const nav = useNavigate();
  if (loading && lines.length) return <Spinner />;
  if (!lines.length) return <div className="wrap section"><Empty title="Your cart is empty"><Link to="/shop">Browse products</Link></Empty></div>;

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
              <div><span className="wtag">{weightOf(l.weight).label}</span> <span className="muted">+{l.qty} item{l.qty > 1 ? 's' : ''} · {money(l.pr.unit)} each</span></div>
              {l.problem && <small className="err">{l.problem}</small>}
            </div>
            <Stepper value={l.qty} onChange={(n) => setQty(l.id, l.weight, n)} label="Number of packs" />
            <b className="ltotal">{money(l.lineTotal)}</b>
            <button className="link" onClick={() => remove(l.id, l.weight)} aria-label="Remove">✕</button>
          </div>
        ))}
      </div>
      <aside className="card summary">
        <h3>Summary</h3>
        <div className="sumrow"><span>Subtotal</span><span>{money(subtotal)}</span></div>
        <div className="sumrow tot"><span>Total</span><span>{money(net)}</span></div>
        <small className="muted">Delivery charges (if any) are added at checkout. Pay by Cash on Delivery.</small>
        {issues.map((i) => <Alert key={i}>{i}</Alert>)}
        <button className="btn block" disabled={issues.length > 0} onClick={() => nav('/checkout')}>Proceed to checkout</button>
      </aside>
    </div>
  );
}
