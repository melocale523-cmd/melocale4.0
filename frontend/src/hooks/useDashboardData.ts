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
    hasUser: !!user,
    completionPct: completion.pct,
    balanceCoins,
    purchaseCount,
  });

  const doneCount = steps.filter(s => s.done).length;
  const checklistPct = Math.round((doneCount / steps.length) * 100);

  return {
    user,
    profile,
    isLoading,
    balanceCoins,
    purchaseCount,
    completion,
    steps,
    doneCount,
    checklistPct,
  };
}
