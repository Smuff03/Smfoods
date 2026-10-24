import { useConsent } from '../consent.jsx';

export default function Privacy() {
  const { reopen } = useConsent();
  return (
    <div className="wrap section narrow prose">
      <h1 className="h1s">Privacy &amp; Cookie Policy</h1>
      <p className="muted">Last updated: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

      <h3>What we collect</h3>
      <p>When you create an account or place an order we collect your <b>name, mobile number, email address and delivery address</b>, and the details of the items you order.
        If you sign in with Google or Apple we receive your name and email from them (Apple may give us a private relay email address).</p>

      <h3>Why we use it</h3>
      <p>Only to process and deliver your order, to call or message you about it, to show your bill and order tracking, and to keep your saved addresses for faster checkout.
        We do not sell your data.</p>

      <h3>Cookies and browser storage</h3>
      <p><b>Essential:</b> keeping you signed in and remembering your cart and your cookie choice. The shop cannot work without these.
        We do not use advertising cookies. You can change your choice at any time:</p>
      <p><button className="btn ghost small" onClick={reopen}>Open cookie settings</button></p>

      <h3>Payment</h3>
      <p>Orders are paid by Cash on Delivery. We do not collect card or bank details.</p>

      <h3>Your choices</h3>
      <p>You can view and edit your name, mobile number and saved addresses under <b>Profile</b>. To ask us to delete your account or data, contact Crunchzy support.</p>
    </div>
  );
}
