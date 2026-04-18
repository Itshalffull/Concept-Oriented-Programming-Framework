/**
 * VariableProgram utilities for Clef Base.
 *
 * Two exports:
 *
 *   1. resolveStepConfigExpressions(input, runtimeContext)
 *      Server-side (and server-component-safe) utility used by the step
 *      execution path in process-interpreter.handler.ts.  Walks a step
 *      config object, detects VariableProgram expressions (values that
 *      start with `$` or `'`), calls VariableProgram/parse then
 *      VariableProgram/resolve through the kernel invoke API route, and
 *      returns the object with expressions replaced by resolved strings.
 *      Failures are silent — original expression is kept on any error
 *      so existing behaviour is preserved (backward compat).
 *
 *   2. useVariableProgram() — React hook (client component only)
 *      Returns { resolveExpression } for live single-expression preview
 *      in VariablePickerWidget and step inspector forms.
 */

import { useCallback, useRef } from 'react';
import { useKernelInvoke } from './clef-provider';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when the string looks like a VariableProgram expression. */
function isVariableExpression(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.startsWith('$') || trimmed.startsWith("'");
}

// ---------------------------------------------------------------------------
// Server-side / universal utility
// ---------------------------------------------------------------------------

/**
 * Runtime context that can be built from information available at step
 * execution time in process-interpreter.handler.ts.
 *
 * All fields are optional — the VariableProgram resolver ignores keys
 * it cannot service; literal expressions (`'some value'`) need no context.
 */
export interface StepRuntimeContext {
  /** The ContentNode id of the "current page" driving this process, if known. */
  pageId?: string;
  /** URL parameters extracted from the request path, if known. */
  urlParams?: Record<string, string>;
  /** Session data available at execution time (e.g. userId, roles). */
  session?: Record<string, unknown>;
  /**
   * Outputs from previously-completed steps, keyed by step key.
   * e.g. { brainstorm: { shortlisted: ["item1", "item2"] } }
   */
  stepOutputs?: Record<string, unknown>;
}

/**
 * Resolve VariableProgram expressions found in a step config input object.
 *
 * Calls `POST /api/invoke/VariableProgram/parse` then
 * `POST /api/invoke/VariableProgram/resolve` for every field value that
 * starts with `$` or `'`.  Non-expression values are passed through
 * unchanged.  Any parse/resolve error leaves the original expression
 * string in place (backward compat — callers can't break existing steps
 * that don't use expressions).
 *
 * @param input          - The StepRun.input JSON as a key-value record.
 * @param runtimeContext - Context gathered at step execution time.
 * @param invokeUrl      - Optional base URL for the API route (defaults to
 *                         relative `/api/invoke` which works server-side
 *                         within the Next.js edge/node runtime).
 * @returns              - A new record with expressions resolved in place.
 */
export async function resolveStepConfigExpressions(
  input: Record<string, unknown>,
  runtimeContext: StepRuntimeContext = {},
  invokeUrl = '/api/invoke',
): Promise<Record<string, unknown>> {
  const contextJson = JSON.stringify({
    pageId: runtimeContext.pageId ?? null,
    urlParams: runtimeContext.urlParams ?? {},
    session: runtimeContext.session ?? {},
    stepOutputs: runtimeContext.stepOutputs ?? {},
  });

  // Collect all fields that look like expressions so we can resolve them
  // in parallel.
  const entries = Object.entries(input);
  const expressionEntries = entries.filter(([, v]) => isVariableExpression(v));

  if (expressionEntries.length === 0) {
    return input;
  }

  // Resolve all expression fields concurrently.
  const resolved = await Promise.all(
    expressionEntries.map(async ([key, value]) => {
      const expression = (value as string).trim();

      try {
        // Step 1: parse the expression into a VariableProgram.
        const parseRes = await fetch(`${invokeUrl}/VariableProgram/parse`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ expression }),
        });

        if (!parseRes.ok) return [key, value] as [string, unknown];

        const parseData = await parseRes.json() as Record<string, unknown>;
        if (parseData.variant !== 'ok' || typeof parseData.program !== 'string') {
          return [key, value] as [string, unknown];
        }

        const programId = parseData.program as string;

        // Step 2: resolve the program with the runtime context.
        const resolveRes = await fetch(`${invokeUrl}/VariableProgram/resolve`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ program: programId, context: contextJson }),
        });

        if (!resolveRes.ok) return [key, value] as [string, unknown];

        const resolveData = await resolveRes.json() as Record<string, unknown>;
        if (resolveData.variant !== 'ok') {
          return [key, value] as [string, unknown];
        }

        const resolvedValue = resolveData.value ?? value;
        return [key, resolvedValue] as [string, unknown];
      } catch {
        // Network error or unexpected exception — keep original expression.
        return [key, value] as [string, unknown];
      }
    }),
  );

  // Merge resolved values back into the input object.
  const resolvedMap = Object.fromEntries(resolved);
  return { ...input, ...resolvedMap };
}

// ---------------------------------------------------------------------------
// React hook — client-side live preview
// ---------------------------------------------------------------------------

/**
 * React hook that provides a single-expression resolver wired to the
 * current page and session context.
 *
 * Suitable for VariablePickerWidget preview and step inspector forms.
 * Must be used inside a component that is a descendant of ClefProvider.
 *
 * @example
 * ```tsx
 * const { resolveExpression } = useVariableProgram();
 * const preview = await resolveExpression('$page.title');
 * ```
 */
export function useVariableProgram() {
  const invoke = useKernelInvoke();

  // Cache the last resolved program id for the same expression to avoid
  // redundant parse round-trips.
  const parseCache = useRef<Map<string, string>>(new Map());

  const resolveExpression = useCallback(
    async (expression: string): Promise<string> => {
      if (!expression || !isVariableExpression(expression)) {
        return expression;
      }

      const trimmed = expression.trim();

      try {
        // Parse phase — check cache first.
        let programId = parseCache.current.get(trimmed);

        if (!programId) {
          const parseResult = await invoke('VariableProgram', 'parse', { expression: trimmed });

          if (parseResult.variant !== 'ok' || typeof parseResult.program !== 'string') {
            // Not a valid expression — return unchanged.
            return expression;
          }

          programId = parseResult.program as string;
          parseCache.current.set(trimmed, programId);
        }

        // Resolve phase — build runtime context from what's available in the
        // browser.  pageId and urlParams are derived from the current URL;
        // session is not directly accessible client-side (no cookie parse),
        // so we pass an empty session object and let the server-side provider
        // handle session-sourced expressions via the API.
        const urlParams: Record<string, string> = {};
        if (typeof window !== 'undefined') {
          const searchParams = new URLSearchParams(window.location.search);
          searchParams.forEach((v, k) => { urlParams[k] = v; });
          // Extract path params heuristically: /admin/processes/:id -> id: <value>
          const pathParts = window.location.pathname.split('/').filter(Boolean);
          // Last non-empty segment is often the entity id.
          if (pathParts.length > 0) {
            urlParams['id'] = pathParts[pathParts.length - 1];
          }
        }

        const contextJson = JSON.stringify({
          pageId: urlParams['id'] ?? null,
          urlParams,
          session: {},
          stepOutputs: {},
        });

        const resolveResult = await invoke('VariableProgram', 'resolve', {
          program: programId,
          context: contextJson,
        });

        if (resolveResult.variant !== 'ok') {
          return expression;
        }

        return typeof resolveResult.value === 'string'
          ? resolveResult.value
          : expression;
      } catch {
        return expression;
      }
    },
    [invoke],
  );

  return { resolveExpression };
}
// isVariableProgramExpression — expression detection
// ---------------------------------------------------------------------------

/**
 * Returns true if the string looks like a VariableProgram expression.
 * The canonical syntax starts with `$` or `'` (single-quote sigil).
 */
export function isVariableProgramExpression(value: string | undefined): boolean {
  if (!value) return false;
  return value.startsWith('$') || value.startsWith("'");
}

// ---------------------------------------------------------------------------
// useVariableDefault hook
// ---------------------------------------------------------------------------

export interface UseVariableDefaultResult {
  resolvedDefault: string | undefined;
  loading: boolean;
}

/**
 * Resolve a form field's defaultValue at mount time.
 *
 * - If `defaultValue` is undefined or not a VariableProgram expression,
 *   `resolvedDefault` is set to `defaultValue` synchronously (no fetch).
 * - If `defaultValue` is a VariableProgram expression (starts with `$` or `'`),
 *   the hook calls VariableProgram/parse + resolve and returns the result.
 * - On resolution failure, falls back to the raw expression string so that
 *   literal defaults continue to work even if the VariableProgram kernel
 *   concept is unavailable.
 */
export function useVariableDefault(defaultValue: string | undefined): UseVariableDefaultResult {
  const [resolved, setResolved] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isVariableProgramExpression(defaultValue)) {
      // Not an expression — resolve synchronously as a literal value.
      setResolved(defaultValue);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    resolveExpression(defaultValue!)
      .then((v) => {
        if (!cancelled) setResolved(v);
      })
      .catch(() => {
        // Fallback: use the raw expression string as the default (backward compat).
        if (!cancelled) setResolved(defaultValue);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [defaultValue]);

  return { resolvedDefault: resolved, loading };
}
