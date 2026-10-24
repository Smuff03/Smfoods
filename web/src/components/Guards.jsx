import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Spinner } from './ui.jsx';

/** UI convenience only. Real enforcement is in Firestore rules and the Cloud Functions. */
export function RequireAuth({ children }) {
  const a = useAuth();
  const loc = useLocation();
  if (!a.ready) return <Spinner />;
  if (!a.user) return <Navigate to="/login" state={{ from: loc.pathname + loc.search }} replace />;
  return children;
}
