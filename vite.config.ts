import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import checker from 'vite-plugin-checker';

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
  // vite-plugin-checker surfaces TS errors as an in-page overlay during dev, so
  // the browser-MCP screenshot loop literally sees type errors on the page.
  // enableBuild:false — `npm run build` already runs `tsc --noEmit`; the plugin
  // is only here for the live dev overlay, so don't double-typecheck on build.
  plugins: [checker({ typescript: true, overlay: true, enableBuild: false })],
  // host:true so a headless browser / MCP can reach the dev server reliably;
  // open:false because the MCP (not Vite) drives the browser.
  server: { host: true, open: false, hmr: { overlay: true } },
  build: {
    target: 'es2022',
    // keep the engine wasm out of inlining/hashing concerns: it lives in public/
  },
  worker: {
    format: 'es' as const,
  },
}));
