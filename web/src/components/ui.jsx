import { Link } from 'react-router-dom';
import { STATES } from '../utils.js';

export const Spinner = ({ label = 'Loading…' }) => <div className="center muted" role="status"><span className="spin" /> {label}</div>;
export const Alert = ({ kind = 'error', children }) => (children ? <div className={`alert ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div> : null);
export const Empty = ({ title, children }) => <div className="empty"><h3>{title}</h3><p className="muted">{children}</p></div>;

/** The Crunchzy logo (web/public/crunchzy-wordmark.svg). */
export const Logo = ({ className = '', onClick }) => (
  <Link to="/" className={`logo ${className}`} onClick={onClick} aria-label="Crunchzy home">
    <img src="/crunchzy-wordmark.svg" alt="Crunchzy – Good Taste Travels" width="260" height="101" />
  </Link>
);

/**
 * Form field wrapper.
 * Pass `invalid` (string) to highlight the field in red with an error message.
 * Pass `fieldRef` to enable scroll-to + shake behaviour from the parent.
 */
export function Field({ label, error, children, hint, invalid, fieldRef }) {
  const hasError = invalid || error;
  return (
    <label className={`field${hasError ? ' field--invalid' : ''}`} ref={fieldRef}>
      <span>{label}</span>
      {children}
      {hint && !hasError && <small className="muted">{hint}</small>}
      {hasError && <small className="err field-err"><span aria-hidden="true">⚠</span> {invalid || error}</small>}
    </label>
  );
}

/** − 1 + stepper */
export function Stepper({ value, onChange, min = 1, max = 999, label = 'Quantity' }) {
  const set = (n) => onChange(Math.min(max, Math.max(min, Math.floor(n) || min)));
  return (
    <div className="qty">
      <button type="button" onClick={() => set(value - 1)} disabled={value <= min} aria-label={`Decrease ${label.toLowerCase()}`}>−</button>
      <input type="number" min={min} max={max} value={value} onChange={(e) => set(Number(e.target.value))} aria-label={label} />
      <button type="button" onClick={() => set(value + 1)} disabled={value >= max} aria-label={`Increase ${label.toLowerCase()}`}>+</button>
    </div>
  );
}

export const emptyAddress = { label: '', line1: '', line2: '', landmark: '', city: '', state: '', pincode: '' };

export function AddressFields({ v, set, errors = {}, fieldRefs = {} }) {
  const f = (k) => ({ value: v[k] || '', onChange: (e) => set({ ...v, [k]: e.target.value }) });
  return (
    <div className="grid2">
      <div className="span2"><Field label="Address line 1 *" invalid={errors.line1} fieldRef={fieldRefs.line1}><input {...f('line1')} maxLength={200} autoComplete="address-line1" placeholder="House / flat no., building, street" /></Field></div>
      <div className="span2"><Field label="Address line 2" invalid={errors.line2}><input {...f('line2')} maxLength={200} autoComplete="address-line2" placeholder="Area, locality" /></Field></div>
      <Field label="Landmark" invalid={errors.landmark}><input {...f('landmark')} maxLength={100} /></Field>
      <Field label="City *" invalid={errors.city} fieldRef={fieldRefs.city}><input {...f('city')} maxLength={80} autoComplete="address-level2" /></Field>
      <Field label="State *" invalid={errors.state} fieldRef={fieldRefs.state}>
        <select {...f('state')}><option value="">Select state</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select>
      </Field>
      <Field label="PIN code *" invalid={errors.pincode} fieldRef={fieldRefs.pincode}><input {...f('pincode')} inputMode="numeric" maxLength={6} autoComplete="postal-code" /></Field>
    </div>
  );
}

export const StatusBadge = ({ status }) => <span className={`badge st-${String(status).toLowerCase()}`}>{status}</span>;
