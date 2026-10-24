import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const KEY = 'crunchzy_consent_v1';
const Ctx = createContext(null);
export const useConsent = () => useContext(Ctx);

const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && typeof v === 'object' ? v : null; } catch { return null; } };

/**
 * Remembers the visitor's cookie / data choice in this browser.
 * `choice` is null until they answer, then { level: 'all' | 'essential', at: ISO date }.
 * Essential storage (login session, cart) is always used because the shop cannot work without it.
 */
export function ConsentProvider({ children }) {
  const [choice, setChoice] = useState(read);
  const [reopen, setReopen] = useState(false);
  const save = useCallback((level) => {
    const v = { level, at: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage unavailable: choice lasts for this visit only */ }
    setChoice(v); setReopen(false);
  }, []);
  const value = useMemo(() => ({ choice, save, show: !choice || reopen, reopen: () => setReopen(true), close: () => setReopen(false) }), [choice, save, reopen]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
