// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// View Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _viewHandler: FunctionalConceptHandler = {
  list(_input: Record<string, unknown>) {
    let p = createProgram(); p = find(p, 'view', {}, 'allViews');
    return completeFrom(p, 'ok', (bindings) => ({
      items: JSON.stringify((bindings.allViews as Array<Record<string, unknown>>) ?? []),
    })) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  get(input: Record<string, unknown>) {
    const view = input.view as string;
    let p = createProgram(); p = spGet(p, 'view', view, 'record');
    p = branch(p, 'record', (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.record as Record<string, unknown>;
        return { view, dataSource: rec.dataSource ?? '', layout: rec.layout ?? '', filters: rec.filters ?? '', sorts: rec.sorts ?? '', groups: rec.groups ?? '', visibleFields: rec.visibleFields ?? '', formatting: rec.formatting ?? '', controls: rec.controls ?? '', title: rec.title ?? '', description: rec.description ?? '' };
      }),
      (b) => complete(b, 'notfound', { message: 'View not found' }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  resolve(input: Record<string, unknown>) {
    const view = input.view as string;
    let p = createProgram(); p = spGet(p, 'view', view, 'record');
    p = branch(p, 'record', (b) => complete(b, 'ok', { data: '[]', config: '' }),
      (b) => complete(b, 'notfound', { message: 'View not found' }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  create(input: Record<string, unknown>) {
    if (!input.dataSource || (typeof input.dataSource === 'string' && (input.dataSource as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'dataSource is required' }) as StorageProgram<Result>;
    }
    const view = input.view as string; const dataSource = input.dataSource as string; const layout = input.layout as string;
    let p = createProgram(); p = spGet(p, 'view', view, 'existing');
    p = branch(p, 'existing', (b) => complete(b, 'error', { message: 'View already exists' }),
      (b) => { let b2 = put(b, 'view', view, { view, dataSource, layout, filters: input.filters as string ?? '[]', sorts: input.sorts as string ?? '[]', groups: input.groups as string ?? '[]', visibleFields: input.visibleFields as string ?? '[]', formatting: input.formatting as string ?? '{}', controls: input.controls as string ?? '{}', title: input.title as string ?? '', description: input.description as string ?? '' }); return complete(b2, 'ok', { view }); });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  setControls(input: Record<string, unknown>) {
    if (!input.view || (typeof input.view === 'string' && (input.view as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'view is required' }) as StorageProgram<Result>;
    }
    if (!input.controls || (typeof input.controls === 'string' && (input.controls as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'controls is required' }) as StorageProgram<Result>;
    }
    const view = input.view as string; const controls = input.controls as string;
    let p = createProgram(); p = spGet(p, 'view', view, 'existing');
    p = branch(p, 'existing', (b) => { let b2 = putFrom(b, 'view', view, (bindings) => ({ ...(bindings.existing as Record<string, unknown>), controls })); return complete(b2, 'ok', { view }); },
      (b) => complete(b, 'notfound', { message: 'View not found' }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  setFilter(input: Record<string, unknown>) {
    const view = input.view as string; const filter = input.filter as string;
    let p = createProgram(); p = spGet(p, 'view', view, 'existing');
    p = branch(p, 'existing',
      (b) => { let b2 = putFrom(b, 'view', view, (bindings) => ({ ...(bindings.existing as Record<string, unknown>), filters: filter })); return complete(b2, 'ok', { view }); },
      (b) => complete(b, 'notfound', { message: 'View not found' }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  setSort(input: Record<string, unknown>) {
    if (!input.view || (typeof input.view === 'string' && (input.view as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'view is required' }) as StorageProgram<Result>;
    }
    if (!input.sort || (typeof input.sort === 'string' && (input.sort as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'sort is required' }) as StorageProgram<Result>;
    }
    const view = input.view as string; const sort = input.sort as string;
    let p = createProgram(); p = spGet(p, 'view', view, 'existing');
    p = branch(p, 'existing', (b) => { let b2 = putFrom(b, 'view', view, (bindings) => ({ ...(bindings.existing as Record<string, unknown>), sorts: sort })); return complete(b2, 'ok', { view }); },
      (b) => complete(b, 'notfound', { message: 'View not found' }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  setGroup(input: Record<string, unknown>) {
    if (!input.view || (typeof input.view === 'string' && (input.view as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'view is required' }) as StorageProgram<Result>;
    }
    if (!input.group || (typeof input.group === 'string' && (input.group as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'group is required' }) as StorageProgram<Result>;
    }
    const view = input.view as string; const group = input.group as string;
    let p = createProgram(); p = spGet(p, 'view', view, 'existing');
    p = branch(p, 'existing', (b) => { let b2 = putFrom(b, 'view', view, (bindings) => ({ ...(bindings.existing as Record<string, unknown>), groups: group })); return complete(b2, 'ok', { view }); },
      (b) => complete(b, 'notfound', { message: 'View not found' }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  setVisibleFields(input: Record<string, unknown>) {
    if (!input.view || (typeof input.view === 'string' && (input.view as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'view is required' }) as StorageProgram<Result>;
    }
    if (!input.fields || (typeof input.fields === 'string' && (input.fields as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'fields is required' }) as StorageProgram<Result>;
    }
    const view = input.view as string; const fields = input.fields as string;
    let p = createProgram(); p = spGet(p, 'view', view, 'existing');
    p = branch(p, 'existing', (b) => { let b2 = putFrom(b, 'view', view, (bindings) => ({ ...(bindings.existing as Record<string, unknown>), visibleFields: fields })); return complete(b2, 'ok', { view }); },
      (b) => complete(b, 'notfound', { message: 'View not found' }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  changeLayout(input: Record<string, unknown>) {
    const view = input.view as string; const layout = input.layout as string;
    let p = createProgram(); p = spGet(p, 'view', view, 'existing');
    p = branch(p, 'existing',
      (b) => { let b2 = putFrom(b, 'view', view, (bindings) => ({ ...(bindings.existing as Record<string, unknown>), layout })); return complete(b2, 'ok', { view }); },
      (b) => complete(b, 'notfound', { message: 'View not found' }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  duplicate(input: Record<string, unknown>) {
    const view = input.view as string;
    let p = createProgram(); p = spGet(p, 'view', view, 'existing');
    p = branch(p, 'existing',
      (b) => { const newView = `${view}-copy-${Date.now()}`; let b2 = putFrom(b, 'view', newView, (bindings) => ({ ...(bindings.existing as Record<string, unknown>), view: newView })); return complete(b2, 'ok', { newView }); },
      (b) => complete(b, 'notfound', { message: 'View not found' }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  update(input: Record<string, unknown>) {
    const view = input.view as string;
    let p = createProgram(); p = spGet(p, 'view', view, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'view', view, (bindings) => {
          const updated: Record<string, unknown> = { ...(bindings.existing as Record<string, unknown>) };
          if (input.dataSource !== undefined) updated.dataSource = input.dataSource; if (input.layout !== undefined) updated.layout = input.layout;
          if (input.filters !== undefined) updated.filters = input.filters; if (input.sorts !== undefined) updated.sorts = input.sorts;
          if (input.groups !== undefined) updated.groups = input.groups; if (input.visibleFields !== undefined) updated.visibleFields = input.visibleFields;
          if (input.formatting !== undefined) updated.formatting = input.formatting; if (input.controls !== undefined) updated.controls = input.controls;
          if (input.title !== undefined) updated.title = input.title; if (input.description !== undefined) updated.description = input.description;
          return updated;
        });
        return complete(b2, 'ok', { view });
      },
      (b) => complete(b, 'notfound', { message: 'View not found' }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  embed(input: Record<string, unknown>) {
    const view = input.view as string;
    let p = createProgram(); p = spGet(p, 'view', view, 'existing');
    p = branch(p, 'existing', (b) => complete(b, 'ok', { embedCode: '' }),
      (b) => complete(b, 'notfound', { message: 'View not found' }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  addContextualFilter(input: Record<string, unknown>) {
    const view = input.view as string; const field = input.field as string; const operator = input.operator as string;
    const contextBinding = input.context_binding as string; const fallbackBehavior = input.fallback_behavior as string;
    let p = createProgram(); p = spGet(p, 'view', view, 'existing');
    p = branch(p, 'existing',
      (b) => {
        if (!contextBinding.startsWith('context.')) return complete(b, 'invalid_binding', { binding: contextBinding });
        if (!['hide','show_empty','ignore_filter'].includes(fallbackBehavior)) return complete(b, 'invalid_binding', { binding: `Invalid fallback_behavior: ${fallbackBehavior}` });
        const contextualFilter = { field, operator, source_type: 'contextual', context_binding: contextBinding, fallback_behavior: fallbackBehavior };
        let b2 = putFrom(b, 'view', view, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          let filters: unknown[]; try { filters = JSON.parse((existing.filters as string) || '[]'); if (!Array.isArray(filters)) filters = []; } catch { filters = []; }
          filters.push(contextualFilter);
          return { ...existing, filters: JSON.stringify(filters) };
        });
        return complete(b2, 'ok', { filter: JSON.stringify(contextualFilter) });
      },
      (b) => complete(b, 'notfound', { message: 'View not found' }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const viewHandler = autoInterpret(_viewHandler);

