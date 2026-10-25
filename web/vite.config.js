import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Reads VITE_* variables from the project root .env, from web/.env, or from the host's
// environment variables (Netlify / Vercel / Firebase CI). web/.env wins over the root one.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, '..', 'VITE_'), ...loadEnv(mode, '.', 'VITE_') };
  const define = Object.fromEntries(
    Object.entries(env).map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)]),
  );
  return {
    plugins: [react()],
    define,
    server: {
      port: 5173,
      host: true,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
    },
    preview: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
    },
  };
});
