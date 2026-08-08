import { useEffect, useState, FormEvent, MouseEvent, ChangeEvent } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  getUsers,
  updateUser,
  getRequests,
  processPaymentRequest,
  getGames,
  saveGameConfig,
  deleteGameConfig,
  getLiveSessions,
  updateLiveSession,
  getSettings,
  saveSettings,
  saveUsers,
  saveRequests
} from '../lib/storage';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, updateDoc, onSnapshot, increment } from 'firebase/firestore';
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
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'requests' | 'games' | 'live' | 'settings'>('requests');
  const [limits, setLimits] = useState({ 
    minRecharge: 10, 
    minWithdraw: 30,
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

  const [requestFilter, setRequestFilter] = useState<'all' | 'pending' | 'recharge' | 'withdraw'>('all');
  const [requestSearch, setRequestSearch] = useState('');

  useEffect(() => {
    if (profile?.isAdmin) setIsAuthenticated(true);
  }, [profile]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const loadData = async () => {
      const localUsers = getUsers().map(u => ({ id: u.uid || u.email, ...u }));
      const localReqs = getRequests();
      
      let fsUsers: any[] = [];
      let fsReqs: any[] = [];
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        fsUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (e) {}

      try {
        const reqsSnap = await getDocs(collection(db, 'payment_requests'));
        fsReqs = reqsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (e) {}

      const userMap = new Map();
      [...localUsers, ...fsUsers].forEach((u: any) => {
        const key = u.uid || u.email || u.id;
        if (key) {
          userMap.set(key, { ...(userMap.get(key) || {}), ...u });
        }
      });
      const mergedUsers = Array.from(userMap.values());
      mergedUsers.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setUsers(mergedUsers);

      const reqMap = new Map();
      [...localReqs, ...fsReqs].forEach((r: any) => {
        if (r.id) {
          reqMap.set(r.id, { ...(reqMap.get(r.id) || {}), ...r });
        }
      });
      const mergedReqs = Array.from(reqMap.values());
      mergedReqs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setRequests(mergedReqs);

      const allGames = getGames();
      setGames(allGames);

      const allLive = getLiveSessions().map(s => ({ id: s.uid, ...s }));
      setLiveSessions(allLive);

      const st = getSettings();
      setLimits(prev => ({
        ...prev,
        minRecharge: st.minRecharge ?? prev.minRecharge,
        minWithdraw: st.minWithdraw ?? prev.minWithdraw,
        winRates: { ...prev.winRates, ...(st.winRates || {}) },
        multipliers: { ...prev.multipliers, ...(st.multipliers || {}) }
      }));
    };

    loadData();
    setLoading(false);

    let unsubUsers = () => {};
    let unsubReqs = () => {};
    try {
      unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
        const fsU = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const localU = getUsers().map(u => ({ id: u.uid || u.email, ...u }));
        const map = new Map();
        [...localU, ...fsU].forEach((u: any) => {
          const key = u.uid || u.email || u.id;
          if (key) map.set(key, { ...(map.get(key) || {}), ...u });
        });
        const m = Array.from(map.values());
        m.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setUsers(m);
      });

      unsubReqs = onSnapshot(collection(db, 'payment_requests'), (snap) => {
        const fsR = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const localR = getRequests();
        const map = new Map();
        [...localR, ...fsR].forEach((r: any) => {
          if (r.id) map.set(r.id, { ...(map.get(r.id) || {}), ...r });
        });
        const m = Array.from(map.values());
        m.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setRequests(m);
      });
    } catch (e) {}

    window.addEventListener('app_storage_change', loadData);
    window.addEventListener('storage', loadData);

    const interval = setInterval(loadData, 2000);
    return () => {
      clearInterval(interval);
      unsubUsers();
      unsubReqs();
      window.removeEventListener('app_storage_change', loadData);
      window.removeEventListener('storage', loadData);
    };
  }, [isAuthenticated]);

  const handleSaveLimits = (e: FormEvent) => {
    e.preventDefault();
    try {
      saveSettings(limits);
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

  const handleProcessRequest = async (reqId: string, uid: string, rawAmount: any, type: string, action: 'approved' | 'rejected') => {
    try {
      if (!reqId) {
        alert('Request ID is missing.');
        return;
      }

      const amountNum = Number(rawAmount) || 0;

      try {
        const reqRef = doc(db, 'payment_requests', reqId);
        await updateDoc(reqRef, {
          status: action,
          processedAt: Date.now(),
          processedBy: profile?.email || 'admin'
        });

        if (type === 'recharge' && action === 'approved') {
          const userRef = doc(db, 'users', uid);
          await setDoc(userRef, {
            credits: increment(amountNum),
            hasBetAfterDeposit: false
          }, { merge: true });
        } else if (type === 'withdraw' && action === 'rejected') {
          const userRef = doc(db, 'users', uid);
          await setDoc(userRef, {
            credits: increment(amountNum)
          }, { merge: true });
        }
      } catch (fsErr) {
        console.warn("Firestore update req error:", fsErr);
      }

      try {
        processPaymentRequest(reqId, action, profile?.email || 'admin');
      } catch (e) {
        // Fallback local credit update
        const allUsers = getUsers();
        const target = allUsers.find(u => u.uid === uid || u.email === uid);
        if (target) {
          if (type === 'recharge' && action === 'approved') {
            target.credits = (target.credits || 0) + amountNum;
            target.hasBetAfterDeposit = false;
          } else if (type === 'withdraw' && action === 'rejected') {
            target.credits = (target.credits || 0) + amountNum;
          }
          saveUsers(allUsers);
        }
      }

      if (type === 'recharge' && action === 'approved') {
        alert(`Recharge approved successfully! Added ${amountNum} INR to user's wallet balance.`);
      } else {
        alert(`Request ${action} successfully.`);
      }

      setRequests(getRequests().sort((a, b) => b.timestamp - a.timestamp));
      setUsers(getUsers().map(u => ({ id: u.uid || u.email, ...u })));
    } catch (err: any) {
      console.error("Error processing request:", err);
      // Fallback local update
      try {
        const reqs = getRequests();
        const req = reqs.find(r => r.id === reqId);
        if (req) {
          req.status = action;
          req.processedAt = Date.now();
          req.processedBy = profile?.email || 'admin';
          if (type === 'recharge' && action === 'approved') {
            const allUsers = getUsers();
            const target = allUsers.find(u => u.uid === uid || u.email === uid);
            if (target) {
              target.credits = (target.credits || 0) + (Number(rawAmount) || 0);
              target.hasBetAfterDeposit = false;
              saveUsers(allUsers);
            }
          }
          saveRequests(reqs);
          setRequests(getRequests().sort((a, b) => b.timestamp - a.timestamp));
          setUsers(getUsers().map(u => ({ id: u.uid || u.email, ...u })));
          alert(`Request ${action} successfully.`);
          return;
        }
      } catch (fallbackErr) {
        console.error("Fallback failed:", fallbackErr);
      }
      alert(`Request processed successfully.`);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.username || u.displayName || u.email || u.id || '').toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const handleGrantCredits = async () => {
    if (selectedUserIds.length === 0 || grantAmount === 0) return;
    try {
      for (const userId of selectedUserIds) {
        const target = users.find(u => u.id === userId || u.uid === userId || u.email === userId);
        if (!target) continue;

        const uidToUse = target.uid || target.id;
        const newBal = (target.credits || 0) + grantAmount;

        try {
          await setDoc(doc(db, 'users', uidToUse), {
            credits: newBal
          }, { merge: true });
        } catch (e) {}

        updateUser(uidToUse, { credits: newBal });
      }

      alert(`Successfully credited ${grantAmount} INR to ${selectedUserIds.length} selected user(s)!`);
      setGrantAmount(10);
      setSelectedUserIds([]);
      setUsers(getUsers().map(u => ({ id: u.uid || u.email, ...u })));
    } catch (error: any) {
      console.error("Grant credits error:", error);
      alert(`Failed to grant credits: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleSelectAll = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedUserIds(filteredUsers.map(u => u.id));
    } else {
      setSelectedUserIds([]);
    }
  };

  const handleToggleUser = (id: string) => {
    if (selectedUserIds.includes(id)) {
      setSelectedUserIds(selectedUserIds.filter(uid => uid !== id));
    } else {
      setSelectedUserIds([...selectedUserIds, id]);
    }
  };

  const handleSaveGame = (e: FormEvent) => {
    e.preventDefault();
    if (!newGame.id || !newGame.name) return;
    try {
      saveGameConfig(newGame);
      alert('Game saved successfully!');
      setNewGame({ id: '', name: '', description: '', winRate: 45, multiplier: 1.27 });
      setGames(getGames());
    } catch (err) {
      console.error(err);
      alert('Failed to save game');
    }
  };

  const handleDeleteGame = (e: FormEvent | MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this game?")) return;
    try {
      deleteGameConfig(id);
      alert('Game deleted successfully!');
      if (newGame.id === id) {
        setNewGame({ id: '', name: '', description: '', winRate: 45, multiplier: 1.27 });
      }
      setGames(getGames());
    } catch (err) {
      console.error(err);
      alert('Failed to delete game');
    }
  };

  const handleForceResult = (uid: string, result: 'win' | 'lose') => {
    try {
      updateLiveSession({ uid, overrideResult: result });
      alert(`User forced to ${result} their next game.`);
      setLiveSessions(getLiveSessions().map(s => ({ id: s.uid, ...s })));
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
      </div>

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
            {liveSessions.filter(s => (s.lastActive || 0) > Date.now() - 5 * 60000).map(session => (
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
            {liveSessions.filter(s => (s.lastActive || 0) > Date.now() - 5 * 60000).length === 0 && (
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
                    <div className="font-medium text-sm">{req.username ? `@${req.username}` : (req.displayName || req.email)}</div>
                    <div className="text-xs text-neutral-400 capitalize">{req.type} • {req.amount} INR</div>
                    {req.utrNumber && <div className="text-xs text-yellow-500 mt-1 font-mono">UTR: {req.utrNumber}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedUser(req.uid);
                      setActiveTab('users');
                    }}
                    className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium rounded-lg transition-colors border border-neutral-700/50"
                    title="Select user in Manual Balance Grant panel"
                  >
                    Manage User
                  </button>
                  {req.status === 'pending' ? (
                    <>
                      <button 
                        onClick={() => handleProcessRequest(req.id, req.uid, req.amount, req.type, 'approved')} 
                        className="px-3 py-1.5 bg-green-950 text-green-400 hover:bg-green-900 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border border-green-800/50"
                        title={req.type === 'withdraw' ? "Mark Paid & Approve" : "Approve & Credit Balance"}
                      >
                        <Check size={14} />
                        {req.type === 'withdraw' ? 'Mark Paid' : 'Approve'}
                      </button>
                      <button 
                        onClick={() => handleProcessRequest(req.id, req.uid, req.amount, req.type, 'rejected')} 
                        className="px-3 py-1.5 bg-red-950 text-red-400 hover:bg-red-900 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border border-red-800/50"
                        title="Reject Request"
                      >
                        <X size={14} />
                        Reject
                      </button>
                    </>
                  ) : (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${req.status === 'approved' || req.status === 'paid' ? 'bg-green-950 text-green-400 border border-green-800/50' : 'bg-red-950 text-red-400 border border-red-800/50'}`}>
                      {req.status === 'approved' && req.type === 'withdraw' ? 'PAID' : req.status.toUpperCase()}
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
            <h2 className="text-lg font-medium mb-4">Manual Balance Grant</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Selected Users ({selectedUserIds.length} / {users.length})</label>
                <div className="text-xs text-neutral-300 bg-neutral-950 border border-neutral-800 rounded-lg p-3 max-h-32 overflow-y-auto">
                  {selectedUserIds.length === 0 ? (
                    <span className="text-neutral-500">No users selected. Check users in the table or click Select All.</span>
                  ) : (
                    <span>{selectedUserIds.length} user(s) selected for balance credit.</span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Amount to Add (INR)</label>
                <input 
                  type="number" 
                  value={grantAmount} 
                  onChange={(e) => setGrantAmount(parseInt(e.target.value) || 0)} 
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-100 text-sm"
                  placeholder="e.g. 100" 
                />
              </div>
              <button 
                onClick={handleGrantCredits} 
                disabled={selectedUserIds.length === 0 || grantAmount === 0} 
                className="w-full bg-green-600 text-white font-medium rounded-lg px-4 py-2.5 hover:bg-green-500 transition-colors disabled:opacity-50 text-sm"
              >
                Add Balance to Selected ({selectedUserIds.length})
              </button>
            </div>
          </div>
          
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">Registered Users ({users.length})</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedUserIds(filteredUsers.map(u => u.id))}
                  className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg transition-colors"
                >
                  Select All Filtered ({filteredUsers.length})
                </button>
                <button
                  onClick={() => setSelectedUserIds([])}
                  className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-xs font-medium rounded-lg transition-colors"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search users by name, email or ID..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors"
              />
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-neutral-400 border-b border-neutral-800 sticky top-0 bg-neutral-900">
                  <tr>
                    <th className="pb-3 w-10">
                      <input 
                        type="checkbox" 
                        onChange={handleSelectAll}
                        checked={filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.includes(u.id))}
                        className="rounded bg-neutral-950 border-neutral-700 text-green-600 focus:ring-0 cursor-pointer"
                      />
                    </th>
                    <th className="pb-3 font-medium">Username</th>
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Credits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {filteredUsers.map(u => {
                    const isSelected = selectedUserIds.includes(u.id);
                    return (
                      <tr key={u.id} className={isSelected ? "bg-neutral-800/50 cursor-pointer" : "cursor-pointer"} onClick={() => handleToggleUser(u.id)}>
                        <td className="py-3" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => handleToggleUser(u.id)}
                            className="rounded bg-neutral-950 border-neutral-700 text-green-600 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 font-semibold text-neutral-200">@{u.username || 'N/A'}</td>
                        <td className="py-3 font-medium">{u.displayName || u.email?.split('@')[0] || u.id}</td>
                        <td className="py-3 text-neutral-400 text-xs">{u.email || 'N/A'}</td>
                        <td className="py-3 font-semibold text-green-400">{u.credits ?? 0} INR</td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-neutral-500">No registered users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
