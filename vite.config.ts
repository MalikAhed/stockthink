import { defineConfig } from 'vite';

// GitHub Pages project site lives at https://<user>.github.io/stockthink/
// so production builds use that base path; dev stays at root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/stockthink/' : '/',
  build: {
    target: 'es2022',
    // keep the engine wasm out of inlining/hashing concerns: it lives in public/
  },
  worker: {
    format: 'es' as const,
  },
}));
