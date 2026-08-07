import { useEffect, useState } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, increment, onSnapshot } from 'firebase/firestore';
import { auth, db, isConfigured } from './lib/firebase';
import { useAuthStore, UserProfile } from './store/authStore';
import { AppLayout } from './components/AppLayout';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const { setUser, setProfile, setLoading } = useAuthStore();

  useEffect(() => {
    // Safety net: ensure loading state resolves even if auth callback hangs
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 2000);

    if (!isConfigured) {
      setLoading(false);
      clearTimeout(loadingTimeout);
      return;
    }

    try {
      let unsubProfile: (() => void) | null = null;
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        clearTimeout(loadingTimeout);
        setUser(currentUser);
        if (unsubProfile) {
          unsubProfile();
          unsubProfile = null;
        }
        
        if (currentUser) {
          const isSeniorAdmin = currentUser.email === 'saritagupta77300@gmail.com';
          const docRef = doc(db, 'users', currentUser.uid);
          
          try {
            let docSnap = null;
            try {
              docSnap = await getDoc(docRef);
            } catch (err) {
              console.warn("getDoc offline or pending:", err);
            }
            if (docSnap && !docSnap.exists()) {
              const newProfile = {
                uid: currentUser.uid,
                email: currentUser.email || '',
                displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
                credits: 0,
                freeCredits: 0,
                isAdmin: isSeniorAdmin,
                createdAt: Date.now()
              };
              await setDoc(docRef, newProfile, { merge: true }).catch(() => {});
            } else if (docSnap && isSeniorAdmin && !docSnap.data()?.isAdmin) {
              await updateDoc(docRef, { isAdmin: true }).catch(() => {});
            }
          } catch (e) {
            console.warn("Auth state doc check error:", e);
          }

          unsubProfile = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
              let data = docSnap.data() as UserProfile;
              // Check daily reward
              const now = Date.now();
              const oneDay = 24 * 60 * 60 * 1000;
              if (!data.lastDailyReward || (now - data.lastDailyReward) > oneDay) {
                updateDoc(docRef, {
                  credits: increment(5),
                  lastDailyReward: now
                }).catch(() => {});
              }
              setProfile(data);
            }
            setLoading(false);
          }, (error) => {
            console.warn("Profile snapshot error:", error);
            setLoading(false);
          });
        } else {
          setProfile(null);
          setLoading(false);
        }
      }, (error) => {
        console.warn("Auth state error:", error);
        clearTimeout(loadingTimeout);
        setUser(null);
        setProfile(null);
        setLoading(false);
      });

      return () => {
        clearTimeout(loadingTimeout);
        unsubscribe();
        if (unsubProfile) unsubProfile();
      };
    } catch (error) {
      console.warn("Firebase init error:", error);
      clearTimeout(loadingTimeout);
      setUser(null);
      setProfile(null);
      setLoading(false);
    }
  }, [setUser, setProfile, setLoading]);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppLayout />
    </BrowserRouter>
  );
}

