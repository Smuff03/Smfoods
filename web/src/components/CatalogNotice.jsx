import { useCatalog } from '../catalog.jsx';
import { Alert, Empty } from './ui.jsx';

/** Error / offline / slow-connection banner for the live catalogue. Renders nothing when all is well. */
export function CatalogNotice() {
  const { status, errorCode, retry, offline, slow, loading } = useCatalog();
  const btn = <> <button className="btn ghost small" onClick={retry}>Try again</button></>;
  if (status === 'error') {
    return errorCode === 'permission-denied'
      ? <Alert>The product catalogue could not be opened (permission denied). Please contact Crunchzy support.{btn}</Alert>
      : <Alert>We could not load the products. Check your internet connection and try again.{btn}</Alert>;
  }
  if (status === 'offline') return <Alert>You appear to be offline or the server is unreachable. Products will appear automatically when the connection returns.{btn}</Alert>;
  if (offline) return <Alert kind="info">Showing saved data. Reconnecting…</Alert>;
  if (loading && slow) return <Alert kind="info">Still loading products — your connection looks slow.</Alert>;
  return null;
}

/** Shown when the connection is fine but there are no active products to list. */
export function EmptyCatalogue() {
  const { status } = useCatalog();
  if (status !== 'empty') return null;
  return (
    <Empty title="No products available yet">
      Our catalogue is being updated. Please check back soon.
      {import.meta.env.DEV && <><br /><small>[dev] The storefront reads the <code>products</code> collection. See the README for how products are synced from the admin panel.</small></>}
    </Empty>
  );
}
