// Shiki Highlight Provider
//
// Runs shiki's tokenizer over the given text in the given language and returns
// InlineAnnotation-shaped bytes — a JSON-encoded list of annotations, one per
// shiki token, with { start, end, kind: "token", scope, color }.
//
// Registers itself in the shared Highlight provider registry under the id
// "shiki". The Highlight handler dispatches to this function when handling
// highlight(language, text) for any language that was registered against the
// "shiki" provider via sync (see syncs/app/register-shiki-highlight.sync).
//
// Shiki is lazy-loaded + cached on first use so the module import stays cheap
// and test suites that never exercise highlighting don't pay the startup cost.
// A highlighter instance caches loaded grammars across calls.

import {
  registerHighlightProvider,
  type HighlightProviderFn,
} from './highlight-provider-registry.ts';

type ShikiThemedToken = {
  content: string;
  color?: string;
  explanation?: Array<{
    scopes: Array<{ scopeName: string }>;
  }>;
};

type ShikiHighlighter = {
  codeToThemedTokens: (
    code: string,
    lang: string,
    theme?: string,
    options?: { includeExplanation?: boolean },
  ) => ShikiThemedToken[][];
  loadLanguage?: (lang: string) => Promise<void>;
  getLoadedLanguages?: () => string[];
};

type ShikiConfig = {
  theme?: string;
};

let highlighterPromise: Promise<ShikiHighlighter> | null = null;

const SUPPORTED_LANGS = [
  'javascript', 'typescript', 'json', 'css', 'html', 'markdown',
  'python', 'rust', 'go', 'sql', 'bash', 'yaml',
];

async function getHighlighter(theme: string): Promise<ShikiHighlighter> {
  if (!highlighterPromise) {
    // Dynamic import so module loads without shiki installed at type-check time.
    highlighterPromise = (async () => {
      const shiki = await import('shiki');
      const hl = await (shiki as any).getHighlighter({
        theme,
        langs: SUPPORTED_LANGS,
      });
      return hl as ShikiHighlighter;
    })();
  }
  return highlighterPromise;
}

function parseConfig(config: string | undefined): ShikiConfig {
  if (!config) return {};
  try {
    const parsed = JSON.parse(config);
    if (parsed && typeof parsed === 'object') return parsed as ShikiConfig;
  } catch {
    // Ignore malformed config — fall back to defaults.
  }
  return {};
}

/**
 * Tokenize `text` as `lang` using shiki and return a JSON-encoded annotation
 * list (Bytes/UTF-8 string). Each annotation marks one token span with its
 * resolved colour and top TextMate scope.
 *
 * Synchronous wrapper: returns a JSON envelope string. Errors produce an
 * `{ ok: false, error: { message } }` envelope so the Highlight handler can
 * surface an `error` variant without a second pass. Async shiki startup is
 * handled by returning a promise-serialisation fallback: callers that need
 * a true synchronous result pre-warm via `warmShikiHighlighter()`.
 */
export function highlightWithShiki(
  text: string,
  lang: string,
  config?: string,
): string {
  // Fast path: shiki must be warmed already for synchronous return. If not
  // warmed, we return an empty annotation list — the caller should invoke
  // `warmShikiHighlighter` during boot.
  const instance = peekHighlighter();
  if (!instance) {
    // Kick warmup in the background for subsequent calls.
    const cfg = parseConfig(config);
    void getHighlighter(cfg.theme ?? 'github-light');
    return JSON.stringify({
      annotations: [] as Annotation[],
      warming: true,
    });
  }

  try {
    const tokens = instance.codeToThemedTokens(text, lang, undefined, {
      includeExplanation: true,
    });
    const annotations = tokensToAnnotations(text, tokens);
    return JSON.stringify({ annotations });
  } catch (err: any) {
    return JSON.stringify({
      ok: false,
      error: { message: err?.message ?? String(err) },
    });
  }
}

type Annotation = {
  start: number;
  end: number;
  kind: 'token';
  scope: string;
  color: string;
};

function tokensToAnnotations(
  text: string,
  tokenLines: ShikiThemedToken[][],
): Annotation[] {
  const annotations: Annotation[] = [];
  let offset = 0;
  for (let lineIdx = 0; lineIdx < tokenLines.length; lineIdx++) {
    const line = tokenLines[lineIdx];
    for (const tok of line) {
      const len = tok.content.length;
      if (len > 0) {
        const scope =
          tok.explanation?.[0]?.scopes?.[tok.explanation[0].scopes.length - 1]
            ?.scopeName ?? '';
        annotations.push({
          start: offset,
          end: offset + len,
          kind: 'token',
          scope,
          color: tok.color ?? '',
        });
      }
      offset += len;
    }
    // Account for the newline separator between lines (shiki splits on \n).
    if (lineIdx < tokenLines.length - 1) offset += 1;
  }
  // Clamp against the source text length in case the tokenizer normalised.
  for (const a of annotations) {
    if (a.end > text.length) a.end = text.length;
    if (a.start > text.length) a.start = text.length;
  }
  return annotations;
}

let warmInstance: ShikiHighlighter | null = null;
function peekHighlighter(): ShikiHighlighter | null {
  return warmInstance;
}

/** Pre-load the shiki highlighter so subsequent `highlightWithShiki` calls
 * run synchronously. Call this from boot syncs or test setup. */
export async function warmShikiHighlighter(config?: string): Promise<void> {
  const cfg = parseConfig(config);
  warmInstance = await getHighlighter(cfg.theme ?? 'github-light');
}

/** Reset the cached highlighter (for tests). */
export function resetShikiHighlighter(): void {
  highlighterPromise = null;
  warmInstance = null;
}

// Self-register under the provider id "shiki" so the Highlight handler can
// dispatch to us when invoked for any language whose sync named "shiki".
const providerFn: HighlightProviderFn = (text, language, config) =>
  highlightWithShiki(text, language, config);

registerHighlightProvider('shiki', providerFn);
