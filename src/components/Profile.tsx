import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { History, Trophy } from 'lucide-react';
import { motion } from 'motion/react';

interface GameRecord {
  id: string;
  gameId: string;
  wager: number;
  winnings: number;
  profit: number;
  timestamp: any;
}

interface Achievement {
  id: string;
  name: string;
  timestamp: any;
}

export function Profile() {
  const { user, profile, loading: authLoading } = useAuthStore();
  const [history, setHistory] = useState<GameRecord[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        const q = query(
          collection(db, 'history'),
          where('uid', '==', user.uid),
          orderBy('timestamp', 'desc'),
          limit(10)
        );
        const querySnapshot = await getDocs(q);
        const records = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as GameRecord[];
        setHistory(records);

        const aQ = query(
          collection(db, 'achievements'),
          where('uid', '==', user.uid),
          orderBy('timestamp', 'desc')
        );
        const aSnap = await getDocs(aQ);
        setAchievements(aSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Achievement[]);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-neutral-400 text-sm animate-pulse">Loading profile...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center bg-neutral-900 border border-neutral-800 rounded-2xl p-8">
        <h2 className="text-xl font-medium mb-2">Please log in</h2>
        <p className="text-neutral-400 text-sm mb-6">You need to be logged in to view your profile.</p>
        <a href="/login" className="inline-block bg-neutral-100 text-neutral-950 font-medium px-6 py-2.5 rounded-lg hover:bg-white transition-colors">Log In</a>
      </div>
    );
  }

  const displayProfile = profile || {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email?.split('@')[0] || 'User',
    credits: 10,
    isAdmin: false,
    createdAt: Date.now()
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-4xl mx-auto pb-12"
    >
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Profile</h1>
        <p className="text-neutral-400">Manage your account and view history.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
            <div className="w-20 h-20 bg-neutral-800 rounded-full flex items-center justify-center text-2xl font-medium mb-4 mx-auto">
              {displayProfile.displayName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <h2 className="text-xl font-medium text-center mb-1">{displayProfile.displayName}</h2>
            <p className="text-neutral-400 text-sm text-center mb-6">{displayProfile.email}</p>
            
            <div className="border-t border-neutral-800 pt-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-neutral-400">Balance</span>
                <span className="font-medium text-green-400">{displayProfile.credits} INR</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Member Since</span>
                <span className="font-medium">{new Date(displayProfile.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={18} className="text-yellow-500" />
              <h3 className="text-lg font-medium">Achievements</h3>
            </div>
            <div className="space-y-3">
              {achievements.length > 0 ? achievements.map((ach, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={ach.id} 
                  className="flex items-center gap-3 p-3 bg-neutral-950 border border-neutral-800 rounded-xl"
                >
                  <div className="w-8 h-8 rounded-full bg-yellow-950 text-yellow-500 flex items-center justify-center flex-shrink-0">
                    <Trophy size={14} />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{ach.name}</div>
                    <div className="text-xs text-neutral-500">Unlocked {ach.timestamp?.toDate().toLocaleDateString()}</div>
                  </div>
                </motion.div>
              )) : (
                <div className="text-sm text-neutral-500 text-center py-4">Keep playing to unlock achievements!</div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-1 md:col-span-2">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 h-full shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <History size={20} className="text-neutral-400" />
              <h3 className="text-lg font-medium">Recent Activity</h3>
            </div>

            {loading ? (
              <div className="text-neutral-500 text-sm">Loading history...</div>
            ) : history.length > 0 ? (
              <div className="space-y-4">
                {history.map((record, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={record.id} 
                    className="flex justify-between items-center p-3 rounded-lg bg-neutral-950 border border-neutral-800"
                  >
                    <div>
                      <div className="font-medium capitalize mb-1">{record.gameId.replace('-', ' ')}</div>
                      <div className="text-xs text-neutral-500">
                        {record.timestamp?.toDate().toLocaleString()}
                      </div>
                    </div>
                    <div className={`font-medium ${record.profit >= 0 ? 'text-green-400' : 'text-neutral-400'}`}>
                      {record.profit >= 0 ? '+' : ''}{record.profit} INR
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-neutral-500 text-sm">No games played yet.</div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
