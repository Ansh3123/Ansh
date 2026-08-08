import { useState, FormEvent } from 'react';
import { useAuthStore } from '../store/authStore';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { updateUser, isUsernameTaken } from '../lib/storage';
import { motion } from 'motion/react';
import { UserCheck } from 'lucide-react';

export function UsernameModal() {
  const { user, profile, setProfile } = useAuthStore();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If user is not logged in or already has a username, do not show modal
  if (!user || (profile && profile.username)) {
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const clean = username.trim();

    if (!clean) {
      setError('Username cannot be empty.');
      return;
    }

    if (clean.length < 3) {
      setError('Username must be at least 3 characters long.');
      return;
    }

    if (isUsernameTaken(clean, user.uid)) {
      setError('This username is already taken by another user. Please choose a different one.');
      return;
    }

    setLoading(true);
    try {
      // Update in Firestore if configured
      try {
        await setDoc(doc(db, 'users', user.uid), {
          username: clean
        }, { merge: true });
      } catch (fbErr) {
        console.warn("Firestore username update error:", fbErr);
      }

      // Update in local storage / profile
      const updated = updateUser(user.uid, { username: clean });
      if (updated) {
        setProfile({ ...profile, ...updated, username: clean });
      } else {
        setProfile(profile ? { ...profile, username: clean } : {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          username: clean,
          credits: 100,
          freeCredits: 0,
          isAdmin: false,
          createdAt: Date.now()
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to set username');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full shadow-2xl"
      >
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-green-950 text-green-400 rounded-full flex items-center justify-center mx-auto mb-3">
            <UserCheck size={24} />
          </div>
          <h2 className="text-xl font-semibold mb-1">Create Your Unique Username</h2>
          <p className="text-neutral-400 text-sm">
            A unique username is required for your account and for admin wallet recharges. One username per person.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/50 border border-red-900 text-red-200 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Username</label>
            <input
              type="text"
              required
              placeholder="e.g. goku_007"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-neutral-100 focus:outline-none focus:border-neutral-600 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg px-4 py-3 transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? 'Saving username...' : 'Continue to App'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
