import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// GitHub Pages project site lives at https://<user>.github.io/stockthink/ so
// production (build AND preview) uses that base; only the dev server is '/'.
export default defineConfig(({ mode }) => ({
  base: mode === 'development' ? '/' : '/stockthink/',
  // Zone aliases: @frontend → frontend/src, @backend → backend/src. Only
  // cross-zone and test + eval imports use these; intra-zone stays relative.
  resolve: {
    alias: {
      '@frontend': fileURLToPath(new URL('./frontend/src', import.meta.url)),
      '@backend': fileURLToPath(new URL('./backend/src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    // keep the engine wasm out of inlining/hashing concerns: it lives in public/
  },
  worker: {
    format: 'es' as const,
  },
}));
