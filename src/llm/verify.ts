/**
 * R4 verifier — every AI-worded sentence is checked against the move's
 * whitelist (squares + legal/known SAN tokens) and the R1 eval-speak ban.
 * Anything that fails falls back to the Mode A baseline.
 */

const SQUARE_RE = /\b[a-h][1-8]\b/g;
const SAN_RE =
  /\bO-O(?:-O)?|\b[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|\b[a-h]x[a-h][1-8](?:=[QRBN])?[+#]?/g;
/** Eval-speak and engine references that must never appear (R1 + contract). */
const BANNED_RE =
  /%|centipawn|\bcp\b|\beval(uation)?\b|\bengine\b|stockfish|\bwin(ning)? (chance|probabilit)|accuracy/i;

export interface VerifyResult {
  ok: boolean;
  reasons: string[];
}

export function verifyComment(comment: string, whitelist: string[]): VerifyResult {
  const reasons: string[] = [];
  // check/mate suffixes are cosmetic — compare without them on both sides
  const norm = (s: string): string => s.replace(/[+#]/g, '');
  const allowed = new Set(whitelist);
  const allowedNorm = new Set(whitelist.map(norm));
  // squares mentioned inside SAN tokens are validated as part of the SAN
  const sanTokens = comment.match(SAN_RE) ?? [];
  for (const san of sanTokens)
    if (!allowed.has(san) && !allowedNorm.has(norm(san))) reasons.push(`unknown move "${san}"`);
  const stripped = comment.replace(SAN_RE, ' ');
  for (const sq of stripped.match(SQUARE_RE) ?? [])
    if (![...allowed].some(w => w.includes(sq))) reasons.push(`unknown square "${sq}"`);
  if (BANNED_RE.test(comment)) reasons.push('eval-speak or engine reference');
  return { ok: reasons.length === 0, reasons };
}
