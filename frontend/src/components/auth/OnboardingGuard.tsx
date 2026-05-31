import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { user } = useAuthStore();

  const { data: onboardingCompleted, isLoading } = useQuery({
    queryKey: ['onboarding_status', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('professionals')
        .select('onboarding_completed')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data?.onboarding_completed ?? false;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0E1C32] flex flex-col items-center justify-center text-emerald-500">
        <Loader2 className="animate-spin mb-9" size={40} />
        <p className="text-[#94A3B8] font-medium">Verificando perfil...</p>
      </div>
    );
  }

  if (!onboardingCompleted) {
    return <Navigate to="/profissional/onboarding" replace />;
  }

  return <>{children}</>;
}
