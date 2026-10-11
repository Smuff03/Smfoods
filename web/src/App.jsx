import { Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Footer from './components/Footer.jsx';
import { RequireAuth } from './components/Guards.jsx';
import Header from './components/Header.jsx';
import Admin from './pages/Admin.jsx';
import BulkOrder from './pages/BulkOrder.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import NotFound from './pages/NotFound.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import Orders from './pages/Orders.jsx';
import Product from './pages/Product.jsx';
import Profile from './pages/Profile.jsx';
import Register from './pages/Register.jsx';
import Reset from './pages/Reset.jsx';
import Retailer from './pages/Retailer.jsx';
import Shop from './pages/Shop.jsx';

function ScrollTop() { const { pathname } = useLocation(); useEffect(() => { window.scrollTo(0, 0); }, [pathname]); return null; }

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
          <Route path="/login/customer" element={<Login type="customer" />} />
          <Route path="/login/retailer" element={<Login type="retailer" />} />
          <Route path="/register/customer" element={<Register type="customer" />} />
          <Route path="/register/retailer" element={<Register type="retailer" />} />
          <Route path="/reset" element={<Reset />} />
          <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
          <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
          <Route path="/orders/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/retailer" element={<RequireAuth loginAs="retailer"><Retailer /></RequireAuth>} />
          <Route path="/bulk" element={<RequireAuth retailer><BulkOrder /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
