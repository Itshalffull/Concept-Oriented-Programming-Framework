/**
 * VariableSourceProvider interface — shared types for all built-in source providers.
 *
 * Source providers are registered via PluginRegistry under the namespace
 * "variable-source". At resolution time, VariableProgram/resolve calls
 * PluginRegistry/get("variable-source", kind) to locate the provider.
 *
 * Registration via PluginRegistry happens in boot syncs (separate card).
 * These files are provider implementations only.
 *
 * See architecture doc Section 10.1 for VariableProgram monad patterns.
 */

/**
 * ArgSpec describes a single argument that a source provider accepts.
 * Used by the VariablePickerWidget to build the argument entry form.
 */
export interface ArgSpec {
  name: string;
  type: string;        // "string" | "number" | "boolean"
  required: boolean;
  description?: string;
}

/**
 * PropertySpec describes a navigable property on a source provider's output.
 * Used by the VariablePickerWidget middle panel to list sub-fields the user
 * can append as .get() traversal steps.
 */
export interface PropertySpec {
  name: string;
  type: string;        // e.g. "string" | "number" | "boolean" | "ContentNode" | "any"
  isRelation: boolean; // true → traversing this field follows a relation (linked entity)
  description?: string;
}

/**
 * VariableSourceProvider — the contract every source provider must satisfy.
 *
 * Providers are plain objects (not concept handlers). They are registered
 * with PluginRegistry at boot time by a dedicated sync. At runtime,
 * VariableProgram/resolve calls the provider's resolve() with the args
 * extracted from the source instruction and the ambient resolution context.
 */
export interface VariableSourceProvider {
  /**
   * PluginRegistry key used when registering and looking up this provider.
   * Matches the sourceKind string used in VariableProgram/from().
   * Examples: "page", "url", "step", "session", "literal", "content", "query", "context"
   */
  kind: string;

  /**
   * Canonical expression text prefix for this source.
   * Examples: "$page", "$url", "$session", "'" (single-quote for literals)
   */
  prefix: string;

  /**
   * Argument schema for the VariablePickerWidget argument entry panel.
   * Empty array means the source needs no arguments (e.g. "page", "session").
   */
  argSpec: ArgSpec[];

  /**
   * Declared output type for static inference by VariableProgram/typeCheck.
   * Common values: "ContentNode", "string", "Session", "any", "any[]"
   */
  resolvedType: string;

  /**
   * Resolve the source to a concrete value.
   *
   * @param args    - Arguments extracted from the source instruction's args object.
   *                  Field names match the ArgSpec.name declarations above.
   * @param context - Ambient runtime context. Providers read from well-known keys:
   *                  - context.pageId        (string) — current page identifier
   *                  - context.urlParams     (Record<string,string>) — URL path/query params
   *                  - context.queryResults  (Record<string,unknown>) — named query results
   *                  - context.stepOutputs   (Record<string,string>) — step output JSON strings
   *                  - context.stepSchema    (Record<string,PropertySpec[]>) — step output schemas
   *                  - context.session       (object) — current user session
   *                  - context.ambient       (Record<string,unknown>) — arbitrary ambient values
   *                  - context.ambientSchema (Record<string,PropertySpec[]>) — ambient value schemas
   * @returns Resolved value, or null when the value is absent from context.
   *          Never throws — return null on missing context fields.
   */
  resolve(args: Record<string, string>, context: Record<string, unknown>): Promise<unknown>;

  /**
   * List navigable properties for the VariablePickerWidget middle panel.
   *
   * Called with the current args (which may be partially filled). Providers
   * should return field specs for the type their resolve() produces. When
   * context-dependent (e.g. schema depends on pageId), providers may return
   * a reasonable default set when args are missing.
   *
   * @param args - Arguments currently configured for this source (may be partial).
   * @returns Array of PropertySpec, or empty array when the source value is a scalar.
   */
  listProperties(args: Record<string, string>): Promise<PropertySpec[]>;
}
