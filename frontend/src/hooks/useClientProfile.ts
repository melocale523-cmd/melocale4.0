// useClientProfile — for clients only.
// Fetches `profiles` table only (id, full_name, phone, avatar_url, city, cep + address block).
// Does NOT call ensure_professional_exists or touch the professionals table.
// For professional profile data (bio, category, serviceRadius) use useProfile instead.
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
  address_zipcode: string;
  address_street: string;
  address_number: string;
  address_block: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  city: string | null;
  cep: string | null;
  address_zipcode: string | null;
  address_street: string | null;
  address_number: string | null;
  address_block: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
}

async function fetchClientProfile(userId: string): Promise<ClientProfileData> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, avatar_url, city, cep, address_zipcode, address_street, address_number, address_block, address_complement, address_neighborhood, address_city, address_state')
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
    address_zipcode: row.address_zipcode || '',
    address_street: row.address_street || '',
    address_number: row.address_number || '',
    address_block: row.address_block || '',
    address_complement: row.address_complement || '',
    address_neighborhood: row.address_neighborhood || '',
    address_city: row.address_city || '',
    address_state: row.address_state || '',
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
