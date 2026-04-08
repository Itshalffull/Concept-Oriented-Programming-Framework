// @clef-handler style=functional concept=PaginationSpec
// ============================================================
// PaginationSpec Concept Implementation — Functional (StorageProgram) style
//
// Manages named pagination configurations for view result sets.
// Supports offset, cursor, and keyset pagination modes.
// Each spec tracks page size, max size, current position,
// total count, and hasMore flag.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram,
  get,
  find,
  put,
  putFrom,
  del,
  complete,
  completeFrom,
  branch,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// --- Validation helpers ---

const VALID_MODES = new Set(['offset', 'cursor', 'keyset']);

function toInt(value: unknown): number {
  if (typeof value === 'number') return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

interface PaginationRecord {
  name: string;
  mode: string;
  pageSize: number;
  maxSize: number;
  position: string;
  totalCount: number;
  hasMore: boolean;
  [key: string]: unknown;
}

// --- Handler ---

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { name: 'PaginationSpec' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const name = input.name as string;
    const mode = input.mode as string;
    const pageSize = toInt(input.pageSize);
    const maxSize = input.maxSize !== undefined && input.maxSize !== null ? toInt(input.maxSize) : 100;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'name is required',
      }) as StorageProgram<Result>;
    }

    if (!VALID_MODES.has(mode)) {
      return complete(createProgram(), 'error', {
        message: `mode must be one of "offset", "cursor", or "keyset"; got "${mode}"`,
      }) as StorageProgram<Result>;
    }

    if (!Number.isInteger(pageSize) || pageSize <= 0) {
      return complete(createProgram(), 'error', {
        message: 'pageSize must be a positive integer',
      }) as StorageProgram<Result>;
    }

    if (pageSize > maxSize) {
      return complete(createProgram(), 'error', {
        message: `pageSize (${pageSize}) exceeds maxSize (${maxSize})`,
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'pagination', name, 'existing');

    return branch(
      p,
      'existing',
      // existing != null — duplicate
      (b) =>
        complete(b, 'duplicate', { name }),
      // existing == null — store and return ok
      (b) => {
        const record: PaginationRecord = {
          name,
          mode,
          pageSize,
          maxSize,
          position: '0',
          totalCount: -1,
          hasMore: true,
        };
        const b2 = put(b, 'pagination', name, record);
        return complete(b2, 'ok', { spec: name });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'pagination', name, 'existing');

    return branch(
      p,
      'existing',
      (b) =>
        completeFrom(b, 'ok', (bindings) => {
          const r = bindings.existing as PaginationRecord;
          return {
            spec: r.name,
            name: r.name,
            mode: r.mode,
            pageSize: r.pageSize,
            maxSize: r.maxSize,
            position: r.position,
            totalCount: r.totalCount,
            hasMore: r.hasMore,
          };
        }),
      (b) =>
        complete(b, 'not_found', {
          message: `No pagination spec with name "${name}" found`,
        }),
    ) as StorageProgram<Result>;
  },

  advance(input: Record<string, unknown>) {
    const name = input.name as string;
    const nextPosition = input.nextPosition as string;

    let p = createProgram();
    p = get(p, 'pagination', name, 'existing');

    return branch(
      p,
      'existing',
      (b) =>
        branch(
          b,
          (bindings) => (bindings.existing as PaginationRecord).hasMore === true,
          // hasMore is true — advance is permitted
          (b2) => {
            const b3 = putFrom(b2, 'pagination', name, (bindings) => {
              const r = bindings.existing as PaginationRecord;
              return { ...r, position: nextPosition };
            });
            return completeFrom(b3, 'ok', (bindings) => {
              const r = bindings.existing as PaginationRecord;
              return { spec: r.name, position: nextPosition };
            });
          },
          // hasMore is false — exhausted
          (b2) =>
            complete(b2, 'exhausted', {
              message: 'No further pages exist; advance is not permitted when hasMore is false',
            }),
        ),
      (b) =>
        complete(b, 'not_found', {
          message: `No pagination spec with name "${name}" found`,
        }),
    ) as StorageProgram<Result>;
  },

  retreat(input: Record<string, unknown>) {
    const name = input.name as string;
    const prevPosition = input.prevPosition as string;

    let p = createProgram();
    p = get(p, 'pagination', name, 'existing');

    return branch(
      p,
      'existing',
      (b) =>
        branch(
          b,
          (bindings) => (bindings.existing as PaginationRecord).position !== '0',
          // position is not "0" — retreat is permitted
          (b2) => {
            const b3 = putFrom(b2, 'pagination', name, (bindings) => {
              const r = bindings.existing as PaginationRecord;
              return { ...r, position: prevPosition };
            });
            return completeFrom(b3, 'ok', (bindings) => {
              const r = bindings.existing as PaginationRecord;
              return { spec: r.name, position: prevPosition };
            });
          },
          // position is "0" — at_start
          (b2) =>
            complete(b2, 'at_start', {
              message: 'Already at the first page; cannot retreat further',
            }),
        ),
      (b) =>
        complete(b, 'not_found', {
          message: `No pagination spec with name "${name}" found`,
        }),
    ) as StorageProgram<Result>;
  },

  reset(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'pagination', name, 'existing');

    return branch(
      p,
      'existing',
      (b) => {
        const b2 = putFrom(b, 'pagination', name, (bindings) => {
          const r = bindings.existing as PaginationRecord;
          return { ...r, position: '0' };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const r = bindings.existing as PaginationRecord;
          return { spec: r.name, position: '0' };
        });
      },
      (b) =>
        complete(b, 'not_found', {
          message: `No pagination spec with name "${name}" found`,
        }),
    ) as StorageProgram<Result>;
  },

  resize(input: Record<string, unknown>) {
    const name = input.name as string;
    const pageSize = toInt(input.pageSize);

    if (!Number.isInteger(pageSize) || pageSize <= 0) {
      return complete(createProgram(), 'error', {
        message: 'pageSize must be a positive integer',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'pagination', name, 'existing');

    return branch(
      p,
      'existing',
      (b) =>
        branch(
          b,
          (bindings) => pageSize <= (bindings.existing as PaginationRecord).maxSize,
          // pageSize is within bounds — update and reset position
          (b2) => {
            const b3 = putFrom(b2, 'pagination', name, (bindings) => {
              const r = bindings.existing as PaginationRecord;
              return { ...r, pageSize, position: '0' };
            });
            return completeFrom(b3, 'ok', (bindings) => {
              const r = bindings.existing as PaginationRecord;
              return { spec: r.name, pageSize, position: '0' };
            });
          },
          // pageSize exceeds maxSize
          (b2) =>
            completeFrom(b2, 'exceeds_max', (bindings) => {
              const r = bindings.existing as PaginationRecord;
              return {
                message: `pageSize (${pageSize}) exceeds maxSize (${r.maxSize}) for spec "${name}"`,
              };
            }),
        ),
      (b) =>
        complete(b, 'not_found', {
          message: `No pagination spec with name "${name}" found`,
        }),
    ) as StorageProgram<Result>;
  },

  updateCount(input: Record<string, unknown>) {
    const name = input.name as string;
    const totalCount = toInt(input.totalCount);
    const hasMore = input.hasMore === true || input.hasMore === 'true';

    let p = createProgram();
    p = get(p, 'pagination', name, 'existing');

    return branch(
      p,
      'existing',
      (b) => {
        const b2 = putFrom(b, 'pagination', name, (bindings) => {
          const r = bindings.existing as PaginationRecord;
          return { ...r, totalCount, hasMore };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const r = bindings.existing as PaginationRecord;
          return { spec: r.name, totalCount, hasMore };
        });
      },
      (b) =>
        complete(b, 'not_found', {
          message: `No pagination spec with name "${name}" found`,
        }),
    ) as StorageProgram<Result>;
  },

  remove(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'pagination', name, 'existing');

    return branch(
      p,
      'existing',
      (b) => {
        const b2 = del(b, 'pagination', name);
        return complete(b2, 'ok', { name });
      },
      (b) =>
        complete(b, 'not_found', {
          message: `No pagination spec with name "${name}" found`,
        }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'pagination', {}, 'allSpecs');
    return completeFrom(p, 'ok', (bindings) => {
      const allSpecs = (bindings.allSpecs as Array<PaginationRecord>) ?? [];
      const names = allSpecs.map((s) => s.name);
      return { specs: JSON.stringify(names) };
    }) as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'pagination', name, 'existing');

    return branch(
      p,
      'existing',
      (b) =>
        completeFrom(b, 'ok', (bindings) => {
          const r = bindings.existing as PaginationRecord;
          const limit = r.pageSize;

          if (r.mode === 'offset') {
            const pageNumber = parseInt(r.position, 10) || 0;
            const offsetValue = pageNumber * limit;
            return { limit, offset: offsetValue, cursor: '' };
          }

          if (r.mode === 'cursor') {
            return { limit, offset: 0, cursor: r.position };
          }

          // keyset mode
          return { limit, offset: 0, cursor: r.position };
        }),
      (b) =>
        complete(b, 'not_found', {
          message: `No pagination spec with name "${name}" found`,
        }),
    ) as StorageProgram<Result>;
  },

};

export const paginationSpecHandler = autoInterpret(_handler);
