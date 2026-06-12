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
import { attackersTo, attacks, isInBadSpot, PIECE_VALUES } from './board';
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
import { between } from 'chessops/attacks';
import type { Fact, MissedIdea, PieceOn, SanMove } from './facts';
import { factPriority, sortFacts } from './facts';
import type { PinFound } from './primitives';
import {
  effectiveDefenders,
  givesDiscoveredCheck,
  materialDiff,
  pinsCreatedEx,
  pinsHeld,
  seeSquare,
} from './primitives';
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
/** Legal moves by the side to move that give check (GM-6 prophylaxis gate). */
function checkingMoves(pos: Chess): number {
  let n = 0;
  for (const [from, dests] of pos.allDests()) {
    for (const to of dests) {
      const role = pos.board.get(from)?.role;
      const move: NormalMove =
        role === 'pawn' && (to >= 56 || to < 8) ? { from, to, promotion: 'queen' } : { from, to };
      const probe = pos.clone();
      probe.play(move);
      if (probe.isCheck()) n++;
    }
  }
  return n;
}

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

/**
 * A pin is only worth talking about when it bites — a new pin relation alone
 * is geometry, not a reason. Confirmed when either the board proves it
 * (capturing the pinned piece wins material right now, or it is attacked more
 * than effectively defended), the engine's own continuation shows the mover
 * exploiting it within their next two moves (taking the pinned piece, piling
 * another attacker on it, or winning something it was defending — the
 * confirming move is returned so prose can cite it), or it is a quiet
 * absolute pin of a real piece by a pinner the opponent cannot win.
 *
 * `pv` is a line from `after` (opponent to move first), so the mover's
 * follow-ups sit at odd indices. If the opponent's reply dissolves the pin,
 * the walk stops — a pin the engine immediately lets go of proved nothing.
 */
function pinSignificance(
  after: Chess,
  mover: 'white' | 'black',
  pin: PinFound,
  pv: string[] | undefined,
): { keep: boolean; exploit?: SanMove } {
  // capturing the pinned piece wins material right now (legal-move SEE,
  // so the pin itself is what disarms the defenders)
  const ghost = after.clone();
  ghost.turn = mover;
  ghost.epSquare = undefined;
  if (seeSquare(ghost, pin.pinned) > 0) return { keep: true };

  // under real pressure: attacked more times than effectively defended
  const attackerCount = attackersTo(after.board, pin.pinned, mover, after.board.occupied).size();
  if (attackerCount > effectiveDefenders(after.board, pin.pinned).length) return { keep: true };

  // engine intent: does the continuation use the pin?
  const probe = after.clone();
  for (let i = 0; i < Math.min(pv?.length ?? 0, 4); i++) {
    const m = parseUci(pv![i]) as NormalMove | undefined;
    if (!m || !probe.isLegal(m)) break;
    if (probe.turn !== mover) {
      probe.play(m);
      // the opponent may break the pin (move it, block, take the pinner)
      const held = pinsHeld(probe.board, mover).some(
        p => p.pinned === pin.pinned && p.against === pin.against,
      );
      if (!held) break;
      continue;
    }
    const victim = probe.board.get(m.to);
    const paralysisCapture =
      victim !== undefined &&
      victim.color !== mover &&
      attackersTo(probe.board, m.to, opposite(mover), probe.board.occupied).has(pin.pinned);
    if (m.to === pin.pinned || m.to === pin.against || paralysisCapture)
      return { keep: true, exploit: sanMove(probe, m) };
    const exploitSan = sanMove(probe, m);
    probe.play(m);
    // piling on: the moved piece now adds an attacker to the pinned square
    if (attackersTo(probe.board, pin.pinned, mover, probe.board.occupied).has(m.to))
      return { keep: true, exploit: exploitSan };
  }

  // a quiet absolute pin still restrains, but only of a real piece and only
  // when the opponent cannot simply win the pinning piece
  if (
    pin.absolute &&
    after.board.get(pin.pinned)!.role !== 'pawn' &&
    seeSquare(after, pin.pinner) === 0
  )
    return { keep: true };

  return { keep: false };
}

/**
 * "They cannot all be saved" is checked against the engine's best defense:
 * after the opponent's PV reply, the fork stands if a non-king target is
 * still winnable on the spot (legal-move SEE), or the PV itself harvests one
 * next move. Capturing the forker also confirms it — the forker was safe, so
 * best play choosing to take it means material is conceded either way.
 * With no PV to check against, the geometric fork is taken at face value.
 */
function forkConfirmed(
  after: Chess,
  mover: 'white' | 'black',
  forker: Square,
  targets: Square[],
  pv: string[] | undefined,
): boolean {
  if (!pv?.length) return true;
  const reply = parseUci(pv[0]) as NormalMove | undefined;
  if (!reply || !after.isLegal(reply)) return true;
  if (reply.to === forker) return true;
  const probe = play(after, reply);
  const next = pv[1] ? (parseUci(pv[1]) as NormalMove | undefined) : undefined;
  if (next && probe.isLegal(next) && targets.includes(next.to)) {
    const victim = probe.board.get(next.to);
    if (victim && victim.color !== mover) return true;
  }
  for (const t of targets) {
    const p = probe.board.get(t);
    if (!p || p.color === mover || p.role === 'king') continue;
    if (seeSquare(probe, t) > 0) return true;
  }
  return false;
}

/**
 * A tempo claim needs the engine's defense to actually react — move the
 * attacked piece, capture or block the attacker, or reinforce the target.
 * An "attack" best play simply ignores, winning nothing, was never forcing.
 */
function tempoConfirmed(
  after: Chess,
  mover: 'white' | 'black',
  attacker: Square,
  target: Square,
  pv: string[] | undefined,
): boolean {
  if (!pv?.length) return true;
  const reply = parseUci(pv[0]) as NormalMove | undefined;
  if (!reply || !after.isLegal(reply)) return true;
  if (reply.from === target || reply.to === attacker) return true;
  if (between(attacker, target).has(reply.to)) return true;
  const probe = play(after, reply);
  const t = probe.board.get(target);
  if (!t || t.color === mover) return false;
  const defBefore = attackersTo(after.board, target, opposite(mover), after.board.occupied).size();
  const defAfter = attackersTo(probe.board, target, opposite(mover), probe.board.occupied).size();
  if (defAfter > defBefore) return true; // they spent the move reinforcing it
  return seeSquare(probe, target) > 0; // ignored a real threat — it just wins
}

/**
 * Quiet-move reason finder: when a decent move produced no concrete fact of
 * its own, look one move deeper into the engine's line — the opponent's best
 * reply, then the mover's follow-up — and if that follow-up carries a strong
 * idea (mate threat / winning a piece / fork / significant pin) that was NOT
 * already available before the move, the two moves are explained as one plan.
 */
function preparedIdea(before: Chess, move: NormalMove, ctx: AnnotateContext): Fact | null {
  const mover = before.turn;
  const playedUci = makeUci(move);
  // continuation of the played move: its own MultiPV line if the engine had
  // one, else the best line from the after-position
  const own = ctx.lines.find(l => l.pvUci[0] === playedUci)?.pvUci.slice(1);
  const pv = own ?? ctx.replyPv;
  if (!pv || pv.length < 2) return null;
  const after = play(before, move);
  const reply = parseUci(pv[0]) as NormalMove | undefined;
  if (!reply || !after.isLegal(reply)) return null;
  const probe = play(after, reply);
  const follow = parseUci(pv[1]) as NormalMove | undefined;
  if (!follow || !probe.isLegal(follow) || probe.turn !== mover) return null;
  if (follow.to === reply.to) return null; // a recapture is not a plan
  const san = sanMove(probe, follow);
  const afterFollow = play(probe, follow);
  const availableBefore = (test: (pos: Chess, m: NormalMove) => boolean): boolean =>
    before.isLegal(follow) && test(before, follow);

  if (createsMateThreat(probe, follow) && !availableBefore((p, m) => createsMateThreat(p, m) !== null))
    return { kind: 'prepares', move: san, idea: { what: 'mate_threat' } };

  const victim = probe.board.get(follow.to);
  if (
    victim &&
    victim.color !== mover &&
    victim.role !== 'pawn' &&
    capturesFreePiece(probe, follow) &&
    seeSquare(before, follow.to) === 0 // was not simply winnable already
  )
    return {
      kind: 'prepares',
      move: san,
      idea: { what: 'wins_piece', piece: { role: victim.role, square: makeSquare(follow.to) } },
    };

  const forks = createsFork(probe, follow);
  if (forks.length && !availableBefore((p, m) => createsFork(p, m).length > 0))
    return {
      kind: 'prepares',
      move: san,
      idea: { what: 'fork', targets: forks.map(sq => pieceOn(afterFollow, sq)) },
    };

  const pins = pinsCreatedEx(probe, follow).filter(
    p => pinSignificance(afterFollow, mover, p, pv.slice(2)).keep,
  );
  if (pins.length && !availableBefore((p, m) => pinsCreatedEx(p, m).length > 0))
    return { kind: 'prepares', move: san, idea: { what: 'pin', piece: pieceOn(afterFollow, pins[0].pinned) } };

  return null;
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

  // GM-1 (Think Like a Super-GM §4.1): the move was on the engine's own
  // shortlist — PV2's first move — and the drop stayed below mistake size.
  // Candidate framing instead of generic praise/criticism.
  if (
    ctx.lines.length >= 2 &&
    ctx.bestUci !== null &&
    ctx.bestUci !== playedUci &&
    ctx.lines[1].pvUci[0] === playedUci &&
    ctx.winDrop < 10
  ) {
    const bestMove = parseUci(ctx.bestUci) as NormalMove | undefined;
    if (bestMove && before.isLegal(bestMove))
      facts.push({ kind: 'second_candidate', best: sanMove(before, bestMove) });
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
  if (forkTargets.length && forkConfirmed(after, mover, move.to, forkTargets, ctx.replyPv))
    facts.push({
      kind: 'creates_fork',
      forker: pieceOn(after, move.to),
      targets: forkTargets.map(sq => pieceOn(after, sq)),
    });

  for (const pin of pinsCreatedEx(before, move)) {
    const sig = pinSignificance(after, mover, pin, ctx.replyPv);
    if (!sig.keep) continue;
    facts.push({
      kind: 'creates_pin',
      pinned: pieceOn(after, pin.pinned),
      against: pieceOn(after, pin.against),
      exploit: sig.exploit,
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
  if (tempoTarget !== null && tempoConfirmed(after, mover, move.to, tempoTarget, ctx.replyPv))
    facts.push({ kind: 'wins_tempo', target: pieceOn(after, tempoTarget) });

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

  // ignored threat: the engine reply captures a mover piece that was ALREADY
  // loose before the move (hangsPieces excludes those by design) — the deeper
  // story is "you were under attack and did nothing about it"
  if (ctx.winDrop >= 5 && replyMove && after.isLegal(replyMove)) {
    const sq = replyMove.to;
    const victim = after.board.get(sq);
    if (
      victim &&
      victim.color === mover &&
      victim.role !== 'king' &&
      sq !== move.to &&
      !hung.includes(sq) &&
      isInBadSpot(before.board, sq) &&
      seeSquare(after, sq) > 0
    )
      facts.push({ kind: 'ignores_threat', piece: pieceOn(after, sq), capture: sanMove(after, replyMove) });
  }

  if (ctx.winDrop >= 5 && replyMove && after.isLegal(replyMove)) {
    const replyForks = createsFork(after, replyMove);
    if (replyForks.length) {
      const afterReply = play(after, replyMove);
      // confirmed against the mover's own best defense in the same line
      if (forkConfirmed(afterReply, opposite(mover), replyMove.to, replyForks, ctx.replyPv?.slice(1)))
        facts.push({
          kind: 'allows_fork',
          forkMove: sanMove(after, replyMove),
          targets: replyForks.map(sq => pieceOn(afterReply, sq)),
        });
    }
  }

  // GM-7 (book §4.3, Adams' 1.Ne5?!): a move can fail by what it STOPS doing.
  // The engine's punishing reply lands on an empty square that ONLY the moved
  // piece used to cover from its old post — it walked away from its job.
  if (ctx.winDrop >= MISS_GATE && replyMove && after.isLegal(replyMove) && movedRole !== 'pawn') {
    const t = replyMove.to;
    const movedBefore = before.board.get(move.from);
    if (
      movedBefore &&
      t !== move.to &&
      !before.board.get(t) && // infiltration, not a capture story
      attacks(movedBefore, move.from, before.board.occupied).has(t) &&
      attackersTo(before.board, t, mover, before.board.occupied).without(move.from).isEmpty() &&
      attackersTo(after.board, t, mover, after.board.occupied).isEmpty()
    )
      facts.push({
        kind: 'abandons_square',
        role: movedBefore.role,
        from: makeSquare(move.from),
        square: makeSquare(t),
        reply: sanMove(after, replyMove),
      });
  }

  /* ---- quiet good move: explain it together with the engine's plan ------ */
  if (ctx.winDrop < 5 && !facts.some(f => factPriority(f) <= 20)) {
    const prep = preparedIdea(before, move, ctx);
    if (prep) facts.push(prep);
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
  // gentle "better way" ideas from winDrop>=5 (inaccuracies); accusatory
  // missed-tactic facts keep the stricter MISS_GATE
  if (ctx.winDrop >= 5 && ctx.bestUci && ctx.bestUci !== playedUci) {
    const best = parseUci(ctx.bestUci) as NormalMove | undefined;
    if (best && before.isLegal(best)) {
      const bestSan = sanMove(before, best);
      const missedMate = mateFor(mover, ctx.lines[0]?.eval ?? ctx.evalBefore);
      if (ctx.winDrop >= MISS_GATE && missedMate !== null)
        facts.push({ kind: 'missed_mate', mateIn: missedMate, move: bestSan });

      const bestTarget = before.board.get(best.to);
      const bestVictim = bestTarget && bestTarget.color !== mover ? bestTarget : undefined;
      if (ctx.winDrop >= MISS_GATE && bestVictim && capturesFreePiece(before, best))
        facts.push({
          kind: 'missed_free_piece',
          move: bestSan,
          victim: { role: bestVictim.role, square: makeSquare(best.to) },
        });

      const afterBest = play(before, best);
      const missedForks = createsFork(before, best);
      if (
        ctx.winDrop >= MISS_GATE &&
        missedForks.length &&
        forkConfirmed(afterBest, mover, best.to, missedForks, ctx.lines[0]?.pvUci.slice(1))
      )
        facts.push({
          kind: 'missed_fork',
          move: bestSan,
          targets: missedForks.map(sq => pieceOn(afterBest, sq)),
        });

      // same significance bar as creates_pin — the best line's continuation
      // (pvUci[0] is the best move itself) confirms the missed pin mattered
      const missedPins = pinsCreatedEx(before, best).filter(
        p => pinSignificance(afterBest, mover, p, ctx.lines[0]?.pvUci.slice(1)).keep,
      );
      if (ctx.winDrop >= MISS_GATE && missedPins.length)
        facts.push({ kind: 'missed_pin', move: bestSan, pinned: pieceOn(afterBest, missedPins[0].pinned) });

      const missedTraps = trapsPieces(before, best);
      if (ctx.winDrop >= MISS_GATE && missedTraps.length)
        facts.push({ kind: 'missed_trap', move: bestSan, piece: pieceOn(afterBest, missedTraps[0]) });

      if (
        ctx.winDrop >= MISS_GATE &&
        missedMate === null &&
        !missedForks.length &&
        !bestVictim &&
        createsMateThreat(before, best)
      )
        facts.push({ kind: 'missed_mate_threat', move: bestSan });

      // no tactical miss found: explain the quiet best move by its own purpose
      // so the suggestion always carries a WHY (never a bare "was better")
      const MISSED: Fact['kind'][] = [
        'missed_mate', 'missed_free_piece', 'missed_fork',
        'missed_pin', 'missed_trap', 'missed_mate_threat',
      ];
      if (!facts.some(f => MISSED.includes(f.kind))) {
        const ideas: MissedIdea[] = [];
        const movedRoleBest = before.board.get(best.from)!.role;
        // a sound non-free capture: the point was the exchange itself
        if (bestVictim && seeSquare(afterBest, best.to) === 0)
          ideas.push({ what: 'trades', victim: { role: bestVictim.role, square: makeSquare(best.to) } });
        if (isInBadSpot(before.board, best.from) && seeSquare(afterBest, best.to) === 0)
          ideas.push({ what: 'escapes', role: movedRoleBest });
        const saved = defendsHangingPieces(before, best);
        if (saved.length) ideas.push({ what: 'defends', piece: pieceOn(afterBest, saved[0]) });
        const tempo = winsTempo(before, best);
        if (tempo !== null && tempoConfirmed(afterBest, mover, best.to, tempo, ctx.lines[0]?.pvUci.slice(1)))
          ideas.push({ what: 'wins_tempo', target: pieceOn(afterBest, tempo) });
        // GM-6 (book §4.3, Carlsen-Nakamura Kh2): a quiet king move that
        // strips EVERY opponent check while standing better — prophylaxis,
        // "putting the ball in the opponent's court"
        const beforePovPct =
          mover === 'white' ? winPercent(ctx.evalBefore) : 100 - winPercent(ctx.evalBefore);
        if (
          movedRoleBest === 'king' &&
          !bestVictim &&
          Math.abs((best.from & 7) - (best.to & 7)) <= 1 && // not castling
          !afterBest.isCheck() &&
          beforePovPct >= 55 &&
          checkingMoves(after) > 0 &&
          checkingMoves(afterBest) === 0
        )
          ideas.push({ what: 'removes_checks' });
        for (const f of positionalPurposes(before, best))
          ideas.push({ what: 'positional', fact: f });
        // still nothing? the point may be the follow-up one move deeper in
        // the best line (same machinery as the played-move 'prepares' fact)
        if (!ideas.length) {
          const prep = preparedIdea(before, best, ctx);
          if (prep && prep.kind === 'prepares')
            ideas.push({ what: 'prepares', move: prep.move, idea: prep.idea });
        }
        // last resort: the best line simply wins material by force (the same
        // walk used for refutations, mirrored onto the opponent)
        if (!ideas.length) {
          const pv = ctx.lines[0]?.pvUci;
          if (pv && pv.length > 1) {
            const gain = refutationWalk(afterBest, pv.slice(1), opposite(mover));
            if (gain && gain.kind === 'refutation')
              ideas.push({ what: 'wins_material', role: gain.lossRole });
          }
        }
        // a capture the static SEE couldn't bless: the engine vouches for it,
        // so at least say WHAT it takes (covers recaptures — C1/C8)
        if (!ideas.length && bestVictim)
          ideas.push({ what: 'captures', victim: { role: bestVictim.role, square: makeSquare(best.to) } });
        if (ideas.length)
          facts.push({ kind: 'missed_idea', move: bestSan, ideas: ideas.slice(0, 2) });
      }

      // GM-2 (Think Like a Super-GM §4.1): a QUIET tactical move — no capture,
      // no check, no promotion — is the hardest kind to spot. Soften the
      // verdict when the engine shows the miss was exactly that.
      const TACTICAL_MISS: Fact['kind'][] = [
        'missed_mate', 'missed_free_piece', 'missed_fork',
        'missed_pin', 'missed_trap', 'missed_mate_threat',
      ];
      const bestIsPawnCapture =
        before.board.get(best.from)!.role === 'pawn' && (best.from & 7) !== (best.to & 7);
      // GM-8 (book §4.5, Storey-Crouch 1.Bd1!): a RETREAT toward the back
      // rank is just as notoriously hard to spot as a quiet move.
      const bestRank = best.to >> 3;
      const fromRank = best.from >> 3;
      const isRetreat =
        mover === 'white' ? bestRank < fromRank : bestRank > fromRank;
      if (
        ctx.winDrop >= MISS_GATE &&
        !bestVictim &&
        !bestIsPawnCapture &&
        best.promotion === undefined &&
        !play(before, best).isCheck() &&
        facts.some(f => TACTICAL_MISS.includes(f.kind))
      )
        facts.push({
          kind: 'hard_to_find',
          move: bestSan,
          reason: isRetreat && before.board.get(best.from)!.role !== 'king' ? 'retreat' : 'quiet',
        });
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
