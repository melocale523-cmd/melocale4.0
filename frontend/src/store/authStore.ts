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
  // auth_mode é apenas hint de navegação de UI (tab ativa). Nenhuma decisão de permissão
  // ou rota usa este valor — todas usam user.role (vindo do Supabase via setAuth).
  currentMode: (localStorage.getItem('auth_mode') as 'client' | 'professional' | 'admin' | null) || null,

  setAuth: (user) => set((state) => {
    // currentMode segue user.role após autenticação; localStorage só persiste preferência de UI.
    const newMode = user?.role ?? state.currentMode ?? null;
    if (newMode) localStorage.setItem('auth_mode', newMode);
    else localStorage.removeItem('auth_mode');
    return { user, isAuthenticated: !!user, isLoading: false, currentMode: newMode };
  }),

  setLoading: (loading) => set({ isLoading: loading }),

  setMode: (mode) => {
    if (mode) localStorage.setItem('auth_mode', mode);
    else localStorage.removeItem('auth_mode');
    set({ currentMode: mode });
  },

  logout: () => {
    localStorage.removeItem('auth_mode');
    set({ user: null, isAuthenticated: false, isLoading: false, currentMode: null });
  },
}));
