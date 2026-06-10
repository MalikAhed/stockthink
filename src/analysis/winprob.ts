/**
 * Evaluation → win-probability math.
 *
 * Formulas verified against primary sources (2026-06):
 *  - lichess lila ui/lib/src/ceval/winningChances.ts (sigmoid, clamps, mate mapping)
 *  - https://lichess.org/page/accuracy (move accuracy curve)
 *  - lila modules/analyse AccuracyPercent (game accuracy: weighted + harmonic mean)
 *
 * Everything downstream (eval bar, classification ladder, accuracy, graph)
 * speaks win-probability, never raw centipawns. All evals are stored from
 * White's point of view.
 */

/** Engine score for one position, white POV. Exactly one of cp/mate is set. */
export interface EvalScore {
  cp?: number;
  mate?: number;
}

/** Fit constant from lila PR #11148 (curve_fit on 75k positions). */
const MULTIPLIER = -0.00368208;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Raw sigmoid: cp → winning chances in [-1, 1] (no clamping). */
const rawWinningChances = (cp: number): number => 2 / (1 + Math.exp(MULTIPLIER * cp)) - 1;

/** cp → winning chances, cp clamped to ±1000 like lichess. */
const cpWinningChances = (cp: number): number => rawWinningChances(clamp(cp, -1000, 1000));

/**
 * Mate-in-N → winning chances via synthetic cp = (21 − min(10, N)) · 100,
 * fed through the UNclamped sigmoid: M1 ≈ 0.9987, M10+ ≈ 0.9657 — always
 * above the cp ceiling (0.9509 at ±1000cp), so a forced mate always fills
 * the bar more than any cp eval, without pinning at 100%.
 */
const mateWinningChances = (mate: number): number => {
  const cp = (21 - Math.min(10, Math.abs(mate))) * 100;
  return rawWinningChances(cp * (mate > 0 ? 1 : -1));
};

/** Eval → winning chances in [-1, 1], white POV. */
export const winningChances = (ev: EvalScore): number =>
  ev.mate !== undefined ? mateWinningChances(ev.mate) : cpWinningChances(ev.cp ?? 0);

/** Eval → Win% in [0, 100] for White. Win% = 50 + 50·chances. */
export const winPercent = (ev: EvalScore): number => 50 + 50 * winningChances(ev);

/** Winning chances for a given color (white chances negated for black). */
export const povChances = (color: 'white' | 'black', ev: EvalScore): number =>
  color === 'white' ? winningChances(ev) : -winningChances(ev);

/**
 * Mover's win% drop caused by a move: Win%(before) − Win%(after), from the
 * mover's POV, floored at 0 (improving on the expected eval is not a gain
 * to punish). This is the input to the classification ladder and accuracy.
 */
export const winPercentDrop = (
  mover: 'white' | 'black',
  before: EvalScore,
  after: EvalScore,
): number => {
  const b = 50 + 50 * povChances(mover, before);
  const a = 50 + 50 * povChances(mover, after);
  return Math.max(0, b - a);
};

/**
 * Per-move accuracy in [0, 100] — lichess curve, verified verbatim:
 * 103.1668100711649·e^(−0.04354415386753951·drop) − 3.166924740191411 (+1 bonus).
 */
export const moveAccuracy = (winDrop: number): number => {
  if (winDrop <= 0) return 100;
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * winDrop) - 3.166924740191411;
  return clamp(raw + 1, 0, 100);
};

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

const stdDev = (xs: number[]): number => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map(x => (x - m) * (x - m))));
};

const harmonicMean = (xs: number[]): number =>
  xs.length / xs.reduce((a, b) => a + 1 / Math.max(b, 1e-9), 0);

/**
 * Game accuracy for one player — lichess method:
 * mean of (volatility-weighted mean, harmonic mean) of per-move accuracies.
 *
 * @param accuracies   per-move accuracy values for this player's moves, in order
 * @param winPercents  Win% (this player's POV) BEFORE each of the player's moves,
 *                     plus the final position — used to compute volatility windows
 */
export const gameAccuracy = (accuracies: number[], winPercents: number[]): number => {
  if (accuracies.length === 0) return 100;
  const windowSize = clamp(Math.floor(winPercents.length / 10), 2, 8);
  // sliding-window stddev of win% = "volatility" weight per move
  const weights = accuracies.map((_, i) => {
    const start = Math.max(0, i + 1 - windowSize);
    const window = winPercents.slice(start, Math.max(i + 1, start + windowSize) + 1);
    return clamp(stdDev(window), 0.5, 12);
  });
  const weighted =
    accuracies.reduce((s, a, i) => s + a * weights[i], 0) / weights.reduce((a, b) => a + b, 0);
  return clamp((weighted + harmonicMean(accuracies)) / 2, 0, 100);
};

/**
 * UCI scores arrive from the SIDE TO MOVE's perspective: normalize to white POV
 * once, at the parse layer, and never think about it again.
 */
export const toWhitePov = (sideToMove: 'white' | 'black', ev: EvalScore): EvalScore =>
  sideToMove === 'white'
    ? ev
    : { cp: ev.cp !== undefined ? -ev.cp : undefined, mate: ev.mate !== undefined ? -ev.mate : undefined };
