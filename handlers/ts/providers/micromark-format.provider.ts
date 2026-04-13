// Micromark Round-Trip Format Provider
// ============================================================
// Implements the formatter dispatch target for the Format concept
// when language="markdown". Round-trips the input through
// mdast-util-from-markdown -> mdast (AST) -> mdast-util-to-markdown
// to canonicalize markdown syntax: bullet markers are normalized,
// code fences are unified, emphasis delimiters are made consistent,
// thematic breaks collapse to a canonical form, etc.
//
// The canonical output is diffed against the input with the same
// line-granular Myers-LCS diffLines routine used by the prettier
// format provider so the resulting Patch is directly applicable,
// invertible, and composable through the Patch + UndoStack pipeline.
// A format call becomes exactly one undo entry.
//
// Exported entry points:
//   formatMarkdown(text, config?) -> Promise<Bytes>     (async, preferred)
//   formatMarkdownSync(text, config?) -> Bytes          (after warm-up)
//
// Registration is driven by syncs/app/register-micromark-format.sync
// which dispatches Format/register(provider: "micromark-format",
// language: "markdown", config: "") when PluginRegistry advertises a
// format-provider plugin slot at boot. The concrete text->Patch
// dispatch fn is installed in the shared module-level registry
// (format-provider-registry.ts) on import so the Format concept
// handler can stay storage-pure while concrete formatter libraries
// live here.
//
// The Patch effect shape matches handlers/ts/patch.handler.ts and
// prettier-format.provider.ts:
//   { type: "equal" | "insert" | "delete", line: number, content: string }
// Applying the script by concatenating equal+insert lines yields the
// canonical text; inverting swaps insert<->delete so Undo restores
// the original.

import { diffLines, type EditOp } from './prettier-format.provider.ts';
import {
  registerFormatProvider,
  type FormatProviderFn,
} from './format-provider-registry.ts';

export const FORMAT_PROVIDER_ID = 'micromark-format';
export const FORMAT_LANGUAGE = 'markdown';

// ------------------------------------------------------------------
// Lazy module loading
// ------------------------------------------------------------------
// mdast-util-{from,to}-markdown are ESM-only pure packages with no
// native deps. We load them dynamically so environments without the
// deps installed can still import this module cleanly (the async
// entry point will throw a structured error rather than crashing at
// import time).

type FromMarkdown = (
  doc: string | Uint8Array,
  options?: Record<string, unknown>,
) => unknown;
type ToMarkdown = (
  tree: unknown,
  options?: Record<string, unknown>,
) => string;

let fromMarkdown: FromMarkdown | null = null;
let toMarkdown: ToMarkdown | null = null;
let loadError: Error | null = null;
let loadPromise: Promise<void> | null = null;

async function loadMdast(): Promise<void> {
  if (fromMarkdown && toMarkdown) return;
  if (loadError) throw loadError;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const fromMod = (await import('mdast-util-from-markdown')) as unknown as {
          fromMarkdown?: FromMarkdown;
          default?: FromMarkdown | { fromMarkdown?: FromMarkdown };
        };
        const toMod = (await import('mdast-util-to-markdown')) as unknown as {
          toMarkdown?: ToMarkdown;
          default?: ToMarkdown | { toMarkdown?: ToMarkdown };
        };
        const fm =
          fromMod.fromMarkdown ??
          (typeof fromMod.default === 'function'
            ? (fromMod.default as FromMarkdown)
            : (fromMod.default as { fromMarkdown?: FromMarkdown } | undefined)
                ?.fromMarkdown);
        const tm =
          toMod.toMarkdown ??
          (typeof toMod.default === 'function'
            ? (toMod.default as ToMarkdown)
            : (toMod.default as { toMarkdown?: ToMarkdown } | undefined)
                ?.toMarkdown);
        if (typeof fm !== 'function' || typeof tm !== 'function') {
          throw new Error(
            'mdast-util-from-markdown / mdast-util-to-markdown not available',
          );
        }
        fromMarkdown = fm;
        toMarkdown = tm;
      } catch (err) {
        loadError = err instanceof Error ? err : new Error(String(err));
        throw loadError;
      }
    })();
  }
  await loadPromise;
}

// ------------------------------------------------------------------
// Config handling
// ------------------------------------------------------------------
// The Format concept's `config` is an opaque Bytes field. For the
// markdown provider we accept an optional JSON-encoded object whose
// shape is `{ from?: object, to?: object }` — the two sub-objects
// are passed straight through to mdast-util-from-markdown and
// mdast-util-to-markdown respectively. Unknown config formats
// (non-JSON, non-object) are ignored so callers can pass "" and
// get canonical defaults.

type MicromarkConfig = {
  from?: Record<string, unknown>;
  to?: Record<string, unknown>;
};

function decodeConfig(config: string | undefined): MicromarkConfig {
  if (!config) return {};
  try {
    const parsed = JSON.parse(config);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as MicromarkConfig;
    }
    return {};
  } catch {
    return {};
  }
}

// ------------------------------------------------------------------
// Public async API
// ------------------------------------------------------------------

/**
 * Round-trip `text` through mdast-util-from-markdown + mdast-util-to-markdown
 * and return a serialized Patch describing the edit from the input to the
 * canonicalized output.
 *
 * @param text   markdown source text to canonicalize
 * @param config optional JSON-encoded `{ from?, to? }` options object
 * @returns      JSON-encoded EditOp[] (Patch effect bytes). When input is
 *               already canonical this is a pure sequence of `equal` ops.
 * @throws       if mdast-util-* modules are not installed, or if the
 *               round-trip itself throws (e.g. on an internal parser
 *               assertion). Callers (the Format handler / sync dispatch)
 *               MUST translate thrown errors to the format -> error
 *               variant.
 */
export async function formatMarkdown(
  text: string,
  config?: string,
): Promise<string> {
  await loadMdast();
  if (!fromMarkdown || !toMarkdown) {
    throw loadError ?? new Error('mdast-util-* not loaded');
  }
  const opts = decodeConfig(config);
  const tree = fromMarkdown(text, opts.from ?? {});
  const canonical = toMarkdown(tree, opts.to ?? {});
  const ops: EditOp[] = diffLines(text, canonical);
  return JSON.stringify(ops);
}

// ------------------------------------------------------------------
// Sync adapter (matches FormatProviderFn signature)
// ------------------------------------------------------------------
// The mdast modules are pure-ESM and can only be loaded dynamically.
// We warm the cache on import so subsequent synchronous calls hit
// resolved state; callers preferring async should use formatMarkdown
// directly.

void loadMdast().catch(() => {
  /* leave loadError set; sync path returns a structured error envelope */
});

const formatMarkdownSyncImpl: FormatProviderFn = (text, config) => {
  if (!fromMarkdown || !toMarkdown) {
    // Not yet warmed. Return an equal-only pass-through so upstream
    // code never receives an invalid Patch; callers should prefer the
    // async entry point for first-hit correctness.
    const ops: EditOp[] = diffLines(text, text);
    return JSON.stringify(ops);
  }
  const opts = decodeConfig(config);
  const tree = fromMarkdown(text, opts.from ?? {});
  const canonical = toMarkdown(tree, opts.to ?? {});
  const ops = diffLines(text, canonical);
  return JSON.stringify(ops);
};

export const formatMarkdownSync = formatMarkdownSyncImpl;

// Self-register on import so kernel-boot wiring can activate providers
// by importing this module. The .sync file installs the concept-layer
// binding (Format/register -> provider: "micromark-format"); this line
// installs the concrete dispatch fn so Format/format { language:
// "markdown" } can resolve to it at runtime.
registerFormatProvider(FORMAT_PROVIDER_ID, formatMarkdownSyncImpl);
