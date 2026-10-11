import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import { RETAILER_LABEL } from '../utils.js';

export default function Header() {
  const a = useAuth();
  const { count } = useCart();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const go = () => setOpen(false);
  const submit = (e) => { e.preventDefault(); nav(`/shop${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); go(); };

  return (
    <header className="header">
      <div className="topbar"><span>Quality Snacks. Wholesale Prices.</span><span className="hide-sm">Cash on Delivery available</span></div>
      <div className="wrap hrow">
        <Link to="/" className="logo" onClick={go}>SM<span>Foods</span></Link>
        <form className="search" onSubmit={submit} role="search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search snacks, namkeen, sweets…" aria-label="Search products" />
          <button className="btn small" type="submit">Search</button>
        </form>
        <button className="menu-btn" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>☰</button>
        <nav className={`nav ${open ? 'open' : ''}`}>
          <NavLink to="/shop" onClick={go}>Shop</NavLink>
          {a.isRetailer && <NavLink to="/bulk" onClick={go}>Bulk order</NavLink>}
          {a.isAdmin && <NavLink to="/admin" onClick={go}>Admin tools</NavLink>}
          {a.user ? (
            <>
              {a.wholesaleStatus && !a.isRetailer && <NavLink to="/retailer" onClick={go} className="chip warn">Retailer: {RETAILER_LABEL[a.wholesaleStatus]}</NavLink>}
              {a.isRetailer && <NavLink to="/retailer" onClick={go} className="chip ok">Retailer</NavLink>}
              <NavLink to="/orders" onClick={go}>My orders</NavLink>
              <NavLink to="/profile" onClick={go}>Profile</NavLink>
              <button className="link" onClick={() => { a.logout(); go(); nav('/'); }}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login/customer" className="btn ghost small" onClick={go}>Customer Login</Link>
              <Link to="/login/retailer" className="btn small" onClick={go}>Retailer Login</Link>
            </>
          )}
          <NavLink to="/cart" className="cartlink" onClick={go}>Cart{count > 0 && <b>{count}</b>}</NavLink>
        </nav>
      </div>
    </header>
  );
}
