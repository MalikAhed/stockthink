/**
 * Tier 2 — optional on-device reworder (WebLLM + a small Qwen instruct
 * model, Apache-2.0). Pure surface realization: the model receives ONE
 * move's verified facts and the template sentence, and may only re-phrase
 * them. Output is JSON-constrained, then fact-checked (verify.ts); any
 * failure silently keeps the deterministic template, so the floor is
 * always the Tier-1 text.
 *
 * The whole module — and the ~3MB WebLLM runtime — loads lazily via dynamic
 * import only after the user opts in; model weights (~0.4GB, one-time)
 * stream from Hugging Face's CDN and are cached by the browser.
 */
import type { AnnotatedReport } from '../analyze';
import type { GameFactSheet, MoveFactSheet } from './factsheet';
import { verifyCommentText } from './verify';

/** Prebuilt MLC model ids, best first; first one present in the runtime wins. */
const MODEL_CANDIDATES = [
  'Qwen3-0.6B-q4f16_1-MLC',
  'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
];

export const webGpuAvailable = (): boolean =>
  typeof navigator !== 'undefined' && 'gpu' in navigator;

type MLCEngine = {
  chat: {
    completions: {
      create(req: object): Promise<{ choices: Array<{ message: { content?: string | null } }> }>;
    };
  };
  unload(): Promise<void>;
};

export interface Reworder {
  rewordMove(m: MoveFactSheet): Promise<{ short: string; long: string } | null>;
  dispose(): Promise<void>;
}

const SYSTEM_PROMPT = `You reword chess commentary. You are NOT a chess analyst.
You get a JSON fact sheet for ONE move: classification, win-probability data,
verified facts, and reference sentences ("templateShort"/"templateLong").
Rewrite them as a friendly, fluent coach. Rules:
- Use ONLY the given facts. Never add tactics, squares, pieces, plans or
  evaluations that are not in the facts.
- Never change any number. Keep moves in the notation given (e.g. Nf3).
- "short": 1-2 sentences. "long": 2-4 sentences.
Reply with ONLY JSON: {"short": "...", "long": "..."}`;

/**
 * Download/initialize the on-device model. `onProgress` receives WebLLM's
 * human-readable progress text plus a 0..1 fraction.
 */
export async function createReworder(
  onProgress: (text: string, progress: number) => void,
): Promise<Reworder> {
  if (!webGpuAvailable()) throw new Error('WebGPU is not available in this browser.');
  const webllm = await import('@mlc-ai/web-llm');
  const available = new Set(webllm.prebuiltAppConfig.model_list.map(m => m.model_id));
  const model = MODEL_CANDIDATES.find(id => available.has(id));
  if (!model) throw new Error('No suitable on-device model in this WebLLM build.');
  const engine = (await webllm.CreateMLCEngine(model, {
    initProgressCallback: p => onProgress(p.text, p.progress),
  })) as unknown as MLCEngine;

  return {
    async rewordMove(m: MoveFactSheet) {
      try {
        const res = await engine.chat.completions.create({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify(m) },
          ],
          temperature: 0.3,
          max_tokens: 256,
          response_format: { type: 'json_object' },
          // Qwen3: disable thinking mode — this is paraphrase, not reasoning.
          extra_body: { enable_thinking: false },
        });
        const content = res.choices[0]?.message?.content ?? '';
        const parsed = JSON.parse(content) as { short?: string; long?: string };
        const short = (parsed.short ?? '').trim();
        const long = (parsed.long ?? '').trim() || short;
        if (!short) return null;
        if (!verifyCommentText(short, m) || !verifyCommentText(long, m)) return null;
        return { short, long };
      } catch {
        return null; // any model failure → keep the template
      }
    },
    dispose: () => engine.unload(),
  };
}

export interface RewordProgress {
  done: number;
  total: number;
  rewritten: number;
}

/**
 * Reword every non-book, non-forced move in place. Returns how many moves
 * were actually rewritten (the rest keep their deterministic template).
 */
export async function rewordReport(
  reworder: Reworder,
  report: AnnotatedReport,
  sheet: GameFactSheet,
  onProgress: (p: RewordProgress) => void,
  shouldStop?: () => boolean,
): Promise<number> {
  const targets = sheet.moves.filter(
    m => m.classification !== 'book' && m.classification !== 'forced',
  );
  let done = 0;
  let rewritten = 0;
  for (const m of targets) {
    if (shouldStop?.()) break;
    const out = await reworder.rewordMove(m);
    const move = report.moves[m.ply - 1];
    if (out && move) {
      move.commentary = out;
      rewritten++;
    }
    done++;
    onProgress({ done, total: targets.length, rewritten });
  }
  return rewritten;
}
