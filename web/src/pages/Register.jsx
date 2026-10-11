import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applyWholesale } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Field } from '../components/ui.jsx';
import { EMAIL_RE, PHONE_RE, errMsg } from '../utils.js';
import { GoogleButton } from './Login.jsx';
import { ShopFields, emptyShop, validateShop } from './Retailer.jsx';

export default function Register({ type }) {
  const a = useAuth();
  const nav = useNavigate();
  const retailer = type === 'retailer';
  const [f, setF] = useState({ name: '', phone: '', email: '', password: '', confirm: '' });
  const [shop, setShop] = useState(emptyShop);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const dest = retailer ? '/retailer' : '/';
  const [done, setDone] = useState(false);

  useEffect(() => { if (a.user && !busy && !done) nav(dest, { replace: true }); }, [a.user]); // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    const name = f.name.trim(), phone = f.phone.trim(), email = f.email.trim();
    if (name.length < 2) return setErr('Enter your full name.');
    if (!PHONE_RE.test(phone)) return setErr('Enter a valid 10-digit mobile number.');
    if (!EMAIL_RE.test(email)) return setErr('Enter a valid email address.');
    if (f.password.length < 6) return setErr('Password must be at least 6 characters.');
    if (f.password !== f.confirm) return setErr('Passwords do not match.');
    if (retailer) { const m = validateShop(shop); if (m) return setErr(m); }
    setBusy(true);
    try {
      await a.register({ email, password: f.password, name, phone });
      if (retailer) {
        try { await applyWholesale({ ...shop, ownerName: name, phone }); }
        catch (x) { setDone(true); nav('/retailer', { replace: true, state: { notice: `Your account was created, but the shop details could not be submitted: ${x.message} Please submit them below.` } }); return; }
      }
      setDone(true); nav(dest, { replace: true });
    } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  const google = async () => { setErr(''); setBusy(true); try { await a.google(); setDone(true); nav(dest, { replace: true }); } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); } };

  return (
    <div className="authwrap"><div className={`card authcard ${retailer ? 'wide' : ''}`}>
      <span className={`chip ${retailer ? 'warn' : 'ok'}`}>{retailer ? 'Retailer account' : 'Customer account'}</span>
      <h1>{retailer ? 'Register your shop' : 'Create your account'}</h1>
      {retailer && <p className="muted">Retailer accounts are reviewed by SMFoods. Until approval you can shop at normal prices; wholesale pricing unlocks once approved.</p>}
      <Alert>{err}</Alert>
      <form onSubmit={submit} noValidate>
        <div className="grid2">
          <Field label={retailer ? 'Owner name *' : 'Full name *'}><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></Field>
          <Field label="Mobile number *"><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" autoComplete="tel" /></Field>
          <div className="span2"><Field label="Email *"><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></Field></div>
          <Field label="Password *" hint="At least 6 characters"><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" /></Field>
          <Field label="Confirm password *"><input type="password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} autoComplete="new-password" /></Field>
        </div>
        {retailer && <><h3>Shop / business details</h3><ShopFields v={shop} set={setShop} /></>}
        <button className="btn block" disabled={busy}>{busy ? 'Creating account…' : retailer ? 'Register & submit for approval' : 'Create account'}</button>
      </form>
      <div className="or"><span>or</span></div>
      <GoogleButton disabled={busy} onClick={google} />
      {retailer && <p className="muted center"><small>With Google you will be asked for your shop details next.</small></p>}
      <p className="center muted">Already registered? <Link to={`/login/${type}`}>Log in</Link></p>
    </div></div>
  );
}
