// Shared module-level registry for ContentSerializer providers keyed by
// target format id (e.g. "markdown", "html", "json", "pdf").
//
// Each provider self-registers at import/boot time by calling
// `registerContentSerializerProvider`. The ContentSerializer concept
// handler dispatches through this registry when handling `serialize`,
// keeping concept state (the providers/byTarget relations) independent
// from the concrete serialization implementations.
//
// Contract:
//   - Input: rootNodeId plus a `fetchNode` callback the provider uses to
//     read each ContentNode + its child ids during tree traversal. The
//     handler populates `fetchNode` from an already-materialized snapshot
//     of the ContentNode + Outline relations (loaded via StorageProgram
//     `find`) so the provider itself can stay synchronous and pure.
//   - Output: serialized bytes as a UTF-8 string (or base64 for binary
//     targets). On failure providers MUST NOT throw — they return a
//     structured error envelope `{ ok: false, error: { message } }`
//     encoded as JSON bytes so callers can distinguish soft failures
//     from storage-layer errors surfaced by the handler.

export type SerializerNode = {
  id: string;
  schema: string;
  body: string;
  childIds: string[];
};

export type FetchNode = (id: string) => SerializerNode | null;

export type ContentSerializerProviderFn = (
  rootNodeId: string,
  fetchNode: FetchNode,
  config?: string,
) => string;

const registry = new Map<string, ContentSerializerProviderFn>();

export function registerContentSerializerProvider(
  id: string,
  fn: ContentSerializerProviderFn,
): void {
  registry.set(id, fn);
}

export function getContentSerializerProvider(
  id: string,
): ContentSerializerProviderFn | undefined {
  return registry.get(id);
}

export function listContentSerializerProviders(): string[] {
  return [...registry.keys()].sort();
}

export function clearContentSerializerProviders(): void {
  registry.clear();
}
