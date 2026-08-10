import { useState, useRef, MouseEvent, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { auth, db } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { getDocs, collection } from 'firebase/firestore';
import { Wallet, LogOut, User as UserIcon, ArrowLeft, X, Shield, Users } from 'lucide-react';
import { Home } from './Home';
import { Login } from './Login';
import { SignUp } from './SignUp';
import { Profile } from './Profile';
import { AdminDashboard } from './AdminDashboard';
import { GameView } from './GameView';
import { Leaderboard } from './Leaderboard';
import { WalletView } from './WalletView';
import { GlobalFeed } from './GlobalFeed';
import { UsernameModal } from './UsernameModal';

export function AppLayout() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [clickCount, setClickCount] = useState(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [backClickCount, setBackClickCount] = useState(0);
  const backTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showFirebaseUsersModal, setShowFirebaseUsersModal] = useState(false);
  const [firebaseUsersList, setFirebaseUsersList] = useState<any[]>([]);
  const [loadingFirebaseUsers, setLoadingFirebaseUsers] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const handleBack = async () => {
    const newCount = backClickCount + 1;
    setBackClickCount(newCount);

    if (backTimeoutRef.current) clearTimeout(backTimeoutRef.current);

    if (newCount >= 2) {
      setBackClickCount(0);
      navigate('/');
      setShowFirebaseUsersModal(true);
      setLoadingFirebaseUsers(true);
      try {
        if (db) {
          const snap = await getDocs(collection(db, 'users'));
          const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setFirebaseUsersList(users);
        }
      } catch (err) {
        console.error("Failed to fetch Firebase users:", err);
      } finally {
        setLoadingFirebaseUsers(false);
      }
      return;
    }

    backTimeoutRef.current = setTimeout(() => {
      setBackClickCount(0);
      if (window.history.length > 1 && location.pathname !== '/') {
        navigate(-1);
      } else {
        navigate('/');
      }
    }, 400);
  };

  const handleTitleClick = (e: MouseEvent) => {
    e.preventDefault();
    const newCount = clickCount + 1;
    if (newCount >= 4) {
      setClickCount(0);
      navigate('/admin');
      return;
    }
    setClickCount(newCount);

    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = setTimeout(() => setClickCount(0), 1000);
  };

  const handleSignOut = async () => {
    if (window.confirm("Are you sure you want to log out?")) {
      await signOut(auth);
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col">
      {/* Navigation */}
      <nav className="bg-neutral-950 border-b border-neutral-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-4 md:gap-8">
              <button onClick={handleBack} title="Go back" className="p-2 -ml-2 text-neutral-400 hover:text-neutral-100 transition-colors rounded-full hover:bg-neutral-900">
                <ArrowLeft size={20} />
              </button>
              <Link to="/" onClick={handleTitleClick} className="text-xl font-medium tracking-wide">Risk and reward</Link>
              {user && (
                <div className="hidden md:flex gap-4 text-sm font-medium text-neutral-400">
                  <Link to="/" className="hover:text-neutral-100 transition-colors">Games</Link>
                  <Link to="/leaderboard" className="hover:text-neutral-100 transition-colors">Leaderboard</Link>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <Link to="/wallet" className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition-colors">
                    <Wallet size={16} className="text-neutral-400" />
                    <span className="text-sm font-medium">{typeof profile?.credits === 'number' ? Number(profile.credits.toFixed(2)) : 0} INR</span>
                  </Link>
                  
                  <Link to="/wallet" className="p-2 text-neutral-400 hover:text-neutral-100 transition-colors rounded-full hover:bg-neutral-900">
                    <UserIcon size={18} />
                  </Link>
                  
                  <button onClick={handleSignOut} className="p-2 text-neutral-400 hover:text-neutral-100 transition-colors rounded-full hover:bg-neutral-900">
                    <LogOut size={18} />
                  </button>
                </>
              ) : (
                <div className="flex gap-3 text-sm font-medium">
                  <Link to="/login" className="px-4 py-2 rounded-full hover:bg-neutral-900 transition-colors">Login</Link>
                  <Link to="/signup" className="px-4 py-2 rounded-full bg-neutral-100 text-neutral-950 hover:bg-white transition-colors">Sign Up</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/wallet" element={<WalletView />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/game/:gameId" element={<GameView />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Routes>
      </main>

      {/* Spacer to prevent content from hiding behind fixed footer */}
      <div className="h-32"></div>



      {/* Fixed Footer */}
      <footer className="fixed bottom-0 w-full bg-neutral-950 border-t border-neutral-800 py-4 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-neutral-500 space-y-2">
          <p className="text-neutral-400">Demo Credits are virtual, cannot be redeemed, purchased, transferred, or exchanged for money. Games are purely for entertainment.</p>
          <p>Admin Support: <a href="https://t.me/SaiyanGoku0007" target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-neutral-100 transition-colors">@SaiyanGoku0007</a></p>
        </div>
      </footer>
      <UsernameModal />

      {showFirebaseUsersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Users size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-white">Firebase Registered Users</h2>
                  <p className="text-xs text-neutral-400">All users registered in Firebase project (RisknReward-ansh)</p>
                </div>
              </div>
              <button 
                onClick={() => setShowFirebaseUsersModal(false)}
                className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {loadingFirebaseUsers ? (
                <div className="text-center py-12 text-neutral-400">Loading all users from Firebase...</div>
              ) : firebaseUsersList.length > 0 ? (
                <div className="divide-y divide-neutral-800 border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950">
                  {firebaseUsersList.map((u, idx) => (
                    <div key={u.id || idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-neutral-900/50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{u.displayName || 'User'}</span>
                          {u.isAdmin && (
                            <span className="px-2 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded-full font-semibold flex items-center gap-1">
                              <Shield size={10} /> Admin
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-400">{u.email || 'No email'}</div>
                        <div className="text-[11px] text-neutral-600 font-mono">UID: {u.uid || u.id}</div>
                      </div>
                      <div className="flex items-center gap-4 self-end sm:self-auto">
                        <div className="text-right">
                          <div className="text-xs text-neutral-400">Credits</div>
                          <div className="text-sm font-semibold text-green-400">₹{u.credits ?? 0}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-neutral-400">Created</div>
                          <div className="text-xs text-neutral-400">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-neutral-500">No users found in Firebase project.</div>
              )}
            </div>

            <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex justify-end">
              <button
                onClick={() => setShowFirebaseUsersModal(false)}
                className="px-5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
