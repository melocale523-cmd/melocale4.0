import { apiFetch } from './api';

export const connectProfessionalAccount = async (email: string) => {
  const response = await apiFetch('/api/create-connected-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${response.status}`);
  }
  return response.json() as Promise<{ accountId: string }>;
};

// accountId is no longer sent in the body — the backend fetches it from DB
// using the authenticated user's identity, preventing spoofing.
export const createOnboardingLink = async () => {
  const response = await apiFetch('/api/create-account-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${response.status}`);
  }
  return response.json() as Promise<{ url: string }>;
};
