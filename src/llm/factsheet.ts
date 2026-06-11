/**
 * Mode B factsheet + prompt builder (V2 spec, "deep review").
 *
 * Prompt contract is ablation-validated (C1 2603.20510 + CCC 2410.20811 +
 * ChessQA — docs/research/LAST-RESEARCH-NOTES.md):
 *  - FEN + explicit piece list + legal-move list per position
 *  - opponent's last move, ONE best line (not MultiPV), detector facts
 *  - verdict/classification stated as ground truth the model must not contradict
 *  - feigned discovery: explain as if analyzing fresh; never mention engines,
 *    scores, or that the answer was given
 *  - 4–10 sentences scaled to move weight, moves annotated in words,
 *    explicit coordinates, objective voice
 */
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { makeSan } from 'chessops/san';
import { makeSquare } from 'chessops/util';
import type { GameReport, MoveReport } from '../analysis/report';
import { composeComment } from '../compose/compose';
import type { Fact } from '../concepts/facts';

export interface MoveFactsheet {
  ply: number;
  san: string;
  color: 'white' | 'black';
  classification: MoveReport['classification'];
  fenBefore: string;
  pieceList: string;
  lastMove: string | null;
  legalMoves: string[];
  bestLine: string[];
  facts: Fact[];
  /** Mode A text — the deterministic baseline the model improves on. */
  baseline: string;
  /** Tokens the model may mention (R4 whitelist: squares + SAN moves). */
  whitelist: string[];
}

export interface GameFactsheet {
  headers: Record<string, string>;
  opening: string | null;
  moves: MoveFactsheet[];
}

const ROLE_LETTER: Record<string, string> = {
  king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: '',
};

function pieceList(pos: Chess): string {
  const side = (color: 'white' | 'black'): string => {
    const parts: string[] = [];
    for (const sq of pos.board[color]) {
      const p = pos.board.get(sq)!;
      parts.push(`${ROLE_LETTER[p.role]}${makeSquare(sq)}`);
    }
    return parts.join(' ');
  };
  return `White: ${side('white')} | Black: ${side('black')}`;
}

function legalSans(pos: Chess): string[] {
  const sans: string[] = [];
  for (const [from, dests] of pos.allDests())
    for (const to of dests) sans.push(makeSan(pos, { from, to }));
  return sans;
}

const SQUARE_RE = /\b[a-h][1-8]\b/g;
const SAN_RE = /\bO-O(?:-O)?\b|\b[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?\b/g;

/** Every square / SAN token inside a fact (for the whitelist). */
function factTokens(f: Fact): string[] {
  const json = JSON.stringify(f);
  return [...(json.match(SQUARE_RE) ?? []), ...(json.match(SAN_RE) ?? [])];
}

export function buildFactsheet(report: GameReport): GameFactsheet {
  const moves = report.moves.map((m, i) => {
    const pos = Chess.fromSetup(parseFen(m.fenBefore).unwrap()).unwrap();
    const legal = legalSans(pos);
    const bestLine = m.lines[0]?.sanPv.slice(0, 8) ?? [];
    const whitelist = new Set<string>([
      m.san,
      ...legal,
      ...bestLine,
      ...(m.fenBefore.match(/\b[a-h][1-8]\b/g) ?? []),
      ...pieceList(pos).match(SQUARE_RE)!,
      ...m.facts.flatMap(factTokens),
    ]);
    return {
      ply: m.ply,
      san: m.san,
      color: m.color,
      classification: m.classification,
      fenBefore: m.fenBefore,
      pieceList: pieceList(pos),
      lastMove: i > 0 ? report.moves[i - 1].san : null,
      legalMoves: legal,
      bestLine,
      facts: m.facts,
      baseline: composeComment(m).text,
      whitelist: [...whitelist],
    };
  });
  return { headers: report.headers, opening: report.opening, moves };
}

/** Moves worth deep commentary (skip book and quiet best/excellent chains). */
const isKeyMove = (m: MoveFactsheet): boolean =>
  m.classification !== 'book' &&
  (m.facts.length > 0 || !['best', 'excellent', 'good'].includes(m.classification));

export function buildPrompt(sheet: GameFactsheet): string {
  const key = sheet.moves.filter(isKeyMove);
  const movesBlock = key
    .map(m => {
      const facts = m.facts.length
        ? m.facts.map(f => `    - ${JSON.stringify(f)}`).join('\n')
        : '    - (no tactical or positional features detected — keep it brief)';
      return [
        `MOVE ${m.ply} (${m.color}): ${m.san} — verdict: ${m.classification.toUpperCase()}`,
        `  position before (FEN): ${m.fenBefore}`,
        `  pieces: ${m.pieceList}`,
        m.lastMove ? `  opponent's last move: ${m.lastMove}` : null,
        `  legal moves: ${m.legalMoves.join(' ')}`,
        m.bestLine.length ? `  best line from here: ${m.bestLine.join(' ')}` : null,
        `  verified facts:\n${facts}`,
        `  baseline explanation: ${m.baseline}`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  return `You are a strong chess coach annotating a game for a club player.

For each move below, write a short coaching explanation of WHY the move is good or bad, as if you discovered the ideas through your own analysis of the position.

Hard rules:
- The verdict shown for each move is ground truth. Never contradict it, never soften it.
- Use ONLY pieces, squares and moves that appear in the given position data and verified facts. Never invent a piece, square or tactic.
- Never mention engines, evaluations, scores, percentages, centipawns, or that any information was provided to you.
- 2-4 sentences for ordinary moves; up to 8 for decisive mistakes or brilliant moves.
- Annotate moves in words on first mention, e.g. "Qxh7+ (queen takes h7 with check)".
- Ground every claim in explicit coordinates ("the knight on c3"), objective voice, no "I see"/"I notice".
- Explain cause before consequence: what the move overlooks or achieves, then what follows from it.

Game: ${sheet.headers.White ?? 'White'} vs ${sheet.headers.Black ?? 'Black'}${sheet.opening ? ` — ${sheet.opening}` : ''}

${movesBlock}

Reply with ONLY a JSON object of this exact shape (one entry per move shown above):
{"comments": [{"ply": <number>, "comment": "<your explanation>"}]}`;
}
