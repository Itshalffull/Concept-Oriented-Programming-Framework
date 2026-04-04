// @clef-handler style=functional concept=AnnotationLayer
// AnnotationLayer Concept Implementation — Functional (StorageProgram) style
//
// Manages named annotation layers scoped to document entities. Each layer holds
// a set of annotation IDs, a visibility state, and optional owner/color metadata.
// Supports create (duplicate + empty-field guards), addAnnotation, removeAnnotation,
// setVisibility (enum validation), export (merge into target layer), flatten (delete
// layer record and return annotation count), get (full metadata + count), list
// (all layers for an entityRef), and delete.
// See repertoire/concepts/media/annotation-layer.concept for the full spec.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, mergeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_VISIBILITY = ['visible', 'hidden'] as const;

// ─── Handler ─────────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', { name: 'AnnotationLayer' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const entityRef = (input.entityRef as string) ?? '';
    const name = (input.name as string) ?? '';
    const owner = (input.owner as string | null) ?? null;
    const color = (input.color as string | null) ?? null;

    if (!entityRef || entityRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'entityRef is required' }) as StorageProgram<Result>;
    }
    if (!name || name.trim() === '') {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    // Duplicate key: same name + entityRef combination
    const duplicateKey = `${entityRef}::${name}`;

    let p = createProgram();
    p = get(p, 'layer-index', duplicateKey, 'existing');
    return branch(p,
      'existing',
      (b) => complete(b, 'duplicate', { message: `A layer named "${name}" already exists for entity "${entityRef}"` }),
      (b) => {
        // Generate a stable ID from entityRef+name+timestamp approach — use duplicateKey as
        // the layer ID so that uniqueness is enforced both ways
        const id = duplicateKey;
        const now = new Date().toISOString();
        let b2 = put(b, 'layer-index', duplicateKey, { id });
        b2 = put(b2, 'layer', id, {
          id,
          entityRef,
          name,
          owner: owner ?? null,
          color: color ?? null,
          visibility: 'visible',
          annotations: [] as string[],
          createdAt: now,
        });
        return complete(b2, 'ok', { id });
      },
    ) as StorageProgram<Result>;
  },

  addAnnotation(input: Record<string, unknown>) {
    const id = (input.id as string) ?? '';
    const annotationId = (input.annotationId as string) ?? '';

    let p = createProgram();
    p = get(p, 'layer', id, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No layer exists with id "${id}"` }),
      (b) => {
        let b2 = mergeFrom(b, 'layer', id, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const annotations = [...((rec.annotations as string[]) ?? [])];
          if (!annotations.includes(annotationId)) {
            annotations.push(annotationId);
          }
          return { annotations };
        });
        return complete(b2, 'ok', { id });
      },
    ) as StorageProgram<Result>;
  },

  removeAnnotation(input: Record<string, unknown>) {
    const id = (input.id as string) ?? '';
    const annotationId = (input.annotationId as string) ?? '';

    let p = createProgram();
    p = get(p, 'layer', id, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No layer exists with id "${id}"` }),
      (b) => {
        let b2 = mergeFrom(b, 'layer', id, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const annotations = ((rec.annotations as string[]) ?? []).filter(
            (a) => a !== annotationId,
          );
          return { annotations };
        });
        return complete(b2, 'ok', { id });
      },
    ) as StorageProgram<Result>;
  },

  setVisibility(input: Record<string, unknown>) {
    const id = (input.id as string) ?? '';
    const visibility = (input.visibility as string) ?? '';

    if (!(VALID_VISIBILITY as readonly string[]).includes(visibility)) {
      return complete(createProgram(), 'error', {
        message: `visibility must be "visible" or "hidden"`,
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'layer', id, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No layer exists with id "${id}"` }),
      (b) => {
        let b2 = mergeFrom(b, 'layer', id, () => ({ visibility }));
        return complete(b2, 'ok', { id });
      },
    ) as StorageProgram<Result>;
  },

  export(input: Record<string, unknown>) {
    const id = (input.id as string) ?? '';
    const targetLayerId = (input.targetLayerId as string) ?? '';

    let p = createProgram();
    p = get(p, 'layer', id, 'sourceLayer');
    p = get(p, 'layer', targetLayerId, 'targetLayer');

    return branch(p,
      (b) => b.sourceLayer == null,
      (b) => complete(b, 'notfound', { message: `Source layer "${id}" does not exist` }),
      (b) => branch(b,
        (bb) => bb.targetLayer == null,
        (bb) => complete(bb, 'notfound', { message: `Target layer "${targetLayerId}" does not exist` }),
        (bb) => {
          let b2 = mergeFrom(bb, 'layer', targetLayerId, (bindings) => {
            const src = bindings.sourceLayer as Record<string, unknown>;
            const tgt = bindings.targetLayer as Record<string, unknown>;
            const srcAnnotations = (src.annotations as string[]) ?? [];
            const tgtAnnotations = (tgt.annotations as string[]) ?? [];
            const merged = [...tgtAnnotations];
            for (const ann of srcAnnotations) {
              if (!merged.includes(ann)) {
                merged.push(ann);
              }
            }
            return { annotations: merged };
          });
          return completeFrom(b2, 'ok', (bindings) => {
            const src = bindings.sourceLayer as Record<string, unknown>;
            const count = ((src.annotations as string[]) ?? []).length;
            return { count };
          });
        },
      ),
    ) as StorageProgram<Result>;
  },

  flatten(input: Record<string, unknown>) {
    const id = (input.id as string) ?? '';

    let p = createProgram();
    p = get(p, 'layer', id, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No layer exists with id "${id}"` }),
      (b) => {
        // Capture the annotation count before deletion
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return ((rec.annotations as string[]) ?? []).length;
        }, '_count');

        // The layer id IS the duplicateKey (entityRef::name), so the index
        // entry shares the same key — remove both records with static keys.
        b2 = del(b2, 'layer', id);
        b2 = del(b2, 'layer-index', id);

        return completeFrom(b2, 'ok', (bindings) => ({
          count: bindings._count as number,
        }));
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const id = (input.id as string) ?? '';

    let p = createProgram();
    p = get(p, 'layer', id, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No layer exists with id "${id}"` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        const annotations = (rec.annotations as string[]) ?? [];
        return {
          id: rec.id as string,
          entityRef: rec.entityRef as string,
          name: rec.name as string,
          owner: rec.owner ?? null,
          visibility: rec.visibility as string,
          color: rec.color ?? null,
          annotationCount: annotations.length,
        };
      }),
    ) as StorageProgram<Result>;
  },

  list(input: Record<string, unknown>) {
    const entityRef = (input.entityRef as string) ?? '';

    let p = createProgram();
    p = find(p, 'layer', { entityRef }, 'allLayers');
    return completeFrom(p, 'ok', (bindings) => {
      const layers = (bindings.allLayers ?? []) as Array<Record<string, unknown>>;
      return { layers: layers.map((l) => l.id as string) };
    }) as StorageProgram<Result>;
  },

  delete(input: Record<string, unknown>) {
    const id = (input.id as string) ?? '';

    let p = createProgram();
    p = get(p, 'layer', id, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No layer exists with id "${id}"` }),
      (b) => {
        // The layer id IS the duplicateKey (entityRef::name), so the index
        // entry shares the same key — remove both with static keys.
        let b2 = del(b, 'layer', id);
        b2 = del(b2, 'layer-index', id);
        return complete(b2, 'ok', { id });
      },
    ) as StorageProgram<Result>;
  },

};

export const annotationLayerHandler = autoInterpret(_handler);
