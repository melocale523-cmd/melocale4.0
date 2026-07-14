import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    env: {
      // Unit tests must never depend on production or CI credentials.
      VITE_SUPABASE_URL: 'https://test-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: `test-${'x'.repeat(128)}`,
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
