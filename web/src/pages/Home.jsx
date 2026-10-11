import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useCatalog } from '../catalog.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { CatalogNotice, EmptyCatalogue } from '../components/CatalogNotice.jsx';
import { Spinner } from '../components/ui.jsx';
import { discountPct } from '../pricing.js';

const Row = ({ title, to, items }) => items.length ? (
  <section className="wrap section">
    <div className="row between"><h2>{title}</h2>{to && <Link to={to} className="more">View all →</Link>}</div>
    <div className="grid">{items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
  </section>
) : null;

export default function Home() {
  const { products, categories, loading } = useCatalog();
  const { user, isRetailer } = useAuth();
  const inStock = products.filter((p) => p.stockQty > 0);
  const featured = (inStock.filter((p) => p.featured === true).length ? inStock.filter((p) => p.featured === true) : inStock).slice(0, 8);
  const offers = inStock.filter((p) => discountPct(p) > 0).sort((a, b) => discountPct(b) - discountPct(a)).slice(0, 4);
  const fresh = [...inStock].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 4);

  return (
    <>
      <section className="hero">
        <div className="wrap herogrid">
          <div>
            <span className="eyebrow">Wholesale &amp; retail snacks</span>
            <h1>Quality Snacks.<br />Wholesale Prices.</h1>
            <p>Fresh chakli, chivda, namkeen, farsan and sweets, delivered to your door. Shops and retailers get dedicated wholesale pricing and bulk ordering.</p>
            <div className="row gap">
              <Link to="/shop" className="btn">Shop now</Link>
              {!isRetailer && <Link to={user ? '/retailer' : '/register/retailer'} className="btn ghost">Become a retailer</Link>}
              {isRetailer && <Link to="/bulk" className="btn ghost">Bulk order</Link>}
            </div>
          </div>
          <ul className="perks">
            <li><b>Wholesale pricing</b><span>Approved retailers unlock bulk rates &amp; tiers</span></li>
            <li><b>Live stock</b><span>Availability updates in real time</span></li>
            <li><b>Cash on Delivery</b><span>Pay when your order arrives</span></li>
          </ul>
        </div>
      </section>

      <div className="wrap"><CatalogNotice /></div>
      {loading ? <Spinner label="Loading products…" /> : (
        <>
          {categories.length > 0 && (
            <section className="wrap section">
              <h2>Shop by category</h2>
              <div className="cats">{categories.map((c) => <Link key={c} to={`/shop?cat=${encodeURIComponent(c)}`} className="cat">{c}</Link>)}</div>
            </section>
          )}
          <Row title="Featured products" to="/shop" items={featured} />
          <Row title="Offers" to="/shop?sort=discount" items={isRetailer ? [] : offers} />
          <Row title="New arrivals" to="/shop?sort=newest" items={fresh} />
          <div className="wrap section"><EmptyCatalogue /></div>
        </>
      )}
    </>
  );
}
