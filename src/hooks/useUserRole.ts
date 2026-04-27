import { useMemo } from 'react';
import { useAuthStore } from '../store/authStore';

export function useUserRole() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  
  const loading = isLoading; 
  const role = user?.role || null;

  return useMemo(() => ({
    role,
    loading,
    isClient: role === 'client',
    isProfessional: role === 'professional',
    isAdmin: role === 'admin',
    isAuthenticated,
  }), [role, loading, isAuthenticated]);
}
