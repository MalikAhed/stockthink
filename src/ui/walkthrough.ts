/**
 * Best-move Spotlight — a user-paced, step-by-step walkthrough of an engine
 * line (no autoplay). Each step is one move, played with a board animation,
 * an arrow, and ONE friendly sentence derived purely from the board
 * (capture / check / mate / castle / promotion — all machine-verified, R4).
 *
 * Depth is capped at 3 full moves (6 plies): deeper lines get an honest
 * "we'll explain further in the future" note instead of unexplained SAN soup.
 */
import { Chess } from 'chessops/chess';
import { parseFen, makeFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';
import { makeSan } from 'chessops/san';
import type { NormalMove, Role } from 'chessops/types';
import type { VariationChip } from '../compose/compose';

/** Plies we explain with confidence (3 full moves). */
export const CONFIDENT_PLIES = 6;
/** Hard cap — a couple of extra "engine only" plies for the curious. */
const MAX_PLIES = 10;

export interface WalkthroughStep {
  /** Position shown on the board at this step. */
  fen: string;
  /** Squares of the move just played (board highlight), if any. */
  lastMove?: [string, string];
  /** Arrow to draw: the move just played, or (intro step) the move to come. */
  arrow?: { orig: string; dest: string; brush: 'green' | 'yellow' };
  /** One friendly sentence. */
  caption: string;
  /** Small secondary note (honesty footer on deep steps). */
  note?: string;
  /** Whose move this step shows (styling). */
  side: 'you' | 'opponent' | 'intro';
}

const ROLE_NAME: Record<Role, string> = {
  pawn: 'pawn',
  knight: 'knight',
  bishop: 'bishop',
  rook: 'rook',
  queen: 'queen',
  king: 'king',
};

const SQUARE = (sq: number): string =>
  'abcdefgh'[sq & 7] + String((sq >> 3) + 1);

/** Friendly lead-ins so consecutive steps don't read like a metronome. */
const YOUR_LEADS = ['You play', 'Now', 'Then comes', 'And now'];
const OPP_LEADS = [
  'The expected reply is',
  'Your opponent would likely answer',
  'The best defense is',
  'The opponent tries',
];

/**
 * One board-verified sentence for a move: what moved, what it captured,
 * whether it checks or mates. Never speculates beyond the board.
 */
function describeMove(
  pos: Chess,
  move: NormalMove,
  san: string,
  yours: boolean,
  moveIdx: number,
): string {
  const lead = yours
    ? YOUR_LEADS[Math.floor(moveIdx / 2) % YOUR_LEADS.length]
    : OPP_LEADS[Math.floor(moveIdx / 2) % OPP_LEADS.length];

  const piece = pos.board.get(move.from);
  const victim = pos.board.get(move.to);
  const isEp = piece?.role === 'pawn' && (move.from & 7) !== (move.to & 7) && !victim;

  const after = pos.clone();
  after.play(move);
  const mate = after.isCheckmate();
  const check = !mate && after.isCheck();

  let body: string;
  if (san.startsWith('O-O-O')) body = 'the king castles long, tucking away to safety';
  else if (san.startsWith('O-O')) body = 'the king castles to safety';
  else if (move.promotion)
    body = `the pawn reaches the last rank and becomes a ${ROLE_NAME[move.promotion]}!`;
  else if (isEp) body = 'the pawn captures en passant';
  else if (victim)
    body = `the ${ROLE_NAME[piece?.role ?? 'pawn']} captures the ${ROLE_NAME[victim.role]} on ${SQUARE(move.to)}`;
  else
    body = `the ${ROLE_NAME[piece?.role ?? 'pawn']} goes to ${SQUARE(move.to)}`;

  let tail = '';
  if (mate) tail = ' — checkmate, the game would end right here!';
  else if (check) tail = ' — check!';

  return `${lead} ${san} — ${body}${tail}`;
}

/**
 * Build the full step list for a chip. Step 0 is an intro (start position,
 * arrow previewing the first move); each later step plays one ply.
 */
export function buildWalkthrough(
  chip: VariationChip,
  playedSan: string | null,
): WalkthroughStep[] {
  const setup = parseFen(chip.fen);
  if (setup.isErr) return [];
  let pos: Chess;
  try {
    pos = Chess.fromSetup(setup.unwrap()).unwrap();
  } catch {
    return [];
  }

  // "you" = whoever is to move at the line's start for a best line; for a
  // refutation the line starts with the OPPONENT punishing the played move.
  const youAreFirstMover = chip.kind === 'best';

  const steps: WalkthroughStep[] = [];
  const firstUci = chip.uciPv[0];
  const firstSan = chip.sanPv[0] ?? '';

  steps.push({
    fen: chip.fen,
    arrow: firstUci
      ? {
          orig: firstUci.slice(0, 2),
          dest: firstUci.slice(2, 4),
          brush: youAreFirstMover ? 'green' : 'yellow',
        }
      : undefined,
    caption:
      chip.kind === 'best'
        ? playedSan
          ? `Instead of ${playedSan}, this was the moment for ${firstSan}. Step through it at your own pace.`
          : `The strongest idea here was ${firstSan}. Step through it at your own pace.`
        : `So what was wrong with ${playedSan ?? 'that move'}? Watch how the reply punishes it.`,
    side: 'intro',
  });

  const plies = Math.min(chip.uciPv.length, MAX_PLIES);
  for (let i = 0; i < plies; i++) {
    const move = parseUci(chip.uciPv[i]) as NormalMove | undefined;
    if (!move || !pos.isLegal(move)) break;
    const san = makeSan(pos, move);
    const yours = youAreFirstMover ? i % 2 === 0 : i % 2 === 1;
    const confident = i < CONFIDENT_PLIES;
    const caption = confident
      ? describeMove(pos, move, san, yours, i)
      : `The engine continues with ${san}.`;
    pos.play(move);
    steps.push({
      fen: makeFen(pos.toSetup()),
      lastMove: [chip.uciPv[i].slice(0, 2), chip.uciPv[i].slice(2, 4)],
      arrow: {
        orig: chip.uciPv[i].slice(0, 2),
        dest: chip.uciPv[i].slice(2, 4),
        brush: yours ? 'green' : 'yellow',
      },
      caption,
      note: confident
        ? undefined
        : 'We keep explanations to 3 moves for now — deeper, well-explained lines are coming as the coach learns more.',
      side: yours ? 'you' : 'opponent',
    });
    if (pos.isEnd()) break;
  }

  return steps;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The Spotlight card (rendered into the coach slot while focus mode is on):
 * tag · title · one caption · progress dots · big prev/next. The user drives —
 * there is no autoplay anywhere here.
 */
export function renderSpotlightCard(
  el: HTMLElement,
  title: string,
  kind: 'best' | 'refutation',
  steps: WalkthroughStep[],
  i: number,
  on: { go: (i: number) => void; exit: () => void },
): void {
  const step = steps[i];
  const last = i === steps.length - 1;
  const dots = steps
    .map(
      (_, d) =>
        `<button class="spot-dot${d === i ? ' active' : d < i ? ' done' : ''}" data-dot="${d}" aria-label="step ${d + 1}"></button>`,
    )
    .join('');
  el.innerHTML = `
    <div class="spotlight-card ${kind}">
      <div class="spot-head">
        <span class="spot-tag">${kind === 'best' ? '✨ Best move' : '🔍 Why it fails'}</span>
        <button class="spot-exit" title="Back to the game (Esc)">✕</button>
      </div>
      <div class="spot-title">${esc(title)}</div>
      <div class="spot-caption ${step.side}">${esc(step.caption)}</div>
      ${step.note ? `<div class="spot-note">${esc(step.note)}</div>` : ''}
      <div class="spot-dots">${dots}</div>
      <div class="spot-controls">
        <button class="spot-btn" data-nav="prev" ${i === 0 ? 'disabled' : ''}>◀ Back</button>
        <button class="spot-btn primary" data-nav="next">${last ? '✓ Got it' : 'Next ▶'}</button>
      </div>
      <div class="spot-hint">← → to step · Esc to return</div>
    </div>`;
  el.querySelector('.spot-exit')?.addEventListener('click', on.exit);
  el.querySelectorAll<HTMLButtonElement>('.spot-dot').forEach(b =>
    b.addEventListener('click', () => on.go(Number(b.dataset.dot))),
  );
  el.querySelector('[data-nav="prev"]')?.addEventListener('click', () => on.go(i - 1));
  el.querySelector('[data-nav="next"]')?.addEventListener('click', () =>
    last ? on.exit() : on.go(i + 1),
  );
}
