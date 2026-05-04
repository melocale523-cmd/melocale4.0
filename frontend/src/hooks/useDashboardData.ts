import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useProfile } from './useProfile';
import { walletService, leadService } from '../services/dbServices';
import { calculateProfileCompletion, calculateSteps } from '../lib/profileHelpers';

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

  const completion = calculateProfileCompletion(profile, user?.email);

  const steps = calculateSteps({
    profile,
    email: user?.email,
    balanceCoins,
    purchaseCount,
  });

  const doneCount = steps.filter(s => s.done).length;
  const totalSteps = steps.length;
  const checklistPct = Math.round((doneCount / totalSteps) * 100);

  if (!isLoading && profile) {
    console.log('[useDashboardData]', {
      avatar: !!profile.avatar_url,
      steps: steps.map(s => ({ id: s.id, done: s.done })),
      doneCount,
      totalSteps,
      checklistPct,
    });
  }

  return {
    user,
    profile,
    isLoading,
    balanceCoins,
    purchaseCount,
    completion,
    steps,
    doneCount,
    totalSteps,
    checklistPct,
  };
}
