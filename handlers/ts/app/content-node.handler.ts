// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ContentNode Concept Implementation
// Per spec §2.1: There is one entity — ContentNode. There are no entity types
// and no bundles. Identity comes from which Schemas are applied (via Schema
// concept), not from a "type" field. ContentNode is a universal entity pool.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete, completeFrom,
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
      (b) => complete(b, 'exists', { message: 'already exists' }),
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
    const node = input.node as string;
    const metadata = input.metadata as string;

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

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'node', {}, 'items');
    return completeFrom(p, 'ok', (bindings) => ({ items: JSON.stringify((bindings.items as Array<Record<string, unknown>>) || []) })) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  stats(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'node', {}, 'items');
    return completeFrom(p, 'ok', (bindings) => ({ items: JSON.stringify((bindings.items as Array<Record<string, unknown>>) || []) })) as StorageProgram<{ variant: string; [key: string]: unknown }>;
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

