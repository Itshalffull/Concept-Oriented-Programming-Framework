/**
 * LiteralVariableProvider — resolves 'value' literal expressions.
 *
 * Returns the literal string value supplied in args.value directly, without
 * consulting any runtime context. Used for constant values embedded in
 * filter spec templates, DataSourceSpec template vars, and other places where
 * a fixed string is needed in an otherwise variable-driven expression.
 *
 * The canonical expression syntax for literals uses single quotes: 'hello'.
 *
 * Registered under PluginRegistry key "variable-source:literal".
 * Boot sync registration is handled separately.
 */

import type { ArgSpec, PropertySpec, VariableSourceProvider } from './source-provider.interface.ts';

const ARG_SPEC: ArgSpec[] = [
  {
    name: 'value',
    type: 'string',
    required: true,
    description: 'Literal string value to return at resolution time',
  },
];

export const literalProvider: VariableSourceProvider = {
  kind: 'literal',
  prefix: "'",
  argSpec: ARG_SPEC,
  resolvedType: 'string',

  async resolve(
    args: Record<string, string>,
    _context: Record<string, unknown>,
  ): Promise<unknown> {
    // No context needed — return the literal value directly.
    return args.value ?? null;
  },

  async listProperties(
    _args: Record<string, string>,
  ): Promise<PropertySpec[]> {
    // Literal values are scalar strings — no navigable sub-properties.
    return [];
  },
};
