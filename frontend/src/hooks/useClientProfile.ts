import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { logService } from '../lib/logService';

export interface ClientProfileData {
  id: string;
  full_name: string;
  phone: string;
  avatar_url: string;
  city: string;
}

async function fetchClientProfile(userId: string): Promise<ClientProfileData> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, avatar_url, city')
    .eq('id', userId)
    .single();

  if (error) {
    logService.error('useClientProfile', 'fetch failed', error);
    throw new Error('Erro ao carregar perfil. Tente novamente.');
  }

  return {
    id: data.id,
    full_name: data.full_name || '',
    phone: data.phone || '',
    avatar_url: data.avatar_url || '',
    city: data.city || '',
  };
}

export function useClientProfile() {
  const { user } = useAuthStore();
  const userId = user?.id;

  return useQuery({
    queryKey: ['clientProfile', userId],
    queryFn: () => fetchClientProfile(userId!),
    enabled: !!userId,
    staleTime: 30_000,
    retry: 1,
  });
}
