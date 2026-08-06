import { create } from 'zustand';
import { User } from 'firebase/auth';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  credits: number;
  freeCredits?: number;
  isAdmin: boolean;
  createdAt: number;
  lastDailyReward?: number;
  stats?: {
    totalWins?: number;
    totalCreditsWon?: number;
  };
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  updateCredits: (amount: number) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
  updateCredits: (amount) => set((state) => ({
    profile: state.profile ? { ...state.profile, credits: state.profile.credits + amount } : null
  })),
}));
