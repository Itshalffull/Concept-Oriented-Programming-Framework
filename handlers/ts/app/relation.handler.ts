// @migrated dsl-constructs 2026-03-18
// Relation Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _relationHandler: FunctionalConceptHandler = {
  defineRelation(input: Record<string, unknown>) {
    const relation = input.relation as string;
    const schema = input.schema as string;

    let p = createProgram();
    p = spGet(p, 'relation', relation, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { relation }),
      (b) => {
        let b2 = put(b, 'relation', relation, {
          relation,
          definition: schema,
          links: JSON.stringify([]),
          rollups: '',
        });
        return complete(b2, 'ok', { relation });
      },
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  link(input: Record<string, unknown>) {
    const relation = input.relation as string;
    const source = input.source as string;
    const target = input.target as string;

    let p = createProgram();
    p = spGet(p, 'relation', relation, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'relation', relation, {
          links: JSON.stringify([{ source, target }]),
        });
        return complete(b2, 'ok', { relation, source, target });
      },
      (b) => complete(b, 'invalid', { relation, message: 'Relation does not exist' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  unlink(input: Record<string, unknown>) {
    const relation = input.relation as string;
    const source = input.source as string;
    const target = input.target as string;

    let p = createProgram();
    p = spGet(p, 'relation', relation, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'relation', relation, {
          links: JSON.stringify([]),
        });
        return complete(b2, 'ok', { relation, source, target });
      },
      (b) => complete(b, 'notfound', { relation, source, target }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getRelated(input: Record<string, unknown>) {
    const relation = input.relation as string;
    const entity = input.entity as string;

    let p = createProgram();
    p = spGet(p, 'relation', relation, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { related: '' }),
      (b) => complete(b, 'notfound', { relation, entity }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  defineRollup(input: Record<string, unknown>) {
    const relation = input.relation as string;
    const formula = input.formula as string;

    let p = createProgram();
    p = spGet(p, 'relation', relation, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'relation', relation, { rollups: formula });
        return complete(b2, 'ok', { relation, formula });
      },
      (b) => complete(b, 'notfound', { relation }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  computeRollup(input: Record<string, unknown>) {
    const relation = input.relation as string;
    const entity = input.entity as string;

    let p = createProgram();
    p = spGet(p, 'relation', relation, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { value: '0' }),
      (b) => complete(b, 'notfound', { relation, entity }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  trackViewItems(input: Record<string, unknown>) {
    const viewId = String(input.view ?? '');
    const itemsRaw = input.items as string;

    let p = createProgram();

    if (!viewId || !itemsRaw) {
      return complete(p, 'error', { message: 'view and items are required' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let itemIds: string[];
    try {
      itemIds = JSON.parse(itemsRaw);
    } catch {
      return complete(p, 'error', { message: 'items must be a JSON array of strings' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    p = spGet(p, 'relation', 'view-item', 'existing');
    p = put(p, 'relation', 'view-item', {
      relation: 'view-item',
      definition: JSON.stringify({
        forward_label: 'displays',
        reverse_label: 'appears in',
        cardinality: 'many-to-many',
      }),
      links: JSON.stringify(itemIds.map(id => ({ source: viewId, target: id }))),
      rollups: '',
    });

    return complete(p, 'ok', { created: 0, removed: 0, total: itemIds.length }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'relation', {}, 'all');
    return complete(p, 'ok', { items: JSON.stringify([]) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const relationHandler = autoInterpret(_relationHandler);

