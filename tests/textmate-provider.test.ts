// Smoke test for the generic TextMate Highlight provider (VPR-12).
//
// Uses a minimal hand-authored `.tmLanguage.json` grammar (kept tiny so we
// don't depend on any VSCode extension bundle) to verify:
//   - The provider registers itself under id "textmate".
//   - warmTextmateGrammar + highlightWithTextmate produce shiki-compatible
//     `{ annotations: [...] }` with correct token kinds, scopes, and ranges.
//   - An optional theme scope-map drives the `color` field.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  highlightWithTextmate,
  highlightWithTextmateAsync,
  warmTextmateGrammar,
  resetTextmateProvider,
} from '../handlers/ts/providers/textmate.provider.ts';
import {
  getHighlightProvider,
  listHighlightProviders,
} from '../handlers/ts/providers/highlight-provider-registry.ts';

// Tiny self-contained grammar: keyword `let`, identifiers, and numbers.
const MINI_GRAMMAR = {
  scopeName: 'source.mini',
  name: 'Mini',
  patterns: [
    { match: '\\b(let)\\b', name: 'keyword.control.mini' },
    { match: '\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b', name: 'variable.other.mini' },
    { match: '\\b([0-9]+)\\b', name: 'constant.numeric.mini' },
  ],
};

let tmpDir: string;
let grammarPath: string;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'clef-tm-'));
  grammarPath = join(tmpDir, 'mini.tmLanguage.json');
  writeFileSync(grammarPath, JSON.stringify(MINI_GRAMMAR), 'utf8');
  await warmTextmateGrammar(grammarPath, 'source.mini');
});

afterAll(() => {
  resetTextmateProvider();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('textmate highlight provider', () => {
  it('self-registers under id "textmate"', () => {
    expect(listHighlightProviders()).toContain('textmate');
    expect(typeof getHighlightProvider('textmate')).toBe('function');
  });

  it('returns an error envelope when required options are missing', () => {
    const out = JSON.parse(highlightWithTextmate('let x = 1', 'mini', undefined));
    expect(out.ok).toBe(false);
    expect(out.error?.message).toMatch(/grammarPath/);
  });

  it('tokenizes text into shiki-compatible annotations', () => {
    const config = JSON.stringify({ grammarPath, scopeName: 'source.mini' });
    const out = JSON.parse(highlightWithTextmate('let x 42', 'mini', config));
    expect(out.annotations).toBeTruthy();
    const annotations = out.annotations as Array<{
      start: number; end: number; kind: string; scope: string; color: string;
    }>;
    expect(annotations.length).toBeGreaterThan(0);
    for (const a of annotations) {
      expect(a.kind).toBe('token');
      expect(typeof a.scope).toBe('string');
      expect(a.end).toBeGreaterThan(a.start);
    }
    // The keyword `let` must produce a keyword.control scope.
    const letTok = annotations.find((a) => a.scope.startsWith('keyword.control'));
    expect(letTok).toBeDefined();
    expect(letTok!.start).toBe(0);
    expect(letTok!.end).toBe(3);
    // The number `42` must produce a constant.numeric scope.
    const numTok = annotations.find((a) => a.scope.startsWith('constant.numeric'));
    expect(numTok).toBeDefined();
  });

  it('applies theme scope map to emit colors', () => {
    const config = JSON.stringify({
      grammarPath,
      scopeName: 'source.mini',
      theme: {
        'keyword.control': '#ff00aa',
        'constant.numeric': '#00ccff',
      },
    });
    const out = JSON.parse(highlightWithTextmate('let 7', 'mini', config));
    const annotations = out.annotations as Array<{ scope: string; color: string }>;
    const kw = annotations.find((a) => a.scope.startsWith('keyword.control'));
    const num = annotations.find((a) => a.scope.startsWith('constant.numeric'));
    expect(kw?.color).toBe('#ff00aa');
    expect(num?.color).toBe('#00ccff');
  });

  it('async entrypoint warms + tokenizes in one call', async () => {
    const config = JSON.stringify({ grammarPath, scopeName: 'source.mini' });
    const out = JSON.parse(await highlightWithTextmateAsync('let y', 'mini', config));
    expect(out.annotations.length).toBeGreaterThan(0);
  });
});
