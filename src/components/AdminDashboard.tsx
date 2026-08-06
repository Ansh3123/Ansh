import { useEffect, useState, FormEvent, MouseEvent } from 'react';
import { useAuthStore } from '../store/authStore';
import { collection, query, limit, getDocs, doc, updateDoc, increment, orderBy, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, Activity, Settings, Gift, ArrowDownToLine, ArrowUpFromLine, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function AdminDashboard() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  
  const [users, setUsers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [liveSessions, setLiveSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [grantAmount, setGrantAmount] = useState(10);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'requests' | 'games' | 'live' | 'settings' | 'domains'>('requests');
  const [authorizedDomains, setAuthorizedDomains] = useState<string[]>([
    'ansh-risknreward.vercel.app',
    'ais-dev-uhulvo4bxmmldlfknoraaj-266190708646.asia-southeast1.run.app',
    'ais-pre-uhulvo4bxmmldlfknoraaj-266190708646.asia-southeast1.run.app',
    'ai.studio',
    'run.app',
    'asia-southeast1.run.app',
    'localhost',
    '127.0.0.1'
  ]);
  const [newDomainInput, setNewDomainInput] = useState('');
  const [limits, setLimits] = useState({ 
    minRecharge: 3, 
    minWithdraw: 5,
    winRates: {
      'coin-flip': 45,
      'dice-roll': 45,
      'lucky-wheel': 45,
      'dart-board': 45,
      'bowling': 45
    },
    multipliers: {
      'coin-flip': 1.27,
      'dice-roll': 1.27,
      'lucky-wheel': 1.27,
      'dart-board': 1.27,
      'bowling': 1.27
    }
  });

  const [newGame, setNewGame] = useState({ id: '', name: '', description: '', winRate: 45, multiplier: 1.27 });

  useEffect(() => {
    if (profile?.isAdmin) setIsAuthenticated(true);
  }, [profile]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Fetch users
    const fetchUsers = async () => {
      const q = query(collection(db, 'users'), limit(500));
      const snap = await getDocs(q);
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchUsers();

    // Listen to requests
    const qReq = query(collection(db, 'payment_requests'), orderBy('timestamp', 'desc'), limit(50));
    const unsubReq = onSnapshot(qReq, (snap) => {
      setRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to games config
    const qGames = query(collection(db, 'games'));
    const unsubGames = onSnapshot(qGames, (snap) => {
      setGames(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to live sessions
    const qLive = query(collection(db, 'live_sessions'), orderBy('lastActive', 'desc'));
    const unsubLive = onSnapshot(qLive, (snap) => {
      setLiveSessions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch limits
    const unsubSettings = onSnapshot(doc(db, 'settings', 'limits'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setLimits(prev => ({ 
          ...prev, 
          minRecharge: data.minRecharge ?? prev.minRecharge, 
          minWithdraw: data.minWithdraw ?? prev.minWithdraw,
          winRates: { ...prev.winRates, ...(data.winRates || {}) },
          multipliers: { ...prev.multipliers, ...(data.multipliers || {}) }
        }));
      }
    });

    // Fetch authorized domains
    const unsubDomains = onSnapshot(doc(db, 'settings', 'authorized_domains'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().domains) {
        setAuthorizedDomains(docSnap.data().domains);
      } else {
        setDoc(doc(db, 'settings', 'authorized_domains'), { 
          domains: [
            'ansh-risknreward.vercel.app',
            'ais-dev-uhulvo4bxmmldlfknoraaj-266190708646.asia-southeast1.run.app',
            'ais-pre-uhulvo4bxmmldlfknoraaj-266190708646.asia-southeast1.run.app',
            'ai.studio',
            'run.app',
            'asia-southeast1.run.app',
            'localhost',
            '127.0.0.1'
          ] 
        }, { merge: true });
      }
    });

    setLoading(false);

    return () => {
      unsubReq();
      unsubGames();
      unsubLive();
      unsubSettings();
      unsubDomains();
    };
  }, [isAuthenticated]);

  const handleAddDomain = async (e: FormEvent) => {
    e.preventDefault();
    if (!newDomainInput.trim()) return;
    const cleaned = newDomainInput.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (authorizedDomains.includes(cleaned)) {
      alert('Domain already exists!');
      return;
    }
    const updated = [...authorizedDomains, cleaned];
    try {
      await setDoc(doc(db, 'settings', 'authorized_domains'), { domains: updated }, { merge: true });
      setAuthorizedDomains(updated);
      setNewDomainInput('');
      alert(`Domain "${cleaned}" successfully added to Firebase authorized domains!`);
    } catch (err) {
      console.error(err);
      alert('Failed to add domain.');
    }
  };

  const handleRemoveDomain = async (domainToRemove: string) => {
    const updated = authorizedDomains.filter(d => d !== domainToRemove);
    try {
      await setDoc(doc(db, 'settings', 'authorized_domains'), { domains: updated }, { merge: true });
      setAuthorizedDomains(updated);
    } catch (err) {
      console.error(err);
      alert('Failed to remove domain.');
    }
  };

  const handleSaveLimits = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'settings', 'limits'), limits);
      alert('Limits updated successfully.');
    } catch (err) {
      console.error(err);
      alert('Failed to update limits.');
    }
  };

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    if (password === 'kakarotisaura') {
      setIsAuthenticated(true);
    } else {
      alert('Invalid admin password');
    }
  };

  const handleProcessRequest = async (reqId: string, uid: string, amount: number, type: string, action: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'payment_requests', reqId), { status: action });
      
      if (action === 'approved') {
        const value = type === 'recharge' ? amount : -amount;
        await setDoc(doc(db, 'users', uid), {
          credits: increment(value)
        }, { merge: true });
        alert(`Request ${action} and wallet updated.`);
      } else {
        alert(`Request ${action}.`);
      }
    } catch (err) {
      console.error(err);
      alert('Error processing request.');
    }
  };

  const handleGrantCredits = async () => {
    if (!selectedUser || grantAmount === 0) return;
    try {
      await setDoc(doc(db, 'users', selectedUser), { credits: increment(grantAmount) }, { merge: true });
      alert('Credits updated successfully');
      setGrantAmount(10);
    } catch (error) {
      console.error(error);
      alert('Failed to update credits');
    }
  };

  const handleSaveGame = async (e: FormEvent) => {
    e.preventDefault();
    if (!newGame.id || !newGame.name) return;
    try {
      await setDoc(doc(db, 'games', newGame.id), newGame);
      alert('Game saved successfully!');
      setNewGame({ id: '', name: '', description: '', winRate: 50, multiplier: 2 });
    } catch (err) {
      console.error(err);
      alert('Failed to save game');
    }
  };

  const handleDeleteGame = async (e: FormEvent | MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this game?")) return;
    try {
      await deleteDoc(doc(db, 'games', id));
      alert('Game deleted successfully!');
      if (newGame.id === id) {
        setNewGame({ id: '', name: '', description: '', winRate: 50, multiplier: 2 });
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete game');
    }
  };

  const handleForceResult = async (uid: string, result: 'win' | 'lose') => {
    try {
      await updateDoc(doc(db, 'live_sessions', uid), {
        overrideResult: result
      });
      alert(`User forced to ${result} their next game.`);
    } catch (err) {
      console.error(err);
      alert('Failed to force result');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-16 p-8 bg-neutral-900 border border-neutral-800 rounded-2xl text-center">
        <h1 className="text-2xl font-semibold mb-6">Admin Access</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            placeholder="Enter Admin Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-100 focus:outline-none focus:border-neutral-600 transition-colors text-center"
          />
          <button type="submit" className="w-full bg-neutral-100 text-neutral-950 font-medium rounded-lg px-4 py-2.5 hover:bg-white transition-colors">
            Access Dashboard
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Admin Dashboard</h1>
        <p className="text-neutral-400">Manage users, requests, and platform settings.</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-neutral-800 pb-2 flex-wrap">
        <button onClick={() => setActiveTab('requests')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'requests' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}>Wallet Requests</button>
        <button onClick={() => setActiveTab('games')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'games' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}>Game Config</button>
        <button onClick={() => setActiveTab('users')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'users' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}>Users & Manual Grant</button>
        <button onClick={() => setActiveTab('live')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'live' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}>Live Players</button>
        <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}>Settings</button>
        <button onClick={() => setActiveTab('domains')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'domains' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}>Authorized Domains</button>
      </div>

      {activeTab === 'domains' && (
        <div className="max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
          <h2 className="text-lg font-medium">Authorized Domains Whitelist</h2>
          <p className="text-sm text-neutral-400">
            Manage authorized domains for Firebase Auth and hosting integration stored securely in Firebase Firestore.
          </p>

          <form onSubmit={handleAddDomain} className="flex gap-3">
            <input
              type="text"
              placeholder="e.g. ansh-risknreward.vercel.app"
              value={newDomainInput}
              onChange={(e) => setNewDomainInput(e.target.value)}
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 text-sm"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-neutral-100 hover:bg-white text-neutral-950 font-semibold rounded-xl text-sm transition-colors"
            >
              Add Domain
            </button>
          </form>

          <div className="space-y-3">
            {authorizedDomains.map((domain) => (
              <div key={domain} className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-mono text-sm text-neutral-200">{domain}</div>
                  <div className="text-xs text-emerald-400 mt-1">● Whitelisted & Stored in Firebase</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(domain);
                      alert('Domain copied to clipboard!');
                    }}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors"
                  >
                    Copy
                  </button>
                  {domain !== 'ansh-risknreward.vercel.app' && (
                    <button
                      onClick={() => handleRemoveDomain(domain)}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs text-neutral-500 leading-relaxed bg-neutral-950 p-4 rounded-xl border border-neutral-800">
            <span className="font-semibold text-neutral-300">Note on Firebase Authentication:</span> Firebase Auth requires authorized domains to be added in your Firebase Console (Authentication &gt; Settings &gt; Authorized domains) if you host your frontend on custom domains like Vercel.
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
          <h2 className="text-lg font-medium mb-4">Platform Settings</h2>
          <form onSubmit={handleSaveLimits} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Minimum Recharge (INR)</label>
                <input
                  type="number"
                  min="1"
                  value={limits.minRecharge}
                  onChange={(e) => setLimits(prev => ({ ...prev, minRecharge: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Minimum Withdrawal (INR)</label>
                <input
                  type="number"
                  min="1"
                  value={limits.minWithdraw}
                  onChange={(e) => setLimits(prev => ({ ...prev, minWithdraw: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-100"
                />
              </div>
            </div>

            <div className="border-t border-neutral-800 pt-4">
              <h3 className="text-md font-medium mb-4">Base Game Win Rates (%) & Payout Multipliers</h3>
              <div className="space-y-4">
                {Object.keys(limits.winRates).map(gameId => (
                  <div key={gameId} className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div>
                      <h4 className="font-medium text-sm capitalize">{gameId.replace('-', ' ')}</h4>
                      <p className="text-xs text-neutral-500">Configure win probability and payout multiplier.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Win Rate (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={limits.winRates[gameId as keyof typeof limits.winRates]}
                          onChange={(e) => setLimits(prev => ({
                            ...prev,
                            winRates: {
                              ...prev.winRates,
                              [gameId]: parseInt(e.target.value) || 0
                            }
                          }))}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-sm text-neutral-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Payout Multiplier</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={limits.multipliers?.[gameId as keyof typeof limits.multipliers] ?? 2}
                          onChange={(e) => setLimits(prev => ({
                            ...prev,
                            multipliers: {
                              ...prev.multipliers,
                              [gameId]: parseFloat(e.target.value) || 0
                            }
                          }))}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-sm text-neutral-100"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-neutral-500 mt-3">These rates and multipliers are used if no custom game config overrides them in the 'Game Config' tab.</p>
            </div>

            <button type="submit" className="w-full bg-neutral-100 text-neutral-950 font-medium rounded-lg px-4 py-2.5 hover:bg-white transition-colors">
              Save Settings
            </button>
          </form>
        </div>
      )}

      {activeTab === 'live' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
          <h2 className="text-lg font-medium mb-4">Live Players (Active last 5 mins)</h2>
          <div className="space-y-3">
            {liveSessions.filter(s => s.lastActive?.toDate() > new Date(Date.now() - 5 * 60000)).map(session => (
              <div key={session.id} className="flex justify-between items-center p-4 bg-neutral-950 border border-neutral-800 rounded-xl">
                <div>
                  <div className="font-medium text-sm">{session.displayName}</div>
                  <div className="text-xs text-neutral-400">Playing: {session.gameId}</div>
                  {session.overrideResult && (
                    <div className="text-xs text-yellow-500 mt-1">Pending force: {session.overrideResult.toUpperCase()}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleForceResult(session.uid, 'win')} className="px-3 py-1.5 bg-green-950 text-green-500 hover:bg-green-900 text-sm font-medium rounded-lg transition-colors">
                    Force Win
                  </button>
                  <button onClick={() => handleForceResult(session.uid, 'lose')} className="px-3 py-1.5 bg-red-950 text-red-500 hover:bg-red-900 text-sm font-medium rounded-lg transition-colors">
                    Force Lose
                  </button>
                </div>
              </div>
            ))}
            {liveSessions.filter(s => s.lastActive?.toDate() > new Date(Date.now() - 5 * 60000)).length === 0 && (
              <div className="text-neutral-500 text-sm">No active players right now.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
          <h2 className="text-lg font-medium mb-4">Pending & Recent Requests</h2>
          <div className="space-y-3">
            {requests.map(req => (
              <div key={req.id} className="flex justify-between items-center p-4 bg-neutral-950 border border-neutral-800 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-full ${req.type === 'recharge' ? 'bg-green-950 text-green-500' : 'bg-orange-950 text-orange-500'}`}>
                    {req.type === 'recharge' ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{req.displayName || req.email}</div>
                    <div className="text-xs text-neutral-400 capitalize">{req.type} • {req.amount} INR</div>
                    {req.utrNumber && <div className="text-xs text-yellow-500 mt-1 font-mono">UTR: {req.utrNumber}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {req.status === 'pending' ? (
                    <>
                      <button onClick={() => handleProcessRequest(req.id, req.uid, req.amount, req.type, 'approved')} className="p-2 bg-green-950 text-green-500 hover:bg-green-900 rounded-lg transition-colors">
                        <Check size={16} />
                      </button>
                      <button onClick={() => handleProcessRequest(req.id, req.uid, req.amount, req.type, 'rejected')} className="p-2 bg-red-950 text-red-500 hover:bg-red-900 rounded-lg transition-colors">
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <span className={`text-xs font-medium ${req.status === 'approved' ? 'text-green-500' : 'text-red-500'}`}>
                      {req.status.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {requests.length === 0 && <div className="text-neutral-500 text-sm">No requests found.</div>}
          </div>
        </div>
      )}

      {activeTab === 'games' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
            <h2 className="text-lg font-medium mb-4">Add / Edit Game</h2>
            <form onSubmit={handleSaveGame} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Game ID (e.g. dice-roll)</label>
                <input required type="text" value={newGame.id} onChange={e => setNewGame({...newGame, id: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Name</label>
                <input required type="text" value={newGame.name} onChange={e => setNewGame({...newGame, name: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Description</label>
                <input required type="text" value={newGame.description} onChange={e => setNewGame({...newGame, description: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-100" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-neutral-400 mb-1">Win Rate (%)</label>
                  <input required type="number" min="0" max="100" value={newGame.winRate} onChange={e => setNewGame({...newGame, winRate: parseFloat(e.target.value)})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-100" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-neutral-400 mb-1">Multiplier</label>
                  <input required type="number" step="0.1" value={newGame.multiplier} onChange={e => setNewGame({...newGame, multiplier: parseFloat(e.target.value)})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-100" />
                </div>
              </div>
              <button type="submit" className="w-full bg-neutral-100 text-neutral-950 font-medium rounded-lg px-4 py-2.5 hover:bg-white transition-colors">
                Save Game Config
              </button>
            </form>
          </div>
          
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
            <h2 className="text-lg font-medium mb-4">Configured Games</h2>
            <div className="space-y-3">
              {games.map(g => (
                <div key={g.id} className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl flex justify-between items-center cursor-pointer hover:border-neutral-600 transition-colors" onClick={() => setNewGame(g)}>
                  <div>
                    <div className="font-medium">{g.name}</div>
                    <div className="text-xs text-neutral-500">ID: {g.id}</div>
                  </div>
                  <div className="text-right text-sm flex items-center gap-4">
                    <div>
                      <div>{g.winRate}% Win</div>
                      <div className="text-neutral-400">{g.multiplier}x Payout</div>
                    </div>
                    <button 
                      onClick={(e) => handleDeleteGame(e, g.id)}
                      className="p-2 text-red-500 hover:bg-red-950 rounded-lg transition-colors"
                      title="Delete Game"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {games.length === 0 && <div className="text-neutral-500 text-sm">No custom games added yet. Default ones apply.</div>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:col-span-1 h-fit">
            <h2 className="text-lg font-medium mb-4">Manual Grant</h2>
            <div className="space-y-4">
              <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-100">
                <option value="">-- Select a user --</option>
                {users.filter(u => 
                  u.displayName?.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                  u.email?.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                  u.id?.toLowerCase().includes(userSearchQuery.toLowerCase())
                ).map(u => (
                  <option key={u.id} value={u.id}>{u.displayName} - {u.credits} INR</option>
                ))}
              </select>
              <input type="number" value={grantAmount} onChange={(e) => setGrantAmount(parseInt(e.target.value) || 0)} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-100" />
              <button onClick={handleGrantCredits} disabled={!selectedUser} className="w-full bg-neutral-100 text-neutral-950 font-medium rounded-lg px-4 py-2.5 hover:bg-white transition-colors disabled:opacity-50">
                Update Credits
              </button>
            </div>
          </div>
          
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:col-span-2">
            <h2 className="text-lg font-medium mb-4">Users List</h2>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search users by name, email or ID..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-neutral-400 border-b border-neutral-800">
                  <tr>
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Credits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {users.filter(u => 
                    u.displayName?.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                    u.email?.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                    u.id?.toLowerCase().includes(userSearchQuery.toLowerCase())
                  ).map(u => (
                    <tr key={u.id}>
                      <td className="py-3 font-medium">{u.displayName}</td>
                      <td className="py-3 text-neutral-400">{u.email}</td>
                      <td className="py-3">{u.credits} INR</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
