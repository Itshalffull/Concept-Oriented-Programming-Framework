// @clef-handler style=functional
// ContentSerializer Concept Implementation
// Manages a registry of serialization providers keyed by output format target
// (e.g. markdown, html, json, pdf). Dispatches serialize() requests to the
// registered provider for the given target and returns stub bytes — real
// provider tree-walking is wired via sync/perform in a later layer.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import {
  getContentSerializerProvider,
  type SerializerNode,
  type FetchNode,
} from '../providers/content-serializer-provider-registry.ts';

type Result = { variant: string; [key: string]: unknown };

function parseChildIds(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((v) => String(v));
  if (typeof raw === 'string') {
    if (raw.trim() === '') return [];
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v.map((x) => String(x)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function buildFetchNode(
  nodeRows: Array<Record<string, unknown>>,
  outlineRows: Array<Record<string, unknown>>,
): FetchNode {
  const byNode = new Map<string, Record<string, unknown>>();
  for (const r of nodeRows) {
    const key = String((r.key ?? r.node ?? r.id) ?? '');
    if (key) byNode.set(key, r);
  }
  const outlineByNode = new Map<string, Record<string, unknown>>();
  for (const r of outlineRows) {
    const key = String((r.key ?? r.node) ?? '');
    if (key) outlineByNode.set(key, r);
  }
  return (id: string): SerializerNode | null => {
    const node = byNode.get(id);
    if (!node) return null;
    const outline = outlineByNode.get(id);
    const schema = String(
      node.schema ?? node.type ?? (outline ? outline.schema : '') ?? '',
    );
    const body = String(
      node.body ?? node.content ?? '',
    );
    const childIds = parseChildIds(outline ? outline.children : []);
    return { id, schema, body, childIds };
  };
}

let idCounter = 0;
function nextId(): string {
  return `content-serializer-provider-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {

  register(input: Record<string, unknown>) {
    const provider = input.provider != null ? String(input.provider) : '';
    const target = input.target != null ? String(input.target) : '';
    const config = input.config != null ? String(input.config) : '';

    if (!provider || provider.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'provider must be a non-empty string',
      }) as StorageProgram<Result>;
    }
    if (!target || target.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'target must be a non-empty string',
      }) as StorageProgram<Result>;
    }

    // Check for duplicate: is there already a provider registered for this target?
    let p = createProgram();
    p = get(p, 'byTarget', target, 'existing');
    return branch(p,
      (b) => !!b.existing,
      (b) => complete(b, 'duplicate', { provider, target }) as StorageProgram<Result>,
      (b) => {
        const id = nextId();
        let b2 = put(b, 'providers', id, { id, name: provider, target, providerConfig: config });
        b2 = put(b2, 'byTarget', target, id);
        return complete(b2, 'ok', { id }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  serialize(input: Record<string, unknown>) {
    const target = input.target != null ? String(input.target) : '';
    const rootNodeId = input.rootNodeId != null ? String(input.rootNodeId) : '';

    if (!target || target.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'target must be a non-empty string',
      }) as StorageProgram<Result>;
    }
    if (!rootNodeId || rootNodeId.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'rootNodeId must be a non-empty string',
      }) as StorageProgram<Result>;
    }

    // Look up registered provider for this target, then — if one exists —
    // load ContentNode + Outline snapshots and hand them to the registered
    // tree-walk provider function via the module-level registry.
    let p = createProgram();
    p = get(p, 'byTarget', target, 'providerId');
    return branch(p,
      (b) => !b.providerId,
      (b) => complete(b, 'no_provider', { target }) as StorageProgram<Result>,
      (b) => {
        const providerId = String(b.providerId);
        // Load the provider record to get its name + config.
        let b2 = get(b, 'providers', providerId, 'providerRecord');
        // Load ContentNode + Outline snapshots. These live in other concepts'
        // relations; we read them via storage-layer find() so the walk can
        // assemble an in-memory tree and hand it to the provider function.
        b2 = find(b2, 'node', {}, 'allNodes');
        b2 = find(b2, 'outline', {}, 'allOutline');
        return completeFrom(b2, 'ok', (bindings) => {
          const record = (bindings.providerRecord ?? {}) as Record<string, unknown>;
          const providerName = String(record.name ?? '');
          const providerConfig = String(record.providerConfig ?? '');
          const fn = providerName
            ? getContentSerializerProvider(providerName)
            : undefined;
          if (!fn) {
            // Fall back to stub bytes when the concrete provider function
            // hasn't been loaded (e.g. kernel-only boot without providers).
            const bytes = JSON.stringify({
              target,
              rootNodeId,
              providerId,
              provider: providerName,
              stub: true,
            });
            return { variant: 'ok', bytes };
          }
          const nodeRows = (bindings.allNodes ?? []) as Array<Record<string, unknown>>;
          const outlineRows = (bindings.allOutline ?? []) as Array<Record<string, unknown>>;
          const fetchNode = buildFetchNode(nodeRows, outlineRows);
          // If the root doesn't exist in the snapshot AND there is at least
          // some content loaded, surface an error variant so callers can
          // distinguish "missing root" from "empty store".
          if (nodeRows.length > 0 && !fetchNode(rootNodeId)) {
            return { variant: 'error', message: `root node not found: ${rootNodeId}` };
          }
          try {
            const bytes = fn(rootNodeId, fetchNode, providerConfig);
            return { variant: 'ok', bytes };
          } catch (err) {
            return {
              variant: 'error',
              message:
                (err as Error)?.message ?? 'provider threw during serialize',
            };
          }
        }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  deregister(input: Record<string, unknown>) {
    const target = input.target != null ? String(input.target) : '';

    if (!target || target.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'target must be a non-empty string',
      }) as StorageProgram<Result>;
    }

    // Look up the index entry for this target
    let p = createProgram();
    p = get(p, 'byTarget', target, 'existing');
    return branch(p,
      (b) => !!b.existing,
      (b) => {
        const id = String(b.existing);
        let b2 = del(b, 'byTarget', target);
        b2 = del(b2, 'providers', id);
        return complete(b2, 'ok', {}) as StorageProgram<Result>;
      },
      (b) => complete(b, 'not_found', { target }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  listTargets(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'byTarget', {}, 'allEntries');
    return completeFrom(p, 'ok', (b) => {
      const entries = (b.allEntries || []) as Array<{ key: string }>;
      const targets = entries.map((e) => e.key).sort();
      return { targets };
    }) as StorageProgram<Result>;
  },
};

export const contentSerializerHandler = autoInterpret(_handler);
