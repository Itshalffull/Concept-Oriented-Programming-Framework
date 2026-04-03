// @clef-handler style=functional concept=SortSpec
// ============================================================
// SortSpec Concept Implementation — Functional (StorageProgram) style
//
// Manages named, ordered sequences of sort keys for record ordering
// in views. Supports create, get, compose, evaluate, and list.
//
// The evaluate action implements a stable multi-key sort:
//   - Per-key direction (asc/desc)
//   - Null handling: first/last/auto (auto = nulls last for asc,
//     nulls first for desc)
//   - Multi-key: compare by first key, tiebreak by second, etc.
//   - Stability: rows with equal keys preserve original relative order
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram,
  get,
  find,
  put,
  putFrom,
  complete,
  completeFrom,
  branch,
  mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// --- SortKey type (matches the JSON schema declared in the spec) ---
interface SortKey {
  field: string;
  direction: 'asc' | 'desc';
  nulls?: 'first' | 'last' | 'auto';
  collation?: string;
}

// --- Stable multi-key sort implementation ---

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const sa = String(a ?? '');
  const sb = String(b ?? '');
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function isNullish(v: unknown): boolean {
  return v === null || v === undefined;
}

function applySortKeys(
  rows: Record<string, unknown>[],
  keys: SortKey[],
): Record<string, unknown>[] {
  if (keys.length === 0) return rows;

  // Stable sort: attach original index, sort, then strip it
  const indexed = rows.map((row, idx) => ({ row, idx }));

  indexed.sort((a, b) => {
    for (const key of keys) {
      const aVal = a.row[key.field];
      const bVal = b.row[key.field];

      const aNull = isNullish(aVal);
      const bNull = isNullish(bVal);

      if (aNull || bNull) {
        if (aNull && bNull) continue;
        const nullsPos = key.nulls ?? 'auto';
        const nullsLast: boolean =
          nullsPos === 'auto' ? key.direction === 'asc' : nullsPos === 'last';
        if (aNull) return nullsLast ? 1 : -1;
        return nullsLast ? -1 : 1;
      }

      let cmp = compareValues(aVal, bVal);
      if (key.direction === 'desc') cmp = -cmp;
      if (cmp !== 0) return cmp;
    }
    // Tiebreak by original index ensures stability
    return a.idx - b.idx;
  });

  return indexed.map(({ row }) => row);
}

// --- Handler ---

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { name: 'SortSpec' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const name = input.name as string;
    const keys = input.keys as string;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'name is required',
      }) as StorageProgram<Result>;
    }

    // Validate that keys is parseable JSON before storing
    try {
      JSON.parse(keys);
    } catch {
      return complete(createProgram(), 'error', {
        message: 'keys must be a valid JSON array',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'sort', name, 'existing');

    return branch(
      p,
      'existing',
      // existing != null — duplicate
      (b) =>
        completeFrom(b, 'duplicate', (bindings) => ({
          sort: (bindings.existing as Record<string, unknown>).name as string,
        })),
      // existing == null — store and return ok
      (b) => {
        const b2 = put(b, 'sort', name, { name, keys });
        return complete(b2, 'ok', { sort: name });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'sort', name, 'existing');

    return branch(
      p,
      'existing',
      (b) =>
        completeFrom(b, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { sort: existing.name as string, keys: existing.keys as string };
        }),
      (b) =>
        complete(b, 'notfound', {
          message: `No sort spec with name "${name}" found`,
        }),
    ) as StorageProgram<Result>;
  },

  compose(input: Record<string, unknown>) {
    const primary = input.primary as string;
    const secondary = input.secondary as string;
    const composedName = `${primary}+${secondary}`;

    let p = createProgram();
    p = get(p, 'sort', primary, 'primarySort');
    p = get(p, 'sort', secondary, 'secondarySort');

    return branch(
      p,
      'primarySort',
      // primary exists — now check secondary
      (b) =>
        branch(
          b,
          'secondarySort',
          // both exist — concatenate keys
          (b2) => {
            // Compute combined keys from bindings
            let b3 = mapBindings(
              b2,
              (bindings) => {
                const pSort = bindings.primarySort as Record<string, unknown>;
                const sSort = bindings.secondarySort as Record<string, unknown>;
                const pKeys: SortKey[] = JSON.parse(pSort.keys as string);
                const sKeys: SortKey[] = JSON.parse(sSort.keys as string);
                return JSON.stringify([...pKeys, ...sKeys]);
              },
              'combinedKeys',
            );
            // Store the composed sort spec using the computed keys
            b3 = putFrom(b3, 'sort', composedName, (bindings) => ({
              name: composedName,
              keys: bindings.combinedKeys as string,
            }));
            return completeFrom(b3, 'ok', (bindings) => ({
              sort: composedName,
              keys: bindings.combinedKeys as string,
            }));
          },
          // secondary not found
          (b2) =>
            complete(b2, 'notfound', {
              message: `No sort spec with name "${secondary}" found`,
            }),
        ),
      // primary not found
      (b) =>
        complete(b, 'notfound', {
          message: `No sort spec with name "${primary}" found`,
        }),
    ) as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>) {
    const name = input.name as string;
    const rowsJson = input.rows as string;

    // Validate rows JSON early — return error before any storage ops
    let parsedRows: Record<string, unknown>[];
    try {
      const parsed = JSON.parse(rowsJson);
      if (!Array.isArray(parsed)) {
        return complete(createProgram(), 'error', {
          message: 'rows must be a JSON array',
        }) as StorageProgram<Result>;
      }
      parsedRows = parsed as Record<string, unknown>[];
    } catch {
      return complete(createProgram(), 'error', {
        message: `rows could not be parsed as a JSON array`,
      }) as StorageProgram<Result>;
    }

    // Capture the parsed rows in closure scope for use in mapBindings
    const capturedRows = parsedRows;

    let p = createProgram();
    p = get(p, 'sort', name, 'existing');

    return branch(
      p,
      'existing',
      // Sort spec found — perform the sort
      (b) => {
        // Compute sorted rows from bindings; null signals an error
        let b2 = mapBindings(
          b,
          (bindings) => {
            const existing = bindings.existing as Record<string, unknown>;
            let keys: SortKey[];
            try {
              keys = JSON.parse(existing.keys as string) as SortKey[];
            } catch {
              return null;
            }
            try {
              return JSON.stringify(applySortKeys(capturedRows, keys));
            } catch {
              return null;
            }
          },
          'sortResult',
        );

        return branch(
          b2,
          (bindings) => bindings.sortResult !== null,
          (b3) =>
            completeFrom(b3, 'ok', (bindings) => ({
              rows: bindings.sortResult as string,
            })),
          (b3) =>
            complete(b3, 'error', {
              message: 'Sort evaluation failed due to a comparison error',
            }),
        );
      },
      // Sort spec not found
      (b) =>
        complete(b, 'notfound', {
          message: `No sort spec with name "${name}" found`,
        }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'sort', {}, 'allSorts');
    return completeFrom(p, 'ok', (bindings) => {
      const allSorts = (bindings.allSorts as Array<Record<string, unknown>>) ?? [];
      const names = allSorts.map((s) => s.name as string);
      return { sorts: JSON.stringify(names) };
    }) as StorageProgram<Result>;
  },
};

export const sortSpecHandler = autoInterpret(_handler);
