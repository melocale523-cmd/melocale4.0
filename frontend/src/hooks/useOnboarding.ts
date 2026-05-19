import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { avatarService } from '../services/profileService';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

export function useOnboarding() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data: categorias = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('name')
        .eq('is_active', true)
        .order('name');
      if (!data?.length) return [];
      return [
        ...data.filter((c: { name: string }) => c.name === 'Outro'),
        ...data.filter((c: { name: string }) => c.name !== 'Outro'),
      ].map((c: { name: string }) => c.name);
    },
    staleTime: 1000 * 60 * 10,
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => avatarService.upload(user!.id, file),
    onError: (err: Error) => toast.error(err.message),
  });

  const bioMutation = useMutation({
    mutationFn: async ({ bio, category }: { bio: string; category: string }) => {
      const { error } = await supabase
        .from('professionals')
        .update({ bio: bio || null, category: category || null })
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

  return { categorias, avatarMutation, bioMutation, completeMutation };
}
