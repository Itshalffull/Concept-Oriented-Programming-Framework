/**
 * ViewQueryVariableProvider — resolves $query.<name> expressions.
 *
 * Reads a named query result from context.queryResults. Query results are
 * placed into context by the view execution layer before variable programs
 * are resolved. The result may be a list of records or a single record
 * depending on the query's projection.
 *
 * Registered under PluginRegistry key "variable-source:query".
 * Boot sync registration is handled separately.
 */

import type { ArgSpec, PropertySpec, VariableSourceProvider } from './source-provider.interface.ts';

const ARG_SPEC: ArgSpec[] = [
  {
    name: 'name',
    type: 'string',
    required: true,
    description: 'Named query result key to read from context.queryResults',
  },
];

/** Common result record fields available on most query result items. */
const COMMON_RESULT_FIELDS: PropertySpec[] = [
  { name: 'id',        type: 'string', isRelation: false, description: 'Record identifier' },
  { name: 'title',     type: 'string', isRelation: false, description: 'Display title of the record' },
  { name: 'kind',      type: 'string', isRelation: false, description: 'Record kind or type discriminant' },
  { name: 'createdAt', type: 'string', isRelation: false, description: 'ISO 8601 creation timestamp' },
  { name: 'updatedAt', type: 'string', isRelation: false, description: 'ISO 8601 last-updated timestamp' },
];

export const viewQueryProvider: VariableSourceProvider = {
  kind: 'query',
  prefix: '$query',
  argSpec: ARG_SPEC,
  resolvedType: 'any[]',

  async resolve(
    args: Record<string, string>,
    context: Record<string, unknown>,
  ): Promise<unknown> {
    const name = args.name;
    if (name == null || name === '') return null;

    const queryResults = context.queryResults as Record<string, unknown> | undefined;
    if (queryResults == null) return null;

    return queryResults[name] ?? null;
  },

  async listProperties(
    _args: Record<string, string>,
  ): Promise<PropertySpec[]> {
    // Return the common result fields. Schema-specific fields would require
    // knowing which query was run — this information is not available at picker
    // time. The runtime layer may augment this list when the query name is known
    // and the result schema is inferrable.
    return COMMON_RESULT_FIELDS;
  },
};
