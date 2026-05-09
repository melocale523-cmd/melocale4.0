import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("❌ VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórios no .env");
}

// Fixed: Wrapping fetch to avoid "Cannot set property fetch of #<Window> which has only a getter"
// in environments that might have a read-only global fetch.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (url, options) => {
      // Use globalThis directly to avoid any potential getter/setter issues with window.fetch
      return globalThis.fetch(url, options);
    },
  },
});
