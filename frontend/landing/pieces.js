// 3D chess-piece assets: geometry (.glb, meshopt-compressed) + PBR texture maps.
// These were ~5 MB of base64 inlined in the landing HTML; now they are real files
// in public/landing/ and loaded by URL. Edit the manifest, not megabytes of markup.
const B = import.meta.env.BASE_URL;                 // '/' in dev, '/stockthink/' in prod
const NAMES = ['king', 'queen', 'bishop', 'knight', 'rook', 'pawn'];

const PIECES = {};
for (const n of NAMES) {
  PIECES[n] = {
    glb:  `${B}landing/models/${n}.glb`,
    base: `${B}landing/textures/${n}_base.jpg`,
    nrm:  `${B}landing/textures/${n}_nrm.jpg`,
    mr:   `${B}landing/textures/${n}_mr.jpg`,
  };
}

// scene.js / sections.js read these as globals (kept to preserve the original wiring).
window.PIECES = PIECES;
window.HERO_PIECE = 'knight';
