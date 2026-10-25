import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Alert, Field } from '../components/ui.jsx';
import { EMAIL_RE, PHONE_RE, errMsg } from '../utils.js';
import { AppleButton, GoogleButton, SocialDivider } from './Login.jsx';

export default function Register() {
  const a = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', phone: '', email: '', password: '', confirm: '' });
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (a.user && !busy) nav('/', { replace: true }); }, [a.user]); // eslint-disable-line

  const run = async (fn) => { setErr(''); setBusy(true); try { await fn(); nav('/', { replace: true }); } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); } };

  const submit = (e) => {
    e.preventDefault(); setErr('');
    const name = f.name.trim(), phone = f.phone.trim(), email = f.email.trim();
    if (name.length < 2) return setErr('Enter your full name.');
    if (!PHONE_RE.test(phone)) return setErr('Enter a valid 10-digit mobile number.');
    if (!EMAIL_RE.test(email)) return setErr('Enter a valid email address.');
    if (f.password.length < 6) return setErr('Password must be at least 6 characters.');
    if (f.password !== f.confirm) return setErr('Passwords do not match.');
    if (!agree) return setErr('Please agree to the Privacy & Cookie Policy to create your account.');
    run(() => a.register({ email, password: f.password, name, phone }));
  };

  return (
    <div className="authwrap"><div className="card authcard">
      <h1>Create your account</h1>
      <p className="muted">Save your details once and check out in seconds.</p>
      <Alert>{err}</Alert>
      <div className="socials">
        <AppleButton disabled={busy} onClick={() => run(a.apple)} />
        <GoogleButton disabled={busy} onClick={() => run(a.google)} />
      </div>
      <SocialDivider />
      <form onSubmit={submit} noValidate>
        <div className="grid2">
          <Field label="Full name *"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></Field>
          <Field label="Mobile number *"><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" autoComplete="tel" /></Field>
          <div className="span2"><Field label="Email *"><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></Field></div>
          <Field label="Password *" hint="At least 6 characters"><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" /></Field>
          <Field label="Confirm password *"><input type="password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} autoComplete="new-password" /></Field>
        </div>
        <label className="check" htmlFor="register-consent">
          <input
            id="register-consent"
            type="checkbox"
            required
            aria-required="true"
            checked={agree}
            onChange={(e) => { setAgree(e.target.checked); if (e.target.checked && err.includes('Policy')) setErr(''); }}
          />
          <span>I agree that Crunchzy may store my name, mobile number and email as described in the <Link to="/privacy" target="_blank">Privacy &amp; Cookie Policy</Link>. <span className="req-badge">Compulsory</span></span>
        </label>
        <button className="btn block" disabled={busy || !agree} title={!agree ? 'Please tick the compulsory consent box to create your account' : ''}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="center muted">Already registered? <Link to="/login">Log in</Link></p>
    </div></div>
  );
}
