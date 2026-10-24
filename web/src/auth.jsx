import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider, OAuthProvider, createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

/**
 * Identity comes from Firebase Auth (email/password, Google, Apple). Everyone who signs in is a customer.
 * users/{uid} is listened to live so saved name, mobile number and addresses stay in sync.
 */
export function AuthProvider({ children }) {
  const [s, setS] = useState({ ready: false, user: null });
  const [profile, setProfile] = useState(null);

  useEffect(() => onAuthStateChanged(auth,
    (u) => setS({ ready: true, user: u }),
    () => setS({ ready: true, user: null })), []);

  useEffect(() => {
    if (!s.user) { setProfile(null); return undefined; }
    return onSnapshot(doc(db, 'users', s.user.uid), (d) => setProfile(d.exists() ? d.data() : null), () => setProfile(null));
  }, [s.user?.uid]);

  const ensureProfile = async (u, extra = {}) => {
    const ref = doc(db, 'users', u.uid);
    if ((await getDoc(ref)).exists()) return;
    await setDoc(ref, {
      name: extra.name || u.displayName || '', email: u.email || '', phone: extra.phone || '',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  };

  const social = async (provider) => {
    const { user } = await signInWithPopup(auth, provider);
    await ensureProfile(user);
    return user;
  };

  const api = useMemo(() => ({
    ...s, profile,
    login: (email, password) => signInWithEmailAndPassword(auth, email, password),
    google: () => social(new GoogleAuthProvider()),
    // Sign in with Apple. Needs the Apple provider enabled in Firebase (see README).
    apple: () => {
      const p = new OAuthProvider('apple.com');
      p.addScope('email');
      p.addScope('name');
      return social(p);
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
  }), [s, profile]); // eslint-disable-line

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
