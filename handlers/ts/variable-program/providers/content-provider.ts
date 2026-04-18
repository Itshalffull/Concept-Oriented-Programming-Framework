/**
 * ContentVariableProvider — resolves $content[nodeId] expressions.
 *
 * Reads an arbitrary ContentNode record by ID from context.contentNodes.
 * Unlike PageVariableProvider (which uses context.pageId to derive the node),
 * this provider takes an explicit nodeId argument — enabling expressions that
 * reference a specific linked entity rather than the current page.
 *
 * Registered under PluginRegistry key "variable-source:content".
 * Boot sync registration is handled separately.
 */

import type { ArgSpec, PropertySpec, VariableSourceProvider } from './source-provider.interface.ts';

const ARG_SPEC: ArgSpec[] = [
  {
    name: 'nodeId',
    type: 'string',
    required: true,
    description: 'Content node identifier to read',
  },
];

/** Common ContentNode fields always available regardless of schema. */
const COMMON_CONTENT_NODE_FIELDS: PropertySpec[] = [
  { name: 'id',          type: 'string',   isRelation: false, description: 'Unique node identifier' },
  { name: 'title',       type: 'string',   isRelation: false, description: 'Node title' },
  { name: 'kind',        type: 'string',   isRelation: false, description: 'Content node kind' },
  { name: 'status',      type: 'string',   isRelation: false, description: 'Lifecycle status' },
  { name: 'createdAt',   type: 'string',   isRelation: false, description: 'ISO 8601 creation timestamp' },
  { name: 'updatedAt',   type: 'string',   isRelation: false, description: 'ISO 8601 last-updated timestamp' },
  { name: 'schemas',     type: 'string[]', isRelation: false, description: 'Schema names applied to this node' },
  { name: 'body',        type: 'string',   isRelation: false, description: 'Raw body text or serialized block tree' },
  { name: 'author',      type: 'string',   isRelation: true,  description: 'Identifier of the user who created this node' },
];

export const contentProvider: VariableSourceProvider = {
  kind: 'content',
  prefix: '$content',
  argSpec: ARG_SPEC,
  resolvedType: 'ContentNode',

  async resolve(
    args: Record<string, string>,
    context: Record<string, unknown>,
  ): Promise<unknown> {
    const nodeId = args.nodeId;
    if (nodeId == null || nodeId === '') return null;

    const contentNodes = context.contentNodes as Record<string, unknown> | undefined;
    if (contentNodes == null) return null;

    return contentNodes[nodeId] ?? null;
  },

  async listProperties(
    _args: Record<string, string>,
  ): Promise<PropertySpec[]> {
    // Return the stable set of common ContentNode fields. Schema-specific
    // fields require a live concept call that providers do not make. The
    // runtime layer may augment this list when it has the nodeId and can
    // resolve the node's active schema.
    return COMMON_CONTENT_NODE_FIELDS;
  },
};
