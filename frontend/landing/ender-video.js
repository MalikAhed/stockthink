// Finale controller — VIDEO edition. The basement cinematic is now a pre-rendered clip (recorded at max
// quality offline; see record/ + editor/record.mjs), so the live page runs ZERO WebGL here — just a
// hardware-decoded <video> that autoplays once when you arrive. The scroll-driven fade-to-black veil and
// the page→black theme flip are kept (cheap DOM) so the transition into the finale looks identical.
const B = import.meta.env.BASE_URL;
const section = document.querySelector('section.ender');
const video = document.getElementById('enderVideo');
if (section && video) {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  video.poster = `${B}landing/video/ender-poster.jpg`;   // first frame — shown during reveal + to reduced-motion users
  // wire the sources lazily (set on first approach) so the clip isn't downloaded until the finale nears
  let sourced = false;
  function ensureSources() {
    if (sourced) return; sourced = true;
    const mp4 = document.createElement('source'); mp4.src = `${B}landing/video/ender.mp4`; mp4.type = 'video/mp4';
    const webm = document.createElement('source'); webm.src = `${B}landing/video/ender.webm`; webm.type = 'video/webm';
    video.appendChild(mp4); video.appendChild(webm);
    video.load();
  }

  // the fade-to-black veil (same element/feel as the old 3D finale): a fixed full-screen black overlay whose
  // opacity is scrubbed by scroll — fades the screen to black as the coach leaves, then lifts to reveal the clip.
  const fade = document.createElement('div');
  fade.className = 'ender-fade';
  document.body.appendChild(fade);

  let played = false;
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  function onScroll() {
    const r = section.getBoundingClientRect();
    const approachP = clamp01(1 - r.top / innerHeight);              // 0→1 as the section's top rises into view
    const revealP = clamp01(-r.top / (innerHeight * 0.6));           // 0→1 over the first ~⅔ viewport once pinned
    // fade-to-black, then reveal the video underneath (identical choreography to the old canvas reveal):
    video.style.opacity = String(clamp01(revealP / 0.5));            // opaque by the halfway point
    fade.style.opacity = String(approachP * (1 - clamp01((revealP - 0.5) / 0.5))); // holds black, then lifts
    // START the clip as it begins to be revealed — NOT when the section first peeks in (it's still behind the
    // black veil then, and a play-once 5s dolly would finish unseen). One-shot; re-armed when the section leaves.
    if (revealP > 0.05 && !played && !RM) { played = true; ensureSources(); video.play().catch(() => {}); }
  }
  let tick = false;
  addEventListener('scroll', () => { if (tick) return; tick = true; requestAnimationFrame(() => { onScroll(); tick = false; }); }, { passive: true });
  onScroll();

  // preload the clip a bit before the finale; flip the page→black theme on entry; re-arm on full exit.
  const near = new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) ensureSources(); }); }, { rootMargin: '120% 0px' });
  near.observe(section);
  const flip = new IntersectionObserver((es) => {
    es.forEach((e) => {
      document.body.classList.toggle('ending', e.isIntersecting);   // page→black theme flip (light theme only; see CSS)
      if (!e.isIntersecting && e.intersectionRatio <= 0.01) {
        played = false; try { video.pause(); video.currentTime = 0; } catch (err) {}   // re-arm for the next visit
      }
    });
  }, { threshold: [0, 0.01, 0.5] });
  flip.observe(section);
}
