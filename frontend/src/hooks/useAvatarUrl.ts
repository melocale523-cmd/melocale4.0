import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

async function fetchSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('avatars')
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Returns a displayable URL for a stored avatar.
 * - Legacy full URLs (http/https) are returned unchanged.
 * - Storage paths generate a 1-hour signed URL cached for 50 min.
 */
export function useAvatarUrl(avatarValue: string | null | undefined) {
  const isLegacyUrl = !!avatarValue?.startsWith('http');
  const isPath = !!avatarValue && !isLegacyUrl;

  const { data: signedUrl } = useQuery({
    queryKey: ['avatarSignedUrl', avatarValue],
    queryFn: () => fetchSignedUrl(avatarValue!),
    enabled: isPath,
    staleTime: 50 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });

  if (!avatarValue) return null;
  if (isLegacyUrl) return avatarValue;
  return signedUrl ?? null;
}
