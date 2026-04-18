/**
 * PageVariableProvider — resolves $page expressions.
 *
 * Reads the current page's ContentNode record from context.pageId. Returns
 * the full ContentNode record so subsequent .get() traversal steps can
 * access any field on the page (title, status, schema fields, etc.).
 *
 * Registered under PluginRegistry key "variable-source:page".
 * Boot sync registration is handled separately.
 */

import type { ArgSpec, PropertySpec, VariableSourceProvider } from './source-provider.interface.ts';

/** Common ContentNode fields always available regardless of schema. */
const COMMON_CONTENT_NODE_FIELDS: PropertySpec[] = [
  { name: 'id',          type: 'string',   isRelation: false, description: 'Unique node identifier' },
  { name: 'title',       type: 'string',   isRelation: false, description: 'Page title' },
  { name: 'kind',        type: 'string',   isRelation: false, description: 'Content node kind (e.g. "page", "concept")' },
  { name: 'status',      type: 'string',   isRelation: false, description: 'Lifecycle status of the page' },
  { name: 'createdAt',   type: 'string',   isRelation: false, description: 'ISO 8601 creation timestamp' },
  { name: 'updatedAt',   type: 'string',   isRelation: false, description: 'ISO 8601 last-updated timestamp' },
  { name: 'schemas',     type: 'string[]', isRelation: false, description: 'Schema names applied to this node' },
  { name: 'body',        type: 'string',   isRelation: false, description: 'Raw body text or serialized block tree' },
  { name: 'author',      type: 'string',   isRelation: true,  description: 'Identifier of the user who created this page' },
];

export const pageProvider: VariableSourceProvider = {
  kind: 'page',
  prefix: '$page',
  argSpec: [] as ArgSpec[],
  resolvedType: 'ContentNode',

  async resolve(
    _args: Record<string, string>,
    context: Record<string, unknown>,
  ): Promise<unknown> {
    const pageId = context.pageId;
    if (pageId == null) return null;

    // The ContentNode record is expected to be pre-loaded into context under
    // a "contentNodes" map by the resolution runtime. Fall back to null when
    // the map is absent or the specific page is not present.
    const contentNodes = context.contentNodes as Record<string, unknown> | undefined;
    if (contentNodes == null) return null;

    return contentNodes[pageId as string] ?? null;
  },

  async listProperties(
    _args: Record<string, string>,
  ): Promise<PropertySpec[]> {
    // Return the stable set of common ContentNode fields. Schema-specific
    // fields (from Schema/listFields) would require a live concept call,
    // which providers do not make. The runtime layer may augment this list
    // after calling listProperties() when a pageId is available.
    return COMMON_CONTENT_NODE_FIELDS;
  },
};
