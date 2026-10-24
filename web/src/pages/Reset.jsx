import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Alert, Field } from '../components/ui.jsx';
import { EMAIL_RE, errMsg } from '../utils.js';

export default function Reset() {
  const { reset } = useAuth();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setMsg('');
    if (!EMAIL_RE.test(email.trim())) return setErr('Enter a valid email address.');
    setBusy(true);
    try { await reset(email.trim()); setMsg('If an account exists for this email, a reset link is on its way.'); }
    catch (x) { setErr(x?.code === 'auth/user-not-found' ? 'If an account exists for this email, a reset link is on its way.' : errMsg(x)); }
    finally { setBusy(false); }
  };
  return (
    <div className="authwrap"><div className="card authcard">
      <h1>Reset password</h1>
      <p className="muted">Enter your email and we will send you a reset link.</p>
      <Alert>{err}</Alert><Alert kind="ok">{msg}</Alert>
      <form onSubmit={submit} noValidate>
        <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
        <button className="btn block" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
      </form>
      <p className="center"><Link to="/login">Back to login</Link></p>
    </div></div>
  );
}
