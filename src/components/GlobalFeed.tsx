import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy } from 'lucide-react';

export function GlobalFeed() {
  const [wins, setWins] = useState<any[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'history'),
      where('profit', '>', 0),
      orderBy('profit', 'desc'), // composite index needed if not ordered by profit, wait! If I order by timestamp desc and where profit > 0, it requires composite index. 
      // To avoid index creation delays, let's just fetch recent history and filter locally.
      limit(20)
    );
    // Actually, where('profit', '>', 0) and orderBy('timestamp', 'desc') needs an index.
    // Instead, let's just query history ordered by timestamp, and filter in JS.
    const qNoIndex = query(
      collection(db, 'history'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsub = onSnapshot(qNoIndex, (snap) => {
      const recentWins = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((record: any) => record.profit > 0);
      setWins(recentWins);
    });

    return () => unsub();
  }, []);

  if (wins.length === 0) return null;

  return (
    <div className="fixed bottom-24 left-4 z-30 pointer-events-none">
      <div className="flex flex-col-reverse gap-2">
        <AnimatePresence>
          {wins.slice(0, 2).map((win) => (
            <motion.div
              key={win.id}
              initial={{ opacity: 0, x: -20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="bg-neutral-900/90 backdrop-blur-sm border border-neutral-800 p-3 rounded-2xl shadow-xl flex items-center gap-3 w-64 pointer-events-auto"
            >
              <div className="w-8 h-8 rounded-full bg-yellow-950 text-yellow-500 flex items-center justify-center flex-shrink-0">
                <Trophy size={14} />
              </div>
              <div>
                <p className="text-xs text-neutral-300">
                  <span className="font-medium text-neutral-100">{win.displayName || 'A player'}</span> won
                </p>
                <p className="text-sm font-medium text-green-400">
                  {win.profit} INR in {win.gameId.replace('-', ' ')}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
