import { useEffect, useState } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
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
  const [firebaseError, setFirebaseError] = useState(false);

  useEffect(() => {
    if (!isConfigured) {
      setFirebaseError(true);
      setLoading(false);
      return;
    }

    try {
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        
        if (currentUser) {
          const isSeniorAdmin = currentUser.email === 'saritagupta77300@gmail.com';
          try {
            const docRef = doc(db, 'users', currentUser.uid);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
              let data = docSnap.data() as UserProfile;
              if (isSeniorAdmin && !data.isAdmin) {
                data.isAdmin = true;
                await updateDoc(docRef, { isAdmin: true }).catch(() => {});
              }
              
              // Check daily reward
              const now = Date.now();
              const oneDay = 24 * 60 * 60 * 1000;
              if (!data.lastDailyReward || (now - data.lastDailyReward) > oneDay) {
                try {
                  await updateDoc(docRef, {
                    credits: increment(5),
                    lastDailyReward: now
                  });
                  data.credits += 5;
                  data.lastDailyReward = now;
                } catch (e) {
                  // ignore offline update error
                }
              }
              
              setProfile(data);
            } else {
              const newProfile = {
                uid: currentUser.uid,
                email: currentUser.email || '',
                displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
                credits: 0,
                freeCredits: 0,
                isAdmin: isSeniorAdmin,
                createdAt: Date.now()
              };
              await setDoc(docRef, newProfile).catch(() => {});
              setProfile(newProfile);
            }
          } catch (error) {
            console.warn("Offline or fetch profile warning:", error);
            setProfile({
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
              credits: 0,
              freeCredits: 0,
              isAdmin: isSeniorAdmin,
              createdAt: Date.now()
            });
          }
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }, (error) => {
        console.error("Auth state error:", error);
        setFirebaseError(true);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Firebase init error:", error);
      setFirebaseError(true);
      setLoading(false);
    }
  }, [setUser, setProfile, setLoading]);

  if (firebaseError) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-neutral-900 border border-red-900/50 rounded-2xl p-8 text-center shadow-lg">
          <div className="w-16 h-16 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold mb-3 text-neutral-100">Firebase Configuration Required</h1>
          <p className="text-neutral-400 mb-6 text-sm leading-relaxed">
            Your application requires a valid Firebase configuration to function. The requested project ID "kakarot" was not able to be provisioned automatically.
          </p>
          <div className="text-sm text-left bg-neutral-950 p-5 rounded-xl border border-neutral-800">
            <p className="mb-3 font-medium text-neutral-300">To fix this, please provide your own Firebase project credentials by adding these variables in the AI Studio Secrets panel:</p>
            <ul className="space-y-2 text-neutral-500 font-mono text-xs">
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-neutral-700"></span>VITE_FIREBASE_API_KEY</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-neutral-700"></span>VITE_FIREBASE_AUTH_DOMAIN</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-neutral-700"></span>VITE_FIREBASE_PROJECT_ID</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-neutral-700"></span>VITE_FIREBASE_STORAGE_BUCKET</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-neutral-700"></span>VITE_FIREBASE_MESSAGING_SENDER_ID</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-neutral-700"></span>VITE_FIREBASE_APP_ID</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppLayout />
    </BrowserRouter>
  );
}

