import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  if (mode === 'production' && !process.env.VITE_API_URL) {
    throw new Error('VITE_API_URL deve estar definido em builds de produção. O Service Worker não funcionará sem ele.');
  }
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon-32.png', 'apple-touch-icon.png', 'icon.svg'],
        manifest: {
          name: 'MeloCalé',
          short_name: 'MeloCalé',
          description: 'Encontre profissionais de serviços domésticos perto de você',
          theme_color: '#22c55e',
          background_color: '#1a2e1a',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('react-dom') || id.includes('react-router') || id.includes('scheduler') || id.includes('/react/')) return 'vendor-react';
            if (id.includes('@tanstack')) return 'vendor-query';
            if (id.includes('@supabase') || id.includes('@realtime-kit') || id.includes('websocket')) return 'vendor-supabase';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('sonner')) return 'vendor-toast';
            if (id.includes('recharts') || id.includes('victory')) return 'vendor-charts';
            if (id.includes('motion') || id.includes('framer')) return 'vendor-motion';
            if (id.includes('firebase')) return 'vendor-firebase';
          },
        },
      },
    },
  };
});
