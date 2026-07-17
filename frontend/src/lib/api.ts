import { supabase } from './supabase';

export const API_URL = import.meta.env.VITE_API_URL ?? '';

if (!import.meta.env.VITE_API_URL && import.meta.env.DEV) {
  console.warn('[api] VITE_API_URL não definido — requests vão para o mesmo origin');
}

export async function apiFetch(path: string, options?: RequestInit) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_URL}${normalizedPath}`;

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };
  if (options?.body && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, { ...options, headers });
}
