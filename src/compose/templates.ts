/**
 * Stage-4 sentence renderers (Mode A). One renderer per fact kind; slots are
 * filled ONLY from the fact (rule R4). No win%, no centipawns, no eval words
 * tied to numbers (R1); at most the first move or two of any line, always
 * with its purpose stated (R2).
 */
import type { Fact, PieceOn } from '../concepts/facts';
import type { PositionalFact, RegressionFact } from '../concepts/positional';

const FILES = 'abcdefgh';

const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
const inWords = (n: number): string => NUM_WORDS[n] ?? String(n);

const pieceAt = (p: PieceOn): string => `${p.role} on ${p.square}`;

const listTargets = (targets: PieceOn[]): string => {
  const names = targets.map(t => (t.role === 'king' ? 'the king' : `the ${pieceAt(t)}`));
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

function renderPositional(f: PositionalFact): string {
  switch (f.kind) {
    case 'castles':
      return f.side === 'king'
        ? 'Castling tucks the king away and connects the rooks.'
        : 'Castling long brings the king to safety and activates the rook.';
    case 'passed_pawn':
      return `This creates a passed pawn on ${f.square} — no enemy pawn can stop it on its way up the board.`;
    case 'simplifies_ahead':
      return 'Trading pieces while ahead in material — every exchange brings the win closer.';
    case 'releases_pin':
      return `This frees the ${f.role} on ${f.square} from the pin.`;
    case 'rook_open_file':
      return `The rook takes the open ${FILES[f.file]}-file, the natural highway into the position.`;
    case 'rook_seventh':
      return `The rook lands on the seventh rank at ${f.square}, attacking from behind.`;
    case 'knight_outpost':
      return `The knight settles on ${f.square}, an outpost no enemy pawn can ever challenge.`;
    case 'file_battery':
      return f.partnerRole === 'rook'
        ? `Heavy pieces double on the ${FILES[f.file]}-file, stacking pressure.`
        : `A queen-and-rook battery forms on the ${FILES[f.file]}-file.`;
    case 'fianchetto':
      return `The bishop takes the long diagonal from ${f.square}.`;
    case 'develops':
      return `A developing move — the ${f.role} joins the game from ${f.square}.`;
    case 'improves_shield':
      return 'This shores up the pawn cover in front of the king.';
    case 'center_gain':
      return 'This strengthens the grip on the center.';
    case 'mobility_gain':
      return `The ${f.role} gains real scope from its new square.`;
  }
}

function renderRegression(f: RegressionFact): string {
  switch (f.kind) {
    case 'weakens_shield':
      return 'It loosens the pawn cover in front of the king.';
    case 'opens_king_file':
      return `It opens the ${FILES[f.file]}-file toward the king — an invitation for the heavy pieces.`;
    case 'doubled_pawns':
      return `It leaves doubled pawns on the ${FILES[f.file]}-file.`;
    case 'isolated_pawn':
      return `The ${FILES[f.file]}-pawn is left isolated, with no neighbor to defend it.`;
    case 'rim_knight':
      return `The knight heads to the rim on ${f.square}, where it controls little.`;
    case 'lags_development':
      return 'It falls further behind in development while the opponent brings pieces out.';
    case 'cedes_center':
      return 'It gives up control of the center.';
  }
}

/** One sentence per fact. Returns null for context kinds rendered elsewhere. */
export function renderFact(f: Fact): string | null {
  switch (f.kind) {
    case 'delivers_mate':
      return 'Checkmate — the game ends here.';
    case 'gives_stalemate':
      return 'Stalemate — the game is drawn on the spot.';
    case 'forced':
      return 'The only legal move.';
    case 'only_move':
      return 'The only move that holds everything together — anything else falls apart.';
    case 'wins_free_piece':
      return `This wins the ${pieceAt(f.victim)} for nothing — no recapture works.`;
    case 'captures_higher':
      return `A favorable exchange: the ${f.attacker} takes the ${pieceAt(f.victim)}.`;
    case 'creates_fork':
      return `The ${pieceAt(f.forker)} forks ${listTargets(f.targets)} — they cannot all be saved.`;
    case 'creates_pin': {
      const base =
        f.against.role === 'king'
          ? `This pins the ${pieceAt(f.pinned)} against the king — it cannot move without losing everything behind it.`
          : `This pins the ${pieceAt(f.pinned)} against the ${pieceAt(f.against)} — moving it would cost even more material.`;
      return f.exploit ? `${base} ${f.exploit.san} comes next to cash in on it.` : base;
    }
    case 'discovered_check':
      return 'A discovered check — the moved piece steps aside and unmasks an attack on the king.';
    case 'traps_piece':
      return `The enemy ${pieceAt(f.piece)} is now trapped — it has no safe square left.`;
    case 'mate_threat':
      return `This threatens checkmate with ${f.mateMove.san} next.`;
    case 'wins_tempo':
      return `This gains time by attacking the ${pieceAt(f.target)}, forcing an immediate answer.`;
    case 'blocks_check':
      return 'The check is blocked while keeping the position intact.';
    case 'trade':
      return `A fair trade of ${f.piece}s.`;
    case 'sacrifice':
      return `A genuine ${f.piece} sacrifice — material is given up for the attack.`;
    case 'defends_piece':
      return `This protects the ${pieceAt(f.piece)}, which was under attack.`;
    case 'prepares':
      switch (f.idea.what) {
        case 'mate_threat':
          return `A preparing move — it sets up ${f.move.san} next, threatening checkmate.`;
        case 'wins_piece':
          return `This prepares ${f.move.san}, winning the ${pieceAt(f.idea.piece)}.`;
        case 'fork':
          return `This prepares ${f.move.san}, forking ${listTargets(f.idea.targets)}.`;
        case 'pin':
          return `This prepares ${f.move.san}, pinning the ${pieceAt(f.idea.piece)}.`;
      }
    case 'positional':
      return renderPositional(f.fact);
    case 'regression':
      return renderRegression(f.fact);
    case 'hangs_piece':
      return `This leaves the ${pieceAt(f.piece)} hanging — ${f.capture.san} simply takes it.`;
    case 'ignores_threat':
      return `The ${pieceAt(f.piece)} was already under attack, and this move does nothing about it — ${f.capture.san} now wins it.`;
    case 'allows_mate':
      return f.firstMove
        ? `This allows a forced mate: after ${f.firstMove.san} there is no defense (mate in ${inWords(f.mateIn)}).`
        : `This allows a forced mate in ${inWords(f.mateIn)}.`;
    case 'allows_fork':
      return `Now ${f.forkMove.san} forks ${listTargets(f.targets)} — material is lost by force.`;
    case 'refutation':
      return f.lossRole
        ? `The problem is ${f.moves[0].san}${f.moves[1] ? ` (and after ${f.moves[1].san})` : ''} — the ${f.lossRole} is lost by force.`
        : `The problem is ${f.moves[0].san}, which wins material by force.`;
    case 'missed_mate':
      return `${f.move.san} would have forced checkmate in ${inWords(f.mateIn)}.`;
    case 'missed_free_piece':
      return `${f.move.san} was available, winning the ${pieceAt(f.victim)} outright.`;
    case 'missed_fork':
      return `${f.move.san} would have forked ${listTargets(f.targets)}.`;
    case 'missed_pin':
      return `${f.move.san} would have pinned the ${pieceAt(f.pinned)} against the king.`;
    case 'missed_trap':
      return `${f.move.san} would have trapped the ${pieceAt(f.piece)}.`;
    case 'missed_mate_threat':
      return `${f.move.san} would have set up a direct mating threat.`;
  }
}
