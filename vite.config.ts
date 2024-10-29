import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        }
      },
      headers: {
        'Content-Security-Policy': `
          default-src 'self';
          script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.stripe.com;
          style-src 'self' 'unsafe-inline';
          img-src 'self' data: blob: https:;
          font-src 'self';
          connect-src 'self' http://localhost:* ws://localhost:* https://*.stripe.com;
          frame-src 'self' https://*.stripe.com;
        `.replace(/\s+/g, ' ').trim()
      }
    },
    define: {
      'process.env.VITE_STRIPE_PUBLISHABLE_KEY': JSON.stringify(env.VITE_STRIPE_PUBLISHABLE_KEY),
      'process.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL)
    },
    build: {
      rollupOptions: {
        output: {
          assetFileNames: (assetInfo) => {
            if (assetInfo.name === 'favicon.ico') {
              return 'favicon.ico';
            }
            return 'assets/[name]-[hash][extname]';
          }
        }
      }
    }
  };
});
