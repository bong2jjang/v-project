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
  },
  optimizeDeps: {
    disabled: false, // 의존성 사전 번들링 활성화 유지
    esbuildOptions: {
      // esbuild 메모리 최적화
      target: 'es2020',
      // 동시 작업 수 제한
      logLimit: 0,
    },
  },
  server: {
    port: 5173,
    host: true, // Docker 컨테이너 내 외부 접근 허용
    hmr: {
      // Docker 환경을 위한 HMR 설정
      clientPort: 5173,
    },
    watch: {
      usePolling: true, // Docker 볼륨 마운트에서 파일 변경 감지
      interval: 2000, // 폴링 간격 (ms) - 메모리 절약을 위해 증가
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
        '**/public/**', // public 디렉토리 감시 제외
      ],
    },
    proxy: {
      '/api': {
        // Docker 환경: backend 서비스명 사용
        target: 'http://backend:8000',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('proxyRes', (proxyRes, _req, _res) => {
            // 리다이렉트 URL에서 backend:8000을 제거하여 상대 경로로 변경
            const location = proxyRes.headers['location'];
            if (location && location.includes('backend:8000')) {
              proxyRes.headers['location'] = location.replace('http://backend:8000', '');
            }
          });
        },
      },
    },
  },
});
