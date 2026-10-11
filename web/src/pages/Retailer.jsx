import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { applyWholesale } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, AddressFields, Field, Spinner, emptyAddress } from '../components/ui.jsx';
import { GST_RE, PHONE_RE, RETAILER_LABEL, fmtDate, validateAddress } from '../utils.js';

export const emptyShop = { shopName: '', gstin: '', address: { ...emptyAddress } };

export function validateShop(s) {
  if (s.shopName.trim().length < 2) return 'Enter your shop / business name.';
  const g = s.gstin.trim().toUpperCase();
  if (g && !GST_RE.test(g)) return 'GSTIN looks invalid. Enter 15 characters like 27ABCDE1234F1Z5, or leave it blank.';
  return validateAddress(s.address);
}

export function ShopFields({ v, set }) {
  return (
    <>
      <div className="grid2">
        <Field label="Shop / business name *"><input value={v.shopName} onChange={(e) => set({ ...v, shopName: e.target.value })} maxLength={120} /></Field>
        <Field label="GSTIN" hint="Optional"><input value={v.gstin} onChange={(e) => set({ ...v, gstin: e.target.value.toUpperCase() })} maxLength={15} /></Field>
      </div>
      <AddressFields v={v.address} set={(address) => set({ ...v, address })} />
    </>
  );
}

export default function Retailer() {
  const a = useAuth();
  const loc = useLocation();
  const app = a.profile?.wholesaleApplication;
  const status = a.wholesaleStatus;
  const [shop, setShop] = useState(emptyShop);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    if (app) { setShop({ shopName: app.shopName, gstin: app.gstin || '', address: { ...emptyAddress, ...app.address } }); setPhone(app.phone); }
    else if (a.profile?.phone) setPhone(a.profile.phone);
  }, [app?.shopName, a.profile?.phone]); // eslint-disable-line

  if (!a.profile) return <Spinner />;

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setOk('');
    if (!PHONE_RE.test(phone.trim())) return setErr('Enter a valid 10-digit mobile number.');
    const m = validateShop(shop); if (m) return setErr(m);
    setBusy(true);
    try { await applyWholesale({ ...shop, ownerName: a.profile.name || a.user.displayName || 'Owner', phone: phone.trim() }); setOk('Submitted. We will review your shop and notify you here.'); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };

  const recheck = async () => { setBusy(true); try { await a.refreshClaims(); } finally { setBusy(false); } };

  return (
    <div className="wrap section narrow">
      <h1 className="h1s">Retailer account</h1>
      <Alert kind="info">{loc.state?.notice}</Alert>
      {status && <div className={`card status s-${status}`}>
        <div className="row between wrapfx"><div><span className="muted">Approval status</span><h2>{RETAILER_LABEL[status]}</h2></div>
          {status === 'pending' && <button className="btn ghost small" onClick={recheck} disabled={busy}>Check again</button>}</div>
        {status === 'pending' && <p>Your shop details are with the SMFoods team. Wholesale prices and bulk ordering unlock as soon as you are approved. You can keep shopping at regular prices meanwhile.</p>}
        {status === 'approved' && <p>Your shop is approved. You now see wholesale prices, minimum order quantities and bulk discounts. <Link to="/bulk">Place a bulk order →</Link></p>}
        {status === 'rejected' && <p>Your application was not approved. Update your details below and resubmit, or contact SMFoods.</p>}
        {status === 'suspended' && <p>Your retailer access is suspended. Please contact SMFoods.</p>}
        {a.profile.wholesaleReviewedAt && <small className="muted">Last reviewed {fmtDate(a.profile.wholesaleReviewedAt)}</small>}
      </div>}

      {app && <div className="card"><h3>Shop profile</h3>
        <dl className="specs"><dt>Shop</dt><dd>{app.shopName}</dd><dt>Owner</dt><dd>{app.ownerName}</dd><dt>Phone</dt><dd>{app.phone}</dd>
          {app.gstin && <><dt>GSTIN</dt><dd>{app.gstin}</dd></>}<dt>Address</dt><dd>{[app.address?.line1, app.address?.line2, app.address?.city, app.address?.state, app.address?.pincode].filter(Boolean).join(', ')}</dd></dl>
      </div>}

      {(!status || status === 'pending' || status === 'rejected') && (
        <form className="card" onSubmit={submit} noValidate>
          <h3>{status ? 'Update shop details' : 'Apply for a retailer account'}</h3>
          {!status && <p className="muted">Tell us about your shop. An admin will review it before wholesale pricing is enabled.</p>}
          <Alert>{err}</Alert><Alert kind="ok">{ok}</Alert>
          <Field label="Mobile number *"><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></Field>
          <ShopFields v={shop} set={setShop} />
          <button className="btn" disabled={busy}>{busy ? 'Submitting…' : status ? 'Resubmit' : 'Submit for approval'}</button>
        </form>
      )}
    </div>
  );
}
