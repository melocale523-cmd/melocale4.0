import { create } from 'zustand';

export type Role = 'client' | 'professional' | 'admin';

export interface User {
  id: string; // auth.uid()
  professionalId?: string; // Tabela professionals id (se existir)
  role: Role;
  name: string;
  phone: string;
  email: string;
  avatar?: string;
  address?: string;
  cep?: string;
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
  updateProfile: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // Começa em TRUE para prever loading assíncrono do AuthInitializer
  currentMode: (sessionStorage.getItem('auth_mode') as any) || null,
  
  // setAuth nunca gera NullPointerException se session existir
  setAuth: (user) => set((state) => {
    let newMode = state.currentMode || user?.role || null;
    if (newMode) sessionStorage.setItem('auth_mode', newMode);
    return { 
      user, 
      isAuthenticated: !!user, 
      isLoading: false, 
      // currentMode herda do último request, mas assume o role na montagem primária
      currentMode: newMode 
    };
  }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setMode: (mode) => {
    if (mode) sessionStorage.setItem('auth_mode', mode);
    else sessionStorage.removeItem('auth_mode');
    set({ currentMode: mode });
  },
  
  logout: () => {
    sessionStorage.removeItem('auth_mode');
    set({ 
      user: null, 
      isAuthenticated: false, 
      isLoading: false, 
      currentMode: null 
    });
  },
  
  updateProfile: (data) => set((state) => ({ 
    user: state.user ? { ...state.user, ...data } : null 
  })),
}));
