import { apiFetch } from './api';

export type ConnectStatus = 'not_connected' | 'pending' | 'active';

export interface ConnectStatusResponse {
  accountId: string | null;
  status: ConnectStatus;
}

export const getConnectStatus = async (): Promise<ConnectStatusResponse> => {
  const response = await apiFetch('/api/connect-status');
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${response.status}`);
  }
  return response.json() as Promise<ConnectStatusResponse>;
};

export const connectProfessionalAccount = async (
  email: string,
  currentStatus?: ConnectStatus,
): Promise<void> => {
  if (currentStatus === 'pending' || currentStatus === 'active') {
    return;
  }
  const response = await apiFetch('/api/create-connected-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${response.status}`);
  }
};

// accountId is no longer sent in the body — the backend fetches it from DB
// using the authenticated user's identity, preventing spoofing.
export const createOnboardingLink = async (): Promise<{ url: string }> => {
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
