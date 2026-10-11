import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider, createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

/**
 * Identity comes from Firebase Auth. The role is read from the verified ID-token custom claim
 * (set only by Cloud Functions); the browser can never choose it. users/{uid} is listened to live so an
 * approval made in the admin tools is picked up and the token refreshed without a manual reload.
 */
export function AuthProvider({ children }) {
  const [s, setS] = useState({ ready: false, user: null, claims: {} });
  const [profile, setProfile] = useState(null);

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (!u) return setS({ ready: true, user: null, claims: {} });
    try {
      const t = await u.getIdTokenResult();
      setS({ ready: true, user: u, claims: t.claims });
    } catch {
      // never leave the app stuck on the loading spinner
      setS({ ready: true, user: u, claims: {} });
    }
  }, () => setS({ ready: true, user: null, claims: {} })), []);

  useEffect(() => {
    if (!s.user) { setProfile(null); return undefined; }
    return onSnapshot(doc(db, 'users', s.user.uid), (d) => setProfile(d.exists() ? d.data() : null), () => setProfile(null));
  }, [s.user?.uid]);

  const refreshClaims = useCallback(async () => {
    if (!auth.currentUser) return;
    const t = await auth.currentUser.getIdTokenResult(true);
    setS((x) => ({ ...x, claims: t.claims }));
  }, []);

  // Approval / suspension changes the custom claim: pull the new token as soon as the status changes.
  useEffect(() => { if (s.user && profile) refreshClaims().catch(() => {}); }, [profile?.wholesaleStatus]); // eslint-disable-line

  const ensureProfile = async (u, extra = {}) => {
    const ref = doc(db, 'users', u.uid);
    if ((await getDoc(ref)).exists()) return;
    await setDoc(ref, {
      name: extra.name || u.displayName || '', email: u.email || '', phone: extra.phone || '',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  };

  const api = useMemo(() => ({
    ...s, profile,
    role: s.claims.role || 'customer',
    isAdmin: s.claims.role === 'admin',
    // Retailer pricing needs BOTH the verified claim and an approved profile.
    isRetailer: s.claims.role === 'wholesaler' && profile?.wholesaleStatus === 'approved',
    wholesaleStatus: profile?.wholesaleStatus || null,
    refreshClaims,
    login: (email, password) => signInWithEmailAndPassword(auth, email, password),
    google: async () => {
      const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
      await ensureProfile(user);
      return user;
    },
    register: async ({ email, password, name, phone }) => {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName: name });
      await ensureProfile(user, { name, phone });
      return user;
    },
    reset: (email) => sendPasswordResetEmail(auth, email),
    logout: () => signOut(auth),
    saveProfile: (patch) => updateDoc(doc(db, 'users', s.user.uid), { ...patch, updatedAt: serverTimestamp() }),
  }), [s, profile, refreshClaims]); // eslint-disable-line

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
