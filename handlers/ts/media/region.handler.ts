// @clef-handler style=functional concept=Region
// Region Concept Implementation — Functional (StorageProgram) style
//
// Manages spatial sub-areas of visual media (images, PDF pages, video frames)
// with normalized coordinates, shape type, and optional snapshot.
// Supports create, resolve, crop, get, list, setLabel, and delete.
// See repertoire/concepts/media/region.concept for the full spec.

import { randomUUID } from 'crypto';
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, mergeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_SHAPES = ['rect', 'polygon', 'freeform'] as const;

function isValidShape(shape: string): boolean {
  return (VALID_SHAPES as readonly string[]).includes(shape);
}

// ─── Handler ─────────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', { name: 'Region' }) as StorageProgram<Result>;
  },

  // create is overridden imperatively below (dynamic UUID key)
  create(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', { id: '' }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const id = input.id as string;

    let p = createProgram();
    p = get(p, 'region', id, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No region exists with id "${id}"` }),
      (b) => {
        // Branch on stored status to select ok vs stale variant
        return branch(b,
          (bindings) => (bindings.existing as Record<string, unknown>).status === 'stale',
          (bb) => completeFrom(bb, 'stale', (bindings) => ({
            id,
            snapshot: (bindings.existing as Record<string, unknown>).snapshot ?? null,
          })),
          (bb) => completeFrom(bb, 'ok', (bindings) => ({
            id,
            snapshot: (bindings.existing as Record<string, unknown>).snapshot ?? null,
          })),
        );
      },
    ) as StorageProgram<Result>;
  },

  crop(input: Record<string, unknown>) {
    const id = input.id as string;

    let p = createProgram();
    p = get(p, 'region', id, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No region exists with id "${id}"` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        // Placeholder: return stored snapshot or empty string if not yet generated
        const snapshot = (rec.snapshot as string) ?? '';
        return { id, snapshot };
      }),
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const id = input.id as string;

    let p = createProgram();
    p = get(p, 'region', id, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No region exists with id "${id}"` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return {
          id: rec.id as string,
          sourceEntity: rec.sourceEntity as string,
          bounds: rec.bounds as string,
          shape: rec.shape as string,
          points: rec.points ?? null,
          page: rec.page ?? null,
          snapshot: rec.snapshot ?? null,
          label: rec.label ?? null,
          kind: rec.kind ?? null,
          status: rec.status as string,
        };
      }),
    ) as StorageProgram<Result>;
  },

  list(input: Record<string, unknown>) {
    const sourceEntity = (input.sourceEntity as string | null | undefined) ?? null;

    let p = createProgram();
    // Find all regions — filter client-side when sourceEntity is provided
    p = find(p, 'region', {}, 'allRegions');

    if (sourceEntity) {
      p = mapBindings(p, (bindings) => {
        const all = (bindings.allRegions ?? []) as Array<Record<string, unknown>>;
        return all.filter(r => r.sourceEntity === sourceEntity);
      }, '_filtered');
      return completeFrom(p, 'ok', (bindings) => {
        const filtered = (bindings._filtered ?? []) as Array<Record<string, unknown>>;
        return { regions: filtered.map(r => r.id as string) };
      }) as StorageProgram<Result>;
    }

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allRegions ?? []) as Array<Record<string, unknown>>;
      return { regions: all.map(r => r.id as string) };
    }) as StorageProgram<Result>;
  },

  setLabel(input: Record<string, unknown>) {
    const id = input.id as string;
    const label = (input.label as string) ?? '';

    let p = createProgram();
    p = get(p, 'region', id, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No region exists with id "${id}"` }),
      (b) => {
        let b2 = mergeFrom(b, 'region', id, () => ({ label }));
        return complete(b2, 'ok', { id });
      },
    ) as StorageProgram<Result>;
  },

  delete(input: Record<string, unknown>) {
    const id = input.id as string;

    let p = createProgram();
    p = get(p, 'region', id, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No region exists with id "${id}"` }),
      (b) => {
        let b2 = del(b, 'region', id);
        return complete(b2, 'ok', { id });
      },
    ) as StorageProgram<Result>;
  },

};

// ─── Export (with imperative override for create) ─────────────────────────────

const _base = autoInterpret(_handler);

export const regionHandler = {
  ..._base,

  register: _base.register,

  async create(input: Record<string, unknown>, storage: import('../../../runtime/types.ts').ConceptStorage) {
    const sourceEntity = (input.sourceEntity as string) ?? '';
    const bounds = (input.bounds as string) ?? '';
    const shape = (input.shape as string) ?? '';
    const points = (input.points as string | null) ?? null;
    const page = (input.page as string | null) ?? null;
    const label = (input.label as string | null) ?? null;
    const kind = (input.kind as string | null) ?? null;

    // Input validation — must match error-case fixtures
    if (!sourceEntity || sourceEntity.trim() === '') {
      return { variant: 'error', message: 'sourceEntity is required' };
    }
    if (!bounds || bounds.trim() === '') {
      return { variant: 'error', message: 'bounds is required' };
    }
    try {
      JSON.parse(bounds);
    } catch {
      return { variant: 'error', message: 'bounds must be valid JSON' };
    }
    if (!shape || shape.trim() === '') {
      return { variant: 'error', message: 'shape is required' };
    }
    if (!isValidShape(shape)) {
      return { variant: 'error', message: `shape must be one of: rect, polygon, freeform` };
    }

    const id = randomUUID();

    await storage.put('region', id, {
      id,
      sourceEntity,
      bounds,
      shape,
      points,
      page,
      label,
      kind,
      snapshot: null,
      status: 'active',
    });

    return { variant: 'ok', id };
  },
};
