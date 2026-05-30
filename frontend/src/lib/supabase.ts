import { createClient } from '@supabase/supabase-js';

let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (_client) return _client;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("❌ VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórios no .env");
  }
  if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('supabase.co')) {
    throw new Error("❌ VITE_SUPABASE_URL inválida: deve começar com 'https://' e conter 'supabase.co'");
  }
  if (supabaseAnonKey.length <= 100) {
    throw new Error("❌ VITE_SUPABASE_ANON_KEY inválida: JWT muito curto (esperado >100 caracteres)");
  }

  _client = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: (url, options) => globalThis.fetch(url, options),
    },
  });

  return _client;
}

// Backwards-compatible named export — all existing imports continue to work
export const supabase = getSupabaseClient();
