import { defineConfig } from 'vite';

// Base relativa para funcionar tanto na raiz de um domínio (Vercel) quanto em subpasta.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173, host: true },
});
