import { create } from 'zustand';

export type Role = 'client' | 'professional' | 'admin';

export interface User {
  id: string;
  professionalId?: string;
  role: Role;
  email: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  currentMode: 'client' | 'professional' | 'admin' | null;
  setAuth: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setMode: (mode: 'client' | 'professional' | 'admin' | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  currentMode: (sessionStorage.getItem('auth_mode') as any) || null,

  setAuth: (user) => set((state) => {
    const newMode = state.currentMode || user?.role || null;
    if (newMode) sessionStorage.setItem('auth_mode', newMode);
    return { user, isAuthenticated: !!user, isLoading: false, currentMode: newMode };
  }),

  setLoading: (loading) => set({ isLoading: loading }),

  setMode: (mode) => {
    if (mode) sessionStorage.setItem('auth_mode', mode);
    else sessionStorage.removeItem('auth_mode');
    set({ currentMode: mode });
  },

  logout: () => {
    sessionStorage.removeItem('auth_mode');
    set({ user: null, isAuthenticated: false, isLoading: false, currentMode: null });
  },
}));
