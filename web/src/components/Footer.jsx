import { Link } from 'react-router-dom';
import { useConsent } from '../consent.jsx';
import { Logo } from './ui.jsx';

export default function Footer() {
  const { reopen } = useConsent();
  return (
    <footer className="footer">
      <div className="wrap fgrid">
        <div>
          <Logo className="footlogo" />
          <p>Crunchy, fresh snacks — made with care and delivered to your door. <b>Good Taste Travels.</b></p>
        </div>
        <div><h4>Shop</h4><Link to="/shop">All products</Link><Link to="/cart">Cart</Link><Link to="/orders">Track your order</Link></div>
        <div><h4>Account</h4><Link to="/login">Log in</Link><Link to="/register">Create account</Link><Link to="/profile">My profile</Link></div>
        <div><h4>Legal</h4><Link to="/privacy">Privacy &amp; Cookie Policy</Link><button className="linkbtn" onClick={reopen}>Cookie settings</button></div>
      </div>
      <div className="wrap copy">© {new Date().getFullYear()} Crunchzy. All rights reserved.</div>
    </footer>
  );
}
