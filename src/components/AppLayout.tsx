import { useState, useRef, MouseEvent, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { Wallet, LogOut, User as UserIcon, ArrowLeft } from 'lucide-react';
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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const handleBack = () => {
    if (window.history.length > 1 && location.pathname !== '/') {
      navigate(-1);
    } else {
      navigate('/');
    }
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
                    <span className="text-sm font-medium">{profile?.credits ?? 0} INR</span>
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
    </div>
  );
}
