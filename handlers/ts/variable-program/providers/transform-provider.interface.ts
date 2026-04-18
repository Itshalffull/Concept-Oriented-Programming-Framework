/**
 * VariableTransformProvider — interface for pluggable transform providers
 * registered with PluginRegistry under namespace "variable-transform".
 *
 * At resolution time, VariableProgram/resolve calls
 * PluginRegistry/get("variable-transform", kind) to find the provider,
 * then calls apply(value, args) to reshape the value produced by the
 * source + traversal pipeline.
 *
 * Providers are pure functions: apply() must never throw. On any error,
 * return the original value or a sensible default.
 */

export interface ArgSpec {
  /** Argument name — matches the key in the args Record passed to apply(). */
  name: string;
  /** Expected JavaScript type for validation and documentation. */
  type: 'string' | 'number' | 'boolean';
  /** Whether this argument must be supplied by the caller. */
  required: boolean;
  /** Default value used when the argument is omitted and required is false. */
  default?: string;
}

export interface VariableTransformProvider {
  /** PluginRegistry key — must match the kind used in text syntax (e.g. "format"). */
  kind: string;
  /** Argument schema — describes what arguments apply() accepts. */
  argSpec: ArgSpec[];
  /**
   * Reshape the resolved value.
   *
   * @param value  — the value produced by the source + traversal pipeline
   * @param args   — caller-supplied arguments, keyed by ArgSpec.name
   * @returns        the transformed value; NEVER throws
   */
  apply(value: unknown, args: Record<string, string>): unknown;
}
