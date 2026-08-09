import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp, increment, onSnapshot, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { motion, AnimatePresence } from 'motion/react';
import { playSound, playBgm, stopBgm } from '../lib/audio';
import confetti from 'canvas-confetti';
import { Dices, Target, CircleDollarSign, LoaderPinwheel, Gamepad2, Volume2, VolumeX, X } from 'lucide-react';

export function GameView() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { user, profile: storeProfile, updateCredits } = useAuthStore();
  const profile: any = storeProfile || (user ? {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email?.split('@')[0] || 'User',
    credits: 0,
    isAdmin: user.email === 'saritagupta77300@gmail.com',
    createdAt: Date.now(),
    stats: { totalWins: 0, totalCreditsWon: 0 }
  } : null);
  const [wager, setWager] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<{ win: boolean, amount: number, message: string } | null>(null);
  const [showWinModal, setShowWinModal] = useState(false);
  const [winAmount, setWinAmount] = useState(0);
  const [winTimer, setWinTimer] = useState<any>(null);
  const [showLoseModal, setShowLoseModal] = useState(false);
  const [loseTimer, setLoseTimer] = useState<any>(null);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [rechargeTimer, setRechargeTimer] = useState<any>(null);
  
  const [dbConfig, setDbConfig] = useState<any>(null);
  const [override, setOverride] = useState<'win' | 'lose' | null>(null);

  // Multiplayer & Online state
  const [playMode, setPlayMode] = useState<'bot' | 'real'>('bot');
  const [isOnline, setIsOnline] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [requestSentTo, setRequestSentTo] = useState<string | null>(null);

  // Game specific inputs
  const [coinChoice, setCoinChoice] = useState<'heads' | 'tails'>('heads');
  const [diceChoiceType, setDiceChoiceType] = useState<'number' | 'odd' | 'even'>('number');
  const [diceNumberChoice, setDiceNumberChoice] = useState<number>(1);
  const [lastOutcome, setLastOutcome] = useState<string | number | null>(null);
  const [isMuted, setIsMuted] = useState(localStorage.getItem('isMuted') === 'true');
  const [limits, setLimits] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!isMuted) {
      playBgm();
    } else {
      stopBgm();
    }
    return () => {
      stopBgm();
    }
  }, [isMuted]);

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    localStorage.setItem('isMuted', newMuted.toString());
    if (newMuted) {
      stopBgm();
    } else {
      playBgm();
    }
  };

  useEffect(() => {
    async function fetchConfig() {
      if (!gameId) return;
      try {
        const snap = await getDoc(doc(db, 'games', gameId));
        if (snap.exists()) {
          setDbConfig(snap.data());
        }
        const limitsSnap = await getDoc(doc(db, 'settings', 'limits'));
        if (limitsSnap.exists()) {
          setLimits(limitsSnap.data());
        }
      } catch (err) {
        // Fallback if offline
      }
    }
    fetchConfig();
  }, [gameId]);

  useEffect(() => {
    if (!user || !gameId || !profile) return;
    
    const sessionRef = doc(db, 'live_sessions', user.uid);
    setDoc(sessionRef, {
      uid: user.uid,
      displayName: profile.displayName || user.displayName || user.email?.split('@')[0] || 'User',
      gameId,
      lastActive: serverTimestamp(),
      overrideResult: null
    }, { merge: true });

    const unsub = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.overrideResult) {
          setOverride(data.overrideResult);
        }
      }
    });

    return () => unsub();
  }, [user, gameId, profile]);

  useEffect(() => {
    if (!user || !gameId) return;
    
    // Listen to online players for this game
    const q = collection(db, 'live_sessions');
    const unsub = onSnapshot(q, (snap) => {
      const fiveMinsAgo = Date.now() - 5 * 60000;
      const online = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((d: any) => d.id !== user.uid && d.gameId === gameId && d.lastActive?.toMillis() > fiveMinsAgo && d.isOnline);
      
      setOnlineUsers(online);
      
      // Check my own online status
      const myDoc = snap.docs.find(d => d.id === user.uid);
      if (myDoc && myDoc.data().isOnline) {
        setIsOnline(true);
      } else {
        setIsOnline(false);
      }
    });
    return () => unsub();
  }, [user, gameId]);

  const handleGoOnline = async () => {
    if (!user) return;
    if ((profile?.credits ?? 0) < 1) {
      alert("You need at least 1 INR to go online. Please recharge.");
      navigate('/wallet');
      return;
    }
    await setDoc(doc(db, 'live_sessions', user.uid), { isOnline: true }, { merge: true });
  };

  const handleSendRequest = (uid: string) => {
    setRequestSentTo(uid);
    setTimeout(() => {
      alert("The player didn't respond in time. Playing with bot instead.");
      setRequestSentTo(null);
      setPlayMode('bot');
    }, 3000); // Simulate rejection for now
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center bg-neutral-900 border border-neutral-800 rounded-2xl p-8">
        <h2 className="text-xl font-medium mb-2">Please log in</h2>
        <p className="text-neutral-400 text-sm mb-6">You need to be logged in to play games.</p>
        <a href="/login" className="inline-block bg-neutral-100 text-neutral-950 font-medium px-6 py-2.5 rounded-lg hover:bg-white transition-colors">Log In</a>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-xl mx-auto mt-20 text-center py-16 bg-neutral-900 border border-neutral-800 rounded-2xl">
        <div className="w-8 h-8 border-2 border-neutral-600 border-t-neutral-100 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-neutral-400">Loading game...</p>
      </div>
    );
  }

  const defaultGameConfig: Record<string, { name: string, icon: any }> = {
    'dice-roll': { name: 'Dice Roll', icon: Dices },
    'bowling': { name: 'Bowling Challenge', icon: Target },
    'coin-flip': { name: 'Coin Flip', icon: CircleDollarSign },
    'lucky-wheel': { name: 'Lucky Wheel', icon: LoaderPinwheel }
  };

  const config = defaultGameConfig[gameId || ''] || { name: dbConfig?.name || 'Custom Game', icon: Gamepad2 };
  const GameIcon = config.icon;

  const [countdown, setCountdown] = useState<number | null>(null);

  const handlePlay = async () => {
    if (wager <= 0 || playing) return;
    if (wager > profile.credits) {
      setShowRechargeModal(true);
      if (rechargeTimer) clearTimeout(rechargeTimer);
      const timer = setTimeout(() => {
        setShowRechargeModal(false);
      }, 4000);
      setRechargeTimer(timer);
      return;
    }
    
    setPlaying(true);
    setResult(null);
    setLastOutcome(null);
    setShowWinModal(false);
    setShowLoseModal(false);
    
    playSound('click');

    // Countdown 3..2..1
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      playSound('tick');
      import('../lib/audio').then(m => m.vibrate(50));
      await new Promise(r => setTimeout(r, 1000));
    }
    setCountdown(null);
    playSound('roll');
    import('../lib/audio').then(m => m.vibrate([100, 50, 100]));

    // Simulate game logic delay with fun animation time
    await new Promise(r => setTimeout(r, 2000));

    let win = false;
    let multiplier = 0;
    let message = '';
    let outcomeValue: string | number | null = null;

    const random = Math.random();
    
    let forcedOutcome = override;
    if (forcedOutcome) {
      setOverride(null);
      updateDoc(doc(db, 'live_sessions', user!.uid), { overrideResult: null }).catch(console.error);
    }

    if (forcedOutcome === 'win') {
      win = true;
      multiplier = dbConfig ? dbConfig.multiplier : 1.27;
      message = 'Won of + 27% of the bet amount!';
      outcomeValue = gameId === 'coin-flip' ? coinChoice : gameId === 'dice-roll' ? diceNumberChoice : null;
    } else if (forcedOutcome === 'lose') {
      win = false;
      multiplier = 0;
      message = 'Loss of bet amount';
      outcomeValue = gameId === 'coin-flip' ? (coinChoice === 'heads' ? 'tails' : 'heads') : null;
    } else {
      // Normal logic with 60% winning rate as requested
      let effectiveWinRate = 60;
      const winProbability = effectiveWinRate / 100;

      if (dbConfig) {
        win = random < winProbability;
        multiplier = win ? dbConfig.multiplier : 0;
        message = win ? 'Won of + 27% of the bet amount!' : 'Loss of bet amount';
      } else {
        if (gameId === 'coin-flip') {
          win = random < winProbability;
          const resultFace = win ? coinChoice : (coinChoice === 'heads' ? 'tails' : 'heads');
          outcomeValue = resultFace;
          const mult = limits?.multipliers?.['coin-flip'] ?? 1.27;
          multiplier = win ? mult : 0;
          message = win ? `It landed on ${resultFace}. Won of + 27% of the bet amount!` : `It landed on ${resultFace}. Loss of bet amount`;
        } else if (gameId === 'dice-roll') {
          const actualWinRate = diceChoiceType === 'number' ? winProbability / 3 : winProbability;
          win = random < actualWinRate;
          let roll = 1;
          const baseMult = limits?.multipliers?.['dice-roll'] ?? 1.27;
          if (diceChoiceType === 'number') {
            roll = win ? diceNumberChoice : (diceNumberChoice === 1 ? 2 : 1);
            multiplier = win ? baseMult * 2.5 : 0;
            message = win ? `You rolled a ${roll}. Exact match! Won of + 27% of the bet amount!` : `You rolled a ${roll}. Loss of bet amount`;
          } else {
            const evens = [2, 4, 6];
            const odds = [1, 3, 5];
            if (diceChoiceType === 'even') {
              roll = win ? evens[Math.floor(Math.random() * evens.length)] : odds[Math.floor(Math.random() * odds.length)];
            } else { // odd
              roll = win ? odds[Math.floor(Math.random() * odds.length)] : evens[Math.floor(Math.random() * evens.length)];
            }
            multiplier = win ? baseMult : 0;
            message = win ? `You rolled a ${roll}. Won of + 27% of the bet amount!` : `You rolled a ${roll}. Loss of bet amount`;
          }
          outcomeValue = roll;
        } else if (gameId === 'lucky-wheel') {
          win = random < winProbability;
          const baseMult = limits?.multipliers?.['lucky-wheel'] ?? 1.27;
          if (win) {
             const isJackpot = Math.random() < 0.2; 
             multiplier = isJackpot ? baseMult * 2.5 : baseMult;
             outcomeValue = isJackpot ? "JACKPOT" : "WIN";
             message = 'Won of + 27% of the bet amount!';
          } else {
             multiplier = 0;
             outcomeValue = "LOSE";
             message = 'Loss of bet amount';
          }
        } else if (gameId === 'dart-board') { 
          win = random < winProbability;
          const baseMult = limits?.multipliers?.['dart-board'] ?? 1.27;
          multiplier = win ? baseMult : 0;
          outcomeValue = win ? "BULLSEYE" : "MISS";
          message = win ? 'Bullseye! Won of + 27% of the bet amount!' : 'Loss of bet amount';
        } else { // bowling
          win = random < winProbability;
          const pins = win ? (Math.random() < 0.2 ? 10 : 8) : 4;
          const baseMult = limits?.multipliers?.['bowling'] ?? 1.27;
          multiplier = win ? (pins === 10 ? baseMult * 1.5 : baseMult * 0.75) : 0;
          outcomeValue = pins === 10 ? "STRIKE" : `${pins} PINS`;
          message = win ? `You knocked down ${pins} pins. Won of + 27% of the bet amount!` : `You knocked down ${pins} pins. Loss of bet amount`;
        }
      }
    }

    const winnings = Math.floor(wager * multiplier);
    const profit = winnings - wager;

    try {
      // 1. Instantly update local Zustand store
      updateCredits(profit);

      // 2. Instantly update local storage state (so balance is saved offline and immediately ready)
      try {
        const { updateUser: storageUpdateUser } = await import('../lib/storage');
        const oldStats = profile.stats || { totalWins: 0, totalCreditsWon: 0 };
        storageUpdateUser(user!.uid, {
          credits: (profile.credits || 0) + profit,
          hasBetAfterDeposit: true,
          hasPlacedBet: true,
          stats: {
            totalWins: win ? (oldStats.totalWins || 0) + 1 : (oldStats.totalWins || 0),
            totalCreditsWon: win ? (oldStats.totalCreditsWon || 0) + winnings : (oldStats.totalCreditsWon || 0)
          }
        });
      } catch (err) {
        console.warn("Local storage sync error:", err);
      }

      // 3. Show UI outcome IMMEDIATELY (non-blocking)
      setLastOutcome(outcomeValue);
      setResult({ win, amount: winnings, message });

      if (win) {
        playSound('win');
        import('../lib/audio').then(m => m.vibrate([200, 100, 200]));
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        setWinAmount(winnings);
        setShowWinModal(true);
      } else {
        playSound('lose');
        import('../lib/audio').then(m => m.vibrate([300]));
        setShowLoseModal(true);
      }

      // 4. Asynchronously update Firestore database in the background
      if (db) {
        const userRef = doc(db, 'users', user!.uid);
        setDoc(userRef, { 
          credits: increment(profit),
          hasBetAfterDeposit: true,
          hasPlacedBet: true,
          'stats.totalWins': win ? increment(1) : increment(0),
          'stats.totalCreditsWon': win ? increment(winnings) : increment(0)
        }, { merge: true }).catch(err => {
          console.warn("Firestore user sync error:", err);
        });

        // Achievements check
        if (win) {
          const currentWins = (profile.stats?.totalWins || 0) + 1;
          const currentTotalWon = (profile.stats?.totalCreditsWon || 0) + winnings;

          if (currentWins === 1) {
            const achRef = doc(db, 'achievements', `${user!.uid}_first_win`);
            setDoc(achRef, { uid: user!.uid, id: 'first_win', name: 'First Win', timestamp: serverTimestamp() }, { merge: true }).catch(() => {});
          }
          if (currentTotalWon >= 100 && (profile.stats?.totalCreditsWon || 0) < 100) {
            const achRef = doc(db, 'achievements', `${user!.uid}_100_credits`);
            setDoc(achRef, { uid: user!.uid, id: '100_credits', name: '100 Credits Won', timestamp: serverTimestamp() }, { merge: true }).catch(() => {});
          }
        }

        // Add to history
        addDoc(collection(db, 'history'), {
          uid: user!.uid,
          displayName: profile.displayName || 'A player',
          gameId,
          wager,
          winnings,
          profit,
          timestamp: serverTimestamp()
        }).catch(err => {
          console.warn("Firestore history save error:", err);
        });
      }
    } catch (error) {
      console.error("Error updating game result:", error);
    } finally {
      setPlaying(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-8 pb-12">
      <div className="mb-8 flex justify-between items-end border-b border-neutral-800 pb-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-semibold">{config.name}</h2>
            <button 
              onClick={toggleMute}
              className="p-2 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900 rounded-full transition-all active:scale-95"
            >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </div>
          <p className="text-neutral-400">Place your wager and try your luck.</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-neutral-500 mb-1">Available Balance</div>
          <div className="text-xl font-medium text-green-400">{profile.credits} INR</div>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-sm">
        <div className="mb-8 flex flex-col items-center justify-center h-56 bg-neutral-950 rounded-xl border border-neutral-800 overflow-hidden relative" style={{ perspective: 1000 }}>
          <AnimatePresence mode="wait">
            {countdown !== null ? (
              <motion.div
                key={countdown}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1.5 }}
                exit={{ opacity: 0, scale: 2 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="text-7xl font-bold text-neutral-100"
              >
                {countdown}
              </motion.div>
            ) : playing ? (
              <motion.div
                key="playing"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex flex-col items-center gap-4"
              >
                <motion.div
                  animate={
                    gameId === 'lucky-wheel' ? { rotate: [0, 3600], transition: { duration: 2, ease: "circOut" } } :
                    gameId === 'dice-roll' ? { rotateX: [0, 720, 0], rotateY: [0, 360, 720], y: [0, -50, 0, -25, 0], scale: [1, 1.5, 1], transition: { duration: 2, ease: "easeInOut", times: [0, 0.4, 0.6, 0.8, 1] } } :
                    gameId === 'coin-flip' ? { rotateY: [0, 1800], y: [0, -80, 0], scale: [1, 1.5, 1], transition: { duration: 2, ease: "easeInOut" } } :
                    gameId === 'dart-board' ? { scale: [2, 0.8, 1], z: [100, 0], opacity: [0, 1], transition: { duration: 1, ease: "easeIn" } } :
                    { x: [0, -10, 10, -10, 0], transition: { duration: 1.5, ease: "easeInOut" } }
                  }
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <GameIcon size={64} className="text-neutral-300 drop-shadow-xl" />
                </motion.div>
                <span className="text-sm font-medium text-neutral-400 tracking-widest uppercase">
                  {gameId === 'dice-roll' ? 'Rolling...' : 
                   gameId === 'coin-flip' ? 'Flipping...' : 
                   gameId === 'lucky-wheel' ? 'Spinning...' : 'Playing...'}
                </span>
              </motion.div>
            ) : result ? (
              <motion.div 
                key="result"
                initial={{ scale: 0.5, opacity: 0, y: 30 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                transition={{ type: "spring", bounce: 0.5 }}
                className="text-center w-full px-6"
              >
                <div className="mb-4 flex justify-center">
                  {lastOutcome ? (
                    <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-700 flex items-center justify-center text-2xl font-bold shadow-lg text-neutral-100 uppercase drop-shadow-xl">
                      {lastOutcome}
                    </div>
                  ) : (
                    <GameIcon size={40} className={result.win ? "text-green-500" : "text-neutral-500"} />
                  )}
                </div>
                <div className={`text-2xl font-bold mb-3 ${result.win ? 'text-green-400' : 'text-red-500'}`}>
                  {result.win ? 'won this amount' : 'lost this amount'}
                </div>
                <div className={`inline-block px-5 py-2 rounded-full bg-neutral-950 border ${result.win ? 'border-green-800/60' : 'border-red-800/60'}`}>
                  <span className={`font-bold text-lg ${result.win ? 'text-green-400' : 'text-red-500'}`}>
                    {result.win ? `+${result.amount - wager} INR` : `-${wager} INR`}
                  </span>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="ready"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <GameIcon size={48} className="text-neutral-600 mb-4 mx-auto" />
                <div className="text-neutral-500 font-medium">Ready to play?</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-6">
          {!dbConfig && gameId === 'coin-flip' && (
            <div>
              <label className="text-sm font-medium text-neutral-400 mb-2 block">Choose Side</label>
              <div className="flex gap-2">
                <button onClick={() => setCoinChoice('heads')} className={`flex-1 py-2 rounded-lg border active:scale-95 transition-all ${coinChoice === 'heads' ? 'bg-neutral-800 border-neutral-600' : 'bg-neutral-950 border-neutral-800'}`}>Heads</button>
                <button onClick={() => setCoinChoice('tails')} className={`flex-1 py-2 rounded-lg border active:scale-95 transition-all ${coinChoice === 'tails' ? 'bg-neutral-800 border-neutral-600' : 'bg-neutral-950 border-neutral-800'}`}>Tails</button>
              </div>
            </div>
          )}

          {!dbConfig && gameId === 'dice-roll' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-neutral-400 mb-2 block">Prediction Type</label>
                <div className="flex gap-2">
                  <button onClick={() => setDiceChoiceType('number')} className={`flex-1 py-2 text-sm rounded-lg border active:scale-95 transition-all ${diceChoiceType === 'number' ? 'bg-neutral-800 border-neutral-600' : 'bg-neutral-950 border-neutral-800'}`}>Exact Number (5x)</button>
                  <button onClick={() => setDiceChoiceType('even')} className={`flex-1 py-2 text-sm rounded-lg border active:scale-95 transition-all ${diceChoiceType === 'even' ? 'bg-neutral-800 border-neutral-600' : 'bg-neutral-950 border-neutral-800'}`}>Even (2x)</button>
                  <button onClick={() => setDiceChoiceType('odd')} className={`flex-1 py-2 text-sm rounded-lg border active:scale-95 transition-all ${diceChoiceType === 'odd' ? 'bg-neutral-800 border-neutral-600' : 'bg-neutral-950 border-neutral-800'}`}>Odd (2x)</button>
                </div>
              </div>
              {diceChoiceType === 'number' && (
                <div>
                  <label className="text-sm font-medium text-neutral-400 mb-2 block">Select Number</label>
                  <div className="flex gap-2">
                    {[1,2,3,4,5,6].map(num => (
                      <button key={num} onClick={() => setDiceNumberChoice(num)} className={`flex-1 py-2 rounded-lg border active:scale-95 transition-all ${diceNumberChoice === num ? 'bg-neutral-800 border-neutral-600' : 'bg-neutral-950 border-neutral-800'}`}>{num}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-neutral-400">Wager Amount (INR)</label>
              <button 
                onClick={() => setWager(profile.credits)}
                className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors active:scale-95"
              >
                Max
              </button>
            </div>
            <div className="relative">
              <input
                type="number"
                min="1"
                max={profile.credits}
                value={wager}
                onChange={(e) => setWager(Math.min(profile.credits, Math.max(1, parseInt(e.target.value) || 0)))}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-4 pr-12 py-3 text-neutral-100 focus:outline-none focus:border-neutral-600 transition-colors font-medium text-lg"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-medium">INR</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-neutral-400">Play Mode</label>
            </div>
            <div className="flex gap-2 mb-6 p-1 bg-neutral-950 rounded-xl border border-neutral-800">
              <button 
                onClick={() => setPlayMode('bot')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all active:scale-95 ${playMode === 'bot' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                Play with Bot
              </button>
              <button 
                onClick={() => setPlayMode('real')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all active:scale-95 ${playMode === 'real' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                Play with Real User
              </button>
            </div>
          </div>

          {playMode === 'real' ? (
            <AnimatePresence mode="wait">
              <motion.div 
                key="real"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-neutral-950 border border-neutral-800 rounded-xl p-6 text-center overflow-hidden"
              >
                {!isOnline ? (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
                    className="space-y-4"
                  >
                    <p className="text-neutral-400 text-sm">You are currently offline. Go online to challenge other players!</p>
                    <button 
                      onClick={handleGoOnline}
                      className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all active:scale-95 shadow-sm"
                    >
                      Go Online
                    </button>
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
                    className="space-y-4 text-left"
                  >
                    <h3 className="font-medium text-neutral-300">Online Players</h3>
                    {onlineUsers.length === 0 ? (
                      <div className="text-center py-4 space-y-4">
                        <p className="text-neutral-500 text-sm">No players are currently online for this game.</p>
                        <button 
                          onClick={() => setPlayMode('bot')}
                          className="px-6 py-2 bg-neutral-800 text-neutral-100 font-medium rounded-lg hover:bg-neutral-700 transition-all active:scale-95 text-sm shadow-sm"
                        >
                          Play with Bot Instead
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {onlineUsers.map(u => (
                          <motion.div 
                            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                            key={u.id} 
                            className="flex justify-between items-center bg-neutral-900 border border-neutral-800 p-3 rounded-lg"
                          >
                            <span className="font-medium text-sm">{u.displayName || 'Player'}</span>
                            <button 
                              onClick={() => handleSendRequest(u.id)}
                              disabled={requestSentTo === u.id || playing}
                              className="px-4 py-1.5 bg-neutral-100 text-neutral-900 text-sm font-medium rounded-md hover:bg-white transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                            >
                              {requestSentTo === u.id ? 'Request Sent...' : 'Challenge'}
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={handlePlay}
              disabled={playing || wager <= 0}
              className="w-full bg-neutral-100 text-neutral-950 font-semibold rounded-lg px-4 py-3.5 hover:bg-white transition-all active:scale-95 disabled:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-sm"
            >
              {playing ? 'Playing...' : `Play for ${wager} INR`}
            </motion.button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showRechargeModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 max-w-sm w-full text-center relative shadow-2xl space-y-4">
              <button 
                onClick={() => {
                  setShowRechargeModal(false);
                  if (rechargeTimer) clearTimeout(rechargeTimer);
                }}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-neutral-800 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700 transition-colors"
              >
                <X size={18} />
              </button>
              <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto text-amber-400 text-2xl font-bold">
                ⚠️
              </div>
              <h3 className="text-xl font-semibold text-neutral-100">Recharge your wallet</h3>
              <p className="text-sm text-neutral-400">You don't have enough money in your wallet to place this wager.</p>
              <button
                onClick={() => {
                  setShowRechargeModal(false);
                  if (rechargeTimer) clearTimeout(rechargeTimer);
                  navigate('/wallet');
                }}
                className="w-full py-3 bg-neutral-100 hover:bg-white text-neutral-950 font-semibold rounded-xl transition-all shadow-sm"
              >
                Go to Wallet
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWinModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <div className="bg-neutral-900 border border-green-500 rounded-2xl p-6 max-w-sm w-full text-center relative shadow-2xl">
              <button 
                onClick={() => {
                  setShowWinModal(false);
                  if (winTimer) clearTimeout(winTimer);
                }}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-neutral-800 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700 transition-colors"
              >
                <X size={18} />
              </button>
              <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-4 text-green-400 text-2xl font-bold animate-bounce">
                🎉
              </div>
              <h3 className="text-2xl font-bold text-green-400 mb-1">won this amount</h3>
              <p className="text-sm text-neutral-400 mb-4">Payout credited to wallet</p>
              <div className="text-3xl font-extrabold text-green-400 bg-neutral-950 border border-green-900/60 py-3 rounded-xl shadow-inner">
                +{winAmount - wager} INR
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLoseModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <div className="bg-neutral-900 border border-red-500 rounded-2xl p-6 max-w-sm w-full text-center relative shadow-2xl">
              <button 
                onClick={() => {
                  setShowLoseModal(false);
                  if (loseTimer) clearTimeout(loseTimer);
                }}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-neutral-800 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700 transition-colors"
              >
                <X size={18} />
              </button>
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400 text-2xl font-bold">
                💸
              </div>
              <h3 className="text-2xl font-bold text-red-500 mb-1">lost this amount</h3>
              <p className="text-sm text-neutral-400 mb-4">Deducted from wallet</p>
              <div className="text-3xl font-extrabold text-red-500 bg-neutral-950 border border-red-900/60 py-3 rounded-xl shadow-inner">
                -{wager} INR
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
