import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export interface ProfileData {
  // from profiles table
  id: string;
  full_name: string;
  phone: string;
  avatar_url: string;
  city: string;
  // from professionals table
  professionalId: string;
  bio: string;
  category: string;
  serviceRadius: number | null;
  isActive: boolean;
}

async function fetchProfileData(userId: string): Promise<ProfileData> {
  const [profileRes, profRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, phone, avatar_url, city')
      .eq('id', userId)
      .single(),
    supabase
      .from('professionals')
      .select('id, bio, category, service_radius, is_active')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (profileRes.error) throw profileRes.error;

  const profile = profileRes.data;
  const prof = profRes.data;

  // Ensure professional row exists via RPC (idempotent, no duplicate inserts)
  let profId = prof?.id || '';
  if (!prof) {
    const { data: ensuredId } = await supabase.rpc('ensure_professional_exists', { p_user_id: userId });
    profId = ensuredId || '';
  }

  return {
    id: profile.id,
    full_name: profile.full_name || '',
    phone: profile.phone || '',
    avatar_url: profile.avatar_url || '',
    city: profile.city || '',
    professionalId: profId,
    bio: prof?.bio || '',
    category: prof?.category || '',
    serviceRadius: prof?.service_radius ?? null,
    isActive: prof?.is_active ?? true,
  };
}

export function useProfile() {
  const { user } = useAuthStore();
  const userId = user?.id;

  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfileData(userId!),
    enabled: !!userId,
    staleTime: 30_000,
    retry: 1,
  });
}
