/**
 * DataSource template interpolation via VariableProgram expression inference.
 *
 * Authors write `{{varName}}` in DataSourceSpec config strings. This module
 * replaces the naive string-replacement engine with one that:
 *
 *   1. Finds every `{{...}}` token in a config string.
 *   2. Infers a VariableProgram expression from the token's variable name:
 *        - `{{session.userId}}`      → "$session.userId"
 *        - `{{stepKey.field}}`       → "$step.stepKey.field"  (dot-separated, first segment is stepKey)
 *        - `{{varName}}`             → "$url.varName"          (plain name → URL context by default)
 *   3. Calls `VariableProgram.parse(expression)` to produce a typed program.
 *   4. Calls `VariableProgram.resolve(program, context)` to get the value.
 *   5. Substitutes the resolved value into the config string.
 *
 * Backward compat: if resolution fails (missing context key, parse error, etc.)
 * the original `{{varName}}` token is left unreplaced rather than erroring.
 *
 * The DSL string form stays unchanged — authors still write `{{varName}}`.
 * Only the resolution engine underneath changes.
 *
 * See architecture doc Section 10.1 for concept patterns.
 */

// ---------------------------------------------------------------------------
// VariableProgram — lightweight internal implementation
//
// Until a first-class VariableProgram concept lands in the spec layer,
// this module owns the parse + resolve semantics.  The public interface is
// intentionally minimal so it can be swapped for a real VariableProgram
// kernel call when that concept is created.
// ---------------------------------------------------------------------------

export interface VariableProgram {
  /** Raw expression string, e.g. "$url.entityId" */
  expression: string;
  /** Top-level namespace: "url" | "step" | "session" */
  namespace: 'url' | 'step' | 'session';
  /** Remaining path segments after the namespace */
  path: string[];
}

/**
 * Infer a VariableProgram expression string from a `{{...}}` variable name
 * according to the mapping rules:
 *
 *   - `{{session.X}}`    → `$session.X`
 *   - `{{step.X.Y}}`     → `$step.X.Y`   (explicit $step prefix)
 *   - `{{X.Y}}`          → `$step.X.Y`   (dot inside name → step context)
 *   - `{{X}}`            → `$url.X`       (plain name → URL context)
 */
export function inferExpression(varName: string): string {
  // Explicit session prefix
  if (varName.startsWith('session.')) {
    return `$${varName}`;
  }

  // Explicit step prefix
  if (varName.startsWith('step.')) {
    return `$${varName}`;
  }

  // Dot-separated (no known prefix) → treat first segment as stepKey
  if (varName.includes('.')) {
    return `$step.${varName}`;
  }

  // Plain identifier → URL context
  return `$url.${varName}`;
}

/**
 * Parse a VariableProgram expression string into a typed VariableProgram.
 * Returns null if the expression is malformed.
 *
 * Valid forms:
 *   $url.<key>
 *   $step.<stepKey>[.<field>]*
 *   $session.<key>[.<subkey>]*
 */
export function parseVariableProgram(expression: string): VariableProgram | null {
  if (!expression.startsWith('$')) return null;

  const withoutDollar = expression.slice(1); // e.g. "url.entityId"
  const dotIdx = withoutDollar.indexOf('.');
  if (dotIdx === -1) return null;

  const namespace = withoutDollar.slice(0, dotIdx);
  if (namespace !== 'url' && namespace !== 'step' && namespace !== 'session') return null;

  const rest = withoutDollar.slice(dotIdx + 1);
  if (!rest) return null;

  const path = rest.split('.');

  return { expression, namespace: namespace as VariableProgram['namespace'], path };
}

/**
 * Resolution context passed to `resolveVariableProgram`.
 *
 * - `url`     — flat string map of URL / route parameters (and generic context vars)
 * - `step`    — nested map: stepKey → { fieldName: value }
 * - `session` — flat string map of session-level values (e.g. userId)
 */
export interface VariableResolutionContext {
  url?: Record<string, string>;
  step?: Record<string, Record<string, string>>;
  session?: Record<string, string>;
}

/**
 * Resolve a parsed VariableProgram against a context.
 * Returns the string value on success, or null if the path cannot be resolved.
 */
export function resolveVariableProgram(
  program: VariableProgram,
  ctx: VariableResolutionContext,
): string | null {
  switch (program.namespace) {
    case 'url': {
      const key = program.path[0];
      if (!key) return null;
      const value = ctx.url?.[key];
      return value !== undefined ? String(value) : null;
    }

    case 'step': {
      const [stepKey, ...rest] = program.path;
      if (!stepKey) return null;
      const stepObj = ctx.step?.[stepKey];
      if (stepObj === undefined) return null;
      if (rest.length === 0) {
        // No subfield — step output is a scalar
        return typeof stepObj === 'string' ? stepObj : null;
      }
      const fieldKey = rest.join('.');
      const fieldValue = (stepObj as Record<string, string>)[fieldKey];
      return fieldValue !== undefined ? String(fieldValue) : null;
    }

    case 'session': {
      const key = program.path.join('.');
      const value = ctx.session?.[key];
      return value !== undefined ? String(value) : null;
    }
  }
}

// ---------------------------------------------------------------------------
// Public interpolation API
// ---------------------------------------------------------------------------

/**
 * Resolve a single `{{varName}}` token.
 *
 * 1. Infer a VariableProgram expression from varName.
 * 2. Parse the expression.
 * 3. Resolve against ctx.
 * 4. Return the resolved string, or null on any failure (caller leaves token unreplaced).
 */
export function resolveToken(varName: string, ctx: VariableResolutionContext): string | null {
  try {
    const expression = inferExpression(varName);
    const program = parseVariableProgram(expression);
    if (!program) return null;
    return resolveVariableProgram(program, ctx);
  } catch {
    // Never propagate errors — leave the token unreplaced
    return null;
  }
}

/**
 * Interpolate all `{{varName}}` tokens in `configStr` using the resolution context.
 *
 * Tokens that cannot be resolved are left unreplaced (backward-compatible).
 *
 * @param configStr - The raw config string containing `{{varName}}` placeholders.
 * @param ctx       - Variable resolution context (url, step, session namespaces).
 * @returns         - The interpolated string.
 */
export function interpolateDataSourceConfig(
  configStr: string,
  ctx: VariableResolutionContext,
): string {
  return configStr.replace(/\{\{([\w.]+)\}\}/g, (_match, varName: string) => {
    const resolved = resolveToken(varName, ctx);
    return resolved !== null ? resolved : `{{${varName}}}`;
  });
}

/**
 * Build a VariableResolutionContext from a flat bindings map (the legacy format
 * used by DataSourceSpec/bind, where callers pass e.g. `{"entityId":"abc"}`).
 *
 * Flat keys are placed in the `url` namespace so that `{{entityId}}` → `$url.entityId`
 * resolves correctly.  Keys with a `session.` prefix are placed in `session`.
 * Keys with a `step.` prefix are NOT supported via flat bindings — they require
 * the structured `step` namespace directly.
 */
export function buildContextFromFlatBindings(
  bindings: Record<string, string>,
): VariableResolutionContext {
  const url: Record<string, string> = {};
  const session: Record<string, string> = {};

  for (const [key, value] of Object.entries(bindings)) {
    if (key.startsWith('session.')) {
      session[key.slice('session.'.length)] = value;
    } else {
      // Everything else goes into url namespace (matches legacy behavior)
      url[key] = value;
    }
  }

  return {
    url: Object.keys(url).length > 0 ? url : undefined,
    session: Object.keys(session).length > 0 ? session : undefined,
  };
}

/**
 * Convenience overload for callers that have a simple flat
 * `Record<string, string>` context (e.g. ViewRenderer's `context` prop).
 *
 * All keys are treated as `url`-namespace variables.
 */
export function interpolateWithFlatContext(
  configStr: string,
  flatContext: Record<string, string>,
): string {
  return interpolateDataSourceConfig(configStr, { url: flatContext });
}
