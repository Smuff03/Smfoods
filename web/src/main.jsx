import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import { CartProvider } from './cart.jsx';
import { CatalogProvider } from './catalog.jsx';
import { ConsentProvider } from './consent.jsx';
import { firebaseConfigured } from './firebase.js';
import './styles.css';

class Boundary extends React.Component {
  state = { e: null };
  static getDerivedStateFromError(e) { return { e }; }
  componentDidCatch(e) { console.error('Crunchzy render error:', e); }
  render() {
    if (!this.state.e) return this.props.children;
    return (
      <div className="wrap section">
        <h2>Something went wrong</h2>
        <p className="muted">Please refresh the page. If it keeps happening, the details below will help fix it.</p>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#FFF4E0', padding: 12, borderRadius: 8 }}>{String(this.state.e?.message || this.state.e)}</pre>
      </div>
    );
  }
}

function Setup() {
  return (
    <div className="wrap section">
      <h2>Firebase is not configured</h2>
      <p>The site cannot load any pages until it has your Firebase web config.</p>
      <ol>
        <li>In the project root (the folder that contains <code>web/</code> and <code>functions/</code>) copy <code>.env.example</code> to a new file named exactly <code>.env</code>.</li>
        <li>Replace every <code>your-...</code> / <code>0000</code> placeholder with the real values from Firebase console → Project settings → Your apps → Web app.</li>
        <li>Stop the dev server and run <code>npm run dev</code> again (env changes need a restart).</li>
        <li>If this is a deployed site: set the same <code>VITE_FIREBASE_*</code> variables in your host and rebuild.</li>
      </ol>
    </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(
  firebaseConfigured ? (
    <Boundary>
      <BrowserRouter>
        <ConsentProvider><AuthProvider><CatalogProvider><CartProvider><App /></CartProvider></CatalogProvider></AuthProvider></ConsentProvider>
      </BrowserRouter>
    </Boundary>
  ) : <Setup />,
);
