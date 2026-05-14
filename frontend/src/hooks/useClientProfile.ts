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
  cep: string;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  city: string | null;
  cep: string | null;
}

async function fetchClientProfile(userId: string): Promise<ClientProfileData> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, avatar_url, city, cep')
    .eq('id', userId)
    .single();

  if (error) {
    logService.error('useClientProfile', 'fetch failed', error);
    throw new Error('Erro ao carregar perfil. Tente novamente.');
  }

  const row = data as ProfileRow;
  return {
    id: row.id,
    full_name: row.full_name || '',
    phone: row.phone || '',
    avatar_url: row.avatar_url || '',
    city: row.city || '',
    cep: row.cep || '',
  };
}

export function useClientProfile() {
  const { user } = useAuthStore();
  const userId = user?.id;

  return useQuery({
    queryKey: ['clientProfile', userId],
    queryFn: () => fetchClientProfile(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });
}
