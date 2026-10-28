import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { placeOrder } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useCart, useCartLines } from '../cart.jsx';
import { useCatalog } from '../catalog.jsx';
import { Alert, AddressFields, Empty, Field, Spinner, emptyAddress } from '../components/ui.jsx';
import { weightOf } from '../pricing.js';
import { PHONE_RE, PIN_RE, money } from '../utils.js';

const newId = () => (crypto?.randomUUID ? crypto.randomUUID() : `r${Date.now()}${Math.random().toString(36).slice(2)}`);

/** Scroll to element + flash red border to guide user */
function scrollToField(ref) {
  if (!ref?.current) return;
  ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  ref.current.classList.remove('field--shake');
  // Force reflow so re-adding the class restarts the animation
  void ref.current.offsetWidth; // eslint-disable-line no-void
  ref.current.classList.add('field--shake');
}

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
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const requestId = useRef(newId());

  // Refs for each compulsory field — used for scroll-to + shake
  const refs = {
    name: useRef(null),
    phone: useRef(null),
    line1: useRef(null),
    city: useRef(null),
    state: useRef(null),
    pincode: useRef(null),
    consent: useRef(null),
  };

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

  /** Run all validations, populate per-field errors, scroll to first invalid field. Returns true if valid. */
  const validate = () => {
    const fe = {};
    let firstRef = null;

    const fail = (key, msg) => {
      fe[key] = msg;
      if (!firstRef) firstRef = refs[key];
    };

    if (contact.name.trim().length < 2) fail('name', 'Enter your full name (at least 2 characters).');
    if (!PHONE_RE.test(contact.phone.trim())) fail('phone', 'Enter a valid 10-digit mobile number.');
    if (!addr.line1?.trim()) fail('line1', 'Enter your street / house address.');
    if (!addr.city?.trim()) fail('city', 'Enter the city name.');
    if (!addr.state?.trim()) fail('state', 'Select a state.');
    if (!PIN_RE.test(addr.pincode?.trim() || '')) fail('pincode', 'Enter a valid 6-digit PIN code.');
    if (!agree) fail('consent', 'You must tick this box to place your order.');

    setFieldErrors(fe);

    if (firstRef) {
      scrollToField(firstRef);
      return false;
    }
    return true;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (lock.current) return;
    setErr('');
    if (!validate()) return;
    if (issues.length) return setErr(issues[0]);

    lock.current = true;
    setBusy(true);
    try {
      const { label, id, ...clean } = addr; // eslint-disable-line no-unused-vars
      const r = await placeOrder({
        items: lines.map((l) => ({ productId: l.id, weight: l.weight, qty: l.qty })),
        address: clean,
        contact: { name: contact.name.trim(), phone: contact.phone.trim() },
        paymentMethod: 'COD',
        consent: agree,
        deliveryDate: deliveryDate || null,
        requestId: requestId.current,
        note: note.trim(),
      });

      if (save && pick === 'new') {
        try { await a.saveProfile({ addresses: [...saved, { ...clean, id: newId().slice(0, 8), label: clean.city }].slice(-10) }); } catch { /* non-critical */ }
      }
      clear();
      nav(`/orders/${r.orderId}?placed=1`, { replace: true });
    } catch (x) {
      setErr(x.message);
      lock.current = false;
      setBusy(false);
    }
  };

  const fe = fieldErrors;

  return (
    <form className="wrap section cartgrid" onSubmit={submit} noValidate>
      <div>
        <h1 className="h1s" style={{ marginBottom: '1.1rem' }}>Checkout</h1>

        {/* ── Section 1: Contact details ── */}
        <section className="card checkout-section">
          <div className="checkout-section-head">
            <span className="checkout-step-num">1</span>
            <h3>Your details</h3>
          </div>
          <div className="grid2">
            <Field label="Full name *" invalid={fe.name} fieldRef={refs.name}>
              <input
                value={contact.name}
                onChange={(e) => { setContact({ ...contact, name: e.target.value }); if (fe.name) setFieldErrors({ ...fe, name: '' }); }}
                autoComplete="name"
                placeholder="e.g. Ravi Kumar"
              />
            </Field>
            <Field label="Mobile number *" invalid={fe.phone} fieldRef={refs.phone} hint="Our team will call on this number">
              <input
                value={contact.phone}
                onChange={(e) => { setContact({ ...contact, phone: e.target.value }); if (fe.phone) setFieldErrors({ ...fe, phone: '' }); }}
                inputMode="tel"
                autoComplete="tel"
                placeholder="10-digit mobile"
              />
            </Field>
          </div>
        </section>

        {/* ── Section 2: Delivery address ── */}
        <section className="card checkout-section">
          <div className="checkout-section-head">
            <span className="checkout-step-num">2</span>
            <h3>Delivery address</h3>
          </div>
          {saved.length > 0 && (
            <div className="pills" style={{ marginBottom: '.8rem' }}>
              {saved.map((s) => (
                <button type="button" key={s.id} className={pick === s.id ? 'pill on' : 'pill'} onClick={() => choose(s.id)}>
                  {s.label || s.city}
                </button>
              ))}
              <button type="button" className={pick === 'new' ? 'pill on' : 'pill'} onClick={() => choose('new')}>+ New address</button>
            </div>
          )}
          <AddressFields
            v={addr}
            set={(v) => { setAddr(v); }}
            errors={fe}
            fieldRefs={refs}
          />
          {pick === 'new' && (
            <label className="check">
              <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
              Save this address to my profile
            </label>
          )}
        </section>

        {/* ── Section 3: Payment & extras ── */}
        <section className="card checkout-section">
          <div className="checkout-section-head">
            <span className="checkout-step-num">3</span>
            <h3>Payment</h3>
          </div>
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
          <Field label="Order note (optional)">
            <textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any delivery instructions?" />
          </Field>
        </section>

        {/* ── Section 4: Consent (compulsory) ── */}
        <section
          ref={refs.consent}
          className={`card consentbox checkout-section${fe.consent ? ' compulsory-alert' : ''}`}
        >
          <div className="checkout-section-head">
            <span className="checkout-step-num">4</span>
            <h3>Consent <span className="req-badge">Compulsory</span></h3>
          </div>
          <label className="check" htmlFor="checkout-consent">
            <input
              id="checkout-consent"
              type="checkbox"
              required
              aria-required="true"
              checked={agree}
              onChange={(e) => { setAgree(e.target.checked); if (e.target.checked) setFieldErrors({ ...fe, consent: '' }); }}
            />
            <span>
              I agree that Crunchzy may store and use my <b>name, mobile number and delivery address</b> to
              process, deliver and contact me about this order. See the{' '}
              <Link to="/privacy" target="_blank">Privacy &amp; Cookie Policy</Link>.
            </span>
          </label>
          {fe.consent && (
            <p className="consent-reminder" style={{ marginTop: '.5rem' }}>
              <small>⚠️ {fe.consent}</small>
            </p>
          )}
        </section>
      </div>

      {/* ── Right: Order summary ── */}
      <aside className="cart-summary-card">
        <h3 style={{ marginBottom: '1rem' }}>Order summary</h3>
        {lines.map((l) => (
          <div key={l.key} className="sumrow" style={{ fontSize: '.88rem' }}>
            <span className="muted" style={{ maxWidth: '60%' }}>
              {l.p?.name || 'Unavailable'}<br />
              <small>{weightOf(l.weight, l.p).label} × {l.qty}</small>
            </span>
            <span>{money(l.lineTotal || 0)}</span>
          </div>
        ))}
        <hr style={{ margin: '.8rem 0' }} />
        <div className="sumrow"><span>Subtotal</span><span>{money(subtotal)}</span></div>
        {deliveryDate && <div className="sumrow" style={{ fontSize: '.88rem' }}><span>Delivery date</span><span style={{ fontWeight: 600 }}>{deliveryDate}</span></div>}
        <div className="sumrow"><span>Delivery</span><span>{delivery ? money(delivery) : <span style={{ color: 'var(--ok)', fontWeight: 600 }}>Free</span>}</span></div>
        <div className="sumrow tot"><span>Total</span><span>{money(total)}</span></div>
        <small className="muted" style={{ display: 'block', marginTop: '.5rem', lineHeight: 1.5 }}>
          Pay on delivery. Final prices confirmed at order placement.
        </small>

        {err && <Alert>{err}</Alert>}
        {issues.map((i) => <Alert key={i}>{i}</Alert>)}

        <button
          className="btn block lg"
          style={{ marginTop: '1rem' }}
          disabled={busy || !codOn || issues.length > 0}
        >
          {busy ? 'Placing order…' : `Place order · ${money(total)}`}
        </button>

        <Link to="/cart" className="btn ghost block" style={{ marginTop: '.5rem', textAlign: 'center' }}>
          ← Back to cart
        </Link>
      </aside>
    </form>
  );
}
