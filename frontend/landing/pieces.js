// 3D chess-piece assets: geometry (.glb, meshopt-compressed) + PBR texture maps.
// These were ~5 MB of base64 inlined in the landing HTML; now they are real files
// in public/landing/ and loaded by URL. Edit the manifest, not megabytes of markup.
// Vite injects import.meta.env ('/' dev, '/stockthink/' prod). In the standalone render bundle (Colab,
// no Vite) import.meta.env is undefined, so fall back to '/' — assets are served at the static root there.
const B = (import.meta.env && import.meta.env.BASE_URL) || '/';
const NAMES = ['king', 'queen', 'bishop', 'knight', 'rook', 'pawn'];
// per-piece height ratio relative to the king (was baked into the old base64 blob's `A[type].ratio`).
// The board cinematics scale each piece by KING_H * ratio, so it must travel with the manifest now.
const RATIO = { king: 1.0, queen: 0.9, bishop: 0.8, knight: 0.74, rook: 0.62, pawn: 0.55 };

const PIECES = {};
for (const n of NAMES) {
  PIECES[n] = {
    glb:   `${B}landing/models/${n}.glb`,
    base:  `${B}landing/textures/${n}_base.jpg`,
    nrm:   `${B}landing/textures/${n}_nrm.jpg`,
    mr:    `${B}landing/textures/${n}_mr.jpg`,
    ratio: RATIO[n],
  };
}

// The board (coach + finale cinematics) — its own GLB + two PBR maps, now real URL files instead of
// ~1 MB of base64. Extracted from the old blob; loaded on demand only when a board scene mounts.
const BOARD3D = {
  glb:  `${B}landing/models/chess-board.glb`,
  base: `${B}landing/textures/board_base.jpg`,
  mr:   `${B}landing/textures/board_mr.jpg`,
};

// scene.js / sections.js / board cinematics read these as globals (kept to preserve the original wiring).
window.PIECES = PIECES;
window.BOARD3D = BOARD3D;
window.HERO_PIECE = 'knight';
