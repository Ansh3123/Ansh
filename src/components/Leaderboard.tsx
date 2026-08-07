import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Trophy, Star, Medal } from 'lucide-react';

export function Leaderboard() {
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaders() {
      try {
        const q = query(
          collection(db, 'users'),
          orderBy('stats.totalCreditsWon', 'desc'),
          limit(10)
        );
        const querySnapshot = await getDocs(q);
        setLeaders(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        // Fallback if offline
      } finally {
        setLoading(false);
      }
    }
    fetchLeaders();
  }, []);

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4 pb-32">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-semibold mb-2">Global Leaderboard</h1>
        <p className="text-neutral-400">Top players by total earnings and wins.</p>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6 text-yellow-500">
          <Trophy size={20} />
          <h2 className="text-lg font-medium text-neutral-100">Top 10 Rankings</h2>
        </div>
        
        <div className="space-y-3">
          {loading ? (
            <div className="text-center text-neutral-500 py-4">Loading rankings...</div>
          ) : leaders.length > 0 ? (
            leaders.map((user, index) => (
              <div 
                key={user.id} 
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-neutral-950 border border-neutral-800 rounded-xl gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                    index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                    index === 1 ? 'bg-neutral-300/20 text-neutral-300' :
                    index === 2 ? 'bg-amber-700/20 text-amber-700' :
                    'bg-neutral-800 text-neutral-400'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-neutral-100">{user.displayName || 'Unknown Player'}</div>
                    <div className="text-xs text-neutral-500 mt-1 flex items-center gap-3">
                      <span className="flex items-center gap-1"><Star size={12} className="text-yellow-500/70"/> {user.stats?.totalWins || 0} Wins</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <div className="text-xs text-neutral-400">Total Earned</div>
                  <div className="font-medium bg-neutral-900 border border-neutral-800 px-4 py-1.5 rounded-full text-sm text-green-400 flex items-center gap-1">
                    <Medal size={14} className="text-green-500"/>
                    {user.stats?.totalCreditsWon || 0} INR
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-neutral-500 py-4">No data available.</div>
          )}
        </div>
      </div>
    </div>
  );
}
