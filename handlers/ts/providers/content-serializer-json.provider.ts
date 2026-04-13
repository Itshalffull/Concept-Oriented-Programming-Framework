// JSON ContentSerializer provider — implements the `json-serialize` provider
// id for target="json". Walks the ContentNode tree rooted at rootNodeId and
// emits a pretty-printed JSON dump of {nodeId, schema, body, children: [...]}.
//
// Registration is driven by `syncs/app/register-content-serializers.sync`
// which dispatches ContentSerializer/register(provider: "json-serialize",
// target: "json") once PluginRegistry advertises the content-serializer
// plugin type at boot. The concrete tree-walk function lives in the shared
// module-level registry (see content-serializer-provider-registry.ts).

import {
  registerContentSerializerProvider,
  type ContentSerializerProviderFn,
  type FetchNode,
  type SerializerNode,
} from './content-serializer-provider-registry.ts';

export const CONTENT_SERIALIZER_PROVIDER_ID = 'json-serialize';
export const CONTENT_SERIALIZER_TARGET = 'json';

type SerializedNode = {
  nodeId: string;
  schema: string;
  body: string;
  children: SerializedNode[];
};

function walk(
  id: string,
  fetchNode: FetchNode,
  seen: Set<string>,
): SerializedNode | null {
  if (seen.has(id)) return null;
  seen.add(id);
  const node = fetchNode(id);
  if (!node) return null;
  return {
    nodeId: node.id,
    schema: node.schema ?? '',
    body: node.body ?? '',
    children: node.childIds
      .map((cid) => walk(cid, fetchNode, seen))
      .filter((c): c is SerializedNode => c != null),
  };
}

export const serializeJson: ContentSerializerProviderFn = (
  rootNodeId,
  fetchNode,
  config,
) => {
  const root = fetchNode(rootNodeId);
  if (!root) {
    return JSON.stringify({
      ok: false,
      target: CONTENT_SERIALIZER_TARGET,
      error: { message: `root node not found: ${rootNodeId}` },
    });
  }
  try {
    const tree = walk(rootNodeId, fetchNode, new Set());
    let pretty = true;
    if (config) {
      try {
        const opts = JSON.parse(config) as { pretty?: boolean };
        if (opts && typeof opts.pretty === 'boolean') pretty = opts.pretty;
      } catch {
        /* ignore bad config — fall back to pretty */
      }
    }
    return pretty
      ? JSON.stringify(tree, null, 2) + '\n'
      : JSON.stringify(tree);
  } catch (err) {
    return JSON.stringify({
      ok: false,
      target: CONTENT_SERIALIZER_TARGET,
      error: {
        message:
          (err as Error)?.message ?? 'unknown json serialization error',
      },
    });
  }
};

registerContentSerializerProvider(
  CONTENT_SERIALIZER_PROVIDER_ID,
  serializeJson,
);
