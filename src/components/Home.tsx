import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion } from 'motion/react';
import { Dices, Target, CircleDollarSign, LoaderPinwheel, Gamepad2 } from 'lucide-react';

const DEFAULT_GAMES = [
  { id: 'dice-roll', name: 'Dice Roll', icon: Dices, description: 'Roll the dice and win.' },
  { id: 'dart-board', name: 'Dart Board', icon: Target, description: 'Hit the bullseye.' },
  { id: 'coin-flip', name: 'Coin Flip', icon: CircleDollarSign, description: 'Heads or Tails?' },
  { id: 'lucky-wheel', name: 'Lucky Wheel', icon: LoaderPinwheel, description: 'Spin to win big.' }
];

export function Home() {
  const { user } = useAuthStore();
  const [games, setGames] = useState<any[]>(DEFAULT_GAMES);

  useEffect(() => {
    async function fetchGames() {
      try {
        const snap = await getDocs(collection(db, 'games'));
        if (!snap.empty) {
          const fetchedGames = snap.docs.map(doc => {
            const data = doc.data();
            // Assign icon based on id mapping or fallback to Gamepad2
            let icon = Gamepad2;
            if (doc.id === 'dice-roll') icon = Dices;
            else if (doc.id === 'dart-board') icon = Target;
            else if (doc.id === 'coin-flip') icon = CircleDollarSign;
            else if (doc.id === 'lucky-wheel') icon = LoaderPinwheel;

            return {
              id: doc.id,
              name: data.name,
              description: data.description,
              icon
            };
          });
          setGames(fetchedGames);
        }
      } catch (err) {
        // Fallback default games if offline or uninitialized
      }
    }
    fetchGames();
  }, []);

  return (
    <div className="py-8">
      <div className="mb-12 text-center max-w-2xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-semibold mb-4 tracking-tight">Welcome to Risk and reward</h1>
        <p className="text-neutral-400 text-lg">
          A premium entertainment platform. Play games using virtual Demo Credits.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {games.map((game, index) => (
          <motion.div
            key={game.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link 
              to={user ? `/game/${game.id}` : '/login'}
              className="block group bg-neutral-900 border border-neutral-800 rounded-2xl p-6 hover:bg-neutral-800/80 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <game.icon size={24} className="text-neutral-300" />
              </div>
              <h3 className="text-xl font-medium mb-2">{game.name}</h3>
              <p className="text-neutral-400 text-sm">{game.description}</p>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
