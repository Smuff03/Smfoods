import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../cart.jsx';

/** Floating cart button – bottom-right, visible on all pages except cart/checkout. */
export default function CartFab() {
  const { count } = useCart();
  const nav = useNavigate();
  const [bump, setBump] = useState(false);
  const prev = useRef(count);

  // Animate badge whenever count goes up
  useEffect(() => {
    if (count > prev.current) { setBump(true); setTimeout(() => setBump(false), 400); }
    prev.current = count;
  }, [count]);

  if (count === 0) return null;

  return (
    <button
      className={`cart-fab${bump ? ' bump' : ''}`}
      onClick={() => nav('/cart')}
      aria-label={`View cart – ${count} item${count === 1 ? '' : 's'}`}
    >
      <span className="cart-fab-icon">🛒</span>
      <span className="cart-fab-label">Cart</span>
      <span className="cart-fab-badge">{count > 99 ? '99+' : count}</span>
    </button>
  );
}

