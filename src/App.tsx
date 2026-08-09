import { useEffect, useState } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, increment, onSnapshot } from 'firebase/firestore';
import { auth, db, isConfigured } from './lib/firebase';
import { useAuthStore, UserProfile } from './store/authStore';
import { AppLayout } from './components/AppLayout';
import { getCurrentUser, setCurrentUser, getUsers } from './lib/storage';

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

    // Sync all local users to Firestore as a migration/backup so the admin can see them!
    const syncLocalUsersToFirestore = async () => {
      try {
        if (db && isConfigured) {
          const localUsers = getUsers();
          for (const u of localUsers) {
            const docRef = doc(db, 'users', u.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              // User already exists in Firestore, do NOT overwrite their approved credits and balances
              await setDoc(docRef, {
                uid: u.uid,
                email: u.email,
                displayName: u.displayName,
                createdAt: u.createdAt || Date.now(),
                password: u.password || ''
              }, { merge: true });
            } else {
              // Safe creation of new users
              await setDoc(docRef, {
                uid: u.uid,
                email: u.email,
                displayName: u.displayName,
                credits: u.credits ?? 100,
                freeCredits: u.freeCredits ?? 0,
                isAdmin: u.isAdmin ?? false,
                createdAt: u.createdAt || Date.now(),
                password: u.password || ''
              }, { merge: true });
            }
          }
        }
      } catch (err) {
        console.warn("Sync local users to Firestore failed:", err);
      }
    };
    syncLocalUsersToFirestore();

    if (!isConfigured) {
      setLoading(false);
      clearTimeout(loadingTimeout);
      return;
    }

    try {
      let unsubProfile: (() => void) | null = null;
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        clearTimeout(loadingTimeout);
        if (unsubProfile) {
          unsubProfile();
          unsubProfile = null;
        }
        
        if (currentUser) {
          setUser(currentUser);
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
                credits: 100,
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
              
              // Sync back to local storage to keep items in sync
              const localUser = getCurrentUser();
              if (localUser && localUser.uid === currentUser.uid) {
                setCurrentUser({ ...localUser, ...data });
              } else {
                setCurrentUser({
                  uid: currentUser.uid,
                  email: currentUser.email || '',
                  displayName: data.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
                  credits: data.credits ?? 100,
                  freeCredits: data.freeCredits ?? 0,
                  isAdmin: isSeniorAdmin,
                  createdAt: data.createdAt || Date.now(),
                  password: data.password || ''
                });
              }
            }
            setLoading(false);
          }, (error) => {
            console.warn("Profile snapshot error:", error);
            setLoading(false);
          });
        } else {
          // Check if there is a local storage user logged in!
          const localUser = getCurrentUser();
          if (localUser) {
            setUser(localUser as any);
            const docRef = doc(db, 'users', localUser.uid);
            unsubProfile = onSnapshot(docRef, (docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data() as UserProfile;
                setProfile(data);
                // Sync to local storage to keep items in sync
                setCurrentUser({ ...localUser, ...data });
              } else {
                setProfile(localUser);
              }
              setLoading(false);
            }, (error) => {
              console.warn("Local user Firestore snapshot error:", error);
              setProfile(localUser);
              setLoading(false);
            });
          } else {
            setUser(null);
            setProfile(null);
            setLoading(false);
          }
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

