import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load env file based on `mode` in the current working directory.
    // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
    const env = loadEnv(mode, process.cwd(), '');

    // Try to find the API key in various common environment variable names
    // This is crucial for Vercel where users might name it differently
    const apiKey = 
        env.API_KEY || 
        env.GEMINI_API_KEY || 
        env.GEMINI_API || 
        env.GOOGLE_API_KEY || 
        env.GOOGLE_GENERATIVE_AI_API_KEY ||
        env.VITE_GEMINI_API_KEY || 
        env.VITE_API_KEY || 
        env.VITE_GOOGLE_API_KEY ||
        '';

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Inject the found key as process.env.API_KEY so the app can use it uniformly
        'process.env.API_KEY': JSON.stringify(apiKey),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});