import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Using empty string as prefix to load all env vars
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'https://tailored-letters-app-49dff41a7b95.herokuapp.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, '/api')
        }
      },
      headers: {
        'Content-Security-Policy': `
          default-src 'self';
          script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.stripe.com;
          style-src 'self' 'unsafe-inline';
          img-src 'self' data: blob: https:;
          font-src 'self';
          connect-src 'self' http://localhost:* ws://localhost:* https://*.stripe.com https://tailored-letters-app-49dff41a7b95.herokuapp.com;
          frame-src 'self' https://*.stripe.com;
        `.replace(/\s+/g, ' ').trim()
      }
    },
    define: {
      // Ensure environment variables are properly stringified and available at runtime
      'window.env': {
        VITE_STRIPE_PUBLISHABLE_KEY: JSON.stringify(env.STRIPE_PUBLISHABLE_KEY || ''),
        VITE_API_BASE_URL: JSON.stringify(env.VITE_API_BASE_URL || '/api')
      }
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
