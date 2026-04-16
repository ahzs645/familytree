import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
