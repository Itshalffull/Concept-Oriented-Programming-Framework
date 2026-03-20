// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Projection Concept Implementation (Clef Bind)
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _interfaceProjectionHandler: FunctionalConceptHandler = {
  project(input: Record<string, unknown>) {
    const manifest = input.manifest as string;
    const annotations = input.annotations as string;

    let manifestData: Record<string, unknown>;
    try { manifestData = JSON.parse(manifest); }
    catch { manifestData = { name: manifest }; }

    let annotationData: Record<string, unknown>;
    try { annotationData = JSON.parse(annotations); }
    catch {
      const p = createProgram();
      return complete(p, 'annotationError', {
        concept: (manifestData.name as string) ?? 'unknown',
        errors: JSON.stringify(['Invalid annotation JSON']),
      }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const conceptName = (manifestData.name as string) ?? (manifestData.concept as string) ?? 'unknown';
    const suiteName = (manifestData.kit as string) ?? 'default';
    const traits = (annotationData.traits as Array<{ name: string; scope: string; config: string }>) ?? [];
    const shapes = (manifestData.shapes as Array<{ name: string; kind: string; resolved: string }>) ?? [];
    const actions = (manifestData.actions as string[]) ?? [];
    const traitNames = traits.map((t) => t.name);

    if (traitNames.includes('paginated') && traitNames.includes('streaming')) {
      const p = createProgram();
      return complete(p, 'traitConflict', {
        concept: conceptName, trait1: 'paginated', trait2: 'streaming',
        reason: 'Cannot apply both @paginated and @streaming to the same action',
      }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const projectionId = `proj-${conceptName}-${Date.now()}`;

    let p = createProgram();
    p = put(p, 'projection', projectionId, {
      projectionId, concept: conceptName, suiteName,
      conceptManifest: manifest,
      traits: JSON.stringify(traits),
      resourceMapping: '',
      targetOverrides: JSON.stringify([]),
      shapes: JSON.stringify(shapes),
      crossReferences: JSON.stringify([]),
      actionCount: actions.length,
      traitCount: traits.length,
      shapeCount: shapes.length,
    });

    return complete(p, 'ok', {
      projection: projectionId,
      shapes: shapes.length,
      actions: actions.length,
      traits: traits.length,
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  validate(input: Record<string, unknown>) {
    const projection = input.projection as string;

    let p = createProgram();
    p = spGet(p, 'projection', projection, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { projection, warnings: JSON.stringify([]) }),
      (b) => complete(b, 'incompleteAnnotation', { projection, missing: JSON.stringify(['Projection not found']) }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  diff(input: Record<string, unknown>) {
    const projection = input.projection as string;
    const previous = input.previous as string;

    let p = createProgram();
    p = spGet(p, 'projection', projection, 'current');
    p = spGet(p, 'projection', previous, 'prev');
    return complete(p, 'ok', {
      added: JSON.stringify([]),
      removed: JSON.stringify([]),
      changed: JSON.stringify([]),
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  inferResources(input: Record<string, unknown>) {
    const projection = input.projection as string;

    let p = createProgram();
    p = spGet(p, 'projection', projection, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'projection', projection, {});
        return complete(b2, 'ok', { projection, resources: JSON.stringify([]) });
      },
      (b) => complete(b, 'ok', { projection, resources: JSON.stringify([]) }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const interfaceProjectionHandler = autoInterpret(_interfaceProjectionHandler);

