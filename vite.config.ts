
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    // IMPORTANT: Replace 'YOUR_REPO_NAME' with your actual GitHub repository name
    // e.g. if your repo is 'dnd-vtt', this should be '/dnd-vtt/'
    base: '/DM-s-Prism/', // https://github.com/ronmurphy/DM-s-Prism
    plugins: [react()],
                            define: {
                              // Polyfill process.env for the app code
                              'process.env.API_KEY': JSON.stringify(env.API_KEY),
                            // Prevent other process.env access from crashing the app
                            'process.env': {}
                            },
                            server: {
                              port: 3000
                            }
  };
});
