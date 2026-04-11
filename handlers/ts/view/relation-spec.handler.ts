// @clef-handler style=functional concept=RelationSpec
// RelationSpec Concept Implementation — Functional (StorageProgram) style
//
// Manages named declarations of relation data that a view wants resolved.
// Each spec holds a name and a JSON array of path descriptors covering
// forward field paths, reverse field paths, and link paths. The query
// pipeline reads these to decide whether to project denormalized data,
// inject a join, or mark fields for lazy client-side resolution.
//
// RelationSpec does NOT control denormalization strategy — it only declares
// what the view wants. See Section 3 of relation-resolver-plan.md.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram,
  get,
  find,
  put,
  branch,
  complete,
  completeFrom,
  mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// ─── Path descriptor shape (informational — used for addPath/removePath) ───────

interface PathDescriptor {
  field?: string;
  reverse?: string;
  link?: string;
  sourceSchema?: string;
  include?: string[];
  lazy?: boolean;
  maxCount?: number;
}

/** Return the identifying key for a path descriptor (field, reverse, or link). */
function pathKey(path: PathDescriptor): string | undefined {
  return path.field ?? path.reverse ?? path.link;
}

// ─── Handler ───────────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { name: 'RelationSpec' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const name      = input.name  as string;
    const pathsRaw  = input.paths as string;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'name is required',
      }) as StorageProgram<Result>;
    }

    // Validate paths JSON before storing
    try {
      JSON.parse(pathsRaw ?? '[]');
    } catch {
      return complete(createProgram(), 'error', {
        message: 'paths must be a valid JSON array',
      }) as StorageProgram<Result>;
    }

    const paths = pathsRaw ?? '[]';

    let p = createProgram();
    p = get(p, 'relation-spec', name, 'existing');

    return branch(
      p,
      'existing',
      // duplicate
      (b) =>
        completeFrom(b, 'duplicate', (bindings) => ({
          spec: (bindings.existing as Record<string, unknown>).name as string,
        })),
      // new — store and return ok
      (b) => {
        const b2 = put(b, 'relation-spec', name, { name, paths });
        return complete(b2, 'ok', { spec: name });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'relation-spec', name, 'existing');

    return branch(
      p,
      'existing',
      (b) =>
        branch(
          b,
          (bindings) => !(bindings.existing as Record<string, unknown>)._deleted,
          (b2) =>
            completeFrom(b2, 'ok', (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              return { spec: rec.name as string, paths: rec.paths as string };
            }),
          (b2) =>
            complete(b2, 'notfound', {
              message: `No relation spec with name "${name}" found`,
            }),
        ),
      (b) =>
        complete(b, 'notfound', {
          message: `No relation spec with name "${name}" found`,
        }),
    ) as StorageProgram<Result>;
  },

  update(input: Record<string, unknown>) {
    const name     = input.name  as string;
    const pathsRaw = input.paths as string;

    // Validate paths JSON
    try {
      JSON.parse(pathsRaw ?? '[]');
    } catch {
      return complete(createProgram(), 'error', {
        message: 'paths must be a valid JSON array',
      }) as StorageProgram<Result>;
    }

    const paths = pathsRaw ?? '[]';

    let p = createProgram();
    p = get(p, 'relation-spec', name, 'existing');

    return branch(
      p,
      'existing',
      (b) => {
        const b2 = put(b, 'relation-spec', name, { name, paths });
        return complete(b2, 'ok', { spec: name });
      },
      (b) =>
        complete(b, 'notfound', {
          message: `No relation spec with name "${name}" found`,
        }),
    ) as StorageProgram<Result>;
  },

  addPath(input: Record<string, unknown>) {
    const name    = input.name as string;
    const pathRaw = input.path as string;

    // Validate path JSON
    let parsed: PathDescriptor;
    try {
      parsed = JSON.parse(pathRaw) as PathDescriptor;
    } catch {
      return complete(createProgram(), 'error', {
        message: 'path must be a valid JSON object',
      }) as StorageProgram<Result>;
    }

    // Ensure the path has at least one identifying key
    if (!parsed.field && !parsed.reverse && !parsed.link) {
      return complete(createProgram(), 'error', {
        message: 'path must have a "field", "reverse", or "link" property',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'relation-spec', name, 'existing');

    return branch(
      p,
      'existing',
      (b) => {
        let b2 = mapBindings(
          b,
          (bindings) => {
            const rec = bindings.existing as Record<string, unknown>;
            let existing: PathDescriptor[] = [];
            try {
              existing = JSON.parse(rec.paths as string) as PathDescriptor[];
            } catch {
              existing = [];
            }
            return JSON.stringify([...existing, parsed]);
          },
          'newPaths',
        );
        b2 = put(b2, 'relation-spec', name, { name, paths: (b2 as unknown as Record<string, unknown>).newPaths });
        // Use completeFrom to read the computed newPaths binding
        return completeFrom(b2, 'ok', (bindings) => ({
          spec:  name,
          paths: bindings.newPaths as string,
        }));
      },
      (b) =>
        complete(b, 'notfound', {
          message: `No relation spec with name "${name}" found`,
        }),
    ) as StorageProgram<Result>;
  },

  removePath(input: Record<string, unknown>) {
    const name  = input.name  as string;
    const field = input.field as string;

    let p = createProgram();
    p = get(p, 'relation-spec', name, 'existing');

    return branch(
      p,
      'existing',
      (b) => {
        let b2 = mapBindings(
          b,
          (bindings) => {
            const rec = bindings.existing as Record<string, unknown>;
            let paths: PathDescriptor[] = [];
            try {
              paths = JSON.parse(rec.paths as string) as PathDescriptor[];
            } catch {
              paths = [];
            }
            const filtered = paths.filter((path) => pathKey(path) !== field);
            // Return null when nothing was removed (path not found)
            if (filtered.length === paths.length) return null;
            return JSON.stringify(filtered);
          },
          'newPaths',
        );

        return branch(
          b2,
          (bindings) => bindings.newPaths !== null,
          (b3) => {
            // Persist the updated paths
            const b4 = put(b3, 'relation-spec', name, {
              name,
              paths: (b3 as unknown as Record<string, unknown>).newPaths as string,
            });
            return completeFrom(b4, 'ok', (bindings) => ({
              spec:  name,
              paths: bindings.newPaths as string,
            }));
          },
          (b3) =>
            complete(b3, 'path_not_found', {
              message: `No path with field "${field}" found in relation spec "${name}"`,
            }),
        );
      },
      (b) =>
        complete(b, 'notfound', {
          message: `No relation spec with name "${name}" found`,
        }),
    ) as StorageProgram<Result>;
  },

  remove(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'relation-spec', name, 'existing');

    return branch(
      p,
      'existing',
      (b) => {
        // Overwrite with a tombstone marker so subsequent gets return notfound
        const b2 = put(b, 'relation-spec', name, { name, _deleted: true });
        return complete(b2, 'ok', {});
      },
      (b) =>
        complete(b, 'notfound', {
          message: `No relation spec with name "${name}" found`,
        }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'relation-spec', {}, 'allSpecs');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allSpecs as Array<Record<string, unknown>>) ?? [];
      // Exclude tombstoned records
      const names = all
        .filter((s) => !s._deleted)
        .map((s) => s.name as string);
      return { specs: JSON.stringify(names) };
    }) as StorageProgram<Result>;
  },
};

export const relationSpecHandler = autoInterpret(_handler);
