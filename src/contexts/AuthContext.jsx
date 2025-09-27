import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auth, googleProvider } from '../services/firebaseClient';
import {
  onAuthStateChanged,
  signOut as fbSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';

const AuthContext = createContext({
  user: null,
  loading: true,
  signUp: async () => {},
  signIn: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    signUp: async (name, email, password) => {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name && cred.user) await updateProfile(cred.user, { displayName: name });
      return cred.user;
    },
    signIn: async (email, password) => {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return cred.user;
    },
    signInWithGoogle: async () => {
      const cred = await signInWithPopup(auth, googleProvider);
      return cred.user;
    },
    signOut: async () => {
      await fbSignOut(auth);
    },
  }), [user, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

