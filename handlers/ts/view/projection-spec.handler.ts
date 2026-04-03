// @clef-handler style=functional concept=ProjectionSpec
// ============================================================
// ProjectionSpec Concept Implementation — Functional (StorageProgram) style
//
// Manages named field-selection specifications that control which columns
// appear in a view, in what order, and how they are formatted or computed.
// Supports create, get, merge, evaluate, and list.
//
// The merge action implements overlay-wins semantics:
//   - Base fields are kept unless the overlay has a field with the same key
//   - Overlay fields replace base fields on key conflict
//   - Fields present only in the overlay are appended after the base
//
// The evaluate action:
//   - Selects only the fields declared in the projection, in declaration order
//   - Excludes fields where visible === false
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

// --- ProjectionField type (matches the JSON schema declared in the spec) ---
interface ProjectionField {
  key: string;
  label?: string;
  visible?: boolean;
  formatter?: string;
  computed?: string;
  weight?: number;
}

// --- Merge logic: overlay fields win on key conflict, new overlay fields appended ---
function mergeProjectionFields(
  baseFields: ProjectionField[],
  overlayFields: ProjectionField[],
): ProjectionField[] {
  const overlayByKey = new Map<string, ProjectionField>();
  for (const f of overlayFields) {
    overlayByKey.set(f.key, f);
  }

  // Start with base fields, replacing any that have a matching overlay key
  const merged: ProjectionField[] = baseFields.map((f) =>
    overlayByKey.has(f.key) ? overlayByKey.get(f.key)! : f,
  );

  // Append overlay fields whose keys were NOT in the base
  const baseKeys = new Set(baseFields.map((f) => f.key));
  for (const f of overlayFields) {
    if (!baseKeys.has(f.key)) {
      merged.push(f);
    }
  }

  return merged;
}

// --- Project a single row against fields in declaration order ---
function projectRow(
  row: Record<string, unknown>,
  fields: ProjectionField[],
): Record<string, unknown> {
  const projected: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.visible === false) continue;
    projected[field.key] = row[field.key];
  }
  return projected;
}

// --- Handler ---

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { name: 'ProjectionSpec' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const name = input.name as string;
    const fields = input.fields as string;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'name is required',
      }) as StorageProgram<Result>;
    }

    // Validate that fields is parseable JSON before storing
    try {
      JSON.parse(fields);
    } catch {
      return complete(createProgram(), 'error', {
        message: 'fields must be a valid JSON array',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'projection', name, 'existing');

    return branch(
      p,
      'existing',
      // existing != null — duplicate
      (b) =>
        completeFrom(b, 'duplicate', (bindings) => ({
          projection: (bindings.existing as Record<string, unknown>).name as string,
        })),
      // existing == null — store and return ok
      (b) => {
        const b2 = put(b, 'projection', name, { name, fields });
        return complete(b2, 'ok', { projection: name });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'projection', name, 'existing');

    return branch(
      p,
      'existing',
      (b) =>
        completeFrom(b, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return {
            projection: existing.name as string,
            fields: existing.fields as string,
          };
        }),
      (b) =>
        complete(b, 'notfound', {
          message: `No projection spec with name "${name}" found`,
        }),
    ) as StorageProgram<Result>;
  },

  merge(input: Record<string, unknown>) {
    const base = input.base as string;
    const overlay = input.overlay as string;
    const mergedName = `${base}+${overlay}`;

    let p = createProgram();
    p = get(p, 'projection', base, 'baseProjection');
    p = get(p, 'projection', overlay, 'overlayProjection');

    return branch(
      p,
      'baseProjection',
      // base exists — now check overlay
      (b) =>
        branch(
          b,
          'overlayProjection',
          // both exist — merge fields
          (b2) => {
            // Compute merged fields from bindings
            let b3 = mapBindings(
              b2,
              (bindings) => {
                const bProj = bindings.baseProjection as Record<string, unknown>;
                const oProj = bindings.overlayProjection as Record<string, unknown>;
                let baseFields: ProjectionField[];
                let overlayFields: ProjectionField[];
                try {
                  baseFields = JSON.parse(bProj.fields as string) as ProjectionField[];
                  overlayFields = JSON.parse(oProj.fields as string) as ProjectionField[];
                } catch {
                  return null;
                }
                return JSON.stringify(mergeProjectionFields(baseFields, overlayFields));
              },
              'mergedFields',
            );

            b3 = putFrom(b3, 'projection', mergedName, (bindings) => ({
              name: mergedName,
              fields: bindings.mergedFields as string,
            }));

            return branch(
              b3,
              (bindings) => bindings.mergedFields !== null,
              (b4) =>
                completeFrom(b4, 'ok', (bindings) => ({
                  projection: mergedName,
                  fields: bindings.mergedFields as string,
                })),
              (b4) =>
                complete(b4, 'error', {
                  message: 'Failed to parse projection fields as JSON arrays',
                }),
            );
          },
          // overlay not found
          (b2) =>
            complete(b2, 'notfound', {
              message: `No projection spec with name "${overlay}" found`,
            }),
        ),
      // base not found
      (b) =>
        complete(b, 'notfound', {
          message: `No projection spec with name "${base}" found`,
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
        message: 'rows could not be parsed as a JSON array',
      }) as StorageProgram<Result>;
    }

    // Capture the parsed rows in closure scope for use in mapBindings
    const capturedRows = parsedRows;

    let p = createProgram();
    p = get(p, 'projection', name, 'existing');

    return branch(
      p,
      'existing',
      // Projection spec found — perform field selection
      (b) => {
        // Compute projected rows from bindings; null signals an error
        let b2 = mapBindings(
          b,
          (bindings) => {
            const existing = bindings.existing as Record<string, unknown>;
            let fields: ProjectionField[];
            try {
              fields = JSON.parse(existing.fields as string) as ProjectionField[];
            } catch {
              return null;
            }
            try {
              const projected = capturedRows.map((row) => projectRow(row, fields));
              return JSON.stringify(projected);
            } catch {
              return null;
            }
          },
          'evaluateResult',
        );

        return branch(
          b2,
          (bindings) => bindings.evaluateResult !== null,
          (b3) =>
            completeFrom(b3, 'ok', (bindings) => ({
              rows: bindings.evaluateResult as string,
            })),
          (b3) =>
            complete(b3, 'error', {
              message: 'Projection evaluation failed due to a serialization error',
            }),
        );
      },
      // Projection spec not found
      (b) =>
        complete(b, 'notfound', {
          message: `No projection spec with name "${name}" found`,
        }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'projection', {}, 'allProjections');
    return completeFrom(p, 'ok', (bindings) => {
      const allProjections =
        (bindings.allProjections as Array<Record<string, unknown>>) ?? [];
      const names = allProjections.map((proj) => proj.name as string);
      return { projections: JSON.stringify(names) };
    }) as StorageProgram<Result>;
  },
};

export const projectionSpecHandler = autoInterpret(_handler);
