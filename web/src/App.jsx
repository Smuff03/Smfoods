import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import CookieBanner from './components/CookieBanner.jsx';
import Footer from './components/Footer.jsx';
import { RequireAuth } from './components/Guards.jsx';
import Header from './components/Header.jsx';
import CartFab from './components/CartFab.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import NotFound from './pages/NotFound.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import Orders from './pages/Orders.jsx';
import Privacy from './pages/Privacy.jsx';
import Product from './pages/Product.jsx';
import Profile from './pages/Profile.jsx';
import Register from './pages/Register.jsx';
import Reset from './pages/Reset.jsx';
import Shop from './pages/Shop.jsx';

function ScrollTop() { const { pathname } = useLocation(); useEffect(() => { window.scrollTo(0, 0); }, [pathname]); return null; }

function CartFabConditional() {
  const { pathname } = useLocation();
  if (pathname === '/cart' || pathname === '/checkout') return null;
  return <CartFab />;
}

export default function App() {

  return (
    <>
      <ScrollTop />
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:id" element={<Product />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset" element={<Reset />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
          <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
          <Route path="/orders/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          {/* old links: the admin panel and wholesale / retailer areas were removed from the web shop */}
          <Route path="/login/*" element={<Navigate to="/login" replace />} />
          <Route path="/register/*" element={<Navigate to="/register" replace />} />
          <Route path="/admin" element={<Navigate to="/" replace />} />
          <Route path="/retailer" element={<Navigate to="/" replace />} />
          <Route path="/bulk" element={<Navigate to="/shop" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <CookieBanner />
      <CartFabConditional />
    </>
  );
}
