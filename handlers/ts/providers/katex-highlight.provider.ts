// KaTeX Highlight Provider
//
// Runs katex over the given LaTeX source and reports parse errors as
// InlineAnnotation-shaped bytes — a JSON-encoded list of { start, end,
// kind: "error", meta: <katex message> } records. Unlike the shiki highlight
// provider (LE-11) which emits per-token `kind: "token"` annotations for
// syntax coloring, this provider exists purely to surface squiggles for the
// `code-syntax-error-panel` widget. A successful parse yields an empty
// annotation list (no news is good news).
//
// Registers itself in the shared Highlight provider registry under the id
// "katex-highlight". The Highlight concept handler dispatches to this
// function when handling highlight(language, text) for language="latex"
// via the register-katex-highlight sync.
//
// Mirrors handlers/ts/providers/katex-parse.provider.ts (LE-07) but uses
// katex.renderToString with throwOnError=false first (fast path), falling
// back to katex.__parse for finer-grained error position extraction. KaTeX
// throws ParseError with `.position` and `.length` fields on malformed
// LaTeX, which we translate into annotation ranges directly.

import {
  registerHighlightProvider,
  type HighlightProviderFn,
} from './highlight-provider-registry.ts';

export const HIGHLIGHT_PROVIDER_ID = 'katex-highlight';
export const HIGHLIGHT_LANGUAGE = 'latex';

type KatexModule = {
  __parse?: (text: string, settings?: Record<string, unknown>) => unknown;
  renderToString?: (text: string, settings?: Record<string, unknown>) => string;
  ParseError?: new (...args: unknown[]) => Error;
};

// Resolve KaTeX lazily so environments without the dep can still import this
// module. The sync provider function returns an empty annotation list until
// the module finishes warming.
let katexPromise: Promise<KatexModule> | null = null;
let warmedKatex: KatexModule | null = null;

async function loadKatex(): Promise<KatexModule> {
  if (!katexPromise) {
    katexPromise = import('katex')
      .then((mod: unknown) => {
        const m = mod as { default?: KatexModule } & KatexModule;
        const resolved = (m.default ?? m) as KatexModule;
        warmedKatex = resolved;
        return resolved;
      })
      .catch((err: unknown) => {
        throw new Error(
          `katex module not available: ${(err as Error).message ?? err}`,
        );
      });
  }
  return katexPromise;
}

// Kick off warm-up at import time so the first sync call has a chance of
// finding katex loaded. Tests / boot can also `await warmKatexHighlighter()`
// explicitly for deterministic readiness.
void loadKatex().catch(() => {
  /* left null; sync path returns empty annotations if katex never loads */
});

/** Pre-load katex so subsequent highlight calls run synchronously. */
export async function warmKatexHighlighter(): Promise<void> {
  await loadKatex();
}

/** Reset the cached module (for tests). */
export function resetKatexHighlighter(): void {
  katexPromise = null;
  warmedKatex = null;
}

type HighlightConfig = {
  displayMode?: boolean;
  macros?: Record<string, string>;
  strict?: 'error' | 'warn' | 'ignore' | boolean;
  trust?: boolean;
};

function decodeConfig(config?: string): HighlightConfig {
  if (!config) return {};
  try {
    const trimmed = config.trim();
    if (!trimmed) return {};
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed) as HighlightConfig;
    }
    const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
    return JSON.parse(decoded) as HighlightConfig;
  } catch {
    return {};
  }
}

type ErrorAnnotation = {
  start: number;
  end: number;
  kind: 'error';
  meta: string;
};

function errorToAnnotation(err: unknown, text: string): ErrorAnnotation {
  const e = err as {
    position?: number;
    length?: number;
    token?: { text?: string; loc?: { start?: number; end?: number } };
    rawMessage?: string;
    message?: string;
  };
  let start = typeof e?.position === 'number' ? e.position : undefined;
  let len = typeof e?.length === 'number' ? e.length : undefined;
  const loc = e?.token?.loc;
  if (loc) {
    if (typeof loc.start === 'number' && start == null) start = loc.start;
    if (typeof loc.end === 'number' && start != null && len == null) {
      len = Math.max(0, loc.end - start);
    }
  }
  if (start == null) start = 0;
  if (len == null) len = Math.min(1, text.length);
  const end = Math.min(text.length, start + Math.max(len, 1));
  const message =
    e?.rawMessage ?? e?.message ?? 'katex parse error';
  return {
    start,
    end,
    kind: 'error',
    meta: message,
  };
}

/**
 * Highlight LaTeX source by running katex and collecting parse errors as
 * `kind: "error"` annotations. Returns a JSON envelope matching the Highlight
 * provider contract:
 *
 *   { annotations: [{ start, end, kind: "error", meta }, ...] }
 *
 * Never throws — all failures (including katex not loaded) surface as either
 * an empty annotation list or an `ok: false` envelope for the handler to
 * translate into the `error` variant.
 */
export function highlightLatex(text: string, config?: string): string {
  if (!warmedKatex) {
    // Kick another warm-up pass for subsequent calls.
    void loadKatex().catch(() => {});
    return JSON.stringify({ annotations: [] as ErrorAnnotation[], warming: true });
  }
  const opts = decodeConfig(config);
  const settings: Record<string, unknown> = {
    displayMode: opts.displayMode === true,
    strict: opts.strict ?? 'ignore',
    trust: opts.trust === true,
    throwOnError: true,
  };
  if (opts.macros) settings.macros = opts.macros;

  // Fast path: renderToString(throwOnError=false) returns an HTML string
  // wrapping any error in an <span class="katex-error"> instead of throwing.
  // That path is cheap but hides the precise position, so we only use it to
  // confirm that a parse failure occurred; the precise position comes from
  // __parse below.
  let hadRenderError = false;
  if (typeof warmedKatex.renderToString === 'function') {
    try {
      const html = warmedKatex.renderToString(text, {
        ...settings,
        throwOnError: false,
      });
      hadRenderError = /class="[^"]*katex-error[^"]*"/.test(html);
      if (!hadRenderError) {
        return JSON.stringify({ annotations: [] as ErrorAnnotation[] });
      }
    } catch {
      // throwOnError=false shouldn't throw, but guard anyway.
      hadRenderError = true;
    }
  }

  // Slow path: use __parse (throws ParseError with position/length) to pull
  // a precise marker. If __parse is unavailable, fall back to a whole-span
  // error annotation so the code-syntax-error-panel still has something to
  // show.
  if (typeof warmedKatex.__parse === 'function') {
    try {
      warmedKatex.__parse(text, settings);
      // Parse succeeded even though renderToString flagged an error — treat
      // as a render-level issue (e.g. undefined macro with strict=warn).
      return JSON.stringify({
        annotations: hadRenderError
          ? [{
              start: 0,
              end: Math.min(1, text.length),
              kind: 'error',
              meta: 'katex render warning',
            }]
          : [],
      });
    } catch (err) {
      return JSON.stringify({
        annotations: [errorToAnnotation(err, text)],
      });
    }
  }

  return JSON.stringify({
    annotations: hadRenderError
      ? [{
          start: 0,
          end: text.length,
          kind: 'error',
          meta: 'katex parse error',
        }]
      : [],
  });
}

// Synchronous adapter matching the HighlightProviderFn signature. Language is
// ignored — this provider is only registered for "latex".
const highlightLatexSync: HighlightProviderFn = (text, _language, config) =>
  highlightLatex(text, config);

// Self-register on import so kernel-boot can wire providers by loading this
// module. The .sync file dispatches Highlight/register to bind the
// concept-layer record (language="latex" -> provider="katex-highlight").
registerHighlightProvider(HIGHLIGHT_PROVIDER_ID, highlightLatexSync);

export { highlightLatexSync };
