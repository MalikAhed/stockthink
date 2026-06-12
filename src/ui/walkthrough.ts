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
import { createsFork, createsMateThreat, trapsPieces, winsTempo } from '../concepts/detectors';
import { pinsCreatedEx, seeCapture } from '../concepts/primitives';
import { positionalPurposes } from '../concepts/positional';
import type { PositionalFact } from '../concepts/positional';
import { composeComment } from '../compose/compose';
import type { MoveReport } from '../analysis/report';
import { badgeUrl, CLASS_COLORS } from './badges';
import { formatEval, headline } from './coach';
import { renderRich } from './santag';

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

const PIECE_VALUE: Record<Role, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 0,
};

/** What the line concretely achieves for its first mover — the WHY proof. */
export interface LineOutcome {
  kind: 'mate' | 'material';
  /** Full moves by the first mover until mate. */
  mateIn?: number;
  /** Biggest single victim along the winning sequence. */
  pieceWon?: Role;
}

/**
 * Walk up to `maxPlies` of the PV and report the machine-verified outcome:
 * forced mate, or a net material win measured at a QUIET point (so a PV cut
 * mid-exchange never miscounts). Null = nothing concrete to promise.
 */
export function lineOutcome(
  fen: string,
  uciPv: string[],
  maxPlies = MAX_PLIES,
): LineOutcome | null {
  const setup = parseFen(fen);
  if (setup.isErr) return null;
  let pos: Chess;
  try {
    pos = Chess.fromSetup(setup.unwrap()).unwrap();
  } catch {
    return null;
  }

  let net = 0; // first-mover POV, pawns
  let netAtQuiet = 0;
  let bestVictim: Role | null = null;
  let bestVictimAtQuiet: Role | null = null;

  for (let i = 0; i < Math.min(uciPv.length, maxPlies); i++) {
    const move = parseUci(uciPv[i]) as NormalMove | undefined;
    if (!move || !pos.isLegal(move)) break;
    const mover = i % 2 === 0 ? 1 : -1;
    const victim = pos.board.get(move.to);
    const isEp =
      pos.board.get(move.from)?.role === 'pawn' && (move.from & 7) !== (move.to & 7) && !victim;
    const captured = victim?.role ?? (isEp ? 'pawn' : undefined);
    if (captured) {
      net += mover * PIECE_VALUE[captured];
      if (mover === 1 && (!bestVictim || PIECE_VALUE[captured] > PIECE_VALUE[bestVictim]))
        bestVictim = captured;
    }
    if (move.promotion) net += mover * (PIECE_VALUE[move.promotion] - 1);
    pos.play(move);
    if (pos.isCheckmate())
      // mate delivered by whoever just moved — only the first mover's counts
      return mover === 1 ? { kind: 'mate', mateIn: Math.floor(i / 2) + 1 } : null;
    if (!captured && !pos.isCheck()) {
      // quiet point: the exchange (if any) has settled — bank the count
      netAtQuiet = net;
      bestVictimAtQuiet = bestVictim;
    }
  }

  if (netAtQuiet >= 3 && bestVictimAtQuiet && bestVictimAtQuiet !== 'pawn')
    return { kind: 'material', pieceWon: bestVictimAtQuiet };
  if (netAtQuiet >= 1 && bestVictimAtQuiet)
    return { kind: 'material', pieceWon: 'pawn' };
  return null;
}

/** Outcome → the WHY clause for the intro caption. */
const outcomeClause = (o: LineOutcome): string =>
  o.kind === 'mate'
    ? o.mateIn === 1
      ? 'it forces checkmate on the spot'
      : 'it forces checkmate'
    : `it wins ${o.pieceWon === 'pawn' ? 'a pawn' : `a ${ROLE_NAME[o.pieceWon ?? 'knight']}`}`;

/** Friendly lead-ins so consecutive steps don't read like a metronome. */
const YOUR_LEADS = ['You play', 'Now', 'Then comes', 'And now'];
const OPP_LEADS = [
  'The expected reply is',
  'Your opponent would likely answer',
  'The best defense is',
  'The opponent tries',
];

/**
 * The strongest tactical consequence of a move, provable on the board after
 * it (W2): mate threat > fork > pin > trap > tempo. One clause max — captions
 * teach one idea per step. Null when the move has no provable sting.
 */
function whyClause(before: Chess, move: NormalMove): string | null {
  const afterPos = before.clone();
  afterPos.play(move);
  const board = afterPos.board;
  const role = (sq: number): string => ROLE_NAME[board.get(sq)?.role ?? 'pawn'];

  if (createsMateThreat(before, move)) return 'threatening checkmate next move';
  const fork = createsFork(before, move);
  if (fork.length >= 2) return `forking the ${role(fork[0])} and the ${role(fork[1])}`;
  // a pinned PAWN is rarely the story — only narrate piece pins (W3)
  const pins = pinsCreatedEx(before, move).filter(p => board.get(p.pinned)?.role !== 'pawn');
  if (pins.length) {
    const p = pins[0];
    return p.absolute
      ? `pinning the ${role(p.pinned)} to the king`
      : `pinning the ${role(p.pinned)} against the ${role(p.against)}`;
  }
  const trapped = trapsPieces(before, move);
  if (trapped.length) return `trapping the ${role(trapped[0])} — it has no safe square`;
  const tempo = winsTempo(before, move);
  if (tempo !== null) return `attacking the ${role(tempo)}`;
  return null;
}

/** Which positional purpose to lead with when several fire (most teachable first). */
const POS_RANK: Record<PositionalFact['kind'], number> = {
  castles: 0,
  develops: 1,
  center_gain: 2,
  knight_outpost: 3,
  rook_open_file: 4,
  rook_seventh: 5,
  passed_pawn: 6,
  file_battery: 7,
  fianchetto: 8,
  releases_pin: 9,
  simplifies_ahead: 10,
  improves_shield: 11,
  mobility_gain: 12,
};

/** A board-verified positional purpose as a present-participle clause. */
function positionalWhy(f: PositionalFact): string {
  switch (f.kind) {
    case 'castles':
      return f.side === 'king'
        ? 'tucking the king to safety and connecting the rooks'
        : 'castling long, bringing the king to safety and the rook into play';
    case 'passed_pawn':
      return `creating a passed pawn on ${f.square} that no enemy pawn can stop`;
    case 'simplifies_ahead':
      return 'trading down while ahead — every swap brings the win closer';
    case 'releases_pin':
      return `freeing the ${ROLE_NAME[f.role]} from the pin`;
    case 'rook_open_file':
      return `seizing the open ${'abcdefgh'[f.file]}-file`;
    case 'rook_seventh':
      return `planting the rook on the seventh rank at ${f.square}`;
    case 'knight_outpost':
      return `landing the knight on a strong outpost at ${f.square}`;
    case 'file_battery':
      return `doubling the heavy pieces on the ${'abcdefgh'[f.file]}-file`;
    case 'fianchetto':
      return 'fianchettoing the bishop onto the long diagonal';
    case 'develops': {
      // small deterministic rotation so consecutive developing moves don't drone
      const v = [
        `developing the ${ROLE_NAME[f.role]} into the game`,
        `bringing the ${ROLE_NAME[f.role]} into play`,
        `getting the ${ROLE_NAME[f.role]} off its starting square and into the action`,
      ];
      return v[(f.square.charCodeAt(0) + f.square.charCodeAt(1)) % v.length];
    }
    case 'improves_shield':
      return "shoring up the king's pawn cover";
    case 'center_gain':
      return 'strengthening the grip on the center';
    case 'mobility_gain':
      return `giving the ${ROLE_NAME[f.role]} much more room`;
  }
}

/** The single strongest positional purpose of a move, or null. */
function topPositional(before: Chess, move: NormalMove): PositionalFact | null {
  const facts = positionalPurposes(before, move);
  if (!facts.length) return null;
  return facts.reduce((a, b) => (POS_RANK[a.kind] <= POS_RANK[b.kind] ? a : b));
}

/**
 * Up to two board-verified clauses explaining WHY a move is played. `punish`
 * frames captures as material WON (the refutation's job) instead of merely
 * "taken", and is used when narrating the line that refutes a bad move.
 */
function reasonClauses(before: Chess, move: NormalMove, punish: boolean): string[] {
  const clauses: string[] = [];
  const piece = before.board.get(move.from);
  const victim = before.board.get(move.to);
  const isEp = piece?.role === 'pawn' && (move.from & 7) !== (move.to & 7) && !victim;

  if (victim) {
    const target = `the ${ROLE_NAME[victim.role]} on ${SQUARE(move.to)}`;
    clauses.push(punish && seeCapture(before, move) >= 0 ? `winning ${target}` : `taking ${target}`);
  } else if (isEp) {
    clauses.push('capturing en passant');
  }

  // strongest tactical sting the move creates (mate threat > fork > pin > trap > tempo)
  const why = whyClause(before, move);
  if (why) clauses.push(why);

  // fill the remaining slot with the move's positional purpose
  if (clauses.length < 2) {
    const pf = topPositional(before, move);
    if (pf) clauses.push(positionalWhy(pf));
  }

  return clauses.slice(0, 2);
}

/**
 * One board-verified sentence for a move that leads with its PURPOSE (why the
 * engine plays it) rather than narrating coordinates. `mode` shapes the frame:
 * 'good'/'defense' explain intent, 'punish' explains what the move wins/threatens.
 * Every clause is machine-verified (R4); when nothing concrete fires we fall
 * back to a plain factual statement rather than inventing a reason.
 */
function describeMove(
  pos: Chess,
  move: NormalMove,
  san: string,
  yours: boolean,
  moveIdx: number,
  mode: 'good' | 'defense' | 'punish',
): string {
  const lead = yours
    ? YOUR_LEADS[Math.floor(moveIdx / 2) % YOUR_LEADS.length]
    : OPP_LEADS[Math.floor(moveIdx / 2) % OPP_LEADS.length];

  const piece = pos.board.get(move.from);
  const victim = pos.board.get(move.to);
  const after = pos.clone();
  after.play(move);
  const mate = after.isCheckmate();
  const check = !mate && after.isCheck();

  if (mate) {
    const cap = victim ? `taking the ${ROLE_NAME[victim.role]} on ${SQUARE(move.to)} and delivering ` : '';
    return `${lead} ${san} — ${cap}checkmate, the game would end right here!`;
  }

  let clauses: string[];
  if (san.startsWith('O-O-O'))
    clauses = ['castling long, bringing the king to safety and the rook into play'];
  else if (san.startsWith('O-O')) clauses = ['castling — the king tucks away and the rooks connect'];
  else if (move.promotion) clauses = [`promoting to a ${ROLE_NAME[move.promotion]}`];
  else clauses = reasonClauses(pos, move, mode === 'punish');

  // honest fallback: no verified purpose found — name the move, claim nothing
  if (!clauses.length) clauses = [`bringing the ${ROLE_NAME[piece?.role ?? 'pawn']} to ${SQUARE(move.to)}`];

  const body = clauses.join(' and ');
  return check ? `${lead} ${san} — ${body}, with check.` : `${lead} ${san} — ${body}.`;
}

/**
 * Build the full step list for a chip. Step 0 is an intro (start position,
 * arrow previewing the first move); each later step plays one ply.
 */
export function buildWalkthrough(
  chip: VariationChip,
  playedSan: string | null,
  /** True when the played move was itself fine (best/excellent/good…) —
   *  the intro then reads as a curiosity, never as a correction. */
  playedWasFine = false,
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

  // WHY proof: what the line concretely achieves (mate / material), verified
  // by walking the PV itself — never promised on vibes.
  const outcome = lineOutcome(chip.fen, chip.uciPv);
  let intro: string;
  if (chip.kind === 'best') {
    const opener = playedWasFine
      ? `${playedSan ?? 'Your move'} was a fine choice — the engine just liked ${firstSan} a touch more`
      : playedSan
        ? `Instead of ${playedSan}, this was the moment for ${firstSan}`
        : `The strongest idea here was ${firstSan}`;
    intro = outcome
      ? `${opener} — ${outcomeClause(outcome)}. Step through to see how.`
      : `${opener}. Step through it at your own pace.`;
  } else {
    const punish = outcome
      ? outcome.kind === 'mate'
        ? `${firstSan} leads to checkmate`
        : `${firstSan} wins your ${outcome.pieceWon === 'pawn' ? 'pawn' : ROLE_NAME[outcome.pieceWon ?? 'knight']}`
      : `the reply ${firstSan} punishes it`;
    intro = `So what was wrong with ${playedSan ?? 'that move'}? Watch — ${punish}.`;
  }

  steps.push({
    fen: chip.fen,
    arrow: firstUci
      ? {
          orig: firstUci.slice(0, 2),
          dest: firstUci.slice(2, 4),
          brush: youAreFirstMover ? 'green' : 'yellow',
        }
      : undefined,
    caption: intro,
    side: 'intro',
  });

  const plies = Math.min(chip.uciPv.length, MAX_PLIES);
  for (let i = 0; i < plies; i++) {
    const move = parseUci(chip.uciPv[i]) as NormalMove | undefined;
    if (!move || !pos.isLegal(move)) break;
    const san = makeSan(pos, move);
    const yours = youAreFirstMover ? i % 2 === 0 : i % 2 === 1;
    // in a refutation the opponent's moves (not "yours") are the punishment —
    // frame them by what they win/threaten; everything else explains intent.
    const mode: 'good' | 'defense' | 'punish' =
      chip.kind === 'refutation' && !yours ? 'punish' : yours ? 'good' : 'defense';
    const confident = i < CONFIDENT_PLIES;
    const caption = confident
      ? describeMove(pos, move, san, yours, i, mode)
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
      // the honesty note shows once, on the first beyond-our-depth step (W3)
      note:
        i === CONFIDENT_PLIES
          ? 'We keep explanations to 3 moves for now — deeper, well-explained lines are coming as the coach learns more.'
          : undefined,
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
      <div class="spot-title">${renderRich(title, [steps[0].fen])}</div>
      <div class="spot-caption ${step.side}">${renderRich(step.caption, [i > 0 ? steps[i - 1].fen : steps[0].fen, step.fen])}</div>
      ${step.note ? `<div class="spot-note">${esc(step.note)}</div>` : ''}
      <div class="spot-dots">${dots}</div>
      <div class="spot-controls">
        <button class="spot-btn" data-nav="prev" ${i === 0 ? 'disabled' : ''}>◀ Back</button>
        <button class="spot-btn primary" data-nav="next">${last ? '✓ Got it' : 'Next ▶'}</button>
      </div>
      <div class="spot-hint">← → to step · Esc to return · or just move a piece to try your own idea</div>
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

/**
 * "Your move" card inside the Spotlight: the user grabbed a piece mid-
 * walkthrough and our live engine rated it. Visually distinct (blue) so it
 * can never be confused with the engine's best line.
 */
export function renderTryCard(
  el: HTMLElement,
  m: MoveReport | null,
  san: string,
  on: { undo: () => void; back: () => void },
): void {
  const body = m
    ? `
      <div class="spot-verdict">
        <img class="spot-badge" src="${badgeUrl(m.classification)}" alt="${m.classification}" draggable="false">
        <span class="spot-verdict-label"><span class="san">${renderRich(m.san, [m.fenBefore])}</span> is <span style="color:${CLASS_COLORS[m.classification]}">${headline(m.classification)}</span></span>
        <span class="spot-eval">${formatEval(m.evalAfter)}</span>
      </div>
      <div class="spot-caption you">${renderRich(composeComment(m).text, [m.fenBefore, m.fenAfter])}</div>`
    : `
      <div class="spot-caption intro">Checking ${esc(san)}…</div>`;
  el.innerHTML = `
    <div class="spotlight-card trymode">
      <div class="spot-head">
        <span class="spot-tag try">🧪 Your move</span>
      </div>
      ${body}
      <div class="spot-controls">
        <button class="spot-btn" data-nav="undo" ${m ? '' : 'disabled'}>◀ Undo</button>
        <button class="spot-btn primary" data-nav="back">↩ Back to the best line</button>
      </div>
      <div class="spot-hint">keep moving pieces — every move gets rated</div>
    </div>`;
  el.querySelector('[data-nav="undo"]')?.addEventListener('click', on.undo);
  el.querySelector('[data-nav="back"]')?.addEventListener('click', on.back);
}