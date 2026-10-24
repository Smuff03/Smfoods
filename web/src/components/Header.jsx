import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import { Logo } from './ui.jsx';

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
      <div className="topbar"><span>Good Taste Travels 🧡</span><span className="hide-sm">Cash on Delivery available · Packs of 200 g, 500 g &amp; 1 kg</span></div>
      <div className="wrap hrow">
        <Logo onClick={go} />
        <form className="search" onSubmit={submit} role="search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search snacks, namkeen, sweets…" aria-label="Search products" />
          <button className="btn small" type="submit">Search</button>
        </form>
        <button className="menu-btn" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>☰</button>
        <nav className={`nav ${open ? 'open' : ''}`}>
          <NavLink to="/shop" onClick={go}>Shop</NavLink>
          {a.user ? (
            <>
              <NavLink to="/orders" onClick={go}>My orders</NavLink>
              <NavLink to="/profile" onClick={go}>Profile</NavLink>
              <button className="link" onClick={() => { a.logout(); go(); nav('/'); }}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn ghost small" onClick={go}>Log in</Link>
              <Link to="/register" className="btn small" onClick={go}>Sign up</Link>
            </>
          )}
          <NavLink to="/cart" className="cartlink" onClick={go}>🛒 Cart{count > 0 && <b>{count}</b>}</NavLink>
        </nav>
      </div>
    </header>
  );
}
