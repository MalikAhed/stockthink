import { defineConfig } from 'vite';

// GitHub Pages project site lives at https://<user>.github.io/stockthink/ so
// production (build AND preview) uses that base; only the dev server is '/'.
export default defineConfig(({ mode }) => ({
  base: mode === 'development' ? '/' : '/stockthink/',
  build: {
    target: 'es2022',
    // keep the engine wasm out of inlining/hashing concerns: it lives in public/
  },
  worker: {
    format: 'es' as const,
  },
}));
