import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Alert, Field } from '../components/ui.jsx';
import { EMAIL_RE, errMsg } from '../utils.js';

export const GoogleButton = ({ onClick, disabled }) => (
  <button type="button" className="btn ghost block gbtn" onClick={onClick} disabled={disabled}>
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" /><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" /></svg>
    Continue with Google
  </button>
);

export const AppleButton = ({ onClick, disabled }) => (
  <button type="button" className="btn block abtn" onClick={onClick} disabled={disabled}>
    <svg width="18" height="18" viewBox="0 0 384 512" aria-hidden="true" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" /></svg>
    Continue with Apple
  </button>
);

export const SocialDivider = () => <div className="or"><span>or</span></div>;

export default function Login() {
  const a = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const dest = loc.state?.from || '/';

  useEffect(() => { if (a.user) nav(dest, { replace: true }); }, [a.user]); // eslint-disable-line

  const run = async (fn) => { setErr(''); setBusy(true); try { await fn(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); } };
  const submit = (e) => {
    e.preventDefault();
    if (!EMAIL_RE.test(f.email.trim())) return setErr('Enter a valid email address.');
    if (!f.password) return setErr('Enter your password.');
    run(() => a.login(f.email.trim(), f.password));
  };

  return (
    <div className="authwrap">
      <div className="card authcard">
        <h1>Welcome back</h1>
        <p className="muted">Log in to track your orders and check out faster.</p>
        <Alert>{err}</Alert>
        <div className="socials">
          <AppleButton disabled={busy} onClick={() => run(a.apple)} />
          <GoogleButton disabled={busy} onClick={() => run(a.google)} />
        </div>
        <SocialDivider />
        <form onSubmit={submit} noValidate>
          <Field label="Email"><input type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Password"><input type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <div className="right"><Link to="/reset" className="more">Forgot password?</Link></div>
          <button className="btn block" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button>
        </form>
        <p className="center muted">New here? <Link to="/register">Create an account</Link></p>
        <p className="center muted"><small>By continuing you agree to our <Link to="/privacy">Privacy &amp; Cookie Policy</Link>.</small></p>
      </div>
    </div>
  );
}
