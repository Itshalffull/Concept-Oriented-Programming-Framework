// Smoke test for the generic LSP Format + Highlight provider.
//
// Spawns the dummy LSP server fixture (tests/fixtures/dummy-lsp-server.mjs)
// that returns a fixed TextEdit + semanticTokens response, then drives
// lspFormat and lspHighlight end-to-end asserting:
//   - format produces an EditOp[] diff that reconstructs the "FORMATTED"
//     replacement on line 0
//   - highlight decodes the relative-encoded semanticTokens stream into
//     absolute-range annotations with the advertised scope legend
//   - connection pooling returns the same client for the same options tuple
//   - missing-server spawn failure surfaces an `lsp_unavailable` envelope

import { describe, it, expect, afterEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  lspFormat,
  lspHighlight,
  decodeSemanticTokens,
  resetLspProviderCaches,
  type LspProviderOptions,
} from '../handlers/ts/providers/lsp.provider.ts';
import {
  getLspClient,
  disposeAllLspClients,
} from '../handlers/ts/providers/lsp-client.ts';
import { getFormatProvider } from '../handlers/ts/providers/format-provider-registry.ts';
import { getHighlightProvider } from '../handlers/ts/providers/highlight-provider-registry.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DUMMY = join(__dirname, 'fixtures', 'dummy-lsp-server.mjs');

function optsFor(): LspProviderOptions {
  return {
    serverCommand: process.execPath, // node
    args: [DUMMY],
    rootUri: 'file:///tmp/clef-lsp-test',
    legend: { tokenTypes: ['keyword', 'variable'], tokenModifiers: [] },
  };
}

describe('lsp.provider', () => {
  afterEach(async () => {
    await disposeAllLspClients();
    resetLspProviderCaches();
  });

  it('lspFormat produces a diff that applies the fixture TextEdit', async () => {
    const src = 'foo bar\nbaz';
    const out = await lspFormat(src, 'typescript', optsFor());
    const ops = JSON.parse(out);
    expect(Array.isArray(ops)).toBe(true);
    // Reconstruct the formatted text from the edit script.
    const formatted = ops
      .filter((o: any) => o.type === 'equal' || o.type === 'insert')
      .map((o: any) => o.content)
      .join('\n');
    expect(formatted).toBe('FORMATTED bar\nbaz');
  });

  it('lspHighlight decodes semantic tokens into annotations', async () => {
    const src = 'foo bar\nbaz';
    const out = await lspHighlight(src, 'typescript', optsFor());
    const parsed = JSON.parse(out);
    expect(parsed.annotations).toBeDefined();
    expect(parsed.annotations).toHaveLength(2);
    expect(parsed.annotations[0]).toMatchObject({
      start: 0,
      end: 3,
      kind: 'token',
      scope: 'keyword',
    });
    expect(parsed.annotations[1]).toMatchObject({
      start: 4,
      end: 7,
      kind: 'token',
      scope: 'variable',
    });
  });

  it('reuses a single pooled client per (command, root) tuple', async () => {
    const a = await getLspClient(optsFor());
    const b = await getLspClient(optsFor());
    expect(a).toBe(b);
  });

  it('returns lsp_unavailable envelope when spawn fails', async () => {
    const badOpts: LspProviderOptions = {
      serverCommand: '/nonexistent/definitely-not-a-server-binary-xyz',
      args: [],
    };
    const out = await lspFormat('x', 'typescript', badOpts);
    const env = JSON.parse(out);
    expect(env.ok).toBe(false);
    expect(env.error.message).toMatch(/lsp_unavailable/);
  });

  it('self-registers under id "lsp" in both registries', () => {
    expect(getFormatProvider('lsp')).toBeDefined();
    expect(getHighlightProvider('lsp')).toBeDefined();
  });

  it('decodeSemanticTokens handles multi-line relative encoding', () => {
    const text = 'aaa bbb\nccc';
    // Token 1: line 0, char 0, len 3, type 0
    // Token 2: line 1 (delta=1), char 0, len 3, type 1
    const annotations = decodeSemanticTokens(text, [0, 0, 3, 0, 0, 1, 0, 3, 1, 0], {
      tokenTypes: ['A', 'B'],
      tokenModifiers: [],
    });
    expect(annotations).toEqual([
      { start: 0, end: 3, kind: 'token', scope: 'A' },
      { start: 8, end: 11, kind: 'token', scope: 'B' },
    ]);
  });
});
