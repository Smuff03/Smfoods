export const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const toDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);
export const fmtDate = (v) => {
  const d = toDate(v);
  return d && !isNaN(d) ? d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
};
export const LOW_STOCK = 25; // same threshold as the admin panel
export const STATUS_STEPS = ['Pending', 'Processing', 'Dispatched', 'Delivered'];
export const RETAILER_LABEL = { pending: 'Pending approval', approved: 'Approved', rejected: 'Rejected', suspended: 'Suspended' };
export const STATES = ['Andhra Pradesh', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'West Bengal', 'Other'];

export const PHONE_RE = /^(\+91[\s-]?)?[6-9]\d{9}$/;
export const PIN_RE = /^[1-9]\d{5}$/;
export const GST_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateAddress(a) {
  if (!a.line1?.trim()) return 'Enter address line 1';
  if (!a.city?.trim()) return 'Enter the city';
  if (!a.state?.trim()) return 'Select the state';
  if (!PIN_RE.test(a.pincode?.trim() || '')) return 'Enter a valid 6-digit PIN code';
  return '';
}

/** Turn Firebase auth / functions errors into messages a shopper can act on. */
export function errMsg(e) {
  const c = e?.code || '';
  const map = {
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/wrong-password': 'Incorrect email or password.',
    'auth/user-not-found': 'Incorrect email or password.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/email-already-in-use': 'An account with this email already exists. Try logging in.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/cancelled-popup-request': 'Google sign-in was cancelled.',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in popup. Allow popups and try again.',
    'auth/unauthorized-domain': 'This website domain is not authorised for sign-in yet. Add it in Firebase Authentication settings.',
    'auth/account-exists-with-different-credential': 'This email is registered with a different sign-in method.',
    'functions/unavailable': 'Cannot reach the server. Check your connection and try again.',
    'functions/unauthenticated': 'Your session has expired. Please log in again.',
    'permission-denied': 'You do not have permission to view this.',
  };
  if (map[c]) return map[c];
  if (c === 'functions/not-found') return 'The ordering service is not deployed yet. See the README.';
  if (c === 'functions/internal') return 'Something went wrong. Please try again.';
  return e?.message?.replace(/^Firebase: /, '') || 'Something went wrong. Please try again.';
}
