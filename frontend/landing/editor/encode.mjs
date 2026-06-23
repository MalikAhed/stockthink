// DEV-ONLY encoder: mux a PNG frame sequence (from editor/record.mjs) into web video using the
// ffmpeg-static binary (no system ffmpeg needed). Emits an MP4 (H.264, broad support incl. Safari/iOS)
// and a WebM (VP9) fallback, both muted/loopable autoplay-friendly. Output lands in public/landing/video/.
//   SCENE=ender FPS=24 IN=/tmp/rec/ender node editor/encode.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Prefer an explicit FFMPEG path, else the bundled ffmpeg-static binary, else a system `ffmpeg` on PATH
// (Colab installs one via apt). This keeps the encoder portable between this box and the Colab GPU runner.
let ffmpeg = process.env.FFMPEG;
if (!ffmpeg) {
  const local = fileURLToPath(new URL('../../../node_modules/ffmpeg-static/ffmpeg', import.meta.url));
  ffmpeg = existsSync(local) ? local : 'ffmpeg';
}
const SCENE = process.env.SCENE || 'ender';
const FPS = process.env.FPS || '24';
const CRF = process.env.CRF || '18';        // H.264 quality (lower = better; 18 ≈ visually lossless)
const VPCRF = process.env.VPCRF || '24';    // VP9 quality (lower = better)
const PRESET = process.env.PRESET || 'slow';
const IN = process.env.IN || `/tmp/rec/${SCENE}`;
// default: write straight into the site's public assets; OUTDIR overrides it (the Colab kit writes to ./out)
const OUTDIR = process.env.OUTDIR
  ? (process.env.OUTDIR.endsWith('/') ? process.env.OUTDIR : process.env.OUTDIR + '/')
  : fileURLToPath(new URL('../../public/landing/video/', import.meta.url));

if (ffmpeg.includes('/') && !existsSync(ffmpeg)) { console.error('ffmpeg binary missing at', ffmpeg); process.exit(1); }
const frames = readdirSync(IN).filter((f) => /^f\d+\.png$/.test(f));
if (!frames.length) { console.error('no frames in', IN); process.exit(1); }
mkdirSync(OUTDIR, { recursive: true });
const pattern = `${IN}/f%04d.png`;
const mp4 = `${OUTDIR}${SCENE}.mp4`;
const webm = `${OUTDIR}${SCENE}.webm`;
const run = (args) => { console.log('ffmpeg', args.join(' ')); execFileSync(ffmpeg, args, { stdio: ['ignore', 'ignore', 'inherit'] }); };

// even dimensions required by yuv420p; scale filter rounds down to an even number just in case. The
// format=yuv420p conversion dithers by default, which (with the low CRF) keeps the dark teal gradient +
// lamp falloff from banding into visible steps.
const evenScale = 'scale=trunc(iw/2)*2:trunc(ih/2)*2';

// MP4 / H.264 — the primary source (hardware-decoded on essentially every device → ~zero CPU on scroll).
// aq-mode=3 biases bits toward dark, low-contrast regions — exactly the basement's gradients.
run(['-y', '-framerate', FPS, '-i', pattern,
  '-vf', `${evenScale},format=yuv420p`, '-c:v', 'libx264', '-profile:v', 'high', '-crf', CRF,
  '-preset', PRESET, '-x264-params', 'aq-mode=3:aq-strength=1.1', '-movflags', '+faststart', '-an', mp4]);
// WebM / VP9 — fallback for browsers that prefer it
run(['-y', '-framerate', FPS, '-i', pattern,
  '-vf', `${evenScale},format=yuv420p`, '-c:v', 'libvpx-vp9', '-crf', VPCRF, '-b:v', '0',
  '-aq-mode', '1', '-row-mt', '1', '-an', webm]);

// poster = the FIRST frame, so the reveal shows that image (no black flash) and playback starts from the
// same frame seamlessly; also the still shown to reduced-motion users who don't get autoplay.
const poster = `${OUTDIR}${SCENE}-poster.jpg`;
run(['-y', '-i', `${IN}/f0000.png`, '-vf', evenScale, '-frames:v', '1', '-update', '1', '-q:v', '4', poster]);

for (const f of [mp4, webm, poster]) console.log(`  ${f}  ${(statSync(f).size / 1e6).toFixed(2)} MB`);
console.log(`encoded ${frames.length} frames @ ${FPS}fps`);
