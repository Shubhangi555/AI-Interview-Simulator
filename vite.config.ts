import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy: the browser only ever talks to /api; the API key stays on the server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } },
  },
});
