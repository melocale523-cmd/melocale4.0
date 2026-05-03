import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { getPrimaryCategory } from '../lib/profileHelpers';

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

async function fetchProfileData(userId: string, professionalId: string | undefined): Promise<ProfileData> {
  console.log('[useProfile] fetching', { userId, professionalId });

  const [profileRes, profRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, phone, avatar_url, city')
      .eq('id', userId)
      .single(),
    professionalId
      ? supabase
          .from('professionals')
          .select('id, bio, categories, service_radius, is_active')
          .eq('id', professionalId)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (profileRes.error) {
    console.error('[useProfile] profiles error:', profileRes.error);
    throw profileRes.error;
  }

  if (profRes.error) {
    console.error('[useProfile] professionals error:', profRes.error);
  }

  const profile = profileRes.data;
  const prof = profRes.data;

  const result: ProfileData = {
    id: profile.id,
    full_name: profile.full_name || '',
    phone: profile.phone || '',
    avatar_url: profile.avatar_url || '',
    city: profile.city || '',
    professionalId: prof?.id || professionalId || '',
    bio: prof?.bio || '',
    category: getPrimaryCategory(prof?.categories),
    serviceRadius: prof?.service_radius ?? null,
    isActive: prof?.is_active ?? true,
  };

  console.log('[useProfile] result:', result);
  return result;
}

export function useProfile() {
  const { user } = useAuthStore();
  const userId = user?.id;
  const professionalId = user?.professionalId;

  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfileData(userId!, professionalId),
    enabled: !!userId,
    staleTime: 30_000,
    retry: 1,
  });
}
