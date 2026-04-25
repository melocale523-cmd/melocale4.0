import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://wfournowizclpiektwuv.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmb3Vybm93aXpjbHBpZWt0d3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTQxMDUsImV4cCI6MjA5MTY3MDEwNX0.1byW8VpRXa9FlUXfonSQCbC1da6L7CEi1Fm-7HD7dmg";

console.log("Supabase Client initialized with URL:", supabaseUrl);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Variáveis de ambiente do Supabase não encontradas.");
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
