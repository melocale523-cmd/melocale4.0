import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore, Role } from '../store/authStore';

export function useAuthGuard(targetRole?: Role) {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuthStore();

  const isAuthorized = !targetRole || (user?.role === targetRole);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isAuthorized && user?.role) {
      console.log('useAuthGuard: Redirecionando para dashboard correto:', user.role);
      let dashboard = '/cliente/dashboard';
      if (user.role === 'admin') dashboard = '/admin/dashboard';
      else if (user.role === 'professional') dashboard = '/profissional/dashboard';
      navigate(dashboard, { replace: true });
    }
  }, [isLoading, isAuthenticated, isAuthorized, user?.role, navigate]);

  return { isAuthorized, loading: isLoading, isAuthenticated };
}


