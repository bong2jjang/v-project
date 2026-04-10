import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@v-platform/core': path.resolve(__dirname, '../../../platform/frontend/v-platform-core/src'),
    },
    dedupe: ['react', 'react-dom', 'react-router-dom', 'zustand', '@tanstack/react-query'],
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2020',
      logLimit: 0,
    },
  },
  server: {
    port: 5173,
    host: true,
    hmr: {
      clientPort: 5173,
    },
    fs: {
      allow: [
        path.resolve(__dirname, './src'),
        path.resolve(__dirname, '../../../platform/frontend/v-platform-core/src'),
        path.resolve(__dirname, './node_modules'),
        path.resolve(__dirname, '../../..'),
      ],
    },
    watch: {
      usePolling: true,
      interval: 2000,
      ignored: [
        '**/node_modules/**',
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
