// DEV-ONLY recording studio controller. Builds ONE cinematic at max quality and exposes a deterministic
// per-frame hook (window.RB.frame) for editor/record.mjs. No perf gating, no scroll/observers — the
// recorder owns the clock. Quality knobs come from the URL: ?scene=ender|coach & ?ss=<supersample>.
import * as THREE from 'three';
const Q = new URLSearchParams(location.search);
const SCENE = Q.get('scene') || 'ender';
const SS = Math.max(1, parseFloat(Q.get('ss') || '1.5'));   // supersample: render at SS× then the browser
                                                            // downsamples into the W×H screenshot → clean AA
const canvas = document.getElementById('stage');

window.RB = { ready: false, scene: SCENE, frame: null, error: null, glRenderer: null };

// Read the unmasked GL renderer (e.g. "NVIDIA … / ANGLE" on a GPU, "SwiftShader" on a CPU box) so the
// recorder/notebook can confirm what actually rendered the frames.
function reportRenderer(renderer) {
  try {
    const gl = renderer.getContext();
    const x = gl.getExtension('WEBGL_debug_renderer_info');
    window.RB.glRenderer = x ? String(gl.getParameter(x.UNMASKED_RENDERER_WEBGL)) : 'unknown';
  } catch (e) { window.RB.glRenderer = 'err'; }
}

async function boot() {
  // pieces.js publishes window.PIECES / window.BOARD3D (the real URL assets) the board builders need.
  await import('../pieces.js');

  if (SCENE === 'ender') {
    const { createEnderScene, START_FEN } = await import('../ender-scene.js');
    const view = await createEnderScene(canvas);
    // force maximum fidelity regardless of the device tier the module guessed
    view.renderer.setPixelRatio(SS);
    view.resize();
    reportRenderer(view.renderer);   // expose the GL renderer string so the recorder can confirm GPU vs SwiftShader
    // Drive the WHOLE master clock: p∈[0,1] maps across the full cinematic (intro dolly + rain + the moves +
    // effects), so the baked clip is the live cut frame-for-frame. tick() (rim drift) is intentionally NOT
    // called → every frame is a pure function of p (deterministic capture). Clip length = view.duration s.
    window.RB.duration = view.duration;
    window.RB.frame = (p) => { view.frame(p * view.duration); view.render(); };
    window.RB.fen = START_FEN;
    window.RB.ready = true;
    return;
  }

  throw new Error('unknown scene: ' + SCENE);
}

boot().catch((e) => { window.RB.error = String(e && e.message || e); console.error('[studio]', e); });
