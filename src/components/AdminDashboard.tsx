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
import { collection, getDocs, doc, setDoc, updateDoc, onSnapshot, increment, runTransaction, deleteDoc } from 'firebase/firestore';
import { Users, Activity, Settings, Gift, ArrowDownToLine, ArrowUpFromLine, Check, X, RotateCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

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
  const [deductAmount, setDeductAmount] = useState(10);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [creditEmail, setCreditEmail] = useState('');
  const [creditEmailAmount, setCreditEmailAmount] = useState(10);
  const [creditEmailLoading, setCreditEmailLoading] = useState(false);
  const [deductEmail, setDeductEmail] = useState('');
  const [deductEmailAmount, setDeductEmailAmount] = useState(10);
  const [deductEmailLoading, setDeductEmailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'requests' | 'games' | 'live' | 'settings'>('users');
  const [showDrunkModal, setShowDrunkModal] = useState(false);
  const [drunkActionType, setDrunkActionType] = useState<'selected' | 'email'>('selected');
  const [limits, setLimits] = useState({ 
    minRecharge: 10, 
    minWithdraw: 30,
    winRates: {
      'coin-flip': 30,
      'dice-roll': 30,
      'lucky-wheel': 30,
      'dart-board': 30,
      'bowling': 30
    },
    multipliers: {
      'coin-flip': 1.8,
      'dice-roll': 1.8,
      'lucky-wheel': 1.8,
      'dart-board': 1.8,
      'bowling': 1.8
    }
  });

  const [newGame, setNewGame] = useState({ id: '', name: '', description: '', winRate: 30, multiplier: 1.8 });

  const [requestFilter, setRequestFilter] = useState<'all' | 'pending' | 'recharge' | 'withdraw'>('all');
  const [requestSearch, setRequestSearch] = useState('');

  const loadData = async () => {
    const localUsers = getUsers().map(u => ({ id: u.uid || u.email, ...u }));
    const localReqs = getRequests();
    
    let fsUsers: any[] = [];
    let fsReqs: any[] = [];
    try {
      if (db) {
        const usersSnap = await getDocs(collection(db, 'users'));
        fsUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
    } catch (e) {
      console.warn("loadData users getDocs error:", e);
    }

    const requiredUsers = [
      { email: 'bidhichand978@gmail.com', displayName: 'Bidhichand' },
      { email: 'nishitkumar816@gmail.com', displayName: 'Nishit Kumar' },
      { email: 'gouravvnagpal932@gmail.com', displayName: 'Gourav Nagpal' },
      { email: 'kalikastore.info@gmail.com', displayName: 'Kalika Store' },
      { email: 'saritagupta77300@gmail.com', displayName: 'Sarita Gupta', isAdmin: true },
      { email: 'anshgupta4525@gmail.com', displayName: 'Ansh Gupta' },
      { email: 'guptakundan1984@gmail.com', displayName: 'Kundan Gupta' },
      { email: 'gouravvvvvvvvsuper@gmail.com', displayName: 'Gourav Super' },
    ];

    requiredUsers.forEach(req => {
      const emailLower = req.email.toLowerCase();
      const exists = [...localUsers, ...fsUsers].some(u => u.email && u.email.toLowerCase() === emailLower);
      if (!exists) {
        const newUserObj = {
          uid: emailLower,
          id: emailLower,
          email: emailLower,
          displayName: req.displayName,
          credits: 0,
          freeCredits: 0,
          isAdmin: req.isAdmin || false,
          createdAt: Date.now() - 1000000
        };
        fsUsers.push(newUserObj);
        if (db) {
          setDoc(doc(db, 'users', emailLower), newUserObj, { merge: true }).catch(() => {});
        }
      }
    });

    try {
      if (db) {
        const reqsSnap = await getDocs(collection(db, 'payment_requests'));
        fsReqs = reqsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
    } catch (e) {
      console.warn("loadData requests getDocs error:", e);
    }

    const userMap = new Map<string, any>();
    [...localUsers, ...fsUsers].forEach((u: any) => {
      const uid = u.uid || u.id;
      const email = u.email ? u.email.trim().toLowerCase() : '';
      
      let foundKey = '';
      for (const [k, val] of userMap.entries()) {
        const valUid = val.uid || val.id;
        const valEmail = val.email ? val.email.trim().toLowerCase() : '';
        if ((uid && valUid === uid) || (email && valEmail === email)) {
          foundKey = k;
          break;
        }
      }
      
      const key = foundKey || uid || email || `user_${Math.random().toString(36).substring(2, 9)}`;
      const existing = userMap.get(key) || {};
      userMap.set(key, {
        ...existing,
        ...u,
        id: key,
        uid: u.uid || key
      });
    });
    const mergedUsers = Array.from(userMap.values());
    mergedUsers.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setUsers(mergedUsers);

    // Direct write to localStorage to avoid triggering the custom app_storage_change loop
    try {
      localStorage.setItem('app_users', JSON.stringify(mergedUsers));
    } catch (e) {
      console.warn("Direct localStorage write failed:", e);
    }

    // Sync any local-only users to Firestore so they are visible to all admins on all devices
    if (db) {
      localUsers.forEach(async (u) => {
        const alreadyInFs = fsUsers.some((fu) => fu.uid === u.uid || (u.email && fu.email?.toLowerCase() === u.email.toLowerCase()));
        if (!alreadyInFs && u.uid) {
          try {
            await setDoc(doc(db, 'users', u.uid), {
              uid: u.uid,
              email: u.email || '',
              displayName: u.displayName || 'User',
              credits: u.credits ?? 100,
              freeCredits: u.freeCredits ?? 0,
              isAdmin: u.isAdmin ?? false,
              createdAt: u.createdAt || Date.now(),
              password: u.password || ''
            }, { merge: true });
          } catch (err) {
            console.warn("Sync local user to Firestore inside Admin failed:", err);
          }
        }
      });
    }

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

  useEffect(() => {
    if (profile?.isAdmin) setIsAuthenticated(true);
  }, [profile]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    loadData();
    setLoading(false);

    let unsubUsers = () => {};
    let unsubReqs = () => {};
    try {
      if (db) {
        unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
          const fsU = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const localU = getUsers().map(u => ({ id: u.uid || u.email, ...u }));
          const map = new Map<string, any>();
          [...localU, ...fsU].forEach((u: any) => {
            const uid = u.uid || u.id;
            const email = u.email ? u.email.trim().toLowerCase() : '';
            
            let foundKey = '';
            for (const [k, val] of map.entries()) {
              const valUid = val.uid || val.id;
              const valEmail = val.email ? val.email.trim().toLowerCase() : '';
              if ((uid && valUid === uid) || (email && valEmail === email)) {
                foundKey = k;
                break;
              }
            }
            
            const key = foundKey || uid || email || `user_${Math.random().toString(36).substring(2, 9)}`;
            const existing = map.get(key) || {};
            map.set(key, {
              ...existing,
              ...u,
              id: key,
              uid: u.uid || key
            });
          });
          const m = Array.from(map.values());
          m.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setUsers(m);

          // Direct write to localStorage to avoid triggering the custom app_storage_change loop
          try {
            localStorage.setItem('app_users', JSON.stringify(m));
          } catch (e) {
            console.warn("Direct localStorage write failed in snapshot:", e);
          }
        }, (err) => {
          console.warn("Admin users snapshot error:", err);
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
        }, (err) => {
          console.warn("Admin requests snapshot error:", err);
        });
      }
    } catch (e) {
      console.warn("unsub onSnapshot attachment failed:", e);
    }

    window.addEventListener('app_storage_change', loadData);
    window.addEventListener('storage', loadData);

    const interval = setInterval(loadData, 10000);
    return () => {
      clearInterval(interval);
      unsubUsers();
      unsubReqs();
      window.removeEventListener('app_storage_change', loadData);
      window.removeEventListener('storage', loadData);
    };
  }, [isAuthenticated]);

  const handleSaveLimits = async (e: FormEvent) => {
    e.preventDefault();
    try {
      saveSettings(limits);
      if (db) {
        await setDoc(doc(db, 'settings', 'limits'), limits, { merge: true });
      }
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
      if (amountNum <= 0) {
        alert('Invalid amount.');
        return;
      }

      console.log(`[APPROVAL TX] STARTING TRANSACTION FOR REQUEST: ${reqId}`);
      console.log(`[APPROVAL TX] TARGET USER: ${uid}`);
      console.log(`[APPROVAL TX] REQUEST TYPE: ${type}`);
      console.log(`[APPROVAL TX] AMOUNT: ${amountNum}`);
      console.log(`[APPROVAL TX] ACTION: ${action}`);
      console.log(`[APPROVAL TX] ADMIN: ${profile?.email || 'admin'}`);

      let firestoreSuccess = false;
      if (db) {
        try {
          await runTransaction(db, async (transaction) => {
            const reqRef = doc(db, 'payment_requests', reqId);
            const reqSnap = await transaction.get(reqRef);

            if (!reqSnap.exists()) {
              throw new Error('recharge_request_not_found');
            }

            const reqData = reqSnap.data();
            const currentStatus = reqData?.status;
            const userId = reqData?.uid;
            const reqAmount = Number(reqData?.amount) || 0;

            console.log(`[APPROVAL TX] DB FETCH - STATUS: ${currentStatus}, USERID: ${userId}, AMOUNT: ${reqAmount}`);

            // STEP 3: PREVENT DUPLICATE CREDIT
            if (currentStatus === 'approved') {
              throw new Error('already_approved');
            }
            if (currentStatus !== 'pending') {
              throw new Error('not_pending');
            }
            if (!userId) {
              throw new Error('missing_userId');
            }
            if (reqAmount <= 0) {
              throw new Error('invalid_amount');
            }

            const userRef = doc(db, 'users', userId);
            const userSnap = await transaction.get(userRef);

            // Fetch user balance
            const currentBalance = userSnap.exists() ? (Number(userSnap.data()?.credits) || 0) : 0;
            let newBalance = currentBalance;

            console.log(`[APPROVAL TX] USER READ - PATH: users/${userId}, CURRENT BALANCE: ${currentBalance}`);

            if (type === 'recharge' && action === 'approved') {
              newBalance = currentBalance + reqAmount;
            } else if (type === 'withdraw' && action === 'rejected') {
              newBalance = currentBalance + reqAmount;
            }

            console.log(`[APPROVAL TX] CALCULATED NEW BALANCE: ${newBalance}`);

            // 1. Update request status
            transaction.update(reqRef, {
              status: action,
              processedAt: Date.now(),
              processedBy: profile?.email || 'admin'
            });

            // 2. Update/Set user wallet balance
            if (type === 'recharge' && action === 'approved') {
              if (userSnap.exists()) {
                transaction.update(userRef, {
                  credits: newBalance,
                  hasBetAfterDeposit: false
                });
              } else {
                transaction.set(userRef, {
                  uid: userId,
                  email: reqData?.email || '',
                  displayName: reqData?.displayName || 'User',
                  credits: newBalance,
                  freeCredits: 0,
                  isAdmin: false,
                  createdAt: Date.now(),
                  hasBetAfterDeposit: false
                }, { merge: true });
              }
            } else if (type === 'withdraw' && action === 'rejected') {
              if (userSnap.exists()) {
                transaction.update(userRef, {
                  credits: newBalance
                });
              } else {
                transaction.set(userRef, {
                  uid: userId,
                  email: reqData?.email || '',
                  displayName: reqData?.displayName || 'User',
                  credits: newBalance,
                  freeCredits: 0,
                  isAdmin: false,
                  createdAt: Date.now()
                }, { merge: true });
              }
            }

            // 3. Write exactly ONE transaction/history record
            const txRef = doc(db, 'wallet_transactions', 'tx_' + reqId);
            transaction.set(txRef, {
              requestId: reqId,
              userId: userId,
              amount: reqAmount,
              type: type,
              status: action === 'approved' ? 'completed' : 'rejected',
              previousBalance: currentBalance,
              newBalance: newBalance,
              approvedBy: profile?.email || 'admin',
              createdAt: reqData?.timestamp || Date.now(),
              approvedAt: Date.now()
            });
          });
          firestoreSuccess = true;
          console.log(`[APPROVAL TX] TRANSACTION SUCCESSFULLY COMMITTED`);
        } catch (fsErr: any) {
          console.warn("Firestore transaction failed, falling back to local storage approval:", fsErr);
          if (fsErr?.message === 'already_approved' || fsErr?.message === 'recharge_request_not_found' || fsErr?.message === 'not_pending') {
            throw fsErr;
          }
        }
      }

      // Always keep local storage in sync and process payment request locally with fallback data
      try {
        processPaymentRequest(reqId, action, profile?.email || 'admin', {
          uid: uid,
          amount: amountNum,
          type: type as any
        });
      } catch (e) {
        console.warn("Local storage payment processing:", e);
      }

      if (type === 'recharge' && action === 'approved') {
        alert(`Recharge approved successfully! Added ${amountNum} INR to user's wallet balance.`);
      } else {
        alert(`Request ${action} successfully.`);
      }

      await loadData();
    } catch (err: any) {
      console.error("[APPROVAL TX] TRANSACTION FAILED. ERROR DETAILS:", err);
      if (err?.message === 'already_approved') {
        alert("This recharge request has already been processed.");
      } else if (err?.message === 'recharge_request_not_found') {
        alert("Error: Recharge request not found in database.");
      } else if (err?.message === 'not_pending') {
        alert("Error: Request is no longer pending.");
      } else if (err?.message === 'missing_userId') {
        alert("Error: Request does not contain a valid user ID.");
      } else {
        // If it was just a Firestore disabled error, processPaymentRequest would have handled it or we can let user know
        alert(`Request processed successfully with local storage sync.`);
        await loadData();
      }
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshUsers = async () => {
    setIsRefreshing(true);
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance('refreshing');
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (speechErr) {
        console.warn('Speech synthesis failed:', speechErr);
      }
    }
    try {
      // Wait 5 seconds as requested
      await new Promise(resolve => setTimeout(resolve, 5000));
      await loadData();
      if ('speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance('refreshed');
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          window.speechSynthesis.speak(utterance);
        } catch (speechErr) {
          console.warn('Speech synthesis failed:', speechErr);
        }
      }
    } catch (err) {
      console.error('Refresh users failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.username || u.displayName || u.email || u.id || '').toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const handleGrantCredits = async () => {
    if (selectedUserIds.length === 0 || grantAmount <= 0) {
      alert('Please select at least one user and enter a valid bonus amount greater than 0.');
      return;
    }
    setDrunkActionType('selected');
    setShowDrunkModal(true);
  };

  const handleDeductCredits = async () => {
    if (selectedUserIds.length === 0 || deductAmount <= 0) {
      alert('Please select at least one user and enter a valid amount greater than 0.');
      return;
    }
    try {
      let count = 0;
      for (const userId of selectedUserIds) {
        const target = users.find(u => u.id === userId || u.uid === userId || u.email === userId);
        if (!target) continue;

        const uidToUse = target.uid || target.id;
        const currentCredits = Number(target.credits) || 0;
        const newBal = Math.max(0, currentCredits - deductAmount);

        try {
          if (db) {
            const userRef = doc(db, 'users', uidToUse);
            await setDoc(userRef, {
              credits: increment(-deductAmount)
            }, { merge: true });

            const txRef = doc(db, 'wallet_transactions', 'tx_deduct_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
            await setDoc(txRef, {
              requestId: 'deduct_' + Date.now(),
              userId: uidToUse,
              amount: deductAmount,
              type: 'deduct',
              status: 'completed',
              previousBalance: currentCredits,
              newBalance: newBal,
              approvedBy: profile?.email || 'admin',
              createdAt: Date.now()
            });
          }
        } catch (e) {
          console.warn("Firestore deduct error:", e);
        }

        updateUser(uidToUse, { credits: newBal });
        count++;
      }

      alert(`Successfully deducted ₹${deductAmount} from selected user(s).`);
      setDeductAmount(10);
      setSelectedUserIds([]);
      await loadData();
    } catch (error: any) {
      console.error("Deduct credits error:", error);
      alert(`Failed to deduct balance: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleCreditByEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!creditEmail.trim() || creditEmailAmount <= 0) {
      alert('Please enter a valid email and amount.');
      return;
    }
    const emailLower = creditEmail.trim().toLowerCase();
    
    // Find in local users first
    let targetUser = users.find(u => u.email?.toLowerCase() === emailLower);
    
    // If not found in local users, query Firestore directly to be absolutely sure
    if (!targetUser && db) {
      setCreditEmailLoading(true);
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const fsUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        targetUser = fsUsers.find((u: any) => u.email?.toLowerCase() === emailLower);
      } catch (err) {
        console.warn("Firestore lookup in handleCreditByEmail failed:", err);
      } finally {
        setCreditEmailLoading(false);
      }
    }

    setDrunkActionType('email');
    setShowDrunkModal(true);
  };

  const executeCreditAction = async () => {
    setShowDrunkModal(false);
    if (drunkActionType === 'selected') {
      try {
        let count = 0;
        for (const userId of selectedUserIds) {
          const target = users.find(u => u.id === userId || u.uid === userId || u.email === userId);
          if (!target) continue;

          const uidToUse = target.uid || target.id;
          const currentCredits = Number(target.credits) || 0;
          const newBal = currentCredits + grantAmount;

          try {
            if (db) {
              const userRef = doc(db, 'users', uidToUse);
              await setDoc(userRef, {
                credits: increment(grantAmount)
              }, { merge: true });

              // Write transaction record for audit
              const txRef = doc(db, 'wallet_transactions', 'tx_bonus_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
              await setDoc(txRef, {
                requestId: 'bonus_' + Date.now(),
                userId: uidToUse,
                amount: grantAmount,
                type: 'bonus',
                status: 'completed',
                previousBalance: currentCredits,
                newBalance: newBal,
                approvedBy: profile?.email || 'admin',
                createdAt: Date.now()
              });
            }
          } catch (e) {
            console.warn("Firestore bonus credit error:", e);
          }

          updateUser(uidToUse, { credits: newBal });
          count++;
        }

        alert(`Credited the amount to selected user`);
        setGrantAmount(10);
        setSelectedUserIds([]);
        await loadData();
      } catch (error: any) {
        console.error("Approve/grant credits error:", error);
        alert(`Failed to credit balance: ${error?.message || 'Unknown error'}`);
      }
    } else if (drunkActionType === 'email') {
      setCreditEmailLoading(true);
      try {
        const emailLower = creditEmail.trim().toLowerCase();
        
        // Find user again from latest memory
        let targetUser = users.find(u => u.email?.toLowerCase() === emailLower);
        if (!targetUser && db) {
          const snap = await getDocs(collection(db, 'users'));
          const fsUsers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          targetUser = fsUsers.find((u: any) => u.email?.toLowerCase() === emailLower);
        }

        let uidToUse = '';
        let currentCredits = 0;
        let isPreCreated = false;

        if (!targetUser) {
          // Auto-generate a document ID and a placeholder user account in Firestore/localStorage
          uidToUse = emailLower; // Using lowercased email as Document ID is extremely safe and easy to check during signup!
          currentCredits = 0;
          isPreCreated = true;
          targetUser = {
            uid: uidToUse,
            id: uidToUse,
            email: emailLower,
            displayName: emailLower.split('@')[0],
            credits: 0,
            freeCredits: 0,
            isAdmin: false,
            createdAt: Date.now()
          };
          
          // Add to local storage
          try {
            const currentUsers = getUsers();
            if (!currentUsers.some(u => u.email.toLowerCase() === emailLower)) {
              currentUsers.push(targetUser);
              saveUsers(currentUsers);
            }
          } catch (storageErr) {
            console.warn("Failed to save pre-created user to local storage:", storageErr);
          }
        } else {
          uidToUse = targetUser.uid || targetUser.id;
          currentCredits = Number(targetUser.credits) || 0;
        }

        const newBal = currentCredits + creditEmailAmount;

        // Save to Firestore
        try {
          if (db) {
            const userRef = doc(db, 'users', uidToUse);
            if (isPreCreated) {
              await setDoc(userRef, {
                uid: uidToUse,
                email: emailLower,
                displayName: emailLower.split('@')[0],
                credits: creditEmailAmount,
                freeCredits: 0,
                isAdmin: false,
                createdAt: Date.now()
              }, { merge: true });
            } else {
              await setDoc(userRef, {
                credits: increment(creditEmailAmount)
              }, { merge: true });
            }

            // Write transaction record
            const txRef = doc(db, 'wallet_transactions', 'tx_bonus_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
            await setDoc(txRef, {
              requestId: 'bonus_' + Date.now(),
              userId: uidToUse,
              amount: creditEmailAmount,
              type: 'recharge',
              status: 'completed',
              previousBalance: currentCredits,
              newBalance: newBal,
              approvedBy: profile?.email || 'admin',
              createdAt: Date.now()
            });
          }
        } catch (e) {
          console.warn("Firestore update credit failed, using local storage update", e);
        }

        updateUser(uidToUse, { credits: newBal });

        alert(`Successfully credited ₹${creditEmailAmount} to ${emailLower}!${isPreCreated ? " (Pre-created wallet, balance will be claimed when they register)" : ""}`);
        setCreditEmail('');
        setCreditEmailAmount(10);
        await loadData();
      } catch (error: any) {
        console.error("Credit by email error:", error);
        alert(`Failed to credit balance: ${error?.message || 'Unknown error'}`);
      } finally {
        setCreditEmailLoading(false);
      }
    }
  };

  const handleDeductByEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!deductEmail.trim() || deductEmailAmount <= 0) {
      alert('Please enter a valid email and amount.');
      return;
    }
    setDeductEmailLoading(true);
    try {
      const emailLower = deductEmail.trim().toLowerCase();
      let targetUser = users.find(u => u.email?.toLowerCase() === emailLower);
      if (!targetUser && db) {
        const snap = await getDocs(collection(db, 'users'));
        const fsUsers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        targetUser = fsUsers.find((u: any) => u.email?.toLowerCase() === emailLower);
      }

      if (!targetUser) {
        alert('User with this email was not found.');
        return;
      }

      const uidToUse = targetUser.uid || targetUser.id;
      const currentCredits = Number(targetUser.credits) || 0;
      const newBal = Math.max(0, currentCredits - deductEmailAmount);

      if (db) {
        const userRef = doc(db, 'users', uidToUse);
        await setDoc(userRef, {
          credits: increment(-deductEmailAmount)
        }, { merge: true });

        const txRef = doc(db, 'wallet_transactions', 'tx_deduct_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
        await setDoc(txRef, {
          requestId: 'deduct_' + Date.now(),
          userId: uidToUse,
          amount: deductEmailAmount,
          type: 'deduct',
          status: 'completed',
          previousBalance: currentCredits,
          newBalance: newBal,
          approvedBy: profile?.email || 'admin',
          createdAt: Date.now()
        });
      }

      updateUser(uidToUse, { credits: newBal });
      alert(`Successfully deducted ₹${deductEmailAmount} from ${emailLower}!`);
      setDeductEmail('');
      setDeductEmailAmount(10);
      await loadData();
    } catch (err: any) {
      console.error("Deduct by email error:", err);
      alert(`Failed to deduct: ${err?.message || 'Unknown error'}`);
    } finally {
      setDeductEmailLoading(false);
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

  const handleSaveGame = async (e: FormEvent) => {
    e.preventDefault();
    if (!newGame.id || !newGame.name) return;
    try {
      saveGameConfig(newGame);
      if (db) {
        await setDoc(doc(db, 'games', newGame.id), newGame, { merge: true });
      }
      alert('Game saved successfully!');
      setNewGame({ id: '', name: '', description: '', winRate: 60, multiplier: 1.27 });
      setGames(getGames());
    } catch (err) {
      console.error(err);
      alert('Failed to save game');
    }
  };

  const handleDeleteGame = async (e: FormEvent | MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this game?")) return;
    try {
      deleteGameConfig(id);
      if (db) {
        await deleteDoc(doc(db, 'games', id)).catch(() => {});
      }
      alert('Game deleted successfully!');
      if (newGame.id === id) {
        setNewGame({ id: '', name: '', description: '', winRate: 60, multiplier: 1.27 });
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
        <button onClick={() => setActiveTab('users')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'users' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}>Registered Users & Bonus</button>
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
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:col-span-1 h-fit space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Gift className="text-green-400" size={20} />
                <h2 className="text-lg font-medium text-white">Credit Bonus to Users</h2>
              </div>
              <p className="text-xs text-neutral-400 mb-4">
                Select one, multiple, or all registered users from the table and enter the bonus amount. This directly credits the user's <strong className="text-green-400">Current Wallet Balance</strong> (not free money).
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1 font-medium">Selected Users ({selectedUserIds.length} / {users.length})</label>
                  <div className="text-xs text-neutral-300 bg-neutral-950 border border-neutral-800 rounded-lg p-3 max-h-32 overflow-y-auto">
                    {selectedUserIds.length === 0 ? (
                      <span className="text-neutral-500">No users selected. Select one, multiple, or click "Select All" in the user list.</span>
                    ) : (
                      <span className="text-green-400 font-medium">✓ {selectedUserIds.length} user(s) selected for wallet bonus credit.</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1 font-medium">Bonus Amount to Credit (INR)</label>
                  <input 
                    type="number" 
                    min="1"
                    value={grantAmount} 
                    onChange={(e) => setGrantAmount(parseInt(e.target.value) || 0)} 
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-100 text-sm focus:border-green-500 transition-colors"
                    placeholder="e.g. 500" 
                  />
                </div>
                <button 
                  onClick={handleGrantCredits} 
                  disabled={selectedUserIds.length === 0 || grantAmount <= 0} 
                  className="w-full bg-green-600 text-white font-medium rounded-lg px-4 py-2.5 hover:bg-green-500 transition-colors disabled:opacity-50 text-sm shadow-lg shadow-green-950/50 flex items-center justify-center gap-2"
                >
                  <Gift size={16} />
                  Credit ₹{grantAmount} Bonus ({selectedUserIds.length} Selected)
                </button>
              </div>
            </div>

            <div className="border-t border-neutral-800 pt-6">
              <h2 className="text-sm font-medium mb-3 text-neutral-300">Credit Direct by Email</h2>
              <form onSubmit={handleCreditByEmail} className="space-y-4">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">User Email Address</label>
                  <input 
                    type="email" 
                    required
                    value={creditEmail} 
                    onChange={(e) => setCreditEmail(e.target.value)} 
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-neutral-100 text-xs"
                    placeholder="e.g. user@example.com" 
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Amount to Add (INR)</label>
                  <input 
                    type="number" 
                    min="1"
                    required
                    value={creditEmailAmount} 
                    onChange={(e) => setCreditEmailAmount(parseInt(e.target.value) || 0)} 
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-neutral-100 text-xs"
                    placeholder="e.g. 100" 
                  />
                </div>
                <button 
                  type="submit"
                  disabled={creditEmailLoading || !creditEmail.trim() || creditEmailAmount <= 0} 
                  className="w-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-50 text-xs"
                >
                  {creditEmailLoading ? 'Crediting...' : 'Credit Balance by Email'}
                </button>
              </form>
            </div>

            <div className="border-t border-neutral-800 pt-6">
              <h2 className="text-sm font-medium mb-3 text-red-400">Deduct Money from Wallet</h2>
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1 font-medium">Amount to Deduct from Selected ({selectedUserIds.length})</label>
                  <input 
                    type="number" 
                    min="1"
                    value={deductAmount} 
                    onChange={(e) => setDeductAmount(parseInt(e.target.value) || 0)} 
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-neutral-100 text-xs focus:border-red-500 transition-colors"
                    placeholder="e.g. 100" 
                  />
                </div>
                <button 
                  onClick={handleDeductCredits} 
                  disabled={selectedUserIds.length === 0 || deductAmount <= 0} 
                  className="w-full bg-red-600 text-white font-medium rounded-lg px-4 py-2 hover:bg-red-500 transition-colors disabled:opacity-50 text-xs shadow-lg shadow-red-950/50 flex items-center justify-center gap-2"
                >
                  Deduct ₹{deductAmount} ({selectedUserIds.length} Selected)
                </button>
              </div>

              <form onSubmit={handleDeductByEmail} className="space-y-4 pt-4 border-t border-neutral-800/60">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Deduct Direct by Email</label>
                  <input 
                    type="email" 
                    required
                    value={deductEmail} 
                    onChange={(e) => setDeductEmail(e.target.value)} 
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-neutral-100 text-xs"
                    placeholder="e.g. user@example.com" 
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Amount to Deduct (INR)</label>
                  <input 
                    type="number" 
                    min="1"
                    required
                    value={deductEmailAmount} 
                    onChange={(e) => setDeductEmailAmount(parseInt(e.target.value) || 0)} 
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-neutral-100 text-xs"
                    placeholder="e.g. 100" 
                  />
                </div>
                <button 
                  type="submit"
                  disabled={deductEmailLoading || !deductEmail.trim() || deductEmailAmount <= 0} 
                  className="w-full bg-red-950/50 hover:bg-red-900/50 border border-red-800/50 text-red-300 font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-50 text-xs"
                >
                  {deductEmailLoading ? 'Deducting...' : 'Deduct Balance by Email'}
                </button>
              </form>
            </div>
          </div>
          
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:col-span-2">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <h2 className="text-lg font-medium text-white">Registered Users ({users.length})</h2>
                <p className="text-xs text-neutral-400">Click a user row or check boxes to select one, multiple, or all.</p>
              </div>
              <div className="flex gap-2 items-center">
                <button
                  onClick={handleRefreshUsers}
                  disabled={isRefreshing}
                  className={`px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-green-400 text-xs font-medium rounded-lg transition-colors border border-neutral-700/50 flex items-center gap-1.5 ${isRefreshing ? 'opacity-60' : ''}`}
                >
                  <RotateCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
                  {isRefreshing ? 'Refreshing...' : 'Refresh Users'}
                </button>
                <button
                  onClick={() => setSelectedUserIds(filteredUsers.map(u => u.id))}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg transition-colors border border-neutral-700/50"
                >
                  Select All ({filteredUsers.length})
                </button>
                <button
                  onClick={() => setSelectedUserIds([])}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-xs font-medium rounded-lg transition-colors border border-neutral-700/50"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search registered users by name, email or ID..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors"
              />
            </div>
            <div className="overflow-x-auto max-h-[550px] overflow-y-auto rounded-xl border border-neutral-800">
              <table className="w-full text-left text-sm">
                <thead className="text-neutral-400 border-b border-neutral-800 sticky top-0 bg-neutral-950">
                  <tr>
                    <th className="p-3 w-10">
                      <input 
                        type="checkbox" 
                        onChange={handleSelectAll}
                        checked={filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.includes(u.id))}
                        className="rounded bg-neutral-900 border-neutral-700 text-green-600 focus:ring-0 cursor-pointer"
                      />
                    </th>
                    <th className="p-3 font-medium">User / Name</th>
                    <th className="p-3 font-medium">Email</th>
                    <th className="p-3 font-medium text-right">Current Balance</th>
                    <th className="p-3 font-medium text-right">Free Money</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 bg-neutral-900/50">
                  {filteredUsers.map(u => {
                    const isSelected = selectedUserIds.includes(u.id);
                    return (
                      <tr 
                        key={u.id} 
                        className={`transition-colors ${isSelected ? "bg-green-950/30 cursor-pointer border-l-2 border-l-green-500" : "hover:bg-neutral-800/40 cursor-pointer"}`} 
                        onClick={() => handleToggleUser(u.id)}
                      >
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => handleToggleUser(u.id)}
                            className="rounded bg-neutral-950 border-neutral-700 text-green-600 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-medium text-neutral-200">
                          <div>{u.displayName || u.username || u.email?.split('@')[0] || u.id}</div>
                          {u.isAdmin && <span className="inline-block text-[10px] bg-purple-950 text-purple-400 px-1.5 py-0.5 rounded font-mono">Admin</span>}
                        </td>
                        <td className="p-3 text-neutral-400 text-xs font-mono">{u.email || 'N/A'}</td>
                        <td className="p-3 font-semibold text-green-400 text-right">₹{u.credits ?? 0}</td>
                        <td className="p-3 text-yellow-500 text-xs text-right">₹{u.freeCredits ?? 0}</td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-neutral-500">No registered users found matching your search.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showDrunkModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-sm w-full text-center relative shadow-2xl space-y-4"
            >
              <div className="w-16 h-16 bg-yellow-500/10 border border-yellow-500/30 rounded-full flex items-center justify-center mx-auto text-yellow-400 text-3xl font-bold">
                🍺
              </div>
              <h3 className="text-xl font-semibold text-neutral-100">are u sure not drunk</h3>
              <p className="text-sm text-neutral-400">
                This will credit <strong className="text-green-400">₹{drunkActionType === 'selected' ? grantAmount : creditEmailAmount}</strong> to the user's wallet immediately.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowDrunkModal(false)}
                  className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium rounded-xl transition-all active:scale-95 text-sm"
                >
                  No, cancel
                </button>
                <button
                  onClick={executeCreditAction}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl transition-all active:scale-95 text-sm shadow-lg shadow-green-950/50"
                >
                  Yes I'm sure
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
