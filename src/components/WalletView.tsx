import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Clock, Gift } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { playSound } from '../lib/audio';

export function WalletView() {
  const { user, profile, updateCredits } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'recharge' | 'withdraw'>('recharge');
  const [amount, setAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [limits, setLimits] = useState({ minRecharge: 10, minWithdraw: 30 });
  
  // UTR step
  const [awaitingUtr, setAwaitingUtr] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        const limitsSnap = await getDoc(doc(db, 'settings', 'limits'));
        if (limitsSnap.exists()) {
          const data = limitsSnap.data();
          setLimits({ 
            minRecharge: data.minRecharge ?? 10, 
            minWithdraw: data.minWithdraw ?? 30 
          });
        }

        const q = query(
          collection(db, 'payment_requests'),
          where('uid', '==', user.uid),
          orderBy('timestamp', 'desc')
        );
        const snap = await getDocs(q);
        setRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    }
    fetchData();
  }, [user]);

  const handlePayClick = () => {
    if (amount < limits.minRecharge) {
      alert(`Minimum recharge is ${limits.minRecharge}.`);
      return;
    }
    // Open UPI intent
    window.location.href = `upi://pay?pa=neena19@fam&pn=Admin&am=${amount}&cu=INR`;
    setAwaitingUtr(true);
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (activeTab === 'recharge' && amount < limits.minRecharge) {
      alert(`Minimum recharge is ${limits.minRecharge}.`);
      return;
    }
    if (activeTab === 'withdraw' && amount < limits.minWithdraw) {
      alert(`Minimum withdrawal is ${limits.minWithdraw}.`);
      return;
    }
    if (activeTab === 'withdraw' && amount > (displayProfile.credits || 0)) {
      alert("Insufficient Demo Credits.");
      return;
    }

    if (activeTab === 'recharge' && !utrNumber.trim()) {
      alert("Please enter the UTR number for verification.");
      return;
    }

    setLoading(true);
    try {
      const newRequest = {
        uid: user.uid,
        email: displayProfile.email,
        displayName: displayProfile.displayName || user.displayName || user.email?.split('@')[0] || 'User',
        type: activeTab,
        amount,
        utrNumber: activeTab === 'recharge' ? utrNumber : null,
        status: 'pending',
        timestamp: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'payment_requests'), newRequest);
      
      if (activeTab === 'withdraw') {
        const userRef = doc(db, 'users', user!.uid);
        await setDoc(userRef, {
          credits: increment(-amount)
        }, { merge: true });
        updateCredits(-amount);
      }

      setRequests([{ id: docRef.id, ...newRequest, timestamp: { toDate: () => new Date() } }, ...requests]);
      
      playSound('recharge');
      
      if (activeTab === 'recharge') {
        alert("Recharge request submitted successfully for approval.");
        setAwaitingUtr(false);
        setUtrNumber('');
      } else {
        alert("Withdrawal request submitted successfully. Amount deducted from your wallet.");
      }
      
      setAmount(0);
    } catch (err) {
      console.error(err);
      alert("Failed to submit request.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center bg-neutral-900 border border-neutral-800 rounded-2xl p-8">
        <h2 className="text-xl font-medium mb-2">Please log in</h2>
        <p className="text-neutral-400 text-sm mb-6">You need to be logged in to view your wallet.</p>
        <a href="/login" className="inline-block bg-neutral-100 text-neutral-950 font-medium px-6 py-2.5 rounded-lg hover:bg-white transition-colors">Log In</a>
      </div>
    );
  }

  const displayProfile = profile || {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email?.split('@')[0] || 'User',
    credits: 0,
    freeCredits: 0,
    isAdmin: false,
    createdAt: Date.now()
  };

  return (
    <div className="max-w-4xl mx-auto mt-8 pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Wallet</h1>
        <p className="text-neutral-400">Manage your Demo Credits balance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-neutral-800">
              <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center">
                <Wallet className="text-neutral-300" size={24} />
              </div>
              <div>
                <div className="text-sm text-neutral-400">Current Balance</div>
                <div className="text-3xl font-semibold text-green-400">{displayProfile.credits} INR</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-yellow-950/30 text-yellow-500 flex items-center justify-center">
                <Gift size={24} />
              </div>
              <div>
                <div className="text-sm text-neutral-400 flex items-center gap-2">
                  Free Money <span className="text-[10px] bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-300">Non-withdrawable</span>
                </div>
                <div className="text-xl font-medium text-yellow-500">{displayProfile.freeCredits ?? 0} INR</div>
              </div>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
            <div className="flex gap-2 mb-6 p-1 bg-neutral-950 rounded-xl">
              <button 
                onClick={() => { setActiveTab('recharge'); setAmount(0); setAwaitingUtr(false); }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'recharge' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                Recharge
              </button>
              <button 
                onClick={() => { setActiveTab('withdraw'); setAmount(0); setAwaitingUtr(false); }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'withdraw' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                Withdraw
              </button>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'recharge' && !awaitingUtr && (
                <motion.div key="recharge" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                  <div className="p-4 bg-blue-950/20 border border-blue-900/50 rounded-xl space-y-3">
                    <h3 className="text-sm font-medium text-blue-400">Recharge Instructions</h3>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      Send payment to UPI ID <strong className="text-neutral-200">neena19@fam</strong> using any UPI app. Minimum recharge is {limits.minRecharge} INR.
                    </p>
                    <div className="flex items-center justify-between bg-neutral-950 border border-neutral-800 px-3 py-2 rounded-lg">
                      <span className="text-xs font-mono text-neutral-300">neena19@fam</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText('neena19@fam');
                          alert('UPI ID copied to clipboard!');
                        }}
                        className="text-xs bg-neutral-800 text-neutral-200 px-2.5 py-1 rounded hover:bg-neutral-700 transition-colors"
                      >
                        Copy UPI ID
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1">Recharge Amount (Min {limits.minRecharge})</label>
                    <input
                      type="number"
                      min={limits.minRecharge}
                      value={amount || ''}
                      onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-neutral-100 focus:outline-none focus:border-neutral-600 transition-colors"
                    />
                  </div>
                  <button
                    onClick={handlePayClick}
                    disabled={amount < limits.minRecharge}
                    className="w-full mt-6 bg-neutral-100 text-neutral-950 font-medium rounded-lg px-4 py-3 hover:bg-white transition-colors disabled:opacity-50"
                  >
                    Pay ₹{amount || 0}
                  </button>
                </motion.div>
              )}

              {activeTab === 'recharge' && awaitingUtr && (
                <motion.div key="utr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                  <div className="p-4 bg-yellow-950/20 border border-yellow-900/50 rounded-xl">
                    <h3 className="text-sm font-medium text-yellow-500 mb-2">Verify Payment</h3>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      After completing the payment in your UPI app, please enter the 12-digit UTR (Reference) Number below to verify your recharge.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1">UTR Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 312345678901"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-neutral-100 focus:outline-none focus:border-neutral-600 transition-colors"
                    />
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setAwaitingUtr(false)}
                      className="flex-1 bg-neutral-800 text-neutral-300 font-medium rounded-lg px-4 py-3 hover:bg-neutral-700 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={loading || !utrNumber.trim()}
                      className="flex-[2] bg-neutral-100 text-neutral-950 font-medium rounded-lg px-4 py-3 hover:bg-white transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </motion.div>
              )}

              {activeTab === 'withdraw' && (
                <motion.div key="withdraw" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                  <div className="p-4 bg-orange-950/20 border border-orange-900/50 rounded-xl">
                    <h3 className="text-sm font-medium text-orange-400 mb-2">Withdrawal Rules</h3>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      Minimum withdrawal is {limits.minWithdraw} INR. Withdrawals will be processed to your registered payment details.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1">Withdrawal Amount (Min {limits.minWithdraw})</label>
                    <input
                      type="number"
                      min={limits.minWithdraw}
                      max={profile.credits}
                      value={amount || ''}
                      onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-neutral-100 focus:outline-none focus:border-neutral-600 transition-colors"
                    />
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={loading || amount <= 0 || amount < limits.minWithdraw}
                    className="w-full mt-6 bg-neutral-100 text-neutral-950 font-medium rounded-lg px-4 py-3 hover:bg-white transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Submitting...' : 'Submit Withdrawal Request'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Clock size={20} className="text-neutral-400" />
            <h2 className="text-lg font-medium">Transaction History</h2>
          </div>
          <div className="space-y-3">
            {requests.length > 0 ? (
              requests.map((req) => (
                <div key={req.id} className="flex justify-between items-center p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${req.type === 'recharge' ? 'bg-green-950 text-green-500' : 'bg-orange-950 text-orange-500'}`}>
                      {req.type === 'recharge' ? <ArrowDownToLine size={14} /> : <ArrowUpFromLine size={14} />}
                    </div>
                    <div>
                      <div className="font-medium capitalize text-sm">{req.type}</div>
                      <div className="text-xs text-neutral-500">
                        {req.timestamp?.toDate ? req.timestamp.toDate().toLocaleString() : 'Just now'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-sm">{req.amount} INR</div>
                    <div className={`text-xs ${
                      req.status === 'pending' ? 'text-yellow-500' : 
                      req.status === 'approved' ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-neutral-500 py-8 text-sm">
                No requests found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
