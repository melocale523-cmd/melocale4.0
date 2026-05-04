/**
 * Returns a displayable URL for a stored avatar.
 * The avatars bucket is public, so avatar_url is already a full public URL.
 */
export function useAvatarUrl(avatarValue: string | null | undefined): string | null {
  return avatarValue ?? null;
}
