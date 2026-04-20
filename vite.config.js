import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@firstform/json-url': fileURLToPath(new URL('./vendor/json-url/src/main/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        explorer: 'explorer.html',
      },
    },
  },
  optimizeDeps: {
    exclude: ['better-sqlite3', 'sql.js'],
  },
});
