/**
 * Tier 3 — zero-cost frontier-LLM exchange.
 *
 * Serializes the verified fact sheet into a self-contained prompt the user
 * pastes into any chat LLM (claude.ai, chatgpt.com — free tiers), and
 * imports the JSON reply back into the review. The LLM is never given the
 * raw game to analyze — only the engine-verified facts to reword (per the
 * facts-first findings of MATE arXiv:2411.06655 / ChessQA arXiv:2510.23948);
 * every imported sentence is re-verified against the facts before display.
 */
import type { AnnotatedReport } from '../analyze';
import type { GameFactSheet } from './factsheet';
import { verifyCommentText } from './verify';

export const COMMENTARY_VERSION = 'stockthink-commentary-1';

export interface ImportedMoveComment {
  ply: number;
  short: string;
  long?: string;
}

export interface ImportedCommentary {
  version?: string;
  moves: ImportedMoveComment[];
}

const PROMPT_RULES = `You are a chess commentary REWORDER, not an analyst.

Below is a JSON fact sheet produced by Stockfish plus verified board
detectors for one full game. For every move it lists the classification,
the win-probability swing, the verified tactical/positional facts and a
plain reference sentence ("templateShort"/"templateLong").

Rewrite the commentary for EVERY move so it reads like a friendly, fluent
human coach. Strict rules:
1. Use ONLY the facts given for that move. Do NOT analyze the position
   yourself, do NOT add tactics, plans, squares, pieces or evaluations that
   are not in that move's facts.
2. Never mention a board square that does not appear in that move's facts.
3. Never change a number (win percentages, mate distances, evaluations).
4. Keep "short" to 1–2 sentences and "long" to 2–4 sentences.
5. Vary the phrasing across moves; avoid repeating the same opener.
6. Keep chess moves in standard notation exactly as given (e.g. Nf3, Qxd5).

Reply with ONLY a JSON code block in exactly this shape (one entry per move,
same "ply" values as the fact sheet):

\`\`\`json
{
  "version": "${COMMENTARY_VERSION}",
  "moves": [
    { "ply": 1, "short": "...", "long": "..." }
  ]
}
\`\`\`

Fact sheet:`;

/** Build the full copy/paste prompt for a frontier chat LLM. */
export function buildLlmPrompt(sheet: GameFactSheet): string {
  return `${PROMPT_RULES}\n\n\`\`\`json\n${JSON.stringify(sheet, null, 1)}\n\`\`\`\n`;
}

/** Parse a pasted LLM reply (tolerates code fences and surrounding prose). */
export function parseImportedCommentary(text: string): ImportedCommentary {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object found in the pasted text.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new Error('The pasted text is not valid JSON.');
  }
  const obj = parsed as ImportedCommentary;
  if (!Array.isArray(obj.moves)) throw new Error('JSON is missing the "moves" array.');
  for (const m of obj.moves)
    if (typeof m.ply !== 'number' || typeof m.short !== 'string')
      throw new Error('Each move needs a numeric "ply" and a string "short".');
  return obj;
}

export interface ImportResult {
  /** Moves whose commentary was replaced. */
  applied: number;
  /** Plies rejected by the fact-check (template kept). */
  rejected: number[];
  /** Plies in the import that don't exist in the report. */
  unknown: number[];
}

/**
 * Merge imported commentary into the report, move by move, keeping the
 * deterministic template wherever the imported text fails the fact-check.
 */
export function applyImportedCommentary(
  report: AnnotatedReport,
  sheet: GameFactSheet,
  imported: ImportedCommentary,
): ImportResult {
  const byPly = new Map(sheet.moves.map(m => [m.ply, m]));
  const result: ImportResult = { applied: 0, rejected: [], unknown: [] };
  for (const im of imported.moves) {
    const facts = byPly.get(im.ply);
    const move = report.moves[im.ply - 1];
    if (!facts || !move || move.ply !== im.ply) {
      result.unknown.push(im.ply);
      continue;
    }
    const short = im.short.trim();
    const long = (im.long ?? '').trim() || short;
    if (!short || !verifyCommentText(short, facts) || !verifyCommentText(long, facts)) {
      result.rejected.push(im.ply);
      continue;
    }
    move.commentary = { short, long };
    result.applied++;
  }
  return result;
}
