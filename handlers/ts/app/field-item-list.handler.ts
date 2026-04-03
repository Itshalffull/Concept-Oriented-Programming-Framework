// @clef-handler style=functional
// FieldItemList Handler
//
// Hierarchical ordered list of FieldPlacement IDs within a typed data tree.
// Provides the missing intermediate layer between individual FieldPlacements
// and the top-level DisplayMode flat_fields list.
// Supports nesting (parent–child hierarchy), collapsing, and reordering.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const list = input.list as string;
    const name = input.name as string;
    const schema = (input.schema as string | undefined) ?? null;

    if (!name || (name as string).trim() === '') {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!list || (list as string).trim() === '') {
      return complete(createProgram(), 'error', { message: 'list identifier is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'field-item-list', list, 'existing');
    return branch(p,
      (b) => !!b.existing,
      (b) => complete(b, 'error', { message: `Field item list '${list}' already exists` }),
      (b) => {
        let b2 = put(b, 'field-item-list', list, {
          list,
          name,
          label: null,
          items: JSON.stringify([]),
          parent: null,
          position: 0,
          collapsed: false,
          schema,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { list });
      },
    ) as StorageProgram<Result>;
  },

  addItem(input: Record<string, unknown>) {
    const list = input.list as string;
    const placementId = input.placementId as string;
    const position = input.position as number | undefined;

    let p = createProgram();
    p = get(p, 'field-item-list', list, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `Field item list '${list}' not found` }),
      (b) => {
        let b2 = putFrom(b, 'field-item-list', list, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const items = JSON.parse((existing.items as string) || '[]') as string[];
          if (position !== undefined && position >= 0 && position <= items.length) {
            items.splice(position, 0, placementId);
          } else {
            items.push(placementId);
          }
          return { ...existing, items: JSON.stringify(items), updatedAt: new Date().toISOString() };
        });
        return complete(b2, 'ok', { list });
      },
    ) as StorageProgram<Result>;
  },

  removeItem(input: Record<string, unknown>) {
    const list = input.list as string;
    const placementId = input.placementId as string;

    let p = createProgram();
    p = get(p, 'field-item-list', list, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `Field item list '${list}' not found` }),
      (b) => {
        let b2 = putFrom(b, 'field-item-list', list, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const items = JSON.parse((existing.items as string) || '[]') as string[];
          const filtered = items.filter(id => id !== placementId);
          return { ...existing, items: JSON.stringify(filtered), updatedAt: new Date().toISOString() };
        });
        return complete(b2, 'ok', { list });
      },
    ) as StorageProgram<Result>;
  },

  reorder(input: Record<string, unknown>) {
    const list = input.list as string;
    const rawOrdered = input.orderedIds;
    const orderedIds: string[] = Array.isArray(rawOrdered) ? rawOrdered as string[] :
      typeof rawOrdered === 'string' ? JSON.parse(rawOrdered) : [];

    let p = createProgram();
    p = get(p, 'field-item-list', list, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `Field item list '${list}' not found` }),
      (b) => {
        let b2 = putFrom(b, 'field-item-list', list, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const currentItems = JSON.parse((existing.items as string) || '[]') as string[];
          // Items in orderedIds first, then remaining items not in orderedIds
          const inOrder = orderedIds.filter(id => currentItems.includes(id));
          const remaining = currentItems.filter(id => !orderedIds.includes(id));
          const merged = [...inOrder, ...remaining];
          return { ...existing, items: JSON.stringify(merged), updatedAt: new Date().toISOString() };
        });
        return complete(b2, 'ok', { list });
      },
    ) as StorageProgram<Result>;
  },

  nest(input: Record<string, unknown>) {
    const list = input.list as string;
    const parent = input.parent as string;

    if (!list || (list as string).trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'list identifier is required' }) as StorageProgram<Result>;
    }
    // Simplified cycle check
    if (parent === list) {
      return complete(createProgram(), 'cycle', { message: 'Cannot nest a list under itself' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'field-item-list', list, 'childRecord');
    return branch(p,
      (b) => !b.childRecord,
      (b) => complete(b, 'notfound', { message: `Field item list '${list}' not found` }),
      (b) => {
        // Set parent reference — parent existence is advisory (lazy reference, resolved at render time)
        let b2 = putFrom(b, 'field-item-list', list, (bindings) => {
          const child = bindings.childRecord as Record<string, unknown>;
          return { ...child, parent, updatedAt: new Date().toISOString() };
        });
        return complete(b2, 'ok', { list });
      },
    ) as StorageProgram<Result>;
  },

  setCollapsed(input: Record<string, unknown>) {
    const list = input.list as string;
    const collapsed = input.collapsed as boolean;

    let p = createProgram();
    p = get(p, 'field-item-list', list, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `Field item list '${list}' not found` }),
      (b) => {
        let b2 = putFrom(b, 'field-item-list', list, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, collapsed, updatedAt: new Date().toISOString() };
        });
        return complete(b2, 'ok', { list });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const list = input.list as string;

    let p = createProgram();
    p = get(p, 'field-item-list', list, 'record');
    return branch(p,
      (b) => !b.record,
      (b) => complete(b, 'notfound', { message: `Field item list '${list}' not found` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        const rawItems = record.items as string;
        return {
          list: record.list,
          name: record.name,
          label: record.label ?? null,
          items: rawItems ? JSON.parse(rawItems) : [],
          parent: record.parent ?? null,
          position: record.position ?? 0,
          collapsed: record.collapsed ?? false,
          schema: record.schema ?? null,
        };
      }),
    ) as StorageProgram<Result>;
  },

  delete(input: Record<string, unknown>) {
    const list = input.list as string;

    let p = createProgram();
    p = get(p, 'field-item-list', list, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `Field item list '${list}' not found` }),
      (b) => {
        let b2 = del(b, 'field-item-list', list);
        return complete(b2, 'ok', {});
      },
    ) as StorageProgram<Result>;
  },

  listForSchema(input: Record<string, unknown>) {
    const schema = input.schema as string;

    if (!schema || (schema as string).trim() === '') {
      return complete(createProgram(), 'error', { message: 'schema is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'field-item-list', {}, 'allLists');
    p = mapBindings(p, (b) => {
      const all = b.allLists as Record<string, unknown>[];
      return all
        .filter(l => l.schema === schema)
        .sort((a, c) => ((a.position as number) || 0) - ((c.position as number) || 0))
        .map(l => l.list);
    }, 'filteredLists');
    return completeFrom(p, 'ok', (b) => ({ lists: b.filteredLists })) as StorageProgram<Result>;
  },
};

export const fieldItemListHandler = autoInterpret(_handler);

export default fieldItemListHandler;
