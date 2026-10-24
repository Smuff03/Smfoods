import { useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { Alert, AddressFields, Field, Spinner, emptyAddress } from '../components/ui.jsx';
import { PHONE_RE, errMsg, validateAddress } from '../utils.js';

export default function Profile() {
  const a = useAuth();
  const [f, setF] = useState({ name: '', phone: '' });
  const [addr, setAddr] = useState(emptyAddress);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (a.profile) setF({ name: a.profile.name || '', phone: a.profile.phone || '' }); }, [a.profile?.name, a.profile?.phone]); // eslint-disable-line
  if (!a.profile) return <Spinner />;
  const saved = a.profile.addresses || [];

  const run = async (fn, ok) => { setErr(''); setMsg(''); setBusy(true); try { await fn(); setMsg(ok); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); } };
  const saveInfo = (e) => {
    e.preventDefault();
    if (f.name.trim().length < 2) return setErr('Enter your name.');
    if (f.phone.trim() && !PHONE_RE.test(f.phone.trim())) return setErr('Enter a valid 10-digit mobile number.');
    run(() => a.saveProfile({ name: f.name.trim(), phone: f.phone.trim() }), 'Profile saved.');
  };
  const addAddress = (e) => {
    e.preventDefault();
    const m = validateAddress(addr); if (m) return setErr(m);
    run(async () => { await a.saveProfile({ addresses: [...saved, { ...addr, id: Math.random().toString(36).slice(2, 10), label: addr.label || addr.city }].slice(-10) }); setAddr(emptyAddress); setAdding(false); }, 'Address saved.');
  };
  const del = (id) => run(() => a.saveProfile({ addresses: saved.filter((s) => s.id !== id) }), 'Address removed.');

  return (
    <div className="wrap section narrow">
      <h1 className="h1s">My profile</h1>
      <Alert>{err}</Alert><Alert kind="ok">{msg}</Alert>
      <form className="card" onSubmit={saveInfo} noValidate>
        <h3>Account</h3>
        <div className="grid2">
          <Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Mobile number"><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" /></Field>
        </div>
        <p className="muted">Email: {a.user.email}</p>
        <button className="btn" disabled={busy}>Save changes</button>
      </form>

      <section className="card"><div className="row between"><h3>Saved addresses</h3>{!adding && <button className="btn ghost small" onClick={() => setAdding(true)}>+ Add address</button>}</div>
        {!saved.length && !adding && <p className="muted">No saved addresses yet.</p>}
        {saved.map((s) => <div key={s.id} className="line"><div className="grow"><b>{s.label || s.city}</b><div className="muted">{[s.line1, s.line2, s.landmark, s.city, s.state, s.pincode].filter(Boolean).join(', ')}</div></div><button className="link" onClick={() => del(s.id)} disabled={busy}>Remove</button></div>)}
        {adding && <form onSubmit={addAddress} noValidate>
          <Field label="Label (e.g. Shop, Home)"><input value={addr.label} onChange={(e) => setAddr({ ...addr, label: e.target.value })} maxLength={30} /></Field>
          <AddressFields v={addr} set={setAddr} />
          <div className="row gap"><button className="btn" disabled={busy}>Save address</button><button type="button" className="btn ghost" onClick={() => setAdding(false)}>Cancel</button></div>
        </form>}
      </section>
    </div>
  );
}
