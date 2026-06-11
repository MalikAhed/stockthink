/**
 * Deep Review panel (Mode B): copy the factsheet prompt → paste into Claude
 * (or any strong model) → import the JSON reply. Every sentence is verified
 * against the fact whitelist before it's shown (R4); rejected moves keep
 * their Mode A explanation.
 */
import type { AnnotatedReport } from '../analyze';
import { importCommentary } from '../llm/exchange';
import { buildFactsheet, buildPrompt, type GameFactsheet } from '../llm/factsheet';

export function renderDeepReview(
  el: HTMLElement,
  report: AnnotatedReport,
  onImported: (comments: Map<number, string>) => void,
): void {
  let sheet: GameFactsheet | null = null;
  el.innerHTML = `
    <details class="ai-panel">
      <summary>Deep review (paste into Claude)</summary>
      <p class="ai-hint">Copy the prompt, paste it into a Claude chat, then paste the JSON reply back here. Comments are machine-verified against the analysis before being shown.</p>
      <div class="ai-row">
        <button id="dr-copy" class="primary">Copy prompt</button>
        <span id="dr-status" class="ai-status"></span>
      </div>
      <textarea id="dr-paste" rows="4" spellcheck="false" placeholder='Paste the JSON reply here…'></textarea>
      <div class="ai-row"><button id="dr-import">Import commentary</button></div>
    </details>`;

  const status = el.querySelector('#dr-status') as HTMLElement;
  el.querySelector('#dr-copy')!.addEventListener('click', () => {
    sheet ??= buildFactsheet(report);
    void navigator.clipboard.writeText(buildPrompt(sheet)).then(
      () => (status.textContent = 'Prompt copied — paste it into Claude.'),
      () => (status.textContent = 'Could not access the clipboard.'),
    );
  });
  el.querySelector('#dr-import')!.addEventListener('click', () => {
    const pasted = (el.querySelector('#dr-paste') as HTMLTextAreaElement).value.trim();
    if (!pasted) {
      status.textContent = 'Paste the JSON reply first.';
      return;
    }
    try {
      sheet ??= buildFactsheet(report);
      const result = importCommentary(pasted, sheet);
      status.textContent =
        `${result.accepted.size} comments imported` +
        (result.rejected.size ? `, ${result.rejected.size} rejected by the verifier.` : '.');
      if (result.accepted.size) onImported(result.accepted);
    } catch (e) {
      status.textContent = e instanceof Error ? e.message : String(e);
    }
  });
}
