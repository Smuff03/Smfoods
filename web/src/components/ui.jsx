import { STATES } from '../utils.js';

export const Spinner = ({ label = 'Loading…' }) => <div className="center muted" role="status"><span className="spin" /> {label}</div>;
export const Alert = ({ kind = 'error', children }) => (children ? <div className={`alert ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div> : null);
export const Empty = ({ title, children }) => <div className="empty"><h3>{title}</h3><p className="muted">{children}</p></div>;

export function Field({ label, error, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && !error && <small className="muted">{hint}</small>}
      {error && <small className="err">{error}</small>}
    </label>
  );
}

export const emptyAddress = { label: '', line1: '', line2: '', landmark: '', city: '', state: '', pincode: '' };

export function AddressFields({ v, set }) {
  const f = (k) => ({ value: v[k] || '', onChange: (e) => set({ ...v, [k]: e.target.value }) });
  return (
    <div className="grid2">
      <div className="span2"><Field label="Address line 1 *"><input {...f('line1')} maxLength={200} autoComplete="address-line1" /></Field></div>
      <div className="span2"><Field label="Address line 2"><input {...f('line2')} maxLength={200} autoComplete="address-line2" /></Field></div>
      <Field label="Landmark"><input {...f('landmark')} maxLength={100} /></Field>
      <Field label="City *"><input {...f('city')} maxLength={80} autoComplete="address-level2" /></Field>
      <Field label="State *">
        <select {...f('state')}><option value="">Select state</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select>
      </Field>
      <Field label="PIN code *"><input {...f('pincode')} inputMode="numeric" maxLength={6} autoComplete="postal-code" /></Field>
    </div>
  );
}

export const StatusBadge = ({ status }) => <span className={`badge st-${String(status).toLowerCase()}`}>{status}</span>;
