/**
 * The "why" explanation engine (spec §5–§7).
 *
 * explainBadMove — the refutation walk: simulate the opponent's punishment
 * line (A_after.line1.pv) and attribute the damage to the first concrete,
 * detector-verified fact. explainGoodMove — purpose detection on the move's
 * own PV. Both return fact objects; the template layer renders them.
 *
 * Anti-hallucination rules: every fact below is verified on the actual
 * board by src/explain/detectors.ts; no detector fired ⇒ no fact ⇒ the
 * caller falls back to a generic-but-true sentence.
 */
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { makeSan } from 'chessops/san';
import type { Color, NormalMove, Role, Square } from 'chessops/types';
import { makeSquare, opposite, parseUci } from 'chessops/util';
import { minorMajorSquares } from '../analysis/board';
import type { EvalScore } from '../analysis/winprob';
import {
  type CaptureReason,
  discoveredAttacks,
  forkTargets,
  isInBadSpot,
  isSkewer,
  isTrapped,
  materialDiff,
  mateThreat,
  pinnedDefenderInfo,
  pinsCreated,
  seeCapture,
  whyCapturable,
} from './detectors';
import { positionalPurpose, positionalRegression } from './positional';

export interface PieceRef {
  role: Role;
  square: string;
}

export type Fact =
  /* ---- bad-move facts (from the refutation walk) ---- */
  | { kind: 'allows_mate'; n: number; line: string[] }
  | {
      kind: 'loses_material';
      victim: PieceRef;
      reason: CaptureReason;
      value: number;
      /** SAN of the refutation up to and including the winning capture. */
      line: string[];
      captureSan: string;
      /** True when the very first reply takes the piece (it was hung). */
      immediate: boolean;
      pinnedDefender?: { piece: PieceRef; pinnedTo: Role };
    }
  | { kind: 'allows_fork'; moveSan: string; forker: Role; targets: PieceRef[] }
  | { kind: 'allows_skewer'; moveSan: string }
  | { kind: 'allows_discovered'; moveSan: string; target: PieceRef }
  | { kind: 'allows_mate_threat'; moveSan: string; threatSan: string }
  | { kind: 'loses_material_eventually'; value: number; line: string[] }
  /* ---- good-move facts (purpose detection) ---- */
  | { kind: 'mate_for'; n: number }
  | { kind: 'wins_material'; victim: PieceRef; value: number; reason: CaptureReason }
  | { kind: 'fork_for'; forker: Role; targets: PieceRef[] }
  | { kind: 'pin_for'; pinned: PieceRef }
  | { kind: 'discovered_for'; target: PieceRef }
  | { kind: 'threat_for'; threatSan: string }
  | { kind: 'saves_piece'; piece: PieceRef }
  | { kind: 'trap_for'; piece: PieceRef }
  | { kind: 'positional'; fragment: string };

export interface Explanation {
  /** The single primary fact (priority ladder §7), if any detector fired. */
  primary: Fact | null;
  /** Purpose of the engine's best move — the "better was" clause. */
  betterWas: Fact | null;
}

export interface ExplainArgs {
  fenBefore: string;
  fenAfter: string;
  /** The played move. */
  uci: string;
  mover: Color;
  /** White-POV eval after the played move. */
  evalAfter: EvalScore;
  /** Opponent's best line from the position after the move (the refutation). */
  refutationUci: string[];
  /** Engine best line from the position before the move. */
  bestPvUci: string[];
  /** White-POV eval of the engine best line (≈ eval before the move). */
  bestEval?: EvalScore;
  /** True for inaccuracy/mistake/miss/blunder candidates. */
  isBad: boolean;
  /** Win% points the move threw away. */
  winDrop: number;
}

const MAX_WALK_PLIES = 8;

const chessFrom = (fen: string): Chess => Chess.fromSetup(parseFen(fen).unwrap()).unwrap();

const pieceRef = (board: Chess['board'], sq: Square): PieceRef => ({
  role: board.get(sq)!.role,
  square: makeSquare(sq),
});

/** Is this white-POV eval a mate FOR the given side? */
const isMateFor = (ev: EvalScore, side: Color): boolean =>
  ev.mate !== undefined && (side === 'white' ? ev.mate > 0 : ev.mate < 0);

/** SAN the threatened move found by mateThreat (it lives in the flipped position). */
const threatSan = (posAfterReply: Chess, threat: NormalMove): string => {
  const flipped = posAfterReply.clone();
  flipped.turn = opposite(flipped.turn);
  flipped.epSquare = undefined;
  return makeSan(flipped, threat);
};

/** Priority ladder (§7): lower = more important. */
const PRIORITY: Record<Fact['kind'], number> = {
  allows_mate: 0,
  mate_for: 0,
  loses_material: 1,
  wins_material: 1,
  allows_fork: 2,
  allows_skewer: 2,
  allows_discovered: 2,
  fork_for: 2,
  pin_for: 2,
  discovered_for: 2,
  trap_for: 2,
  saves_piece: 2,
  allows_mate_threat: 3,
  threat_for: 3,
  loses_material_eventually: 4,
  positional: 5,
};

const pickPrimary = (facts: Fact[]): Fact | null =>
  facts.length === 0
    ? null
    : facts.reduce((a, b) => (PRIORITY[b.kind] < PRIORITY[a.kind] ? b : a));

/* ---------------------------------------------------------------------- */

/** Top-level entry: explanation for one analyzed move. */
export function explainMove(args: ExplainArgs): Explanation {
  const posBefore = chessFrom(args.fenBefore);
  const played = parseUci(args.uci) as NormalMove | undefined;
  if (!played || !('from' in played) || !posBefore.isLegal(played))
    return { primary: null, betterWas: null };

  if (args.isBad) {
    const facts = explainBadMove(args, posBefore);
    const betterWas =
      args.bestPvUci.length > 0 && args.bestPvUci[0] !== args.uci
        ? explainGoodMove(posBefore, args.bestPvUci, bestLineEval(args), args.mover)
        : null;
    return { primary: pickPrimary(facts), betterWas };
  }

  // good move: its purpose lives in its own PV (played move + best reply line)
  const ownPv = [args.uci, ...args.refutationUci];
  const primary = explainGoodMove(posBefore, ownPv, args.evalAfter, args.mover);
  return { primary, betterWas: null };
}

/** Eval of the best line ≈ eval before the move; mate sign already white-POV. */
const bestLineEval = (args: ExplainArgs): EvalScore => args.bestEval ?? args.evalAfter;

/* --------------------------------------------- §5 the refutation walk --- */

export function explainBadMove(args: ExplainArgs, posBefore: Chess): Fact[] {
  const { mover } = args;
  const facts: Fact[] = [];
  const posAfter = chessFrom(args.fenAfter);

  // ---- P0: allows forced mate ----
  if (isMateFor(args.evalAfter, opposite(mover))) {
    const n = Math.abs(args.evalAfter.mate!);
    facts.push({
      kind: 'allows_mate',
      n,
      line: sanLine(posAfter, args.refutationUci, Math.max(1, 2 * n - 1)),
    });
  }

  // ---- P1/P2: walk the refutation ----
  const b = posAfter.clone();
  const matStart = materialDiff(b.board, mover);
  const sans: string[] = [];
  let prevMove: NormalMove = parseUci(args.uci) as NormalMove;

  for (let i = 0; i < Math.min(args.refutationUci.length, MAX_WALK_PLIES); i++) {
    const r = parseUci(args.refutationUci[i]) as NormalMove | undefined;
    if (!r || !('from' in r) || !b.isLegal(r)) break;
    const oppMove = b.turn !== mover;

    // a capture against the mover that actually wins material (SEE-verified)
    const victim = b.board.get(r.to); // NB: undefined for en passant — skipped
    if (oppMove && victim && victim.color === mover && seeCapture(b, r) > 0) {
      const reason = whyCapturable(b.board, r.to);
      const fact: Fact = {
        kind: 'loses_material',
        victim: pieceRef(b.board, r.to),
        reason,
        value: seeCapture(b, r),
        line: [...sans, makeSan(b, r)],
        captureSan: makeSan(b, r),
        immediate: i === 0,
      };
      if (reason === 'defender_pinned') {
        const info = pinnedDefenderInfo(b.board, r.to);
        if (info)
          fact.pinnedDefender = {
            piece: pieceRef(b.board, info.defender),
            pinnedTo: b.board.get(info.pinnedTo)!.role,
          };
      }
      facts.push(fact);
      break; // the first concrete loss IS the reason
    }

    const prevB = b.clone();
    sans.push(makeSan(b, r));
    b.play(r);

    if (oppMove) {
      const ft = forkTargets(b.board, r.to);
      if (ft.length >= 2) {
        facts.push({
          kind: 'allows_fork',
          moveSan: sans[sans.length - 1],
          forker: b.board.get(r.to)!.role,
          targets: ft.map(sq => pieceRef(b.board, sq)),
        });
        break;
      }
      if (isSkewer(prevB, r, prevMove)) {
        facts.push({ kind: 'allows_skewer', moveSan: sans[sans.length - 1] });
        break;
      }
      const da = discoveredAttacks(prevB, r);
      if (da.length > 0)
        facts.push({
          kind: 'allows_discovered',
          moveSan: sans[sans.length - 1],
          target: pieceRef(b.board, da[0].target),
        });
      const mt = mateThreat(b);
      if (mt) {
        facts.push({
          kind: 'allows_mate_threat',
          moveSan: sans[sans.length - 1],
          threatSan: threatSan(b, mt as NormalMove),
        });
        break;
      }
    }
    prevMove = r;
  }

  // ---- fallback: net material over the whole line ----
  if (!facts.some(f => f.kind === 'loses_material')) {
    const end = posAfter.clone();
    const endSans: string[] = [];
    for (const uci of args.refutationUci.slice(0, MAX_WALK_PLIES)) {
      const m = parseUci(uci) as NormalMove | undefined;
      if (!m || !('from' in m) || !end.isLegal(m)) break;
      endSans.push(makeSan(end, m));
      end.play(m);
    }
    const net = materialDiff(end.board, mover) - matStart;
    if (net <= -2)
      facts.push({ kind: 'loses_material_eventually', value: -net, line: endSans });
  }

  // ---- positional regression (§6.5) when no tactic fired ----
  if (facts.length === 0 && args.winDrop >= 5) {
    const played = parseUci(args.uci) as NormalMove;
    const fragment = positionalRegression(posBefore, played, mover);
    if (fragment) facts.push({ kind: 'positional', fragment });
  }

  return facts;
}

/* ------------------------------------------ §6 purpose of a good move --- */

export function explainGoodMove(
  posBefore: Chess,
  pvUci: string[],
  evalOfLine: EvalScore,
  mover: Color,
): Fact | null {
  if (pvUci.length === 0) return null;
  const mv = parseUci(pvUci[0]) as NormalMove | undefined;
  if (!mv || !('from' in mv) || !posBefore.isLegal(mv)) return null;
  const b = posBefore.clone();
  b.play(mv);

  // P0: forces mate (n = 0 means this move IS checkmate)
  if (b.isCheckmate()) return { kind: 'mate_for', n: 0 };
  if (isMateFor(evalOfLine, mover))
    return { kind: 'mate_for', n: Math.abs(evalOfLine.mate!) };

  // P1: wins material (SEE-verified capture)
  const victim = posBefore.board.get(mv.to);
  if (victim && victim.color !== mover) {
    const gain = seeCapture(posBefore, mv);
    if (gain > 0)
      return {
        kind: 'wins_material',
        victim: pieceRef(posBefore.board, mv.to),
        value: gain,
        reason: whyCapturable(posBefore.board, mv.to),
      };
  }

  // P2: pure tactics created by the move
  const ft = forkTargets(b.board, mv.to);
  if (ft.length >= 2)
    return {
      kind: 'fork_for',
      forker: b.board.get(mv.to)!.role,
      targets: ft.map(sq => pieceRef(b.board, sq)),
    };
  const pc = pinsCreated(posBefore, mv);
  if (pc.length > 0) return { kind: 'pin_for', pinned: pieceRef(b.board, pc[0]) };
  const da = discoveredAttacks(posBefore, mv);
  if (da.length > 0) return { kind: 'discovered_for', target: pieceRef(b.board, da[0].target) };

  // P3: threatens mate next move
  const mt = mateThreat(b);
  if (mt) return { kind: 'threat_for', threatSan: threatSan(b, mt as NormalMove) };

  // rescue: a piece that was en prise is now safe
  const saved = savedPiece(posBefore, b, mv, mover);
  if (saved) return { kind: 'saves_piece', piece: saved };

  // traps an enemy piece (after our move it is the opponent's turn)
  for (const sq of minorMajorSquares(b.board, opposite(mover))) {
    if (isInBadSpot(b.board, sq) && isTrapped(b, sq))
      return { kind: 'trap_for', piece: pieceRef(b.board, sq) };
  }

  // P5: positional purpose
  const fragment = positionalPurpose(posBefore, mv, mover);
  return fragment ? { kind: 'positional', fragment } : null;
}

/** A mover piece that was in a bad spot before and is safe after the move. */
function savedPiece(
  posBefore: Chess,
  posAfterMove: Chess,
  mv: NormalMove,
  mover: Color,
): PieceRef | null {
  for (const sq of minorMajorSquares(posBefore.board, mover)) {
    if (!isInBadSpot(posBefore.board, sq)) continue;
    const now = sq === mv.from ? mv.to : sq;
    if (posAfterMove.board.get(now)?.color !== mover) continue;
    if (!isInBadSpot(posAfterMove.board, now))
      return { role: posAfterMove.board.get(now)!.role, square: makeSquare(now) };
  }
  return null;
}

/** SAN of the first `plies` of a UCI line from `pos` (legality-checked). */
export function sanLine(pos: Chess, uciLine: string[], plies: number): string[] {
  const probe = pos.clone();
  const out: string[] = [];
  for (const uci of uciLine.slice(0, plies)) {
    const m = parseUci(uci) as NormalMove | undefined;
    if (!m || !('from' in m) || !probe.isLegal(m)) break;
    out.push(makeSan(probe, m));
    probe.play(m);
  }
  return out;
}
