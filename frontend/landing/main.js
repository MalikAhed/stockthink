// Landing-page entry point.
// Loads GSAP from npm (was a CDN <script>), exposes it as window.gsap for the
// scene's intro animation, then boots the modules in dependency order:
//   pieces (asset manifest) -> scene (three.js) -> sections (scroll demos) -> ui.
import gsap from 'gsap';
window.gsap = gsap;

await import('./pieces.js');

// The 3D hero needs WebGL. If it can't initialise (locked-down GPUs, headless
// browsers, WebGL disabled), that must NOT take the rest of the page down — the
// steps, nav and demos are plain DOM and have to keep working. So the hero is
// isolated: its failure is caught and the page continues without it.
try {
  await import('./scene.js');
} catch (err) {
  console.warn('[landing] 3D hero unavailable — continuing without it:', err);
  document.body.classList.add('no-hero');
  // The 3D intro normally clears `pre-intro` (which hides the nav/wordmark/tagline);
  // without it they'd stay invisible, so reveal them here.
  document.body.classList.remove('pre-intro');
}

await import('./scroll-engine.js');   // hero outro + hook morph (scroll-scrubbed motion)
await import('./sections.js');        // per-step demo controller + reveal observers
await import('./number-to-reason.js');// Beat 2 "number → reason" cinematic (self-contained, own observer)

// Beat 3 "the coach studies overnight" — scroll-driven 3D cinematic (own scene). WebGL — isolate.
try { await import('./coach.js'); }
catch (err) { console.warn('[landing] coach cinematic unavailable — continuing without it:', err); }

// 3D gears behind the "How it works" titles. WebGL — isolate failure so the DOM page survives.
try { await import('./gears.js'); }
catch (err) { console.warn('[landing] 3D gears unavailable — continuing without them:', err); }

// 3D gears wrapped around the Stockfish logo on the closing "talks" slide. WebGL — isolate too.
try { await import('./logoGears.js'); }
catch (err) { console.warn('[landing] logo gears unavailable — continuing without them:', err); }

await import('./ui.js');

// Dev-only live Edit Interface (visual editor → editor/edits.json). Never ships:
// import.meta.env.DEV is statically false in the production build, so Vite
// tree-shakes the whole module out.
if (import.meta.env.DEV) {
  import('./editor/editor.js').catch((err) => console.warn('[landing] edit interface failed to load:', err));
}
