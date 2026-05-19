import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { avatarService } from '../services/profileService';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

export function useOnboarding() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const avatarMutation = useMutation({
    mutationFn: (file: File) => avatarService.upload(user!.id, file),
    onError: (err: Error) => toast.error(err.message),
  });

  const bioMutation = useMutation({
    mutationFn: async (bio: string) => {
      const { error } = await supabase
        .from('professionals')
        .update({ bio: bio || null })
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('professionals')
        .update({ onboarding_completed: true })
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.setQueryData(['onboarding_status', user?.id], true);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['professional'] });
      queryClient.invalidateQueries({ queryKey: ['my_professional_id'] });
      navigate('/profissional/dashboard');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { avatarMutation, bioMutation, completeMutation };
}
