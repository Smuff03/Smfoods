import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { setWholesaleStatus, syncCatalogue } from '../api.js';
import { db } from '../firebase.js';
import { Alert, Empty, Spinner } from '../components/ui.jsx';
import { RETAILER_LABEL, errMsg, fmtDate } from '../utils.js';

/** Why is (or isn't) an admin product visible on the storefront? Admin-only reads, live. */
function CatalogueCheck() {
  const [admin, setAdmin] = useState(null);
  const [shop, setShop] = useState(null);
  const [e, setE] = useState('');
  useEffect(() => {
    const fail = (what) => (x) => { console.error(`[SMFoods] ${what} listener failed:`, x?.code, x?.message); setE(errMsg(x)); };
    const a = onSnapshot(query(collection(db, 'adminProducts'), limit(500)), (s) => setAdmin(s.docs.map((d) => ({ id: d.id, ...d.data() }))), fail('adminProducts'));
    const b = onSnapshot(query(collection(db, 'products'), limit(500)), (s) => setShop(Object.fromEntries(s.docs.map((d) => [d.id, d.data()]))), fail('products'));
    return () => { a(); b(); };
  }, []);
  const verdict = (p) => {
    const w = shop?.[p.id];
    if (!w) return ['err', 'Not synced yet — the sync function has not copied it (not deployed, or run “Sync all products now”)'];
    if (w.active !== true) return ['err', 'Hidden — inactive in the admin panel'];
    if (!(w.retailPrice > 0)) return ['warn', 'Visible — “Price on request” (no retail price set in admin)'];
    return ['ok', 'Visible on the storefront'];
  };
  return (
    <section className="card">
      <h3>Catalogue check</h3>
      <Alert>{e}</Alert>
      {!admin || !shop ? <Spinner /> : !admin.length ? <p className="muted">No products in the admin panel yet.</p> : (
        <div className="scroll"><table className="tbl"><thead><tr><th>Product</th><th>SKU</th><th>Retail price</th><th>Status</th></tr></thead><tbody>
          {admin.map((p) => { const [k, t] = verdict(p); return (
            <tr key={p.id}><td><b>{p.name}</b><br /><small className="muted">{p.category}</small></td><td>{p.sku}</td>
              <td>{Number.isFinite(p.retailPrice) ? p.retailPrice : <span className="err">not set</span>}</td>
              <td><span className={k === 'ok' ? '' : k === 'warn' ? 'muted' : 'err'}>{t}</span></td></tr>
          ); })}
        </tbody></table></div>
      )}
    </section>
  );
}

const ORDER = { pending: 0, approved: 1, suspended: 2, rejected: 3 };

/** Minimal admin tools that live outside the existing admin panel: retailer approvals + catalogue sync. */
export default function Admin() {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => onSnapshot(
    query(collection(db, 'users'), where('wholesaleStatus', 'in', Object.keys(ORDER)), limit(300)),
    (s) => setRows(s.docs.map((d) => ({ uid: d.id, ...d.data() })).sort((a, b) => ORDER[a.wholesaleStatus] - ORDER[b.wholesaleStatus])),
    (e) => { setErr(errMsg(e)); setRows([]); },
  ), []);

  const act = async (uid, status) => {
    setErr(''); setMsg(''); setBusy(uid);
    try { await setWholesaleStatus({ uid, status }); setMsg(`Retailer ${status}. They will see the change within moments.`); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const sync = async () => {
    setErr(''); setMsg(''); setBusy('sync');
    try { const r = await syncCatalogue(); setMsg(`Catalogue synced: ${r.synced} products copied from the admin panel.`); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const shown = rows?.filter((r) => filter === 'all' || r.wholesaleStatus === filter);

  return (
    <div className="wrap section">
      <h1 className="h1s">Admin tools</h1>
      <Alert>{err}</Alert><Alert kind="ok">{msg}</Alert>
      <section className="card">
        <div className="row between wrapfx"><div><h3>Catalogue sync</h3><p className="muted">Products sync automatically when you edit them in the admin panel. Run this once after the first deploy to copy everything that already exists.</p></div>
          <button className="btn" disabled={busy === 'sync'} onClick={sync}>{busy === 'sync' ? 'Syncing…' : 'Sync all products now'}</button></div>
      </section>
      <CatalogueCheck />
      <h2>Retailer applications</h2>
      <div className="pills">{['pending', 'approved', 'suspended', 'rejected', 'all'].map((s) => <button key={s} className={filter === s ? 'pill on' : 'pill'} onClick={() => setFilter(s)}>{s === 'all' ? 'All' : RETAILER_LABEL[s]}{rows ? ` (${s === 'all' ? rows.length : rows.filter((r) => r.wholesaleStatus === s).length})` : ''}</button>)}</div>
      {!shown ? <Spinner /> : !shown.length ? <Empty title="Nothing here">No retailers with this status.</Empty> : shown.map((r) => {
        const a = r.wholesaleApplication || {};
        return (
          <div className="card" key={r.uid}>
            <div className="row between wrapfx">
              <div><h3>{a.shopName}</h3><span className={`badge st-${r.wholesaleStatus}`}>{RETAILER_LABEL[r.wholesaleStatus]}</span></div>
              <div className="row gap">
                {r.wholesaleStatus !== 'approved' && <button className="btn small" disabled={busy === r.uid} onClick={() => act(r.uid, 'approved')}>Approve</button>}
                {r.wholesaleStatus === 'pending' && <button className="btn ghost small" disabled={busy === r.uid} onClick={() => act(r.uid, 'rejected')}>Reject</button>}
                {r.wholesaleStatus === 'approved' && <button className="btn ghost small" disabled={busy === r.uid} onClick={() => act(r.uid, 'suspended')}>Suspend</button>}
              </div>
            </div>
            <dl className="specs"><dt>Owner</dt><dd>{a.ownerName} · {a.phone}</dd><dt>Email</dt><dd>{r.email}</dd>{a.gstin && <><dt>GSTIN</dt><dd>{a.gstin}</dd></>}
              <dt>Address</dt><dd>{[a.address?.line1, a.address?.line2, a.address?.city, a.address?.state, a.address?.pincode].filter(Boolean).join(', ')}</dd>
              <dt>Applied</dt><dd>{fmtDate(a.submittedAt)}</dd></dl>
          </div>
        );
      })}
    </div>
  );
}
