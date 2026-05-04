import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useProfile } from './useProfile';
import { walletService, leadService } from '../services/dbServices';
import { getDashboardState } from '../lib/profileHelpers';

export function useDashboardData() {
  const { user } = useAuthStore();
  const { data: profile, isLoading: profileLoading } = useProfile();

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['walletBalance'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: walletService.getBalance,
  });

  const { data: purchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ['myPurchases'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: leadService.getMyPurchases,
  });

  const isLoading = profileLoading || balanceLoading || purchasesLoading;

  const balanceCoins = typeof balance === 'number' ? balance : 0;
  const purchaseCount = Array.isArray(purchases) ? purchases.length : 0;

  const state = getDashboardState({
    profile,
    email: user?.email,
    balanceCoins,
    purchaseCount,
  });

  if (!isLoading && profile) {
    console.log('[useDashboardData]', {
      avatar: profile.avatar_url || null,
      steps: state.steps.map(s => ({ id: s.id, done: s.done })),
      displayDone: state.displayDone,
      displayTotal: state.displayTotal,
      isChecklistComplete: state.isChecklistComplete,
      onlyAvatarMissing: state.onlyAvatarMissing,
    });
  }

  return {
    user,
    profile,
    isLoading,
    balanceCoins,
    purchaseCount,
    ...state,
  };
}
