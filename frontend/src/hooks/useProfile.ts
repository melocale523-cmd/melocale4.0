// useProfile — for professionals only.
// Fetches both `profiles` and `professionals` tables (calls ensure_professional_exists RPC).
// For client-only profile data (cep, no professional row) use useClientProfile instead.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { logService } from '../lib/logService';

export interface ProfileData {
  id: string;
  full_name: string;
  phone: string;
  avatar_url: string;
  city: string;
  professionalId: string;
  bio: string;
  category: string;
  serviceRadius: number | null;
  isActive: boolean;
  featuredUntil: string | null;
  address_zipcode: string;
  address_street: string;
  address_number: string;
  address_block: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
}

async function fetchProfileData(userId: string, hasProfessionalId: boolean): Promise<ProfileData> {
  // Step 1: guarantee the professional row exists — skip if professionalId is already in store
  if (!hasProfessionalId) {
    const { error: rpcError } = await supabase.rpc('ensure_professional_exists', { p_user_id: userId });
    if (rpcError) {
      logService.error('useProfile', 'ensure_professional_exists failed', rpcError);
      throw new Error('Não foi possível preparar os dados profissionais. Tente novamente.');
    }
  }

  // Step 2: fetch both rows — professional row is guaranteed to exist now
  const [profileRes, profRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, phone, avatar_url, city, address_zipcode, address_street, address_number, address_block, address_complement, address_neighborhood, address_city, address_state')
      .eq('id', userId)
      .single(),
    supabase
      .from('professionals')
      .select('id, bio, category, service_radius, is_active, featured_until')
      .eq('user_id', userId)
      .single(),
  ]);

  if (profileRes.error) throw new Error('Erro ao carregar perfil. Tente novamente.');
  if (profRes.error) throw new Error('Erro ao carregar dados profissionais. Tente novamente.');

  const profile = profileRes.data;
  const prof = profRes.data;

  return {
    id: profile.id,
    full_name: profile.full_name || '',
    phone: profile.phone || '',
    avatar_url: profile.avatar_url || '',
    city: profile.city || '',
    professionalId: prof.id,
    bio: prof.bio || '',
    category: prof.category || '',
    serviceRadius: prof.service_radius ?? null,
    isActive: prof.is_active ?? true,
    featuredUntil: (prof as { featured_until?: string | null }).featured_until ?? null,
    address_zipcode: (profile as { address_zipcode?: string | null }).address_zipcode || '',
    address_street: (profile as { address_street?: string | null }).address_street || '',
    address_number: (profile as { address_number?: string | null }).address_number || '',
    address_block: (profile as { address_block?: string | null }).address_block || '',
    address_complement: (profile as { address_complement?: string | null }).address_complement || '',
    address_neighborhood: (profile as { address_neighborhood?: string | null }).address_neighborhood || '',
    address_city: (profile as { address_city?: string | null }).address_city || '',
    address_state: (profile as { address_state?: string | null }).address_state || '',
  };
}

export function useProfile() {
  const { user } = useAuthStore();
  const userId = user?.id;
  const hasProfessionalId = !!user?.professionalId;

  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfileData(userId!, hasProfessionalId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });
}
