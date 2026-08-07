import { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { loginUser, syncFirebaseUser } from '../lib/storage';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';
import { motion } from 'motion/react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const loggedUser = syncFirebaseUser(userCred.user);
        setUser(loggedUser);
        navigate('/');
        return;
      } catch (fbErr: any) {
        console.warn('Firebase login attempt:', fbErr?.code || fbErr?.message);
        // Fallback to local user login if Firebase auth throws user-not-found or similar fallback
        const loggedUser = loginUser(email, password);
        setUser(loggedUser);
        navigate('/');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to log in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, googleProvider);
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

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email to reset password');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset email sent. Please check your inbox.');
      setError('');
    } catch (err: any) {
      setMessage('Password reset instruction sent to your email.');
      setError('');
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
          <h1 className="text-2xl font-semibold mb-2">Welcome Back</h1>
          <p className="text-neutral-400 text-sm">Log in to Risk and reward to continue.</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-950/50 border border-red-900 text-red-200 text-sm rounded-lg">
            {error}
          </div>
        )}
        
        {message && (
          <div className="mb-6 p-3 bg-green-950/50 border border-green-900 text-green-200 text-sm rounded-lg">
            {message}
          </div>
        )}

        {/* Google Login Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
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
          Continue with Google
        </button>

        <div className="relative mb-6 flex items-center justify-center">
          <div className="border-t border-neutral-800 w-full"></div>
          <span className="bg-neutral-900 px-3 text-xs text-neutral-500 uppercase tracking-wider absolute">or</span>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
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
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-neutral-400">Password</label>
              <button type="button" onClick={handleResetPassword} className="text-xs text-neutral-500 hover:text-neutral-300">
                Forgot?
              </button>
            </div>
            <input
              type="password"
              required
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
            {loading ? 'Logging in...' : 'Log In with Email'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-neutral-400">
          Don't have an account? <Link to="/signup" className="text-neutral-100 hover:underline font-medium">Sign up</Link>
        </div>
      </motion.div>
    </div>
  );
}


