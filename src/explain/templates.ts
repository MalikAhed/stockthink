/**
 * Template string bank (spec §8). A template only renders when its fact
 * exists with all slots detector-filled — the renderer never invents a
 * square, piece, or motif. Sentences address the player ("your knight").
 *
 * Lines render as short SAN, at most 3 moves shown, ellipsis after.
 */
import type { Role } from 'chessops/types';
import type { Fact, PieceRef } from './explain';

const ROLE_NAMES: Record<Role, string> = {
  pawn: 'pawn',
  knight: 'knight',
  bishop: 'bishop',
  rook: 'rook',
  queen: 'queen',
  king: 'king',
};

const named = (p: PieceRef): string => `${ROLE_NAMES[p.role]} on ${p.square}`;

/** "Qxd5 Nf3 Bb5" → "Qxd5 Nf3 Bb5…" capped at 3 SAN tokens. */
const shortLine = (line: string[]): string =>
  line.length <= 3 ? line.join(' ') : `${line.slice(0, 3).join(' ')}…`;

/** Like shortLine but never drops the final move (the winning capture). */
const lineToCapture = (line: string[]): string =>
  line.length <= 5
    ? line.join(' ')
    : `${line.slice(0, 3).join(' ')} … ${line[line.length - 1]}`;

const materialWords = (value: number): string => {
  if (value === 1) return 'a pawn';
  if (value === 2) return 'two pawns';
  if (value === 3) return 'a piece';
  if (value === 5) return 'a rook';
  if (value === 9) return 'a queen';
  return `${value} points of material`;
};

const reasonClause = (fact: Extract<Fact, { kind: 'loses_material' | 'wins_material' }>): string => {
  switch (fact.reason) {
    case 'undefended':
      return 'it is undefended';
    case 'defender_pinned':
      return fact.kind === 'loses_material' && fact.pinnedDefender
        ? `its defender, the ${named(fact.pinnedDefender.piece)}, is pinned to your ${ROLE_NAMES[fact.pinnedDefender.pinnedTo]} and cannot recapture`
        : 'its defender is pinned and cannot recapture';
    case 'outnumbered':
      return 'it has more attackers than defenders';
  }
};

/**
 * The primary sentence for a move's main fact. Bad-move facts read as
 * consequences ("This loses…"); good-move facts as achievements.
 */
export function renderPrimary(fact: Fact): string {
  switch (fact.kind) {
    /* ---- bad ---- */
    case 'allows_mate':
      return fact.line.length > 0
        ? `This allows a forced mate in ${fact.n}: ${shortLine(fact.line)}.`
        : `This allows a forced mate in ${fact.n}.`;
    case 'loses_material':
      if (fact.immediate && fact.reason === 'undefended')
        return `This hangs your ${named(fact.victim)} — ${fact.captureSan} simply wins it.`;
      if (fact.reason === 'defender_pinned')
        return `This loses material: after ${lineToCapture(fact.line)}, ${reasonClause(fact)}.`;
      if (fact.reason === 'outnumbered')
        return `This loses your ${named(fact.victim)} — it is attacked more times than it is defended (${lineToCapture(fact.line)}).`;
      return `This loses your ${ROLE_NAMES[fact.victim.role]}: after ${lineToCapture(fact.line)}, the ${named(fact.victim)} is undefended.`;
    case 'allows_fork':
      return `This allows ${fact.moveSan}, forking your ${named(fact.targets[0])} and your ${named(fact.targets[1])}.`;
    case 'allows_skewer':
      return `This walks into a skewer: ${fact.moveSan} wins material along the line.`;
    case 'allows_discovered':
      return `This allows ${fact.moveSan}, a discovered attack on your ${named(fact.target)}.`;
    case 'allows_mate_threat':
      return `This lets your opponent play ${fact.moveSan}, threatening mate with ${fact.threatSan}.`;
    case 'loses_material_eventually':
      return `This loses material by force: after ${shortLine(fact.line)} you end up down ${materialWords(fact.value)}.`;

    /* ---- good ---- */
    case 'mate_for':
      return fact.n === 0 ? 'Checkmate — well played!' : `This forces checkmate in ${fact.n}.`;
    case 'wins_material':
      return `This wins the ${named(fact.victim)} — ${reasonClause(fact)}.`;
    case 'fork_for':
      return `The ${ROLE_NAMES[fact.forker]} forks the ${named(fact.targets[0])} and the ${named(fact.targets[1])}.`;
    case 'pin_for':
      return `This pins the ${named(fact.pinned)} against the king.`;
    case 'discovered_for':
      return `This uncovers a discovered attack on the ${named(fact.target)}.`;
    case 'threat_for':
      return `This threatens mate with ${fact.threatSan}.`;
    case 'saves_piece':
      return `This rescues your attacked ${named(fact.piece)}.`;
    case 'trap_for':
      return `This traps the ${named(fact.piece)} — it has no safe squares.`;
    case 'positional':
      return `This ${fact.fragment}.`;
  }
}

/** The "better was" clause: what the engine's best move would have achieved. */
export function renderBetterWas(bestSan: string, purpose: Fact | null): string {
  if (!purpose) return `${bestSan} was best.`;
  switch (purpose.kind) {
    case 'mate_for':
      return purpose.n === 0
        ? `${bestSan} was checkmate.`
        : `${bestSan} was better — it forces mate in ${purpose.n}.`;
    case 'wins_material':
      return `${bestSan} was better, winning the ${named(purpose.victim)} (${reasonClause(purpose)}).`;
    case 'fork_for':
      return `${bestSan} was better, forking the ${named(purpose.targets[0])} and the ${named(purpose.targets[1])}.`;
    case 'pin_for':
      return `${bestSan} was better, pinning the ${named(purpose.pinned)} against the king.`;
    case 'discovered_for':
      return `${bestSan} was better, uncovering an attack on the ${named(purpose.target)}.`;
    case 'threat_for':
      return `${bestSan} was better, threatening mate with ${purpose.threatSan}.`;
    case 'saves_piece':
      return `${bestSan} was better, saving the attacked ${named(purpose.piece)}.`;
    case 'trap_for':
      return `${bestSan} was better, trapping the ${named(purpose.piece)}.`;
    case 'positional':
      return `${bestSan} was better — it ${purpose.fragment}.`;
    default:
      return `${bestSan} was best.`;
  }
}

/** The Miss template: what the missed best move would have achieved. */
export function renderMissedWin(bestSan: string, purpose: Fact | null): string {
  if (!purpose) return `This misses a much stronger continuation — ${bestSan} was the move.`;
  switch (purpose.kind) {
    case 'mate_for':
      return purpose.n === 0
        ? `This misses a win — ${bestSan} was checkmate!`
        : `This misses a win — ${bestSan} would have forced mate in ${purpose.n}.`;
    case 'wins_material':
      return `This misses a win — ${bestSan} would have won the ${named(purpose.victim)} (${reasonClause(purpose)}).`;
    case 'fork_for':
      return `This misses a win — ${bestSan} would have forked the ${named(purpose.targets[0])} and the ${named(purpose.targets[1])}.`;
    case 'pin_for':
      return `This misses a chance — ${bestSan} would have pinned the ${named(purpose.pinned)} against the king.`;
    case 'discovered_for':
      return `This misses a chance — ${bestSan} would have uncovered an attack on the ${named(purpose.target)}.`;
    case 'threat_for':
      return `This misses a chance — ${bestSan} would have threatened mate with ${purpose.threatSan}.`;
    case 'trap_for':
      return `This misses a chance — ${bestSan} would have trapped the ${named(purpose.piece)}.`;
    default:
      return `This misses a much stronger continuation — ${bestSan} was the move.`;
  }
}

/** Eval words (§2.5) — never raw centipawns in prose. */
export function evalWords(winPctMover: number, mate: boolean): string {
  if (mate) return 'a forced mate';
  if (winPctMover >= 85) return 'winning';
  if (winPctMover >= 65) return 'clearly better';
  if (winPctMover >= 55) return 'slightly better';
  if (winPctMover > 45) return 'roughly equal';
  if (winPctMover > 35) return 'slightly worse';
  if (winPctMover > 15) return 'clearly worse';
  return 'losing';
}
