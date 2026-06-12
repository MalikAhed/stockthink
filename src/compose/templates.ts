/**
 * Stage-4 sentence renderers (Mode A). One renderer per fact kind; slots are
 * filled ONLY from the fact (rule R4). No win%, no centipawns, no eval words
 * tied to numbers (R1); at most the first move or two of any line, always
 * with its purpose stated (R2).
 */
import type { Fact, MissedIdea, PieceOn } from '../concepts/facts';
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

/** Verb phrase for what the missed best move WOULD have done. */
function ideaClause(i: MissedIdea): string {
  switch (i.what) {
    case 'defends':
      return `defended the ${pieceAt(i.piece)}`;
    case 'trades':
      return `traded off the ${pieceAt(i.victim)}`;
    case 'wins_material':
      return i.role ? `won the ${i.role} by force` : `won material by force`;
    case 'captures':
      return `taken the ${pieceAt(i.victim)}`;
    case 'removes_checks':
      return 'quietly taken away every check, leaving all the hard decisions to your opponent';
    case 'prepares':
      switch (i.idea.what) {
        case 'mate_threat':
          return `set up ${i.move.san} next, threatening checkmate`;
        case 'wins_piece':
          return `prepared ${i.move.san}, winning the ${pieceAt(i.idea.piece)}`;
        case 'fork':
          return `prepared ${i.move.san}, forking ${listTargets(i.idea.targets)}`;
        case 'pin':
          return `prepared ${i.move.san}, pinning the ${pieceAt(i.idea.piece)}`;
      }
    case 'escapes':
      return `stepped the ${i.role} out of danger`;
    case 'wins_tempo':
      return `gained time by attacking the ${pieceAt(i.target)}`;
    case 'positional':
      return positionalIdea(i.fact);
  }
}

function positionalIdea(f: PositionalFact): string {
  switch (f.kind) {
    case 'castles':
      return 'brought the king to safety';
    case 'passed_pawn':
      return `created a passed pawn on ${f.square}`;
    case 'simplifies_ahead':
      return 'traded down while ahead in material';
    case 'releases_pin':
      return `freed the ${f.role} from the pin`;
    case 'rook_open_file':
      return `taken the open ${FILES[f.file]}-file`;
    case 'rook_seventh':
      return 'planted the rook on the seventh rank';
    case 'knight_outpost':
      return `settled the knight on the ${f.square} outpost`;
    case 'file_battery':
      return `doubled the heavy pieces on the ${FILES[f.file]}-file`;
    case 'fianchetto':
      return 'put the bishop on the long diagonal';
    case 'develops':
      return `developed the ${f.role}`;
    case 'improves_shield':
      return "shored up the king's pawn cover";
    case 'center_gain':
      return 'strengthened the grip on the center';
    case 'mobility_gain':
      return `given the ${f.role} more scope`;
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
    case 'early_queen':
      return 'The queen comes out early — it can be chased around while the minor pieces are still at home.';
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
      // GM-3 (book §4.1): a towering single candidate marks a critical moment
      return 'The position demanded exactly this — the only move that holds everything together.';
    case 'second_candidate':
      return `One of the main candidate moves here — only ${f.best.san} promised a bit more.`;
    case 'hard_to_find':
      return `To be fair, ${f.move.san} is a quiet move — the hardest kind to spot.`;
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
    case 'missed_idea':
      return `${f.move.san} was the better way — it would have ${f.ideas.map(ideaClause).join(' and ')}.`;
    case 'abandons_square':
      return `The ${f.role} had a job on ${f.from} — covering ${f.square} — and this move walks away from it; ${f.reply.san} steps straight into the gap.`;
    case 'missed_mate_threat':
      return `${f.move.san} would have set up a direct mating threat.`;
  }
}
