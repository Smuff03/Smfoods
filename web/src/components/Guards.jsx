import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Spinner } from './ui.jsx';

/** UI convenience only. Real enforcement is in Firestore rules and the Cloud Functions. */
export function RequireAuth({ children, retailer, admin, loginAs }) {
  const a = useAuth();
  const loc = useLocation();
  if (!a.ready) return <Spinner />;
  if (!a.user) return <Navigate to={retailer || loginAs === 'retailer' ? '/login/retailer' : '/login/customer'} state={{ from: loc.pathname + loc.search }} replace />;
  if (admin && !a.isAdmin) return <Navigate to="/" replace />;
  if (retailer && !a.isRetailer) return <Navigate to="/retailer" replace />;
  return children;
}
