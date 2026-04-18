/**
 * UrlVariableProvider — resolves $url.<param> expressions.
 *
 * Reads a named URL path or query parameter from context.urlParams.
 * The parameter name is supplied in args.param at construction time.
 *
 * Registered under PluginRegistry key "variable-source:url".
 * Boot sync registration is handled separately.
 */

import type { ArgSpec, PropertySpec, VariableSourceProvider } from './source-provider.interface.ts';

const ARG_SPEC: ArgSpec[] = [
  {
    name: 'param',
    type: 'string',
    required: true,
    description: 'URL path or query parameter name to read',
  },
];

export const urlProvider: VariableSourceProvider = {
  kind: 'url',
  prefix: '$url',
  argSpec: ARG_SPEC,
  resolvedType: 'string',

  async resolve(
    args: Record<string, string>,
    context: Record<string, unknown>,
  ): Promise<unknown> {
    const param = args.param;
    if (param == null || param === '') return null;

    const urlParams = context.urlParams as Record<string, string> | undefined;
    if (urlParams == null) return null;

    return urlParams[param] ?? null;
  },

  async listProperties(
    _args: Record<string, string>,
  ): Promise<PropertySpec[]> {
    // URL parameter values are scalar strings — no navigable sub-properties.
    return [];
  },
};
