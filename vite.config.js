import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

function privateDemoDataGuard() {
  const includeDemoData = process.env.VITE_INCLUDE_DEMO_DATA === 'true';
  const includeLegacyClassic = process.env.VITE_INCLUDE_LEGACY_CLASSIC === 'true';
  return {
    name: 'private-demo-data-guard',
    closeBundle() {
      const privateDemoPaths = includeDemoData ? [] : [
        'dist/family-data.json',
        'dist/headshots',
      ];
      const legacyPaths = includeLegacyClassic ? [] : [
        'dist/classic.html',
        'dist/static',
      ];
      for (const path of [...privateDemoPaths, ...legacyPaths]) {
        const target = resolve(path);
        if (existsSync(target)) rmSync(target, { recursive: true, force: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), privateDemoDataGuard()],
  resolve: {
    alias: {
      '@firstform/json-url': fileURLToPath(new URL('./vendor/json-url/src/main/index.ts', import.meta.url)),
    },
  },
  server: {
    port: Number(process.env.PORT) || 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        explorer: 'explorer.html',
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/maplibre-gl')) return 'vendor-maplibre';
          if (id.includes('node_modules/three')) return 'vendor-three';
          if (id.includes('node_modules/jszip')) return 'vendor-jszip';
          if (id.includes('node_modules/sql.js')) return 'vendor-sql';
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) return 'vendor-react';
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['better-sqlite3', 'sql.js'],
  },
});
