import { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { registerUser, syncFirebaseUser, isUsernameTaken } from '../lib/storage';
import { auth, googleProvider, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { motion } from 'motion/react';

export function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName && userCred.user) {
          await updateProfile(userCred.user, { displayName });
        }

        // Write profile to Firestore immediately
        try {
          const emailLower = (userCred.user.email || '').trim().toLowerCase();
          const docRef = doc(db, 'users', userCred.user.uid);
          const isSeniorAdmin = (userCred.user.email || '').toLowerCase() === 'saritagupta77300@gmail.com';
          
          let preCreditedCredits = 0;
          let preCreditedFree = 0;
          let foundPreCredited = false;
          let oldDocIdToDelete = '';

          if (emailLower) {
            try {
              const emailDocRef = doc(db, 'users', emailLower);
              const emailDocSnap = await getDoc(emailDocRef);
              if (emailDocSnap.exists()) {
                const emailData = emailDocSnap.data();
                preCreditedCredits = Number(emailData?.credits) ?? 0;
                preCreditedFree = Number(emailData?.freeCredits) ?? 0;
                foundPreCredited = true;
                oldDocIdToDelete = emailLower;
              } else {
                const usersSnap = await getDocs(collection(db, 'users'));
                const match = usersSnap.docs.find(d => {
                  const dData = d.data();
                  return d.id !== userCred.user.uid && (dData?.email || '').trim().toLowerCase() === emailLower;
                });
                if (match) {
                  const matchData = match.data();
                  preCreditedCredits = Number(matchData?.credits) ?? 0;
                  preCreditedFree = Number(matchData?.freeCredits) ?? 0;
                  foundPreCredited = true;
                  oldDocIdToDelete = match.id;
                }
              }
            } catch (err) {
              console.warn("Pre-credit lookup failed during signup:", err);
            }
          }

          const newProfile = {
            uid: userCred.user.uid,
            email: userCred.user.email || '',
            displayName: displayName || userCred.user.displayName || userCred.user.email?.split('@')[0] || 'User',
            credits: preCreditedCredits,
            freeCredits: preCreditedFree,
            isAdmin: isSeniorAdmin,
            createdAt: Date.now()
          };
          await setDoc(docRef, newProfile, { merge: true });

          if (oldDocIdToDelete) {
            await deleteDoc(doc(db, 'users', oldDocIdToDelete)).catch(() => {});
          }
        } catch (fsWriteErr) {
          console.warn("Immediate Firestore write on signup failed:", fsWriteErr);
        }

        const newUser = syncFirebaseUser({
          uid: userCred.user.uid,
          email: userCred.user.email,
          displayName: displayName || userCred.user.displayName,
        });
        setUser(newUser);
        navigate('/');
        return;
      } catch (fbErr: any) {
        console.warn('Firebase signup attempt:', fbErr?.code || fbErr?.message);
        const newUser = registerUser(email, password, displayName);
        
        // Try to save fallback user to Firestore as well!
        try {
          const docRef = doc(db, 'users', newUser.uid);
          await setDoc(docRef, {
            uid: newUser.uid,
            email: newUser.email,
            displayName: newUser.displayName,
            password: password, // Store password so they can log in from other browsers if needed
            credits: newUser.credits,
            freeCredits: newUser.freeCredits,
            isAdmin: newUser.isAdmin,
            createdAt: newUser.createdAt
          }, { merge: true });
        } catch (fsWriteErr) {
          console.warn("Immediate Firestore write on fallback signup failed:", fsWriteErr);
        }

        setUser(newUser);
        navigate('/');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create an account');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      
      // Ensure user profile in Firestore immediately
      try {
        const docRef = doc(db, 'users', res.user.uid);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          const isSeniorAdmin = (res.user.email || '').toLowerCase() === 'saritagupta77300@gmail.com';
          const newProfile = {
            uid: res.user.uid,
            email: res.user.email || '',
            displayName: res.user.displayName || res.user.email?.split('@')[0] || 'User',
            credits: 0,
            freeCredits: 0,
            isAdmin: isSeniorAdmin,
            createdAt: Date.now()
          };
          await setDoc(docRef, newProfile, { merge: true });
        }
      } catch (fbWriteErr) {
        console.warn("Immediate Firestore write on Google signup failed:", fbWriteErr);
      }

      const syncedUser = syncFirebaseUser(res.user);
      setUser(syncedUser);
      navigate('/');
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setError(err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-xl"
      >
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold mb-2">Create an Account</h1>
          <p className="text-neutral-400 text-sm">Join Risk and reward to start playing.</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-950/50 border border-red-900 text-red-200 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* Google Sign Up Button */}
        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-neutral-800 hover:bg-neutral-750 text-white font-medium rounded-lg px-4 py-2.5 border border-neutral-700 transition-colors disabled:opacity-50 mb-6"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Sign Up with Google
        </button>

        <div className="relative mb-6 flex items-center justify-center">
          <div className="border-t border-neutral-800 w-full"></div>
          <span className="bg-neutral-900 px-3 text-xs text-neutral-500 uppercase tracking-wider absolute">or</span>
        </div>

        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Display Name</label>
            <input
              type="text"
              required
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-100 focus:outline-none focus:border-neutral-600 transition-colors"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-100 focus:outline-none focus:border-neutral-600 transition-colors"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-100 focus:outline-none focus:border-neutral-600 transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-neutral-100 text-neutral-950 font-medium rounded-lg px-4 py-2.5 hover:bg-white transition-colors disabled:opacity-50 mt-4"
          >
            {loading ? 'Creating account...' : 'Sign Up with Email'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-neutral-400">
          Already have an account? <Link to="/login" className="text-neutral-100 hover:underline font-medium">Log in</Link>
        </div>
      </motion.div>
    </div>
  );
}


