// @clef-handler style=functional
// ExposedFilter Handler
//
// Formal registry of named, reusable filter configurations for Views.
// Eliminates inline JSON filter duplication across View seed configs by
// making filters first-class, centrally managed definitions.
//
// Views reference filters by identifier via assignToView / listForView.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, del, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_FILTER_TYPES = new Set(['toggle-group', 'contextual', 'range', 'search']);

const _handler: FunctionalConceptHandler = {
  define(input: Record<string, unknown>) {
    const filterId = (input.filterId as string) ?? '';
    const label = (input.label as string) ?? '';
    const field = (input.field as string) ?? '';
    const filterType = (input.filterType as string) ?? '';
    const operator = (input.operator as string | null) ?? null;
    const defaultOn = (input.defaultOn as string | null) ?? null;
    const defaultOff = (input.defaultOff as string | null) ?? null;
    const contextBinding = (input.contextBinding as string | null) ?? null;
    const fallbackBehavior = (input.fallbackBehavior as string | null) ?? null;

    if (!filterId || filterId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'filterId is required' }) as StorageProgram<Result>;
    }
    if (!label || label.trim() === '') {
      return complete(createProgram(), 'error', { message: 'label is required' }) as StorageProgram<Result>;
    }
    if (!field || field.trim() === '') {
      return complete(createProgram(), 'error', { message: 'field is required' }) as StorageProgram<Result>;
    }
    if (!VALID_FILTER_TYPES.has(filterType)) {
      return complete(createProgram(), 'error', {
        message: `filterType must be one of: ${[...VALID_FILTER_TYPES].join(', ')}`,
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'exposed-filter', filterId, 'existing');
    return branch(p,
      (b) => !!b.existing,
      (b) => complete(b, 'duplicate', { filterId }),
      (b) => {
        let b2 = put(b, 'exposed-filter', filterId, {
          filterId,
          label,
          field,
          filterType,
          operator,
          defaultOn,
          defaultOff,
          contextBinding,
          fallbackBehavior,
          viewAssignments: JSON.stringify([]),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { filter: filterId });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const filterId = (input.filterId as string) ?? '';

    let p = createProgram();
    p = get(p, 'exposed-filter', filterId, 'record');
    return branch(p,
      (b) => !b.record,
      (b) => complete(b, 'notfound', { message: `Filter '${filterId}' not found` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          filter: record.filterId,
          label: record.label,
          field: record.field,
          filterType: record.filterType,
          operator: record.operator ?? null,
          defaultOn: record.defaultOn ?? null,
          defaultOff: record.defaultOff ?? null,
          contextBinding: record.contextBinding ?? null,
          fallbackBehavior: record.fallbackBehavior ?? null,
        };
      }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'exposed-filter', {}, 'allFilters');
    return completeFrom(p, 'ok', (bindings) => {
      const allFilters = bindings.allFilters as Record<string, unknown>[];
      const filterIds = allFilters
        .map(f => f.filterId as string)
        .sort();
      return { filters: filterIds };
    }) as StorageProgram<Result>;
  },

  listForView(input: Record<string, unknown>) {
    const viewId = (input.viewId as string) ?? '';

    if (!viewId || viewId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'viewId is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'exposed-filter', {}, 'allFilters');
    return completeFrom(p, 'ok', (bindings) => {
      const allFilters = bindings.allFilters as Record<string, unknown>[];
      const matching = allFilters
        .filter(f => {
          const views: string[] = JSON.parse((f.viewAssignments as string) || '[]');
          return views.includes(viewId);
        })
        .map(f => f.filterId as string)
        .sort();
      return { filters: matching };
    }) as StorageProgram<Result>;
  },

  assignToView(input: Record<string, unknown>) {
    const filterId = (input.filterId as string) ?? '';
    const viewId = (input.viewId as string) ?? '';

    if (!filterId || filterId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'filterId is required' }) as StorageProgram<Result>;
    }
    if (!viewId || viewId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'viewId is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'exposed-filter', filterId, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `Filter '${filterId}' not found` }),
      (b) => {
        let b2 = putFrom(b, 'exposed-filter', filterId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const views: string[] = JSON.parse((existing.viewAssignments as string) || '[]');
          if (!views.includes(viewId)) {
            views.push(viewId);
          }
          return { ...existing, viewAssignments: JSON.stringify(views), updatedAt: new Date().toISOString() };
        });
        return complete(b2, 'ok', { filter: filterId });
      },
    ) as StorageProgram<Result>;
  },

  update(input: Record<string, unknown>) {
    const filterId = (input.filterId as string) ?? '';

    if (!filterId || filterId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'filterId is required' }) as StorageProgram<Result>;
    }

    // Validate filterType if provided (non-null/non-undefined)
    const newFilterType = input.filterType as string | null | undefined;
    if (newFilterType != null && !VALID_FILTER_TYPES.has(newFilterType)) {
      return complete(createProgram(), 'error', {
        message: `filterType must be one of: ${[...VALID_FILTER_TYPES].join(', ')}`,
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'exposed-filter', filterId, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `Filter '${filterId}' not found` }),
      (b) => {
        let b2 = putFrom(b, 'exposed-filter', filterId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const updated: Record<string, unknown> = { ...existing, updatedAt: new Date().toISOString() };
          if (input.label != null) updated.label = input.label;
          if (input.field != null) updated.field = input.field;
          if (input.filterType != null) updated.filterType = input.filterType;
          if (input.operator != null) updated.operator = input.operator;
          if (input.defaultOn != null) updated.defaultOn = input.defaultOn;
          if (input.defaultOff != null) updated.defaultOff = input.defaultOff;
          if (input.contextBinding != null) updated.contextBinding = input.contextBinding;
          if (input.fallbackBehavior != null) updated.fallbackBehavior = input.fallbackBehavior;
          return updated;
        });
        return complete(b2, 'ok', { filter: filterId });
      },
    ) as StorageProgram<Result>;
  },

  delete(input: Record<string, unknown>) {
    const filterId = (input.filterId as string) ?? '';

    let p = createProgram();
    p = get(p, 'exposed-filter', filterId, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `Filter '${filterId}' not found` }),
      (b) => {
        let b2 = del(b, 'exposed-filter', filterId);
        return complete(b2, 'ok', {});
      },
    ) as StorageProgram<Result>;
  },
};

export const exposedFilterHandler = autoInterpret(_handler);

export default exposedFilterHandler;

