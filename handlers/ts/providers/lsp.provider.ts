// Generic LSP Format + Highlight Provider
//
// Delegates formatting and semantic highlighting to any language server
// that speaks the LSP protocol over stdio. A single provider entry
// covers every language supported by an available language server —
// one adapter in place of per-language sync entries.
//
// Wire contract (options, passed as the `config` Bytes field or as a
// direct argument):
//   {
//     serverCommand: string,      // binary to spawn, e.g. "typescript-language-server"
//     args?: string[],            // process args, e.g. ["--stdio"]
//     rootUri?: string,           // workspace root (file:// URI)
//     initOptions?: unknown,      // server-specific initializationOptions
//     timeoutMs?: number,         // per-request timeout
//     legend?: {                  // semantic tokens legend if known up front;
//       tokenTypes: string[],     // otherwise decoded returns scope "token-<n>"
//       tokenModifiers: string[],
//     },
//   }
//
// Both entry points return the standard envelope used by the Format +
// Highlight concepts. When the server can't be reached or the request
// fails, both return `{ ok: false, error: { message: "lsp_unavailable" } }`
// (or the specific LSP error message) so callers can surface the right
// variant without a second pass.
//
// Self-registers under the provider id "lsp" in BOTH the synchronous
// format + highlight registries (format-provider-registry.ts /
// highlight-provider-registry.ts) so the generic VPR manifest loader
// can wire it into the Format and Highlight concepts like any other
// provider. Because the LSP roundtrip is inherently asynchronous, the
// synchronous wrappers kick off the async call in the background and
// return a "warming" envelope for the first invocation against a
// given (command, root) pair; subsequent calls against the same pool
// entry return the actual result once the response has been cached.
//
// Callers that want the true async result directly should use the
// exported `lspFormat` / `lspHighlight` functions.

import { getLspClient, type LspClientOptions } from './lsp-client.ts';
import { diffLines } from './prettier-format.provider.ts';
import {
  registerFormatProvider,
  type FormatProviderFn,
} from './format-provider-registry.ts';
import {
  registerHighlightProvider,
  type HighlightProviderFn,
} from './highlight-provider-registry.ts';

// ---------------------------------------------------------------------------
// Options decoding

export interface LspProviderOptions extends LspClientOptions {
  legend?: {
    tokenTypes: string[];
    tokenModifiers: string[];
  };
}

function decodeOptions(config: string | undefined): LspProviderOptions | null {
  if (!config) return null;
  try {
    const parsed = JSON.parse(config);
    if (parsed && typeof parsed === 'object' && typeof parsed.serverCommand === 'string') {
      return parsed as LspProviderOptions;
    }
  } catch {
    /* fall through */
  }
  return null;
}

const LANGUAGE_IDS: Record<string, string> = {
  javascript: 'javascript',
  typescript: 'typescript',
  json: 'json',
  css: 'css',
  html: 'html',
  markdown: 'markdown',
  python: 'python',
  rust: 'rust',
  go: 'go',
  yaml: 'yaml',
};

function languageId(language: string): string {
  return LANGUAGE_IDS[language] ?? language;
}

function documentUri(language: string): string {
  const ext = language === 'typescript' ? 'ts'
    : language === 'javascript' ? 'js'
    : language;
  return `inmemory://clef/buffer.${ext}`;
}

function unavailable(message = 'lsp_unavailable'): string {
  return JSON.stringify({ ok: false, error: { message } });
}

// ---------------------------------------------------------------------------
// Format: did-open + textDocument/formatting -> TextEdit[] -> line diff Patch

interface LspTextEdit {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  newText: string;
}

/** Apply a set of LSP TextEdits to a source string. Edits are sorted by
 * position descending so earlier offsets remain valid during application. */
function applyTextEdits(text: string, edits: LspTextEdit[]): string {
  const lines = text.split('\n');
  // Convert each edit into a global offset pair.
  const offsets = new Map<number, number>();
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    offsets.set(i, offset);
    offset += lines[i].length + 1; // +1 for the split newline
  }
  offsets.set(lines.length, offset);

  const indexed = edits.map((e) => {
    const startLine = e.range.start.line;
    const endLine = e.range.end.line;
    const startBase = offsets.get(startLine) ?? text.length;
    const endBase = offsets.get(endLine) ?? text.length;
    return {
      start: Math.min(text.length, startBase + e.range.start.character),
      end: Math.min(text.length, endBase + e.range.end.character),
      newText: e.newText,
    };
  });
  indexed.sort((a, b) => b.start - a.start);

  let result = text;
  for (const ed of indexed) {
    result = result.slice(0, ed.start) + ed.newText + result.slice(ed.end);
  }
  return result;
}

/** Async LSP format entry: returns JSON-encoded EditOp[] (Patch bytes)
 * or an `{ok:false,...}` envelope on failure. */
export async function lspFormat(
  text: string,
  language: string,
  options: LspProviderOptions,
): Promise<string> {
  let client;
  try {
    client = await getLspClient(options);
  } catch {
    return unavailable();
  }
  const uri = documentUri(language);
  try {
    client.notify('textDocument/didOpen', {
      textDocument: {
        uri,
        languageId: languageId(language),
        version: 1,
        text,
      },
    });
    const edits = await client.request<LspTextEdit[] | null>('textDocument/formatting', {
      textDocument: { uri },
      options: { tabSize: 2, insertSpaces: true },
    });
    client.notify('textDocument/didClose', { textDocument: { uri } });
    const formatted = edits && edits.length > 0 ? applyTextEdits(text, edits) : text;
    return JSON.stringify(diffLines(text, formatted));
  } catch (err) {
    const msg = (err as Error).message ?? 'lsp_unavailable';
    return unavailable(msg.startsWith('lsp_unavailable') ? 'lsp_unavailable' : msg);
  }
}

// ---------------------------------------------------------------------------
// Highlight: did-open + textDocument/semanticTokens/full -> decoded annotations

interface SemanticTokensResult {
  resultId?: string;
  data: number[];
}

interface HighlightAnnotation {
  start: number;
  end: number;
  kind: string;
  scope: string;
}

/** Decode LSP semantic tokens' relative-encoded flat array into
 * absolute-range annotations.
 *
 * Per LSP spec, `data` is a sequence of 5-tuples:
 *   (deltaLine, deltaStartChar, length, tokenType, tokenModifiers).
 * deltaStartChar is relative to the previous token's start when on the
 * same line; otherwise it's absolute from column 0. */
export function decodeSemanticTokens(
  text: string,
  data: number[],
  legend?: { tokenTypes: string[]; tokenModifiers: string[] },
): HighlightAnnotation[] {
  const lines = text.split('\n');
  const lineOffsets: number[] = [];
  {
    let off = 0;
    for (const line of lines) {
      lineOffsets.push(off);
      off += line.length + 1;
    }
  }
  const annotations: HighlightAnnotation[] = [];
  let line = 0;
  let char = 0;
  for (let i = 0; i + 4 < data.length; i += 5) {
    const deltaLine = data[i];
    const deltaStart = data[i + 1];
    const length = data[i + 2];
    const tokenType = data[i + 3];
    // const tokenMods = data[i + 4]; // modifiers currently unused in scope name
    if (deltaLine > 0) {
      line += deltaLine;
      char = deltaStart;
    } else {
      char += deltaStart;
    }
    const base = lineOffsets[line] ?? text.length;
    const start = Math.min(text.length, base + char);
    const end = Math.min(text.length, start + length);
    const typeName = legend?.tokenTypes?.[tokenType] ?? `token-${tokenType}`;
    annotations.push({
      start,
      end,
      kind: 'token',
      scope: typeName,
    });
  }
  return annotations;
}

/** Async LSP highlight entry: returns JSON-encoded annotations envelope. */
export async function lspHighlight(
  text: string,
  language: string,
  options: LspProviderOptions,
): Promise<string> {
  let client;
  try {
    client = await getLspClient(options);
  } catch {
    return unavailable();
  }
  const uri = documentUri(language);
  try {
    client.notify('textDocument/didOpen', {
      textDocument: {
        uri,
        languageId: languageId(language),
        version: 1,
        text,
      },
    });
    const result = await client.request<SemanticTokensResult | null>(
      'textDocument/semanticTokens/full',
      { textDocument: { uri } },
    );
    client.notify('textDocument/didClose', { textDocument: { uri } });
    const data = result?.data ?? [];
    const annotations = decodeSemanticTokens(text, data, options.legend);
    return JSON.stringify({ annotations });
  } catch (err) {
    const msg = (err as Error).message ?? 'lsp_unavailable';
    return unavailable(msg.startsWith('lsp_unavailable') ? 'lsp_unavailable' : msg);
  }
}

// ---------------------------------------------------------------------------
// Sync-registry wrappers + self-registration
//
// The format/highlight registries expect synchronous `(text, [lang,] config) =>
// string` functions. We cache resolved results per (command, root, language,
// text-hash) so repeated calls return the real envelope once the async RPC
// completes. The first call kicks off the fetch and returns an "lsp_warming"
// envelope; callers that need guaranteed-synchronous results should pre-warm
// with `warmLspProvider(options)`.

const formatCache = new Map<string, string>();
const highlightCache = new Map<string, string>();
const inflightFormat = new Map<string, Promise<string>>();
const inflightHighlight = new Map<string, Promise<string>>();

function cacheKey(lang: string, text: string, options: LspProviderOptions): string {
  return JSON.stringify([options.serverCommand, options.args ?? [], options.rootUri ?? '', lang, text]);
}

function warmingEnvelope(): string {
  return JSON.stringify({ ok: false, error: { message: 'lsp_warming' } });
}

/** Pre-connect an LSP server so subsequent sync calls return real data. */
export async function warmLspProvider(options: LspProviderOptions): Promise<void> {
  try {
    await getLspClient(options);
  } catch {
    /* swallow — sync callers will see lsp_unavailable */
  }
}

const syncFormat: FormatProviderFn = (text, config) => {
  const opts = decodeOptions(config);
  if (!opts) return unavailable('lsp_unavailable: missing options');
  const lang = '';
  const key = cacheKey(lang, text, opts);
  const hit = formatCache.get(key);
  if (hit !== undefined) return hit;
  if (!inflightFormat.has(key)) {
    const p = lspFormat(text, lang, opts).then((r) => {
      formatCache.set(key, r);
      inflightFormat.delete(key);
      return r;
    });
    inflightFormat.set(key, p);
  }
  return warmingEnvelope();
};

const syncHighlight: HighlightProviderFn = (text, language, config) => {
  const opts = decodeOptions(config);
  if (!opts) return unavailable('lsp_unavailable: missing options');
  const key = cacheKey(language, text, opts);
  const hit = highlightCache.get(key);
  if (hit !== undefined) return hit;
  if (!inflightHighlight.has(key)) {
    const p = lspHighlight(text, language, opts).then((r) => {
      highlightCache.set(key, r);
      inflightHighlight.delete(key);
      return r;
    });
    inflightHighlight.set(key, p);
  }
  return warmingEnvelope();
};

registerFormatProvider('lsp', syncFormat);
registerHighlightProvider('lsp', syncHighlight);

/** Clear the per-call caches. Tests only. */
export function resetLspProviderCaches(): void {
  formatCache.clear();
  highlightCache.clear();
  inflightFormat.clear();
  inflightHighlight.clear();
}
