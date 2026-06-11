/**
 * Stage-2 concept annotator (V2 spec) — the "python step", in TS.
 *
 * Runs the deterministic detectors over the played move, the engine's
 * refutation line (position after the move), and the engine's best move
 * (position before the move) and produces sorted typed facts.
 *
 * No prose here, and no evals leak into facts except as mate distances and
 * the winDrop gates that decide whether "missed/refutation" facts apply.
 */
import { Chess } from 'chessops/chess';
import { makeSan } from 'chessops/san';
import type { NormalMove, Role, Square } from 'chessops/types';
import { makeSquare, makeUci, opposite, parseUci } from 'chessops/util';
import type { EvalScore } from '../analysis/winprob';
import { winPercent } from '../analysis/winprob';
import { PIECE_VALUES } from './board';
import {
  blocksCheck,
  capturesFreePiece,
  capturesHigherPiece,
  createsFork,
  createsMateThreat,
  defendsHangingPieces,
  hangsPieces,
  isSacrifice,
  isTrade,
  trapsPieces,
  winsTempo,
} from './detectors';
import type { Fact, PieceOn, SanMove } from './facts';
import { sortFacts } from './facts';
import { givesDiscoveredCheck, materialDiff, pinsCreated } from './primitives';
import { positionalPurposes, positionalRegressions } from './positional';

export interface EngineLineInput {
  /** White-POV eval of this line (from the position BEFORE the move). */
  eval: EvalScore;
  pvUci: string[];
}

export interface AnnotateContext {
  /** White-POV evals around the move. */
  evalBefore: EvalScore;
  evalAfter: EvalScore;
  /** Mover-POV win% lost (0 if the move gained). */
  winDrop: number;
  /** Engine best move from the position before the move. */
  bestUci: string | null;
  /** MultiPV lines from the position before the move (lines[0] = best). */
  lines: EngineLineInput[];
  /** Best-line UCIs from the position AFTER the move (opponent's refutation). */
  replyPv?: string[];
}

/** winDrop (mover POV, win%) at which "missed X" / refutation facts apply. */
const MISS_GATE = 10;
/** Top-2 win% gap that makes the best move an "only move". */
const ONLY_MOVE_GAP = 10;
/** Refutation walk depth (plies) and material loss (pawns) that count. */
const REFUTATION_PLIES = 6;
const REFUTATION_LOSS = 2;

const play = (pos: Chess, move: NormalMove): Chess => {
  const b = pos.clone();
  b.play(move);
  return b;
};

const pieceOn = (pos: Chess, sq: Square): PieceOn => ({
  role: pos.board.get(sq)!.role,
  square: makeSquare(sq),
});

const sanMove = (pos: Chess, move: NormalMove): SanMove => ({
  san: makeSan(pos, move),
  uci: makeUci(move),
});

/** Mover-POV mate distance from a white-POV eval, if the MOVER is mating. */
const mateFor = (mover: 'white' | 'black', ev: EvalScore): number | null => {
  if (ev.mate === undefined || ev.mate === 0) return null;
  const moverMate = mover === 'white' ? ev.mate : -ev.mate;
  return moverMate > 0 ? moverMate : null;
};

/** Mover-POV mate distance if the OPPONENT is mating (mover is getting mated). */
const mateAgainst = (mover: 'white' | 'black', ev: EvalScore): number | null =>
  mateFor(opposite(mover), ev);

/** Cheapest legal capture onto `square`, for hang rendering. */
function cheapestCapture(pos: Chess, square: Square): NormalMove | null {
  let best: NormalMove | null = null;
  let bestValue = Infinity;
  for (const [from, dests] of pos.allDests()) {
    if (!dests.has(square)) continue;
    const v = PIECE_VALUES[pos.board.get(from)!.role];
    if (v < bestValue) {
      bestValue = v;
      best = { from, to: square };
    }
  }
  return best;
}

export function annotateMove(before: Chess, move: NormalMove, ctx: AnnotateContext): Fact[] {
  const mover = before.turn;
  const after = play(before, move);
  const facts: Fact[] = [];
  const movedRole = before.board.get(move.from)!.role;
  const playedUci = makeUci(move);

  /* ---- terminal ------------------------------------------------------- */
  if (after.isCheckmate()) return [{ kind: 'delivers_mate' }];
  if (after.isStalemate()) return [{ kind: 'gives_stalemate' }];

  /* ---- context -------------------------------------------------------- */
  let legalMoves = 0;
  for (const [, dests] of before.allDests()) legalMoves += dests.size();
  if (legalMoves === 1) return [{ kind: 'forced' }];

  if (ctx.lines.length >= 2 && ctx.bestUci === playedUci) {
    const sign = mover === 'white' ? 1 : -1;
    const gap = sign * (winPercent(ctx.lines[0].eval) - winPercent(ctx.lines[1].eval));
    if (gap >= ONLY_MOVE_GAP) facts.push({ kind: 'only_move' });
  }

  /* ---- what the played move achieves ----------------------------------- */
  const target = before.board.get(move.to);
  const victim = target && target.color !== mover ? target : undefined;
  if (victim && capturesFreePiece(before, move))
    facts.push({ kind: 'wins_free_piece', victim: { role: victim.role, square: makeSquare(move.to) } });
  else if (victim && capturesHigherPiece(before, move))
    facts.push({
      kind: 'captures_higher',
      victim: { role: victim.role, square: makeSquare(move.to) },
      attacker: movedRole,
    });

  const forkTargets = createsFork(before, move);
  if (forkTargets.length)
    facts.push({
      kind: 'creates_fork',
      forker: pieceOn(after, move.to),
      targets: forkTargets.map(sq => pieceOn(after, sq)),
    });

  for (const pinned of pinsCreated(before, move)) {
    const kingSq = after.board.kingOf(after.turn)!;
    facts.push({
      kind: 'creates_pin',
      pinned: pieceOn(after, pinned),
      against: pieceOn(after, kingSq),
    });
  }

  if (givesDiscoveredCheck(before, move)) facts.push({ kind: 'discovered_check' });

  for (const sq of trapsPieces(before, move))
    facts.push({ kind: 'traps_piece', piece: pieceOn(after, sq) });

  const mateMove = createsMateThreat(before, move);
  if (mateMove) {
    // render the threat SAN on the after-position with the turn handed back
    const ghost = after.clone();
    ghost.turn = mover;
    ghost.epSquare = undefined;
    facts.push({ kind: 'mate_threat', mateMove: sanMove(ghost, mateMove) });
  }

  if (blocksCheck(before, move)) facts.push({ kind: 'blocks_check' });
  if (isTrade(before, move)) facts.push({ kind: 'trade', piece: movedRole });
  if (isSacrifice(before, move)) facts.push({ kind: 'sacrifice', piece: movedRole });

  const tempoTarget = winsTempo(before, move);
  if (tempoTarget !== null) facts.push({ kind: 'wins_tempo', target: pieceOn(after, tempoTarget) });

  const defended = defendsHangingPieces(before, move);
  if (defended.length) facts.push({ kind: 'defends_piece', piece: pieceOn(after, defended[0]) });

  for (const f of positionalPurposes(before, move)) facts.push({ kind: 'positional', fact: f });
  for (const f of positionalRegressions(before, move)) facts.push({ kind: 'regression', fact: f });

  /* ---- what the played move concedes ------------------------------------ */
  const replyMove = ctx.replyPv?.[0] ? (parseUci(ctx.replyPv[0]) as NormalMove | undefined) : undefined;

  const newMateAgainst = mateAgainst(mover, ctx.evalAfter);
  if (newMateAgainst !== null && mateAgainst(mover, ctx.evalBefore) === null)
    facts.push({
      kind: 'allows_mate',
      mateIn: newMateAgainst,
      firstMove: replyMove && after.isLegal(replyMove) ? sanMove(after, replyMove) : null,
    });

  const hung = hangsPieces(before, move);
  for (const sq of hung) {
    const capMove =
      replyMove && replyMove.to === sq && after.isLegal(replyMove)
        ? replyMove
        : cheapestCapture(after, sq);
    if (!capMove) continue;
    facts.push({ kind: 'hangs_piece', piece: pieceOn(after, sq), capture: sanMove(after, capMove) });
  }

  if (ctx.winDrop >= 5 && replyMove && after.isLegal(replyMove)) {
    const replyForks = createsFork(after, replyMove);
    if (replyForks.length) {
      const afterReply = play(after, replyMove);
      facts.push({
        kind: 'allows_fork',
        forkMove: sanMove(after, replyMove),
        targets: replyForks.map(sq => pieceOn(afterReply, sq)),
      });
    }
  }

  // generic refutation walk — only when nothing concrete explained the drop
  const hasConcreteBad = facts.some(
    f => f.kind === 'hangs_piece' || f.kind === 'allows_mate' || f.kind === 'allows_fork',
  );
  if (!hasConcreteBad && ctx.winDrop >= MISS_GATE && ctx.replyPv?.length) {
    const ref = refutationWalk(after, ctx.replyPv, mover);
    if (ref) facts.push(ref);
  }

  /* ---- what the best move would have done ------------------------------- */
  if (ctx.winDrop >= MISS_GATE && ctx.bestUci && ctx.bestUci !== playedUci) {
    const best = parseUci(ctx.bestUci) as NormalMove | undefined;
    if (best && before.isLegal(best)) {
      const bestSan = sanMove(before, best);
      const missedMate = mateFor(mover, ctx.lines[0]?.eval ?? ctx.evalBefore);
      if (missedMate !== null)
        facts.push({ kind: 'missed_mate', mateIn: missedMate, move: bestSan });

      const bestTarget = before.board.get(best.to);
      const bestVictim = bestTarget && bestTarget.color !== mover ? bestTarget : undefined;
      if (bestVictim && capturesFreePiece(before, best))
        facts.push({
          kind: 'missed_free_piece',
          move: bestSan,
          victim: { role: bestVictim.role, square: makeSquare(best.to) },
        });

      const missedForks = createsFork(before, best);
      const afterBest = play(before, best);
      if (missedForks.length)
        facts.push({
          kind: 'missed_fork',
          move: bestSan,
          targets: missedForks.map(sq => pieceOn(afterBest, sq)),
        });

      const missedPins = pinsCreated(before, best);
      if (missedPins.length)
        facts.push({ kind: 'missed_pin', move: bestSan, pinned: pieceOn(afterBest, missedPins[0]) });

      const missedTraps = trapsPieces(before, best);
      if (missedTraps.length)
        facts.push({ kind: 'missed_trap', move: bestSan, piece: pieceOn(afterBest, missedTraps[0]) });

      if (
        missedMate === null &&
        !missedForks.length &&
        !bestVictim &&
        createsMateThreat(before, best)
      )
        facts.push({ kind: 'missed_mate_threat', move: bestSan });
    }
  }

  return sortFacts(facts);
}

/**
 * Walk the opponent's PV from the position after the played move; if the
 * mover's material drops by ≥REFUTATION_LOSS within REFUTATION_PLIES, return
 * a refutation fact carrying the SAN moves up to (and including) the capture.
 */
function refutationWalk(
  after: Chess,
  replyPv: string[],
  mover: 'white' | 'black',
): Fact | null {
  const startDiff = materialDiff(after.board, mover);
  const probe = after.clone();
  const moves: SanMove[] = [];
  let lossRole: Role | null = null;
  const lost = (): boolean => materialDiff(probe.board, mover) <= startDiff - REFUTATION_LOSS;
  for (let i = 0; i < Math.min(replyPv.length, REFUTATION_PLIES); i++) {
    const m = parseUci(replyPv[i]) as NormalMove | undefined;
    if (!m || !probe.isLegal(m)) break;
    const victim = probe.board.get(m.to);
    if (victim && probe.turn !== mover && victim.color === mover) lossRole = victim.role;
    moves.push(sanMove(probe, m));
    probe.play(m);
    // only judge at stable points: after the mover's own reply (a capture the
    // mover immediately recaptures is a trade, not a refutation)
    if (probe.turn !== mover && lost() && moves.length <= 4)
      return { kind: 'refutation', moves: [...moves], lossRole };
  }
  // PV ended right after an opponent capture — the line is decided there
  if (probe.turn === mover && lost() && moves.length <= 4)
    return { kind: 'refutation', moves: [...moves], lossRole };
  return null;
}
