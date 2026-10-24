import { Link } from 'react-router-dom';
import { useConsent } from '../consent.jsx';

/** Cookie & data consent. Shown on first visit and whenever "Cookie settings" is clicked in the footer. */
export default function CookieBanner() {
  const { show, save, choice, close } = useConsent();
  if (!show) return null;
  return (
    <div className="consent" role="dialog" aria-modal="false" aria-labelledby="consent-title">
      <div className="consent-in">
        <div className="consent-text">
          <h2 id="consent-title">🍪 We value your privacy</h2>
          <p>
            Crunchzy uses essential cookies and browser storage to keep you signed in and remember your cart. When you order,
            we ask for your <b>name, mobile number and delivery address</b> only to deliver your order and contact you about it.
            Read our <Link to="/privacy">Privacy &amp; Cookie Policy</Link>.
          </p>
          {choice && <small className="muted">Your current choice: {choice.level === 'all' ? 'accepted' : 'essential only'}.</small>}
        </div>
        <div className="consent-actions">
          <button className="btn" onClick={() => save('all')}>Accept &amp; continue</button>
          <button className="btn ghost" onClick={() => save('essential')}>Essential only</button>
          {choice && <button className="link" onClick={close}>Close</button>}
        </div>
      </div>
    </div>
  );
}
