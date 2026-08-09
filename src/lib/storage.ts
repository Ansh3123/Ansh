import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';

export interface UserAccount {
  uid: string;
  email: string;
  password?: string;
  displayName: string;
  username?: string;
  credits: number;
  freeCredits: number;
  isAdmin: boolean;
  createdAt: number;
  lastDailyReward?: number;
  hasBetAfterDeposit?: boolean;
  hasPlacedBet?: boolean;
  stats?: {
    totalWins?: number;
    totalCreditsWon?: number;
  };
}

export interface PaymentRequest {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  type: 'recharge' | 'withdraw';
  amount: number;
  utrNumber?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
  processedAt?: number;
  processedBy?: string;
}

export interface GameRecord {
  id: string;
  uid: string;
  displayName: string;
  gameId: string;
  wager: number;
  winnings: number;
  profit: number;
  timestamp: number;
}

export interface Achievement {
  id: string;
  uid: string;
  name: string;
  timestamp: number;
}

export interface GameConfig {
  id: string;
  name: string;
  description: string;
  winRate: number;
  multiplier: number;
}

export interface PlatformSettings {
  minRecharge: number;
  minWithdraw: number;
  winRates: Record<string, number>;
  multipliers: Record<string, number>;
}

const STORAGE_KEYS = {
  USERS: 'app_users',
  CURRENT_USER: 'app_current_user',
  REQUESTS: 'app_payment_requests',
  HISTORY: 'app_game_history',
  ACHIEVEMENTS: 'app_achievements',
  GAMES: 'app_games_config',
  SETTINGS: 'app_settings',
  SESSIONS: 'app_live_sessions',
};

const DEFAULT_SETTINGS: PlatformSettings = {
  minRecharge: 10,
  minWithdraw: 30,
  winRates: {
    'coin-flip': 45,
    'dice-roll': 45,
    'lucky-wheel': 45,
    'dart-board': 45,
    'bowling': 45,
  },
  multipliers: {
    'coin-flip': 1.27,
    'dice-roll': 1.27,
    'lucky-wheel': 1.27,
    'dart-board': 1.27,
    'bowling': 1.27,
  },
};

const DEFAULT_GAMES: GameConfig[] = [
  { id: 'dice-roll', name: 'Dice Roll', description: 'Roll the dice and win.', winRate: 45, multiplier: 1.27 },
  { id: 'dart-board', name: 'Dart Board', description: 'Hit the bullseye.', winRate: 45, multiplier: 1.27 },
  { id: 'coin-flip', name: 'Coin Flip', description: 'Heads or Tails?', winRate: 45, multiplier: 1.27 },
  { id: 'lucky-wheel', name: 'Lucky Wheel', description: 'Spin to win big.', winRate: 45, multiplier: 1.27 },
];

function getItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('app_storage_change'));
    }
  } catch (err) {
    console.error('Storage write error:', err);
  }
}

// User accounts
export function getUsers(): UserAccount[] {
  return getItem<UserAccount[]>(STORAGE_KEYS.USERS, []);
}

export function saveUsers(users: UserAccount[]): void {
  setItem(STORAGE_KEYS.USERS, users);
}

export function getUserById(uid: string): UserAccount | null {
  if (!uid) return null;
  const users = getUsers();
  return users.find(u => u.uid === uid || u.email?.toLowerCase() === uid.toLowerCase()) || null;
}

export function updateUser(uid: string, patch: Partial<UserAccount>): UserAccount | null {
  if (!uid) return null;
  const users = getUsers();
  let idx = users.findIndex(u => u.uid === uid || u.email?.toLowerCase() === uid.toLowerCase());
  if (idx === -1) return null;
  
  users[idx] = { ...users[idx], ...patch };
  saveUsers(users);

  // Sync to Firestore immediately so admin dashboard gets instant updates
  const updatedUser = users[idx];
  if (db) {
    setDoc(doc(db, 'users', updatedUser.uid), {
      uid: updatedUser.uid,
      email: updatedUser.email,
      displayName: updatedUser.displayName,
      username: updatedUser.username || null,
      credits: updatedUser.credits,
      freeCredits: updatedUser.freeCredits,
      isAdmin: updatedUser.isAdmin,
      createdAt: updatedUser.createdAt,
      stats: updatedUser.stats || null,
      password: updatedUser.password || ''
    }, { merge: true }).catch(err => {
      console.warn("Firestore sync in updateUser failed:", err);
    });
  }

  // Update current user if it's the same
  const current = getCurrentUser();
  if (current && (current.uid === uid || current.email?.toLowerCase() === uid.toLowerCase())) {
    setCurrentUser(users[idx]);
  }
  return users[idx];
}

export function getCurrentUser(): UserAccount | null {
  return getItem<UserAccount | null>(STORAGE_KEYS.CURRENT_USER, null);
}

export function setCurrentUser(user: UserAccount | null): void {
  setItem(STORAGE_KEYS.CURRENT_USER, user);
}

export function isUsernameTaken(username: string, excludeUid?: string): boolean {
  if (!username) return false;
  const users = getUsers();
  const clean = username.trim().toLowerCase();
  return users.some(u => u.username?.toLowerCase() === clean && u.uid !== excludeUid);
}

export function registerUser(email: string, pass: string, displayName: string, username?: string): UserAccount {
  const users = getUsers();
  const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    throw new Error('An account with this email already exists.');
  }

  const cleanUsername = username?.trim();
  if (cleanUsername && isUsernameTaken(cleanUsername)) {
    throw new Error('Username is already taken. Please choose another one.');
  }

  const isAdmin = email.toLowerCase() === 'saritagupta77300@gmail.com';
  const newUser: UserAccount = {
    uid: 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    email,
    password: pass,
    displayName: displayName || email.split('@')[0],
    username: cleanUsername || undefined,
    credits: 100,
    freeCredits: 0,
    isAdmin,
    createdAt: Date.now(),
    stats: { totalWins: 0, totalCreditsWon: 0 },
  };

  users.push(newUser);
  saveUsers(users);
  setCurrentUser(newUser);

  // Sync registered user to Firestore immediately
  if (db) {
    setDoc(doc(db, 'users', newUser.uid), {
      uid: newUser.uid,
      email: newUser.email,
      displayName: newUser.displayName,
      username: newUser.username || null,
      credits: newUser.credits,
      freeCredits: newUser.freeCredits,
      isAdmin: newUser.isAdmin,
      createdAt: newUser.createdAt,
      stats: newUser.stats || null,
      password: newUser.password || ''
    }, { merge: true }).catch(err => {
      console.warn("Firestore sync in registerUser failed:", err);
    });
  }

  return newUser;
}

export function loginUser(email: string, pass: string): UserAccount {
  const users = getUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user || user.password !== pass) {
    throw new Error('Invalid email or password');
  }

  setCurrentUser(user);
  return user;
}

export function logoutUser(): void {
  setCurrentUser(null);
}

export function syncFirebaseUser(fbUser: { uid: string; email?: string | null; displayName?: string | null; username?: string | null }): UserAccount {
  const users = getUsers();
  let user = users.find(u => u.uid === fbUser.uid || (fbUser.email && u.email.toLowerCase() === fbUser.email.toLowerCase()));
  const email = fbUser.email || `${fbUser.uid}@firebase.user`;
  const isAdmin = email.toLowerCase() === 'saritagupta77300@gmail.com';
  const displayName = fbUser.displayName || user?.displayName || email.split('@')[0] || 'User';
  const username = fbUser.username || user?.username || undefined;

  if (!user) {
    user = {
      uid: fbUser.uid,
      email,
      displayName,
      username,
      credits: 100,
      freeCredits: 0,
      isAdmin,
      createdAt: Date.now(),
      stats: { totalWins: 0, totalCreditsWon: 0 },
    };
    users.push(user);
    saveUsers(users);
  } else {
    user = {
      ...user,
      uid: fbUser.uid,
      email: user.email || email,
      displayName: user.displayName || displayName,
      username: user.username || username,
      isAdmin: user.isAdmin || isAdmin,
    };
    // Update local list directly
    const idx = users.findIndex(u => u.uid === user!.uid);
    if (idx !== -1) {
      users[idx] = user;
    } else {
      users.push(user);
    }
    saveUsers(users);
  }

  // Sync to Firestore immediately
  if (db) {
    setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      username: user.username || null,
      credits: user.credits,
      freeCredits: user.freeCredits,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
      stats: user.stats || null,
      password: user.password || ''
    }, { merge: true }).catch(err => {
      console.warn("Firestore sync in syncFirebaseUser failed:", err);
    });
  }

  setCurrentUser(user);
  return user;
}

// Payment requests
export function getRequests(): PaymentRequest[] {
  return getItem<PaymentRequest[]>(STORAGE_KEYS.REQUESTS, []);
}

export const getPaymentRequests = getRequests;

export function saveRequests(reqs: PaymentRequest[]): void {
  setItem(STORAGE_KEYS.REQUESTS, reqs);
}

export function addRequest(req: Omit<PaymentRequest, 'id' | 'timestamp' | 'status'>): PaymentRequest {
  const reqs = getRequests();
  const newReq: PaymentRequest = {
    ...req,
    id: 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    status: 'pending',
    timestamp: Date.now(),
  };
  reqs.unshift(newReq);
  saveRequests(reqs);
  return newReq;
}

export const addPaymentRequest = addRequest;


export function processPaymentRequest(reqId: string, action: 'approved' | 'rejected', processedBy = 'admin'): PaymentRequest {
  const reqs = getRequests();
  const req = reqs.find(r => r.id === reqId);
  if (!req) throw new Error('Request not found');
  if (req.status !== 'pending') throw new Error('Request already processed');

  req.status = action;
  req.processedAt = Date.now();
  req.processedBy = processedBy;

  if (req.type === 'recharge' && action === 'approved') {
    let user = getUserById(req.uid);
    if (!user && req.email) {
      user = getUserById(req.email);
    }
    if (user) {
      updateUser(user.uid || req.uid, {
        credits: (user.credits || 0) + Number(req.amount || 0),
        hasBetAfterDeposit: false,
      });
    } else {
      const users = getUsers();
      const newUser: UserAccount = {
        uid: req.uid,
        email: req.email || `${req.uid}@user.com`,
        displayName: req.displayName || 'User',
        credits: Number(req.amount || 0),
        freeCredits: 0,
        isAdmin: false,
        createdAt: Date.now(),
        hasBetAfterDeposit: false,
      };
      users.push(newUser);
      saveUsers(users);
    }
  } else if (req.type === 'withdraw' && action === 'rejected') {
    let user = getUserById(req.uid);
    if (!user && req.email) {
      user = getUserById(req.email);
    }
    if (user) {
      updateUser(user.uid || req.uid, {
        credits: (user.credits || 0) + Number(req.amount || 0),
      });
    }
  }

  saveRequests(reqs);
  return req;
}

// Game History
export function getHistory(): GameRecord[] {
  return getItem<GameRecord[]>(STORAGE_KEYS.HISTORY, []);
}

export const getHistoryRecords = getHistory;

export function addHistoryRecord(record: Omit<GameRecord, 'id' | 'timestamp'>): GameRecord {
  const history = getHistory();
  const newRec: GameRecord = {
    ...record,
    id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    timestamp: Date.now(),
  };
  history.unshift(newRec);
  setItem(STORAGE_KEYS.HISTORY, history);
  return newRec;
}

// Achievements
export function getAchievements(uid?: string): Achievement[] {
  const all = getItem<Achievement[]>(STORAGE_KEYS.ACHIEVEMENTS, []);
  if (uid) {
    return all.filter(a => a.uid === uid);
  }
  return all;
}

export function addAchievement(uid: string, name: string): void {
  const all = getItem<Achievement[]>(STORAGE_KEYS.ACHIEVEMENTS, []);
  if (all.some(a => a.uid === uid && a.name === name)) return;
  
  all.push({
    id: 'ach_' + Date.now(),
    uid,
    name,
    timestamp: Date.now(),
  });
  setItem(STORAGE_KEYS.ACHIEVEMENTS, all);
}

// Games
export function getGames(): GameConfig[] {
  return getItem<GameConfig[]>(STORAGE_KEYS.GAMES, DEFAULT_GAMES);
}

export function saveGameConfig(game: GameConfig): void {
  const games = getGames();
  const idx = games.findIndex(g => g.id === game.id);
  if (idx >= 0) {
    games[idx] = game;
  } else {
    games.push(game);
  }
  setItem(STORAGE_KEYS.GAMES, games);
}

export function deleteGameConfig(id: string): void {
  const games = getGames().filter(g => g.id !== id);
  setItem(STORAGE_KEYS.GAMES, games);
}

// Settings
export function getSettings(): PlatformSettings {
  return getItem<PlatformSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
}

export function saveSettings(settings: PlatformSettings): void {
  setItem(STORAGE_KEYS.SETTINGS, settings);
}

// Live Sessions
export interface LiveSession {
  uid: string;
  displayName: string;
  gameId: string;
  lastActive: number;
  overrideResult?: 'win' | 'lose' | null;
  isOnline?: boolean;
}

export function getLiveSessions(): LiveSession[] {
  return getItem<LiveSession[]>(STORAGE_KEYS.SESSIONS, []);
}

export function updateLiveSession(session: Partial<LiveSession> & { uid: string }): void {
  const sessions = getLiveSessions();
  const idx = sessions.findIndex(s => s.uid === session.uid);
  if (idx >= 0) {
    sessions[idx] = { ...sessions[idx], ...session, lastActive: Date.now() };
  } else {
    sessions.push({
      uid: session.uid,
      displayName: session.displayName || 'User',
      gameId: session.gameId || '',
      lastActive: Date.now(),
      overrideResult: session.overrideResult || null,
      isOnline: session.isOnline || false,
    });
  }
  setItem(STORAGE_KEYS.SESSIONS, sessions);
}
