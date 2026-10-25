import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { placeOrder } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useCart, useCartLines } from '../cart.jsx';
import { useCatalog } from '../catalog.jsx';
import { Alert, AddressFields, Empty, Field, Spinner, emptyAddress } from '../components/ui.jsx';
import { weightOf } from '../pricing.js';
import { PHONE_RE, money, validateAddress } from '../utils.js';

const newId = () => (crypto?.randomUUID ? crypto.randomUUID() : `r${Date.now()}${Math.random().toString(36).slice(2)}`);

export default function Checkout() {
  const a = useAuth();
  const { clear, deliveryDate, setDeliveryDate } = useCart();
  const { settings } = useCatalog();
  const { lines, subtotal, net, issues, loading } = useCartLines();
  const nav = useNavigate();
  const saved = a.profile?.addresses || [];
  const [contact, setContact] = useState({ name: '', phone: '' });
  const [pick, setPick] = useState('new');
  const [addr, setAddr] = useState(emptyAddress);
  const [save, setSave] = useState(true);
  const [note, setNote] = useState('');
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const requestId = useRef(newId()); // same id on retries => the server never creates the order twice

  useEffect(() => {
    if (!a.profile) return;
    setContact((c) => ({ name: c.name || a.profile.name || '', phone: c.phone || a.profile.phone || '' }));
    if (a.profile.addresses?.length) { setPick(a.profile.addresses[0].id); setAddr(a.profile.addresses[0]); }
  }, [a.profile?.name]); // eslint-disable-line

  if (loading) return <Spinner />;
  if (!lines.length) return <div className="wrap section"><Empty title="Your cart is empty"><Link to="/shop">Browse products</Link></Empty></div>;

  const codOn = settings.codEnabled !== false;
  const charge = Number.isFinite(settings.deliveryCharge) ? settings.deliveryCharge : 0;
  const delivery = Number.isFinite(settings.freeDeliveryAbove) && net >= settings.freeDeliveryAbove ? 0 : charge;
  const total = net + delivery;

  const choose = (id) => { setPick(id); setAddr(id === 'new' ? emptyAddress : saved.find((s) => s.id === id) || emptyAddress); };

  const submit = async (e) => {
    e.preventDefault();
    if (lock.current) return;
    setErr('');
    if (contact.name.trim().length < 2) return setErr('Enter your name.');
    if (!PHONE_RE.test(contact.phone.trim())) return setErr('Enter a valid 10-digit mobile number.');
    const m = validateAddress(addr); if (m) return setErr(m);
    if (!agree) return setErr('Please tick the consent box to proceed. It is compulsory to deliver your order.');
    if (issues.length) return setErr(issues[0]);
    lock.current = true; setBusy(true);
    try {
      const { label, id, ...clean } = addr; // eslint-disable-line no-unused-vars
      const r = await placeOrder({
        items: lines.map((l) => ({ productId: l.id, weight: l.weight, qty: l.qty })),
        address: clean, contact: { name: contact.name.trim(), phone: contact.phone.trim() },
        paymentMethod: 'COD', consent: agree, deliveryDate: deliveryDate || null, requestId: requestId.current, note: note.trim(),
      });

      if (save && pick === 'new') {
        try { await a.saveProfile({ addresses: [...saved, { ...clean, id: newId().slice(0, 8), label: clean.city }].slice(-10) }); } catch { /* non-critical */ }
      }
      clear();
      nav(`/orders/${r.orderId}?placed=1`, { replace: true });
    } catch (x) { setErr(x.message); lock.current = false; setBusy(false); }
  };

  return (
    <form className="wrap section cartgrid" onSubmit={submit} noValidate>
      <div>
        <h1 className="h1s">Checkout</h1>
        <section className="card"><h3>1 · Your details</h3>
          <div className="grid2">
            <Field label="Name *"><input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} autoComplete="name" /></Field>
            <Field label="Mobile number *" hint="Our team will call you on this number"><input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} inputMode="tel" autoComplete="tel" placeholder="10-digit mobile" /></Field>
          </div>
        </section>
        <section className="card"><h3>2 · Delivery address</h3>
          {saved.length > 0 && <div className="pills">{saved.map((s) => <button type="button" key={s.id} className={pick === s.id ? 'pill on' : 'pill'} onClick={() => choose(s.id)}>{s.label || s.city}</button>)}
            <button type="button" className={pick === 'new' ? 'pill on' : 'pill'} onClick={() => choose('new')}>+ New address</button></div>}
          <AddressFields v={addr} set={(v) => { setAddr(v); }} />
          {pick === 'new' && <label className="check"><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> Save this address to my profile</label>}
        </section>
        <section className="card"><h3>3 · Payment</h3>
          {codOn ? (
            <label className="paycard on">
              <input type="radio" name="pay" checked readOnly />
              <span><b>💵 Cash on Delivery</b><small className="muted">Pay in cash when your order arrives</small></span>
            </label>
          ) : <Alert>Cash on Delivery is currently unavailable. Please try again later.</Alert>}
          <Field label="Preferred delivery date (optional)" hint="Selected in cart; can be adjusted here">
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </Field>
          <Field label="Order note (optional)"><textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any delivery instructions?" /></Field>
        </section>
        <section className={`card consentbox ${err && !agree ? 'compulsory-alert' : ''}`}>
          <label className="check" htmlFor="checkout-consent">
            <input
              id="checkout-consent"
              type="checkbox"
              required
              aria-required="true"
              checked={agree}
              onChange={(e) => { setAgree(e.target.checked); if (e.target.checked && err.includes('consent')) setErr(''); }}
            />
            <span>I agree that Crunchzy may store and use my <b>name, mobile number and delivery address</b> to process, deliver and contact me about this order. See the <Link to="/privacy" target="_blank">Privacy &amp; Cookie Policy</Link>. <span className="req-badge">Compulsory</span></span>
          </label>
        </section>
      </div>
      <aside className="card summary">
        <h3>Order summary</h3>
        {lines.map((l) => <div key={l.key} className="sumrow"><span>{l.p?.name || 'Unavailable item'}<br /><small className="muted">{weightOf(l.weight, l.p).label}, +{l.qty} item{l.qty > 1 ? 's' : ''}</small></span><span>{money(l.lineTotal || 0)}</span></div>)}
        <hr />
        <div className="sumrow"><span>Subtotal</span><span>{money(subtotal)}</span></div>
        {deliveryDate && <div className="sumrow"><span>Delivery date</span><span style={{ fontWeight: 600 }}>{deliveryDate}</span></div>}
        <div className="sumrow"><span>Delivery</span><span>{delivery ? money(delivery) : 'Free'}</span></div>
        <div className="sumrow tot"><span>Total (pay on delivery)</span><span>{money(total)}</span></div>

        <small className="muted">Final prices and stock are confirmed by our server when you place the order.</small>
        <Alert>{err}</Alert>
        {issues.map((i) => <Alert key={i}>{i}</Alert>)}
        <button className="btn block lg" disabled={busy || !codOn || issues.length > 0 || !agree} title={!agree ? 'Please tick the compulsory consent box to place your order' : ''}>{busy ? 'Placing order…' : `Place order · ${money(total)}`}</button>
        {!agree && <p className="consent-reminder"><small>⚠️ Please tick the compulsory consent box above to enable placing your order.</small></p>}
        <Link to="/cart" className="center more">← Back to cart</Link>
      </aside>
    </form>
  );
}
