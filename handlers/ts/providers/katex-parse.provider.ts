// KaTeX Parse provider — implements the `katex-parse` provider id for
// language="latex". Wraps KaTeX's internal parser (katex.__parse) to
// produce a portable parse-tree AST encoded as JSON bytes.
//
// Registration is driven by `syncs/app/register-katex-parse.sync` which
// dispatches Parse/register(provider: "katex-parse", language: "latex")
// once PluginRegistry advertises the parse-provider plugin type at boot.
// The actual text->AST dispatch happens through the shared Parse provider
// registry (see parse-provider-registry.ts) so that the Parse concept
// handler stays storage-pure while concrete parser libraries live here.
//
// Error handling: KaTeX throws `ParseError` on malformed LaTeX. We catch
// and encode the error as a structured envelope with position markers so
// LE-12 (katex highlight) can surface squiggles without reparsing.

import {
  registerParseProvider,
  type ParseProviderFn,
} from './parse-provider-registry.ts';

export const PARSE_PROVIDER_ID = 'katex-parse';
export const PARSE_LANGUAGE = 'latex';

type KatexModule = {
  __parse?: (text: string, settings?: Record<string, unknown>) => unknown;
  ParseError?: new (...args: unknown[]) => Error;
};

// Resolve KaTeX lazily so environments without the dep (e.g. kernel-only
// boots) can still import this module. The first parse call will throw
// a structured error rather than a hard import failure.
let katexPromise: Promise<KatexModule> | null = null;
async function loadKatex(): Promise<KatexModule> {
  if (!katexPromise) {
    katexPromise = import('katex')
      .then((mod: unknown) => {
        const m = mod as { default?: KatexModule } & KatexModule;
        return (m.default ?? m) as KatexModule;
      })
      .catch((err: unknown) => {
        throw new Error(
          `katex module not available: ${(err as Error).message ?? err}`,
        );
      });
  }
  return katexPromise;
}

type ParseConfig = {
  displayMode?: boolean;
  macros?: Record<string, string>;
  strict?: 'error' | 'warn' | 'ignore' | boolean;
  trust?: boolean;
};

function decodeConfig(config?: string): ParseConfig {
  if (!config) return {};
  try {
    // Config may arrive as either a JSON string or base64-encoded JSON.
    const trimmed = config.trim();
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed) as ParseConfig;
    }
    const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
    return JSON.parse(decoded) as ParseConfig;
  } catch {
    return {};
  }
}

type ErrorMarker = {
  position?: number;
  length?: number;
  token?: string;
  raw?: string;
};

function extractMarker(err: unknown, text: string): ErrorMarker {
  const e = err as {
    position?: number;
    length?: number;
    token?: { text?: string; loc?: { start?: number; end?: number } };
    rawMessage?: string;
  };
  const marker: ErrorMarker = {};
  if (typeof e?.position === 'number') marker.position = e.position;
  if (typeof e?.length === 'number') marker.length = e.length;
  const loc = e?.token?.loc;
  if (loc) {
    if (typeof loc.start === 'number' && marker.position == null) {
      marker.position = loc.start;
    }
    if (
      typeof loc.end === 'number' &&
      typeof marker.position === 'number' &&
      marker.length == null
    ) {
      marker.length = Math.max(0, loc.end - marker.position);
    }
  }
  if (typeof e?.token?.text === 'string') marker.token = e.token.text;
  if (typeof e?.rawMessage === 'string') marker.raw = e.rawMessage;
  // Fall back to a 1-char marker at position 0 so downstream highlighters
  // always have something to render.
  if (marker.position == null) marker.position = 0;
  if (marker.length == null) marker.length = Math.min(1, text.length);
  return marker;
}

/**
 * Parse LaTeX source into a JSON-encoded AST (bytes).
 *
 * Success: `{ ok: true, language: "latex", tree: <katex-parse-tree> }`
 * Error:   `{ ok: false, language: "latex", error: { message, marker } }`
 *
 * Never throws; all failures are encoded in the return envelope.
 */
export async function parseLatex(
  text: string,
  config?: string,
): Promise<string> {
  const opts = decodeConfig(config);
  try {
    const katex = await loadKatex();
    if (typeof katex.__parse !== 'function') {
      return JSON.stringify({
        ok: false,
        language: PARSE_LANGUAGE,
        error: {
          message: 'katex.__parse unavailable — internal parser not exposed',
          marker: { position: 0, length: 0 },
        },
      });
    }
    const settings: Record<string, unknown> = {
      displayMode: opts.displayMode === true,
      strict: opts.strict ?? 'ignore',
      trust: opts.trust === true,
      throwOnError: true,
    };
    if (opts.macros) settings.macros = opts.macros;
    const tree = katex.__parse(text, settings);
    return JSON.stringify({
      ok: true,
      language: PARSE_LANGUAGE,
      tree,
    });
  } catch (err) {
    const marker = extractMarker(err, text);
    const message =
      (err as Error)?.message ??
      (typeof err === 'string' ? err : 'unknown katex parse error');
    return JSON.stringify({
      ok: false,
      language: PARSE_LANGUAGE,
      error: { message, marker },
    });
  }
}

// Synchronous adapter matching the ParseProviderFn signature. Because the
// katex module load is async but always resolves once on first use, we
// surface a stable sync interface by blocking on a resolved cache after
// the first warm-up. Callers preferring async should import `parseLatex`
// directly.
let warmedKatex: KatexModule | null = null;
void loadKatex()
  .then((m) => {
    warmedKatex = m;
  })
  .catch(() => {
    /* left null; sync path returns a structured error envelope */
  });

const parseLatexSync: ParseProviderFn = (text, config) => {
  if (!warmedKatex || typeof warmedKatex.__parse !== 'function') {
    return JSON.stringify({
      ok: false,
      language: PARSE_LANGUAGE,
      error: {
        message:
          'katex not yet loaded — call parseLatex (async) during warm-up, then retry',
        marker: { position: 0, length: 0 },
      },
    });
  }
  const opts = decodeConfig(config);
  try {
    const settings: Record<string, unknown> = {
      displayMode: opts.displayMode === true,
      strict: opts.strict ?? 'ignore',
      trust: opts.trust === true,
      throwOnError: true,
    };
    if (opts.macros) settings.macros = opts.macros;
    const tree = warmedKatex.__parse(text, settings);
    return JSON.stringify({ ok: true, language: PARSE_LANGUAGE, tree });
  } catch (err) {
    const marker = extractMarker(err, text);
    const message =
      (err as Error)?.message ??
      (typeof err === 'string' ? err : 'unknown katex parse error');
    return JSON.stringify({
      ok: false,
      language: PARSE_LANGUAGE,
      error: { message, marker },
    });
  }
};

// Self-register on import so kernel-boot can wire providers by loading
// this module. The .sync file dispatches Parse/register to register the
// concept-layer binding; this line registers the concrete dispatch fn.
registerParseProvider(PARSE_PROVIDER_ID, parseLatexSync);

export { parseLatexSync };
