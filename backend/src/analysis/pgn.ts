/**
 * PGN ingestion: one pasted PGN → headers + per-ply records with FENs,
 * ready for the engine queue. Built on chessops/pgn (handles chess.com
 * exports: [%clk] comments, NAGs, FEN/SetUp headers, variations ignored).
 */
import { Chess } from 'chessops/chess';
import { makeFen } from 'chessops/fen';
import { parsePgn, parseComment, startingPosition, type PgnNodeData } from 'chessops/pgn';
import { makeSan, parseSan } from 'chessops/san';
import { makeUci } from 'chessops/util';

export interface Ply {
  /** 1-based ply index (1 = White's first move). */
  ply: number;
  moveNumber: number;
  color: 'white' | 'black';
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  /** EPD (first four FEN fields) of the position AFTER the move — book lookups. */
  epdAfter: string;
  /** Remaining clock time in seconds, when the PGN carries [%clk]. */
  clockSeconds?: number;
}

export interface ParsedGame {
  headers: Record<string, string>;
  initialFen: string;
  plies: Ply[];
  /** initialFen followed by every fenAfter — engine queue, length = plies + 1. */
  fens: string[];
}

const epdOf = (pos: Chess): string => makeFen(pos.toSetup(), { epd: true });

/** Parse the first game in a PGN string. Throws with a clear message on bad input. */
export function parseGame(pgn: string): ParsedGame {
  const games = parsePgn(pgn);
  if (games.length === 0 || (!games[0].moves.children.length && games[0].headers.size === 0))
    throw new Error('No game found in PGN');
  const game = games[0];

  const start = startingPosition(game.headers).unwrap(
    pos => pos,
    err => {
      throw new Error(`Bad starting position in PGN: ${err.message}`);
    },
  ) as Chess;

  const headers: Record<string, string> = {};
  for (const [k, v] of game.headers) headers[k] = v;

  const initialFen = makeFen(start.toSetup());
  const pos = start.clone();
  const plies: Ply[] = [];
  const fens: string[] = [initialFen];

  let ply = 0;
  for (const node of game.moves.mainline()) {
    const move = parseSan(pos, node.san);
    if (!move) throw new Error(`Illegal or unreadable move ${ply + 1}: "${node.san}"`);
    ply++;
    const color = pos.turn;
    const fenBefore = makeFen(pos.toSetup());
    const san = makeSan(pos, move); // normalized SAN (adds +/# consistently)
    pos.play(move);
    const fenAfter = makeFen(pos.toSetup());
    plies.push({
      ply,
      moveNumber: Math.ceil(ply / 2),
      color,
      san,
      uci: makeUci(move),
      fenBefore,
      fenAfter,
      epdAfter: epdOf(pos),
      clockSeconds: clockFrom(node),
    });
    fens.push(fenAfter);
  }

  if (plies.length === 0) throw new Error('PGN contains no moves');
  return { headers, initialFen, plies, fens };
}

const clockFrom = (node: PgnNodeData): number | undefined => {
  for (const c of node.comments ?? []) {
    const clock = parseComment(c).clock;
    if (clock !== undefined) return clock;
  }
  return undefined;
};
