// Prettier Format Provider
// ============================================================
// Implements the formatter dispatch target for the Format concept.
// Calls prettier.format on the input text, diffs input vs output,
// and produces a serialized Patch (JSON array of EditOps) compatible
// with the existing Patch + UndoStack pipeline — a single call
// becomes exactly one undo entry.
//
// Exported entry point:
//   formatWithPrettier(text, parser, config?) -> Bytes (JSON Patch effect)
//
// Wired via syncs/app/register-prettier-format.sync, which dispatches
// Format/register(provider: "prettier", language, config) for each
// supported language. The Format handler (handlers/ts/app/format.handler.ts)
// consults the dispatch table at format() time and invokes this function
// when the registered provider name is "prettier".
//
// The Patch effect shape matches handlers/ts/patch.handler.ts:
//   { type: "equal" | "insert" | "delete", line: number, content: string }
// Applying the script by concatenating equal+insert lines yields the
// formatted text; inverting swaps insert<->delete so Undo restores the
// original.

// Prettier is loaded dynamically so that environments without it installed
// still import this module cleanly. formatWithPrettier() throws if prettier
// is missing at call time.
type PrettierModule = {
  format: (source: string, options: Record<string, unknown>) => string | Promise<string>;
};

let prettierModule: PrettierModule | null = null;
let prettierLoadError: Error | null = null;

async function loadPrettier(): Promise<PrettierModule> {
  if (prettierModule) return prettierModule;
  if (prettierLoadError) throw prettierLoadError;
  try {
    const mod = (await import('prettier')) as unknown as PrettierModule & {
      default?: PrettierModule;
    };
    prettierModule = mod.default ?? mod;
    return prettierModule;
  } catch (err) {
    prettierLoadError = err instanceof Error ? err : new Error(String(err));
    throw prettierLoadError;
  }
}

export interface EditOp {
  type: 'equal' | 'insert' | 'delete';
  line: number;
  content: string;
}

/**
 * Produce an edit script (Myers-LCS based, line granularity) describing
 * how to transform `before` into `after`. Matches the encoding used by
 * handlers/ts/patch.handler.ts so the resulting Patch is directly
 * applicable, invertible, and composable.
 */
export function diffLines(before: string, after: string): EditOp[] {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const m = beforeLines.length;
  const n = afterLines.length;

  // LCS DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (beforeLines[i - 1] === afterLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce the edit script (equal / insert / delete)
  const ops: EditOp[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && beforeLines[i - 1] === afterLines[j - 1]) {
      ops.unshift({ type: 'equal', line: i - 1, content: beforeLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'insert', line: j - 1, content: afterLines[j - 1] });
      j--;
    } else {
      ops.unshift({ type: 'delete', line: i - 1, content: beforeLines[i - 1] });
      i--;
    }
  }
  return ops;
}

/**
 * Decoded prettier config. `config` is Bytes in the concept; we accept
 * either a JSON string or an empty string. Unknown keys are passed through
 * to prettier so callers may override parser-specific options.
 */
function decodeConfig(config: string | undefined): Record<string, unknown> {
  if (!config) return {};
  try {
    const parsed = JSON.parse(config);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Format `text` with prettier using the given `parser` (e.g. "typescript",
 * "babel", "json", "css", "html") and return a serialized Patch describing
 * the edit from input to formatted output.
 *
 * @param text    source text to format
 * @param parser  prettier parser identifier (maps from Format concept "config")
 * @param config  optional JSON-encoded prettier options; merged after parser
 * @returns       JSON-encoded EditOp[] (Patch effect bytes). When input is
 *                already formatted this is a pure sequence of `equal` ops.
 * @throws        if prettier is not installed, or if prettier.format throws
 *                (e.g. on a syntax error). Callers (the Format handler /
 *                sync dispatch) MUST translate thrown errors to the
 *                format -> error variant.
 */
export async function formatWithPrettier(
  text: string,
  parser: string,
  config?: string,
): Promise<string> {
  const prettier = await loadPrettier();
  const opts = {
    parser,
    ...decodeConfig(config),
  };
  const formatted = await prettier.format(text, opts);
  const ops = diffLines(text, formatted);
  return JSON.stringify(ops);
}

/**
 * Registry of prettier parsers keyed by Format concept `language`. The
 * register-prettier-format.sync stores the parser name in Format's
 * `config` Bytes field; this table is the canonical source for which
 * languages the prettier provider claims to support.
 */
export const PRETTIER_LANGUAGE_PARSERS: Record<string, string> = {
  javascript: 'babel',
  typescript: 'typescript',
  json: 'json',
  css: 'css',
  html: 'html',
};
