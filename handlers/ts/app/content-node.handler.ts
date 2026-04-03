// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ContentNode Concept Implementation
// Per spec §2.1: There is one entity — ContentNode. There are no entity types
// and no bundles. Identity comes from which Schemas are applied (via Schema
// concept), not from a "type" field. ContentNode is a universal entity pool.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

function parseStructuredValue(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

const _contentNodeHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    if (!input.node || (typeof input.node === 'string' && (input.node as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'node is required' }) as StorageProgram<Result>;
    }
    const node = input.node as string;
    const type = (input.type as string | undefined) ?? '';
    const content = (input.content as string | undefined) ?? '';
    const metadata = (input.metadata as string | undefined) ?? '';
    const createdBy = (input.createdBy as string | undefined) ?? 'system';

    let p = createProgram();
    p = spGet(p, 'node', node, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { message: 'already exists' }),
      (b) => {
        const now = new Date().toISOString();
        let b2 = put(b, 'node', node, {
          node, type, content, metadata, createdBy,
          createdAt: now,
          updatedAt: now,
        });
        return complete(b2, 'ok', { node });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  update(input: Record<string, unknown>) {
    const node = input.node as string;
    const content = input.content as string;

    let p = createProgram();
    p = spGet(p, 'node', node, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'node', node, {
          content,
          updatedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { node });
      },
      (b) => complete(b, 'notfound', { message: 'Node not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  delete(input: Record<string, unknown>) {
    const node = input.node as string;

    let p = createProgram();
    p = spGet(p, 'node', node, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = del(b, 'node', node);
        return complete(b2, 'ok', { node });
      },
      (b) => complete(b, 'notfound', { message: 'Node not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  get(input: Record<string, unknown>) {
    const node = input.node as string;

    let p = createProgram();
    p = spGet(p, 'node', node, 'record');
    p = branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { node: record.node as string, type: record.type as string, content: record.content as string, metadata: (record.metadata as string) || '' };
        }),
      (b) => complete(b, 'notfound', { message: 'Node not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  setMetadata(input: Record<string, unknown>) {
    if (!input.metadata || (typeof input.metadata === 'string' && (input.metadata as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'metadata is required' }) as StorageProgram<Result>;
    }
    const metadataStr = input.metadata as string;
    try {
      const parsed = JSON.parse(metadataStr);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && Object.keys(parsed).length === 0) {
        return complete(createProgram(), 'error', { message: 'metadata must not be empty' }) as StorageProgram<Result>;
      }
    } catch {
      return complete(createProgram(), 'error', { message: 'metadata must be valid JSON' }) as StorageProgram<Result>;
    }
    const node = input.node as string;
    const metadata = metadataStr;

    let p = createProgram();
    p = spGet(p, 'node', node, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'node', node, {
          metadata,
          updatedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { node });
      },
      (b) => complete(b, 'notfound', { message: 'Node not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(input: Record<string, unknown>) {
    const limit = typeof input.limit === 'number' ? input.limit : undefined;
    const offset = typeof input.offset === 'number' ? input.offset : undefined;
    const sortField = typeof input.sortField === 'string' ? input.sortField : undefined;
    const sortOrder = input.sortOrder === 'asc' || input.sortOrder === 'desc' ? input.sortOrder : undefined;

    const options = (limit != null || offset != null || sortField)
      ? { limit, offset, sort: sortField ? { field: sortField, order: sortOrder ?? 'desc' as const } : undefined }
      : undefined;

    let p = createProgram();
    p = find(p, 'node', {}, 'items', options);
    return completeFrom(p, 'ok', (bindings) => ({ items: JSON.stringify((bindings.items as Array<Record<string, unknown>>) || []) })) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  stats(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'node', {}, 'items');
    return completeFrom(p, 'ok', (bindings) => ({ items: JSON.stringify((bindings.items as Array<Record<string, unknown>>) || []) })) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listBySchema(input: Record<string, unknown>) {
    const schema = input.schema as string;
    if (!schema || schema.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'schema is required' }) as StorageProgram<Result>;
    }

    const limit = typeof input.limit === 'number' ? input.limit : undefined;
    const offset = typeof input.offset === 'number' ? input.offset : undefined;

    let p = createProgram();
    // Fetch all memberships and all nodes server-side
    p = find(p, 'membership', {}, 'allMemberships');
    p = find(p, 'node', {}, 'allNodes');
    // Join: filter memberships by schema, then match to nodes
    p = mapBindings(p, (bindings) => {
      const memberships = (bindings.allMemberships as Array<Record<string, unknown>>) || [];
      const nodes = (bindings.allNodes as Array<Record<string, unknown>>) || [];

      // Build entity→schemas map from all memberships
      const schemasByEntity = new Map<string, string[]>();
      for (const m of memberships) {
        const eid = m.entity_id as string;
        const s = m.schema as string;
        if (!eid || !s) continue;
        const existing = schemasByEntity.get(eid) ?? [];
        existing.push(s);
        schemasByEntity.set(eid, existing);
      }

      // Collect entity IDs that have the target schema
      const matchingIds = new Set<string>();
      for (const m of memberships) {
        if (m.schema === schema) {
          matchingIds.add(m.entity_id as string);
        }
      }

      // Filter nodes and enrich with schemas
      let results = nodes
        .filter(n => matchingIds.has(n.node as string))
        .map(n => ({
          ...n,
          schemas: schemasByEntity.get(n.node as string) ?? [],
        }));

      // Apply pagination
      const start = offset ?? 0;
      if (limit != null) {
        results = results.slice(start, start + limit);
      } else if (start > 0) {
        results = results.slice(start);
      }

      return JSON.stringify(results);
    }, 'enrichedItems');
    return completeFrom(p, 'ok', (bindings) => ({ items: bindings.enrichedItems as string })) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  changeType(input: Record<string, unknown>) {
    const node = input.node as string;
    const type = input.type as string;

    let p = createProgram();
    p = spGet(p, 'node', node, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'node', node, {
          type,
          updatedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { node });
      },
      (b) => complete(b, 'notfound', { message: 'Node not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const contentNodeHandler = autoInterpret(_contentNodeHandler);

