/**
 * ContextVariableProvider — resolves $ctx.<key> expressions.
 *
 * Reads an arbitrary value from the ambient context map (context.ambient).
 * Ambient values are placed into context by the hosting surface or process
 * runtime — they represent information that is neither page-specific, URL-
 * derived, session-based, nor tied to a process step output, but is still
 * meaningful at the point of variable resolution.
 *
 * Examples: current workspace ID, selected filter state, sidebar panel mode.
 *
 * Registered under PluginRegistry key "variable-source:context".
 * Boot sync registration is handled separately.
 */

import type { ArgSpec, PropertySpec, VariableSourceProvider } from './source-provider.interface.ts';

const ARG_SPEC: ArgSpec[] = [
  {
    name: 'key',
    type: 'string',
    required: true,
    description: 'Ambient context key to read (e.g. "workspaceId", "selectedFilter")',
  },
];

export const contextProvider: VariableSourceProvider = {
  kind: 'context',
  prefix: '$ctx',
  argSpec: ARG_SPEC,
  resolvedType: 'any',

  async resolve(
    args: Record<string, string>,
    context: Record<string, unknown>,
  ): Promise<unknown> {
    const key = args.key;
    if (key == null || key === '') return null;

    const ambient = context.ambient as Record<string, unknown> | undefined;
    if (ambient == null) return null;

    return ambient[key] ?? null;
  },

  async listProperties(
    args: Record<string, string>,
  ): Promise<PropertySpec[]> {
    // The ambientSchema context key carries per-key field schemas. This
    // information is only available at runtime, not during picker construction.
    // Return empty here; the runtime layer may supply augmented field lists
    // after calling listProperties() when context.ambientSchema[key] is known.
    void args;
    return [];
  },
};
