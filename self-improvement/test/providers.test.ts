/**
 * U3 API provider — request shape, reply extraction, and silent-null failure
 * modes (the caller must always be able to keep the Mode A baseline).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateViaApi, getStoredKey, storeKey } from '@backend/llm/providers';

const store = new Map<string, string>();
beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  store.clear();
});

describe('generateViaApi', () => {
  it('sends the browser-access header and extracts the text block', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"comments":[]}' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const out = await generateViaApi('PROMPT', 'sk-test', () => {});
    expect(out).toBe('{"comments":[]}');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(init.headers['x-api-key']).toBe('sk-test');
    expect(JSON.parse(init.body).messages[0].content).toBe('PROMPT');
  });

  it('returns null (never throws) on HTTP error and on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    expect(await generateViaApi('p', 'bad-key', () => {})).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await generateViaApi('p', 'k', () => {})).toBeNull();
  });
});

describe('key storage', () => {
  it('stores, reads, and clears the key', () => {
    storeKey('sk-abc');
    expect(getStoredKey()).toBe('sk-abc');
    storeKey('');
    expect(getStoredKey()).toBe('');
  });
});
