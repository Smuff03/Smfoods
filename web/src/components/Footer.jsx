import { Link } from 'react-router-dom';
export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap fgrid">
        <div><div className="logo light">Crun<span>chzy</span></div><p>Quality Snacks. Wholesale Prices.</p></div>
        <div><h4>Shop</h4><Link to="/shop">All products</Link><Link to="/cart">Cart</Link><Link to="/orders">Track orders</Link></div>
        <div><h4>For retailers</h4><Link to="/register/retailer">Register your shop</Link><Link to="/login/retailer">Retailer login</Link></div>
      </div>
      <div className="wrap copy">© {new Date().getFullYear()} Crunchzy. All rights reserved.</div>
    </footer>
  );
}
