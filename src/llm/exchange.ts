/**
 * Mode B exchange — parse the pasted JSON reply, verify each comment (R4),
 * and return per-ply commentary with the Mode A baseline as fallback.
 */
import type { GameFactsheet } from './factsheet';
import { verifyComment } from './verify';

export interface ImportResult {
  /** ply → accepted AI comment. */
  accepted: Map<number, string>;
  /** ply → rejection reasons (these moves keep the Mode A baseline). */
  rejected: Map<number, string[]>;
}

export function importCommentary(pasted: string, sheet: GameFactsheet): ImportResult {
  const accepted = new Map<number, string>();
  const rejected = new Map<number, string[]>();

  // tolerate markdown fences and prose around the JSON
  const jsonMatch = pasted.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON object found in the pasted reply.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('The pasted reply is not valid JSON.');
  }
  const comments = (parsed as { comments?: unknown }).comments;
  if (!Array.isArray(comments)) throw new Error('Expected {"comments": [...]} in the reply.');

  const byPly = new Map(sheet.moves.map(m => [m.ply, m]));
  for (const entry of comments) {
    const { ply, comment } = entry as { ply?: unknown; comment?: unknown };
    if (typeof ply !== 'number' || typeof comment !== 'string') continue;
    const move = byPly.get(ply);
    if (!move) continue;
    const result = verifyComment(comment, move.whitelist);
    if (result.ok) accepted.set(ply, comment.trim());
    else rejected.set(ply, result.reasons);
  }
  return { accepted, rejected };
}
