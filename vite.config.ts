import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { writeFileSync } from 'node:fs';
import checker from 'vite-plugin-checker';

// Dev-only endpoint for the landing-page live Edit Interface
// (frontend/landing/editor/). The in-page editor POSTs its changeset here and
// this writes it to editor/edits.json, which Claude then reads to apply the real
// CSS/HTML — no chat bloat, no copy-paste. Only attaches to the dev server, so
// it has zero effect on the production build.
function editSavePlugin() {
  const out = fileURLToPath(new URL('./frontend/landing/editor/edits.json', import.meta.url));
  return {
    name: 'stockthink-edit-save',
    apply: 'serve' as const,
    configureServer(server: any) {
      server.middlewares.use('/__st_edit_save', (req: any, res: any, next: any) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (c: any) => { body += c; });
        req.on('end', () => {
          try {
            writeFileSync(out, body);
            res.statusCode = 200; res.setHeader('Content-Type', 'application/json');
            res.end('{"ok":true}');
            server.config.logger.info(`[edit] saved changeset → editor/edits.json`);
          } catch (err: any) {
            res.statusCode = 500; res.end(JSON.stringify({ ok: false, error: String(err) }));
          }
        });
      });
    },
  };
}

// GitHub Pages project site lives at https://<user>.github.io/stockthink/ so
// production (build AND preview) uses that base; only the dev server is '/'.
export default defineConfig(({ mode }) => ({
  base: mode === 'development' ? '/' : '/stockthink/',
  // Static assets (engine WASM, badges) moved under frontend/; Vite still serves
  // them at the base URL root, so their runtime URLs are unchanged.
  publicDir: 'frontend/public',
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
  plugins: [checker({ typescript: true, overlay: true, enableBuild: false }), editSavePlugin()],
  // host:true so a headless browser / MCP can reach the dev server reliably;
  // open:false because the MCP (not Vite) drives the browser.
  server: { host: true, open: false, hmr: { overlay: true } },
  build: {
    target: 'es2022',
    // keep the engine wasm out of inlining/hashing concerns: it lives in frontend/public/
    // Multi-page: the app (root index.html) + the marketing landing page, a
    // self-contained entry under frontend/landing/ (three.js + GSAP, code-split
    // away from the analysis bundle so its 3D assets never load on the app itself).
    rollupOptions: {
      input: {
        // root index.html redirects to the landing page (the marketing front door);
        // the analysis app itself lives at /stockthink/app.html.
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        app: fileURLToPath(new URL('./app.html', import.meta.url)),
        landing: fileURLToPath(new URL('./frontend/landing/index.html', import.meta.url)),
      },
    },
  },
  worker: {
    format: 'es' as const,
  },
}));
