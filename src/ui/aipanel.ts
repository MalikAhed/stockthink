/**
 * AI commentary panel — the two optional language layers on top of the
 * deterministic templates:
 *  · "Claude / ChatGPT exchange": copy a facts-only prompt, paste the JSON
 *    reply back (free, works in every browser).
 *  · "On-device AI": WebLLM + small Qwen model, opt-in download, WebGPU only.
 * Both paths only REWORD verified facts; every sentence is fact-checked on
 * the way in and falls back to the template when it fails.
 */
import type { AnnotatedReport } from '../analyze';
import { buildFactSheet, type GameFactSheet } from '../llm/factsheet';
import {
  applyImportedCommentary,
  buildLlmPrompt,
  parseImportedCommentary,
} from '../llm/exchange';
/** Duplicated from llm/webllm.ts on purpose: a static import would pull the
 * ~6MB WebLLM runtime into the initial bundle and defeat the lazy chunk. */
const webGpuAvailable = (): boolean =>
  typeof navigator !== 'undefined' && 'gpu' in navigator;

export interface AiPanelCtx {
  getReport(): AnnotatedReport | null;
  /** Called after commentary changed so the app re-renders the coach. */
  onCommentaryUpdated(): void;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let busy = false;

export function renderAiPanel(el: HTMLElement, ctx: AiPanelCtx): void {
  el.innerHTML = `
    <details class="ai-panel">
      <summary>AI commentary <span class="ai-tag">optional</span></summary>
      <p class="ai-hint">The review above is engine-verified. These tools only re-word it —
        they never re-analyze the game.</p>

      <div class="ai-section">
        <button id="ai-copy">Copy prompt for Claude / ChatGPT</button>
        <p class="ai-hint">Paste it into a chat AI (free tier works), then paste the JSON
          reply below.</p>
        <textarea id="ai-import-text" rows="3" spellcheck="false"
          placeholder='Paste the JSON reply here…'></textarea>
        <button id="ai-import">Import commentary</button>
      </div>

      <div class="ai-section">
        ${
          webGpuAvailable()
            ? `<button id="ai-device">Generate on-device (~0.4 GB one-time download)</button>`
            : `<p class="ai-hint">On-device AI needs WebGPU, which this browser doesn't support.
               The exchange above works everywhere.</p>`
        }
        <div id="ai-progress" class="ai-hint"></div>
      </div>

      <p id="ai-status" class="ai-hint"></p>
    </details>`;

  const $ = <T extends HTMLElement>(sel: string): T => el.querySelector(sel) as T;
  const status = (msg: string, isError = false): void => {
    const s = $('#ai-status');
    s.textContent = msg;
    s.classList.toggle('error', isError);
  };
  const sheet = (): GameFactSheet | null => {
    const r = ctx.getReport();
    return r ? buildFactSheet(r) : null;
  };

  $('#ai-copy').addEventListener('click', () => {
    const s = sheet();
    if (!s) return;
    void navigator.clipboard
      .writeText(buildLlmPrompt(s))
      .then(() => status('Prompt copied — paste it into claude.ai or chatgpt.com.'))
      .catch(() => status('Could not access the clipboard.', true));
  });

  $('#ai-import').addEventListener('click', () => {
    const r = ctx.getReport();
    const s = sheet();
    if (!r || !s) return;
    const text = ($('#ai-import-text') as unknown as HTMLTextAreaElement).value;
    try {
      const res = applyImportedCommentary(r, s, parseImportedCommentary(text));
      const parts = [`Applied ${res.applied} comments.`];
      if (res.rejected.length)
        parts.push(`${res.rejected.length} rejected by the fact-check (template kept).`);
      if (res.unknown.length) parts.push(`${res.unknown.length} unknown plies ignored.`);
      status(parts.join(' '));
      ctx.onCommentaryUpdated();
    } catch (e) {
      status(e instanceof Error ? e.message : String(e), true);
    }
  });

  const deviceBtn = el.querySelector<HTMLButtonElement>('#ai-device');
  deviceBtn?.addEventListener('click', () => void runOnDevice());

  async function runOnDevice(): Promise<void> {
    const r = ctx.getReport();
    const s = sheet();
    if (!r || !s || busy) return;
    busy = true;
    deviceBtn!.disabled = true;
    const progress = $('#ai-progress');
    try {
      const { createReworder, rewordReport } = await import('../llm/webllm');
      progress.textContent = 'Loading model…';
      const reworder = await createReworder((text, p) => {
        progress.textContent = `${Math.round(p * 100)}% — ${esc(text).slice(0, 80)}`;
      });
      try {
        const rewritten = await rewordReport(reworder, r, s, p => {
          progress.textContent = `Rewording move ${p.done} / ${p.total}…`;
          if (p.done % 5 === 0) ctx.onCommentaryUpdated();
        });
        progress.textContent = '';
        status(`On-device AI reworded ${rewritten} comments (fact-checked).`);
        ctx.onCommentaryUpdated();
      } finally {
        await reworder.dispose();
      }
    } catch (e) {
      progress.textContent = '';
      status(e instanceof Error ? e.message : String(e), true);
    } finally {
      busy = false;
      deviceBtn!.disabled = false;
    }
  }
}
