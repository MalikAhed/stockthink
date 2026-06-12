/**
 * Rich move tags: SAN tokens in prose ("Nxf7+", "Qe2", "O-O") become small
 * pill tags with the real piece image instead of a letter. A token is only
 * tagged when it parses as a LEGAL move in one of the candidate positions —
 * so square mentions ("covering f2") stay plain text. Tags carry the move,
 * and hovering one previews it on the board (wired via attachPreviews).
 */
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { parseSan } from 'chessops/san';
import { makeUci } from 'chessops/util';
import type { Role } from 'chessops/types';

const NEO = 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150';
const ROLE_CODE: Record<Role, string> = {
  pawn: 'p',
  knight: 'n',
  bishop: 'b',
  rook: 'r',
  queen: 'q',
  king: 'k',
};

/** SAN-shaped tokens (castles, piece moves, pawn moves/captures). */
const SAN_RE =
  /\b(O-O-O|O-O|[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|[a-h](?:x[a-h])?[1-8](?:=[QRBN])?[+#]?)(?![a-zA-Z0-9-])/g;

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface ParsedToken {
  fen: string;
  uci: string;
  color: 'white' | 'black';
  role: Role;
}

/** Try the token as a legal move in each candidate position, first hit wins. */
function parseToken(token: string, fens: string[]): ParsedToken | null {
  const clean = token.replace(/[+#]$/, '');
  for (const fen of fens) {
    const setup = parseFen(fen);
    if (setup.isErr) continue;
    let pos: Chess;
    try {
      pos = Chess.fromSetup(setup.unwrap()).unwrap();
    } catch {
      continue;
    }
    const move = parseSan(pos, clean);
    if (!move || !('from' in move)) continue;
    const piece = pos.board.get(move.from);
    if (!piece) continue;
    return { fen, uci: makeUci(move), color: pos.turn, role: piece.role };
  }
  return null;
}

/** Visible text inside the tag: the piece image replaces the letter. */
const tagText = (token: string, role: Role): string =>
  token.startsWith('O-O') || role === 'pawn' ? token : token.slice(1);

/**
 * A bare destination square ("c6", "d2", "e6+") is indistinguishable from a
 * pawn-push SAN, and our prose uses such squares as plain COORDINATES far more
 * often than as moves ("the knight goes to c6", "covering e6"). chessops will
 * happily read "c6" as a legal pawn move and we'd stamp a bogus pawn pill on a
 * coordinate — the bug this guards against. So we never tag a bare square; a
 * real pawn move still tags when written as a capture (exd5) or promotion
 * (e8=Q). Piece moves and castles are unaffected.
 */
const isBareSquare = (token: string): boolean => /^[a-h][1-8][+#]?$/.test(token);

/**
 * Escape `text` and wrap every SAN token that is a legal move in one of
 * `fens` in a `.san-tag` pill (piece image + move). Unparseable tokens — and
 * bare square coordinates — are left as plain text; never guess a piece.
 */
export function renderRich(text: string, fens: string[]): string {
  return esc(text).replace(SAN_RE, token => {
    if (isBareSquare(token)) return token;
    const p = parseToken(token, fens);
    if (!p) return token;
    return (
      `<span class="san-tag ${p.color}" data-fen="${esc(p.fen)}" data-uci="${p.uci}">` +
      `<img class="san-piece" src="${NEO}/${p.color.charAt(0)}${ROLE_CODE[p.role]}.png" alt="" draggable="false">` +
      `${tagText(token, p.role)}</span>`
    );
  });
}

/**
 * Wire hover previews on every move tag under `root`: enter → show the move
 * on the board, leave → restore whatever view was there.
 */
export function attachPreviews(
  root: HTMLElement,
  onStart: (fen: string, uci: string) => void,
  onEnd: () => void,
): void {
  root.querySelectorAll<HTMLElement>('.san-tag[data-uci]').forEach(tag => {
    tag.addEventListener('mouseenter', () => onStart(tag.dataset.fen!, tag.dataset.uci!));
    tag.addEventListener('mouseleave', onEnd);
  });
}
