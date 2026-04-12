import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom', 'react-router-dom', 'zustand', '@tanstack/react-query'],
  },
  server: {
    port: 5173,
    host: true,
    hmr: {
      clientPort: 5174,
    },
    fs: {
      allow: [
        path.resolve(__dirname, '../../..'),
      ],
    },
    watch: {
      usePolling: true,
      interval: 2000,
      ignored: [
        '**/node_modules/**',
        '**/.pnpm-store/**',
        '**/.git/**',
        '**/tests/**',
        '**/test/**',
        '**/dist/**',
        '**/build/**',
        '**/.vscode/**',
        '**/.idea/**',
        '**/coverage/**',
        '**/public/**',
      ],
    },
    proxy: {
      '/api': {
        target: 'http://template-backend:8000',
        changeOrigin: true,
        ws: true,
        configure: (proxy, _options) => {
          proxy.on('proxyRes', (proxyRes, _req, _res) => {
            const location = proxyRes.headers['location'];
            if (location && location.includes('backend:8000')) {
              proxyRes.headers['location'] = location.replace('http://template-backend:8000', '');
            }
          });
        },
      },
    },
  },
});
