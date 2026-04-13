// TextMate Highlight Provider (VPR-12)
//
// Generic Highlight adapter that consumes any `.tmLanguage.json` grammar and
// emits shiki-compatible token annotations. Unlike the `shiki` provider which
// bundles a curated grammar set, this provider is fully data-driven: callers
// supply a grammar path + scope name via the `options` blob, and the provider
// tokenizes arbitrary text under that grammar.
//
// Uses `vscode-textmate` for tokenization and `vscode-oniguruma` (WASM) as the
// regex engine, mirroring VSCode's own highlighting pipeline.
//
// Registration id: "textmate". The Highlight handler dispatches here when a
// language has been wired to "textmate" via sync or manifest.
//
// Options (JSON, passed as the `config` arg):
//   {
//     "grammarPath": "/abs/path/to/lang.tmLanguage.json",
//     "scopeName":   "source.ts",
//     "theme":       { "<scope>": "#rrggbb", ... }   // optional scope->color map
//   }
//
// Output: JSON envelope `{ annotations: [...] }` where each annotation is
// `{ start, end, kind: "token", scope, color }`. On failure the provider
// returns `{ ok: false, error: { message } }` — it does NOT throw.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  registerHighlightProvider,
  type HighlightProviderFn,
} from './highlight-provider-registry.ts';

type TmConfig = {
  grammarPath?: string;
  scopeName?: string;
  theme?: Record<string, string>;
};

type TmAnnotation = {
  start: number;
  end: number;
  kind: 'token';
  scope: string;
  color: string;
};

// Minimal structural types so this file doesn't require @types/vscode-textmate.
type IGrammar = {
  tokenizeLine: (
    line: string,
    prevState: any,
  ) => {
    tokens: Array<{ startIndex: number; endIndex: number; scopes: string[] }>;
    ruleStack: any;
  };
};
type IRegistry = {
  loadGrammar: (scopeName: string) => Promise<IGrammar | null>;
};

// ---- Oniguruma WASM init (singleton) ----------------------------------------

let onigReady: Promise<any> | null = null;
async function getOnigLib(): Promise<any> {
  if (onigReady) return onigReady;
  onigReady = (async () => {
    const oniguruma: any = await import('vscode-oniguruma');
    const req = createRequire(import.meta.url);
    const wasmPath = req.resolve('vscode-oniguruma/release/onig.wasm');
    const wasmBytes = readFileSync(wasmPath);
    await oniguruma.loadWASM(wasmBytes.buffer.slice(
      wasmBytes.byteOffset,
      wasmBytes.byteOffset + wasmBytes.byteLength,
    ));
    return {
      createOnigScanner: (patterns: string[]) => new oniguruma.OnigScanner(patterns),
      createOnigString: (s: string) => new oniguruma.OnigString(s),
    };
  })();
  return onigReady;
}

// ---- Registry + grammar cache -----------------------------------------------

// Keyed by grammarPath so re-use is cheap across calls.
const grammarCache = new Map<string, Promise<IGrammar | null>>();
let registryPromise: Promise<IRegistry> | null = null;

async function getRegistry(
  loadGrammarFromPath: (scopeName: string) => { path: string; scopeName: string } | null,
): Promise<IRegistry> {
  if (registryPromise) return registryPromise;
  registryPromise = (async () => {
    const tm: any = await import('vscode-textmate');
    const onigLib = getOnigLib();
    const registry = new tm.Registry({
      onigLib,
      loadGrammar: async (scopeName: string) => {
        const hint = loadGrammarFromPath(scopeName);
        if (!hint) return null;
        const raw = readFileSync(hint.path, 'utf8');
        return tm.parseRawGrammar(raw, hint.path);
      },
    });
    return registry as IRegistry;
  })();
  return registryPromise;
}

// Active resolver — updated per-call so the Registry's `loadGrammar` callback
// can find the file for whichever scope we're currently tokenizing.
const scopeToPath = new Map<string, string>();

function resolveScope(scopeName: string): { path: string; scopeName: string } | null {
  const path = scopeToPath.get(scopeName);
  if (!path) return null;
  return { path, scopeName };
}

async function ensureGrammar(
  grammarPath: string,
  scopeName: string,
): Promise<IGrammar | null> {
  scopeToPath.set(scopeName, grammarPath);
  const key = `${scopeName}::${grammarPath}`;
  let existing = grammarCache.get(key);
  if (!existing) {
    existing = (async () => {
      const registry = await getRegistry(resolveScope);
      return registry.loadGrammar(scopeName);
    })();
    grammarCache.set(key, existing);
  }
  return existing;
}

// ---- Warm / peek pattern (mirrors shiki provider) ---------------------------

// Warmed grammars keyed by `${scopeName}::${grammarPath}`, so the sync provider
// function can return immediately.
const warmed = new Map<string, IGrammar>();

export async function warmTextmateGrammar(
  grammarPath: string,
  scopeName: string,
): Promise<void> {
  const g = await ensureGrammar(grammarPath, scopeName);
  if (g) warmed.set(`${scopeName}::${grammarPath}`, g);
}

export function resetTextmateProvider(): void {
  warmed.clear();
  grammarCache.clear();
  scopeToPath.clear();
  registryPromise = null;
  onigReady = null;
}

// ---- Core: tokenize + emit annotations --------------------------------------

function parseConfig(config: string | undefined): TmConfig {
  if (!config) return {};
  try {
    const parsed = JSON.parse(config);
    if (parsed && typeof parsed === 'object') return parsed as TmConfig;
  } catch {
    // fall through
  }
  return {};
}

function pickColor(scopes: string[], theme?: Record<string, string>): string {
  if (!theme) return '';
  // Walk scopes most-specific to least-specific for a best-match lookup.
  for (let i = scopes.length - 1; i >= 0; i--) {
    const s = scopes[i];
    if (theme[s]) return theme[s]!;
    // Try scope prefixes ("string.quoted.double.ts" -> "string.quoted.double" -> ...)
    const parts = s.split('.');
    for (let j = parts.length - 1; j >= 1; j--) {
      const prefix = parts.slice(0, j).join('.');
      if (theme[prefix]) return theme[prefix]!;
    }
  }
  return '';
}

function tokenizeWithGrammar(
  grammar: IGrammar,
  text: string,
  theme?: Record<string, string>,
): TmAnnotation[] {
  const annotations: TmAnnotation[] = [];
  const lines = text.split('\n');
  let ruleStack: any = null; // INITIAL is null in vscode-textmate
  let lineStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const result = grammar.tokenizeLine(line, ruleStack);
    for (const tok of result.tokens) {
      const start = lineStart + tok.startIndex;
      const end = lineStart + tok.endIndex;
      if (end <= start) continue;
      const topScope = tok.scopes[tok.scopes.length - 1] ?? '';
      annotations.push({
        start,
        end,
        kind: 'token',
        scope: topScope,
        color: pickColor(tok.scopes, theme),
      });
    }
    ruleStack = result.ruleStack;
    lineStart += line.length + 1; // +1 for the newline separator
  }
  // Clamp against original text length.
  for (const a of annotations) {
    if (a.end > text.length) a.end = text.length;
    if (a.start > text.length) a.start = text.length;
  }
  return annotations;
}

/**
 * Synchronous provider entrypoint. Requires the grammar to have been pre-warmed
 * via `warmTextmateGrammar`. If not warmed, we kick a background warm and
 * return an empty annotation list — identical behaviour to the shiki provider.
 */
export function highlightWithTextmate(
  text: string,
  _language: string,
  config?: string,
): string {
  const cfg = parseConfig(config);
  if (!cfg.grammarPath || !cfg.scopeName) {
    return JSON.stringify({
      ok: false,
      error: { message: 'textmate provider requires options.grammarPath and options.scopeName' },
    });
  }
  const key = `${cfg.scopeName}::${cfg.grammarPath}`;
  const grammar = warmed.get(key);
  if (!grammar) {
    void warmTextmateGrammar(cfg.grammarPath, cfg.scopeName);
    return JSON.stringify({ annotations: [] as TmAnnotation[], warming: true });
  }
  try {
    const annotations = tokenizeWithGrammar(grammar, text, cfg.theme);
    return JSON.stringify({ annotations });
  } catch (err: any) {
    return JSON.stringify({
      ok: false,
      error: { message: err?.message ?? String(err) },
    });
  }
}

/**
 * Async convenience: warms the grammar if needed then tokenizes. Use from
 * tests or contexts where blocking on first-call is acceptable.
 */
export async function highlightWithTextmateAsync(
  text: string,
  language: string,
  config?: string,
): Promise<string> {
  const cfg = parseConfig(config);
  if (!cfg.grammarPath || !cfg.scopeName) {
    return JSON.stringify({
      ok: false,
      error: { message: 'textmate provider requires options.grammarPath and options.scopeName' },
    });
  }
  await warmTextmateGrammar(cfg.grammarPath, cfg.scopeName);
  return highlightWithTextmate(text, language, config);
}

// Self-register under provider id "textmate".
const providerFn: HighlightProviderFn = (text, language, config) =>
  highlightWithTextmate(text, language, config);

registerHighlightProvider('textmate', providerFn);
