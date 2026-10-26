import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCatalog } from '../catalog.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { CatalogNotice, EmptyCatalogue } from '../components/CatalogNotice.jsx';
import { Empty, Spinner } from '../components/ui.jsx';
import { discountPct } from '../pricing.js';

const PAGE = 24;

export default function Shop() {
  const { products, categories, loading, status } = useCatalog();
  const [sp, setSp] = useSearchParams();
  const [shown, setShown] = useState(PAGE);
  const q = sp.get('q') || '', cat = sp.get('cat') || '', sort = sp.get('sort') || 'name', only = sp.get('stock') === '1';
  const set = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n, { replace: true }); setShown(PAGE); };

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    let l = products.filter((p) => (!cat || p.category === cat)
      && (!t || `${p.name} ${p.category} ${p.sku || ''}`.toLowerCase().includes(t)));
    const unit = (p) => p.retailPrice;
    const sorts = {
      name: (a, b) => a.name.localeCompare(b.name),
      'price-asc': (a, b) => unit(a) - unit(b),
      'price-desc': (a, b) => unit(b) - unit(a),
      discount: (a, b) => discountPct(b) - discountPct(a),
      newest: (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
    };
    return [...l].sort(sorts[sort] || sorts.name);
  }, [products, q, cat, sort]);

  return (
    <div className="wrap section">
      <div className="row between wrapfx">
        <h1 className="h1s">{cat || 'All products'}{q && <small className="muted"> · “{q}”</small>}</h1>
        <div className="row gap wrapfx">
          <select value={sort} onChange={(e) => set('sort', e.target.value)} aria-label="Sort">
            <option value="name">Name A–Z</option><option value="price-asc">Price (per kg): low to high</option>
            <option value="price-desc">Price (per kg): high to low</option><option value="discount">Biggest discount</option><option value="newest">Newest</option>
          </select>
        </div>
      </div>
      <div className="pills">
        <button className={!cat ? 'pill on' : 'pill'} onClick={() => set('cat', '')}>All</button>
        {categories.map((c) => <button key={c} className={cat === c ? 'pill on' : 'pill'} onClick={() => set('cat', c)}>{c}</button>)}
      </div>
      <CatalogNotice />
      {loading ? <Spinner label="Loading products…" /> : status === 'empty' ? <EmptyCatalogue /> : status === 'error' || status === 'offline' ? null : !list.length ? (
        <Empty title="No products found">Try a different search or category.</Empty>
      ) : (
        <>
          <p className="muted">{list.length} product{list.length === 1 ? '' : 's'}</p>
          <div className="grid">{list.slice(0, shown).map((p) => <ProductCard key={p.id} p={p} />)}</div>
          {shown < list.length && <div className="center"><button className="btn ghost" onClick={() => setShown(shown + PAGE)}>Load more</button></div>}
        </>
      )}
    </div>
  );
}
