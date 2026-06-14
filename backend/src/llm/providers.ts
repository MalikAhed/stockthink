/**
 * Rephrase providers (U3/U4) — two automatic transports for the same Mode B
 * contract (factsheet prompt in, JSON commentary out, R4-verified on import):
 *
 *  A. Anthropic API, zero-install — the user pastes their own API key (kept in
 *     localStorage, never sent anywhere but api.anthropic.com).
 *  B. WebLLM, fully local — downloads a ~700 MB model once into browser cache
 *     and runs on WebGPU. Loaded dynamically from a CDN so the app bundle
 *     stays untouched ($0 / no dependency).
 *
 * Both fail SILENTLY at the call site: any error returns null and the caller
 * keeps the Mode A template commentary (R3 — never degrade the baseline).
 */

export type ProgressFn = (message: string) => void;

const API_KEY_STORAGE = 'stockthink.anthropic-key';
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const WEBLLM_CDN = 'https://esm.run/@mlc-ai/web-llm';
const WEBLLM_MODEL = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

export const getStoredKey = (): string => localStorage.getItem(API_KEY_STORAGE) ?? '';
export const storeKey = (key: string): void => {
  if (key) localStorage.setItem(API_KEY_STORAGE, key);
  else localStorage.removeItem(API_KEY_STORAGE);
};

/** Option A: send the prompt to the Anthropic API with the user's own key. */
export async function generateViaApi(
  prompt: string,
  apiKey: string,
  onProgress: ProgressFn,
): Promise<string | null> {
  try {
    onProgress('Asking Claude…');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      onProgress(res.status === 401 ? 'API key rejected.' : `Request failed (${res.status}).`);
      return null;
    }
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find(b => b.type === 'text')?.text;
    return text ?? null;
  } catch {
    onProgress('Could not reach the API.');
    return null;
  }
}

export const webgpuAvailable = (): boolean =>
  typeof navigator !== 'undefined' && 'gpu' in navigator;

/* The engine is cached for the session so the model loads once. */
let webllmEngine: { chat: { completions: { create: (o: object) => Promise<unknown> } } } | null =
  null;

/** Option B: run a small model locally in the browser via WebGPU. */
export async function generateViaWebLLM(
  prompt: string,
  onProgress: ProgressFn,
): Promise<string | null> {
  try {
    if (!webgpuAvailable()) {
      onProgress('This browser has no WebGPU — try Chrome or Edge.');
      return null;
    }
    if (!webllmEngine) {
      onProgress('Loading WebLLM…');
      const mod = (await import(/* @vite-ignore */ WEBLLM_CDN)) as {
        CreateMLCEngine: (
          model: string,
          opts: { initProgressCallback: (p: { text: string }) => void },
        ) => Promise<typeof webllmEngine>;
      };
      webllmEngine = await mod.CreateMLCEngine(WEBLLM_MODEL, {
        initProgressCallback: p => onProgress(p.text),
      });
    }
    onProgress('Generating commentary locally…');
    const reply = (await webllmEngine!.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 3000,
    })) as { choices?: Array<{ message?: { content?: string } }> };
    return reply.choices?.[0]?.message?.content ?? null;
  } catch {
    onProgress('Local model failed — keeping the standard commentary.');
    return null;
  }
}
