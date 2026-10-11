import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../cart.jsx';
import { useCatalog } from '../catalog.jsx';
import { CatalogNotice } from '../components/CatalogNotice.jsx';
import { Empty, Spinner } from '../components/ui.jsx';
import { priceFor } from '../pricing.js';
import { money } from '../utils.js';

/** Retailer-only quick order sheet: enter quantities for many products at once. */
export default function BulkOrder() {
  const { products, loading } = useCatalog();
  const { add } = useCart();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [qty, setQty] = useState({});
  const rows = useMemo(() => products.filter((p) => p.wholesale && `${p.name} ${p.category}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)), [products, q]);

  const picked = rows.filter((p) => Number(qty[p.id]) > 0);
  const problems = picked.map((p) => {
    const n = Number(qty[p.id]);
    if (!Number.isInteger(n)) return `${p.name}: whole numbers only`;
    if (n < p.wholesale.moq) return `${p.name}: minimum ${p.wholesale.moq}`;
    if (n > p.stockQty) return `${p.name}: only ${p.stockQty} in stock`;
    return '';
  }).filter(Boolean);
  const total = picked.reduce((s, p) => s + priceFor(p, true, Number(qty[p.id])).unit * Number(qty[p.id]), 0);

  const submit = () => { picked.forEach((p) => add(p.id, Number(qty[p.id]))); nav('/cart'); };
  if (loading) return <Spinner />;

  return (
    <div className="wrap section">
      <div className="row between wrapfx"><h1 className="h1s">Bulk order</h1>
        <input className="narrow-in" placeholder="Filter products…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter products" /></div>
      <CatalogNotice />
      {!rows.length ? <Empty title="No wholesale products">No products match, or wholesale pricing has not been set up yet.</Empty> : (
        <div className="scroll"><table className="tbl bulk"><thead><tr><th>Product</th><th>Wholesale price</th><th>Min. qty</th><th>Bulk pricing</th><th>Stock</th><th>Quantity</th><th className="right">Amount</th></tr></thead><tbody>
          {rows.map((p) => {
            const n = Number(qty[p.id]) || 0;
            const pr = priceFor(p, true, Math.max(n, 1));
            return (
              <tr key={p.id}>
                <td><b>{p.name}</b><br /><small className="muted">{p.category}{p.sku ? ` · ${p.sku}` : ''}</small></td>
                <td>{money(p.wholesale.price)}</td><td>{p.wholesale.moq}</td>
                <td>{p.wholesale.tiers.length ? [...p.wholesale.tiers].sort((a, b) => a.minQty - b.minQty).map((t) => <div key={t.minQty}><small>{t.minQty}+ → {money(t.price)}</small></div>) : <small className="muted">—</small>}</td>
                <td>{p.stockQty > 0 ? p.stockQty : <span className="badge out">Out</span>}</td>
                <td><input className="qin" type="number" min={0} max={p.stockQty} disabled={p.stockQty < 1} placeholder="0" value={qty[p.id] ?? ''} onChange={(e) => setQty({ ...qty, [p.id]: e.target.value })} aria-label={`Quantity for ${p.name}`} /></td>
                <td className="right">{n > 0 ? money(pr.unit * n) : ''}</td>
              </tr>
            );
          })}
        </tbody></table></div>
      )}
      <div className="stickybar">
        <div><b>{picked.length}</b> product{picked.length === 1 ? '' : 's'} · <b>{money(total)}</b>{problems.length > 0 && <small className="err"> · {problems[0]}</small>}</div>
        <button className="btn" disabled={!picked.length || problems.length > 0} onClick={submit}>Add to cart &amp; review</button>
      </div>
    </div>
  );
}
