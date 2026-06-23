// Assemble a SELF-CONTAINED render bundle that needs NO Vite — just a static file server + headless
// Chrome + Node. This is what you upload to Google Colab (GPU) to render the cinematics ~50× faster
// than this GPU-less box. The same studio/scene/recorder files run there unchanged; `three` resolves
// via the importmap baked into the standalone studio.html, and pieces.js falls back to BASE_URL='/'.
//   node editor/make-render-kit.mjs   →   ./render-kit.zip
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const L = (p) => fileURLToPath(new URL('../' + p, import.meta.url));            // frontend/landing/<p>
const PUB = (p) => fileURLToPath(new URL('../../public/landing/' + p, import.meta.url));
const KIT = L('render-kit');
const ZIP = L('render-kit.zip');

rmSync(KIT, { recursive: true, force: true });
rmSync(ZIP, { force: true });
mkdirSync(KIT, { recursive: true });
mkdirSync(KIT + '/record', { recursive: true });
mkdirSync(KIT + '/editor', { recursive: true });
mkdirSync(KIT + '/landing/models', { recursive: true });
mkdirSync(KIT + '/landing/textures', { recursive: true });

// scene + studio modules (run in the browser; `three` via importmap in studio.html)
for (const f of ['pieces.js', 'perf.js', 'ender-scene.js', 'ender-board.js', 'board-layout.js']) cpSync(L(f), KIT + '/' + f);
cpSync(L('record/studio.html'), KIT + '/record/studio.html');
cpSync(L('record/studio.js'), KIT + '/record/studio.js');
// the Node-side recorder + encoder (portable: GL=gpu, URLPATH, system-ffmpeg fallback)
cpSync(L('editor/record.mjs'), KIT + '/editor/record.mjs');
cpSync(L('editor/encode.mjs'), KIT + '/editor/encode.mjs');
// real URL assets pieces.js / ender-board.js fetch (served at /landing/… by the static server)
cpSync(PUB('models'), KIT + '/landing/models', { recursive: true });
cpSync(PUB('textures'), KIT + '/landing/textures', { recursive: true });

// minimal deps: the browser gets three from a CDN (importmap); Node only needs `ws` for the recorder.
writeFileSync(KIT + '/package.json', JSON.stringify({
  name: 'stockthink-render-kit', private: true, type: 'module',
  dependencies: { ws: '^8.18.0' },
}, null, 2) + '\n');

writeFileSync(KIT + '/README.md', `# StockThink render kit (GPU, e.g. Colab)
Self-contained — no Vite. Serve this folder statically, then drive the recorder with a real GPU.

    npm install                                  # just \`ws\`
    python3 -m http.server 8000 &                # serve the bundle at :8000
    GL=gpu PORT=8000 URLPATH=/record/studio.html \\
      SCENE=ender FRAMES=240 W=3840 H=2160 SS=1 OUT=/tmp/rec/ender node editor/record.mjs
    SCENE=ender FPS=30 IN=/tmp/rec/ender OUTDIR=./out node editor/encode.mjs   # needs ffmpeg on PATH

The Colab notebook automates all of the above. The studio reports its WebGL renderer at boot so you can
confirm the GPU (NVIDIA …) is actually being used and it didn't fall back to SwiftShader.
`);

let archived = 'none';
try { execFileSync('zip', ['-rq', ZIP, 'render-kit'], { cwd: L('') }); archived = 'render-kit.zip'; }
catch { try { execFileSync('tar', ['-czf', L('render-kit.tgz'), '-C', L(''), 'render-kit']); archived = 'render-kit.tgz'; } catch (e) { archived = 'FAILED: ' + e.message; } }

console.log('kit assembled at', KIT);
console.log('archive:', archived);
