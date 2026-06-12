/**
 * Typed facts (V2 spec stage 2 output). Every piece of commentary is rendered
 * ONLY from these — prose never sees evals or raw PVs (rules R1/R2/R4).
 *
 * Every move/square/piece mention is pre-rendered here (SAN + square names) so
 * the composer and the Mode B verifier share one whitelist.
 */
import type { Role } from 'chessops/types';
import type { PositionalFact, RegressionFact } from './positional';

/** A move as both notations — SAN for prose, UCI for board playback. */
export interface SanMove {
  san: string;
  uci: string;
}

/** A piece sitting on a square ("knight on c3"). */
export interface PieceOn {
  role: Role;
  square: string;
}

export type Fact =
  /* terminal */
  | { kind: 'delivers_mate' }
  | { kind: 'gives_stalemate' }
  /* what the played move achieves (good) */
  | { kind: 'wins_free_piece'; victim: PieceOn }
  | { kind: 'captures_higher'; victim: PieceOn; attacker: Role }
  | { kind: 'creates_fork'; forker: PieceOn; targets: PieceOn[] }
  | {
      kind: 'creates_pin';
      pinned: PieceOn;
      against: PieceOn;
      /** Engine-confirmed follow-up that exploits the pin, if any. */
      exploit?: SanMove;
    }
  | { kind: 'discovered_check' }
  | { kind: 'traps_piece'; piece: PieceOn }
  | { kind: 'mate_threat'; mateMove: SanMove }
  | { kind: 'wins_tempo'; target: PieceOn }
  | { kind: 'blocks_check' }
  | { kind: 'trade'; piece: Role }
  | { kind: 'sacrifice'; piece: Role }
  | { kind: 'defends_piece'; piece: PieceOn }
  /* quiet move explained by the engine's own follow-up (one move deeper) */
  | {
      kind: 'prepares';
      /** The mover's follow-up in the engine line (after the best reply). */
      move: SanMove;
      idea:
        | { what: 'mate_threat' }
        | { what: 'wins_piece'; piece: PieceOn }
        | { what: 'fork'; targets: PieceOn[] }
        | { what: 'pin'; piece: PieceOn };
    }
  | { kind: 'positional'; fact: PositionalFact }
  /* what the played move concedes (bad) */
  | { kind: 'hangs_piece'; piece: PieceOn; capture: SanMove }
  /* GM-7 (book §4.3): the move walked away from a square it had to cover */
  | { kind: 'abandons_square'; role: Role; from: string; square: string; reply: SanMove }
  /* a piece was ALREADY under attack and this move did nothing about it */
  | { kind: 'ignores_threat'; piece: PieceOn; capture: SanMove }
  | { kind: 'allows_mate'; mateIn: number; firstMove: SanMove | null }
  | { kind: 'allows_fork'; forkMove: SanMove; targets: PieceOn[] }
  | { kind: 'refutation'; moves: SanMove[]; lossRole: Role | null }
  | { kind: 'regression'; fact: RegressionFact }
  /* what the best move would have done (missed) */
  | { kind: 'missed_mate'; mateIn: number; move: SanMove }
  | { kind: 'missed_free_piece'; move: SanMove; victim: PieceOn }
  | { kind: 'missed_fork'; move: SanMove; targets: PieceOn[] }
  | { kind: 'missed_pin'; move: SanMove; pinned: PieceOn }
  | { kind: 'missed_trap'; move: SanMove; piece: PieceOn }
  | { kind: 'missed_mate_threat'; move: SanMove }
  /* quiet best move explained by its own purpose (no tactical miss found) */
  | { kind: 'missed_idea'; move: SanMove; ideas: MissedIdea[] }
  /* context */
  | { kind: 'only_move' }
  /* the played move was the engine's own second candidate (GM-1: candidate
     framing instead of generic praise/criticism) */
  | { kind: 'second_candidate'; best: SanMove }
  /* the missed best move was QUIET (no capture/check/promotion) yet tactical —
     the hardest kind to spot (GM-2: soften the criticism) */
  | { kind: 'hard_to_find'; move: SanMove; reason: 'quiet' | 'retreat' | 'pawn_break' }
  /* GM-2 praise side: the player FOUND a quiet move with a tactical point */
  | { kind: 'quiet_strength' }
  | { kind: 'forced' };

export type MissedIdea =
  | { what: 'defends'; piece: PieceOn }
  | { what: 'trades'; victim: PieceOn }
  | { what: 'escapes'; role: Role }
  | { what: 'wins_tempo'; target: PieceOn }
  | { what: 'positional'; fact: PositionalFact }
  /* GM-6 (book §4.3): quiet king move that strips every opponent check */
  | { what: 'removes_checks' }
  /* GM-9 (book §4.5): best ignores the threat and makes a bigger one */
  | { what: 'counterattack'; threatened: PieceOn }
  /* GM-10 (book §4.6): with a development lead, the pawn break that rips
     open lines toward the enemy king — PV-confirmed slider pressure */
  | { what: 'open_lines' }
  /* the point is the follow-up: best move prepares a tactic one move deeper */
  | { what: 'prepares'; move: SanMove; idea: Extract<Fact, { kind: 'prepares' }>['idea'] }
  /* the best line wins material by force within a few moves */
  | { what: 'wins_material'; role: Role | null }
  /* plain capture whose soundness the engine itself vouches for */
  | { what: 'captures'; victim: PieceOn };

export type FactKind = Fact['kind'];

/**
 * Composer priority — lower number = told first (mate > material > tactics >
 * tempo/structure > positional > context). The annotator returns facts sorted
 * by this.
 */
const PRIORITY: Record<FactKind, number> = {
  delivers_mate: 0,
  gives_stalemate: 0,
  allows_mate: 1,
  missed_mate: 2,
  hangs_piece: 3,
  abandons_square: 3.5,
  ignores_threat: 3.5,
  allows_fork: 4,
  refutation: 5,
  missed_free_piece: 6,
  missed_fork: 7,
  missed_trap: 8,
  missed_pin: 9,
  missed_mate_threat: 10,
  missed_idea: 10.5,
  wins_free_piece: 11,
  creates_fork: 12,
  traps_piece: 13,
  mate_threat: 14,
  creates_pin: 15,
  discovered_check: 16,
  captures_higher: 17,
  sacrifice: 18,
  wins_tempo: 19,
  defends_piece: 20,
  prepares: 20.5,
  blocks_check: 21,
  trade: 22,
  regression: 23,
  positional: 24,
  only_move: 25,
  second_candidate: 25.5,
  hard_to_find: 25.7,
  quiet_strength: 25.9,
  forced: 26,
};

export const factPriority = (f: Fact): number => PRIORITY[f.kind];

export const sortFacts = (facts: Fact[]): Fact[] =>
  [...facts].sort((a, b) => factPriority(a) - factPriority(b));
