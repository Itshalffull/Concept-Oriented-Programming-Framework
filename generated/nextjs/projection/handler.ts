// Projection — Data projection and view layer for concept manifests
// Projects manifests into shapes/actions/traits, validates for breaking changes, diffs versions.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ProjectionStorage,
  ProjectionProjectInput,
  ProjectionProjectOutput,
  ProjectionValidateInput,
  ProjectionValidateOutput,
  ProjectionDiffInput,
  ProjectionDiffOutput,
  ProjectionInferResourcesInput,
  ProjectionInferResourcesOutput,
} from './types.js';

import {
  projectOk,
  projectAnnotationError,
  projectUnresolvedReference,
  projectTraitConflict,
  validateOk,
  validateBreakingChange,
  validateIncompleteAnnotation,
  diffOk,
  diffIncompatible,
  inferResourcesOk,
} from './types.js';

export interface ProjectionError {
  readonly code: string;
  readonly message: string;
}

const storageError = (error: unknown): ProjectionError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Parse manifest JSON safely, returning null on failure. */
const parseManifest = (manifest: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(manifest);
  } catch {
    return null;
  }
};

/** Extract shapes, actions, and traits counts from a parsed manifest. */
const countProjectionElements = (
  parsed: Record<string, unknown>,
): { readonly shapes: number; readonly actions: number; readonly traits: number } => {
  const state = parsed['state'];
  const actions = parsed['actions'];
  const traits = parsed['traits'] ?? parsed['capabilities'];
  return {
    shapes: Array.isArray(state) ? state.length : (typeof state === 'object' && state ? Object.keys(state).length : 0),
    actions: Array.isArray(actions) ? actions.length : (typeof actions === 'object' && actions ? Object.keys(actions).length : 0),
    traits: Array.isArray(traits) ? traits.length : 0,
  };
};

export interface ProjectionHandler {
  readonly project: (
    input: ProjectionProjectInput,
    storage: ProjectionStorage,
  ) => TE.TaskEither<ProjectionError, ProjectionProjectOutput>;
  readonly validate: (
    input: ProjectionValidateInput,
    storage: ProjectionStorage,
  ) => TE.TaskEither<ProjectionError, ProjectionValidateOutput>;
  readonly diff: (
    input: ProjectionDiffInput,
    storage: ProjectionStorage,
  ) => TE.TaskEither<ProjectionError, ProjectionDiffOutput>;
  readonly inferResources: (
    input: ProjectionInferResourcesInput,
    storage: ProjectionStorage,
  ) => TE.TaskEither<ProjectionError, ProjectionInferResourcesOutput>;
}

// --- Implementation ---

export const projectionHandler: ProjectionHandler = {
  project: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const manifest = parseManifest(input.manifest);
          if (!manifest) {
            return projectAnnotationError('unknown', ['Failed to parse manifest JSON']);
          }

          const conceptName = String(manifest['name'] ?? 'unknown');

          // Parse annotations and validate
          const annotations = parseManifest(input.annotations);
          if (!annotations) {
            return projectAnnotationError(conceptName, ['Failed to parse annotations JSON']);
          }

          // Check for annotation errors
          const annotationErrors: string[] = [];
          if (annotations['expose'] && typeof annotations['expose'] !== 'object') {
            annotationErrors.push('Invalid expose annotation: expected object');
          }
          if (annotationErrors.length > 0) {
            return projectAnnotationError(conceptName, annotationErrors);
          }

          // Check for unresolved references
          const refs = Array.isArray(manifest['references']) ? manifest['references'] : [];
          const missing: string[] = [];
          for (const ref of refs) {
            const resolved = await storage.get('concept_entity', String(ref));
            if (!resolved) {
              missing.push(String(ref));
            }
          }
          if (missing.length > 0) {
            return projectUnresolvedReference(conceptName, missing);
          }

          // Check for trait conflicts
          const traits = Array.isArray(manifest['traits']) ? manifest['traits'] as readonly Record<string, unknown>[] : [];
          for (let i = 0; i < traits.length; i++) {
            for (let j = i + 1; j < traits.length; j++) {
              const t1 = traits[i];
              const t2 = traits[j];
              if (t1['name'] && t2['name'] && t1['name'] === t2['name']) {
                return projectTraitConflict(
                  conceptName,
                  String(t1['name']),
                  String(t2['name']),
                  'Duplicate trait name',
                );
              }
            }
          }

          const counts = countProjectionElements(manifest);
          const projectionId = `proj_${conceptName}`;

          await storage.put('projection', projectionId, {
            id: projectionId,
            manifest: input.manifest,
            annotations: input.annotations,
            shapes: counts.shapes,
            actions: counts.actions,
            traits: counts.traits,
            createdAt: new Date().toISOString(),
          });

          return projectOk(projectionId, counts.shapes, counts.actions, counts.traits);
        },
        storageError,
      ),
    ),

  validate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const projection = await storage.get('projection', input.projection);
          if (!projection) {
            return validateIncompleteAnnotation(input.projection, ['Projection not found']);
          }

          const manifest = parseManifest(String(projection['manifest'] ?? '{}'));
          const annotations = parseManifest(String(projection['annotations'] ?? '{}'));

          if (!manifest || !annotations) {
            return validateIncompleteAnnotation(input.projection, ['Invalid stored projection data']);
          }

          // Check for incomplete annotations (actions without expose annotations)
          const actions = manifest['actions'];
          const missingAnnotations: string[] = [];
          if (typeof actions === 'object' && actions) {
            const actionKeys = Array.isArray(actions) ? actions.map((a: Record<string, unknown>) => String(a['name'] ?? '')) : Object.keys(actions);
            for (const actionName of actionKeys) {
              const expose = annotations['expose'];
              if (typeof expose === 'object' && expose && !(expose as Record<string, unknown>)[actionName]) {
                missingAnnotations.push(`Action '${actionName}' has no expose annotation`);
              }
            }
          }

          if (missingAnnotations.length > 0) {
            return validateIncompleteAnnotation(input.projection, missingAnnotations);
          }

          // Check for breaking changes against previous version
          const previousProjection = await storage.get('projection_history', input.projection);
          if (previousProjection) {
            const oldManifest = parseManifest(String(previousProjection['manifest'] ?? '{}'));
            if (oldManifest) {
              const breakingChanges: string[] = [];
              const oldActions = typeof oldManifest['actions'] === 'object' ? Object.keys(oldManifest['actions'] ?? {}) : [];
              const newActions = typeof manifest['actions'] === 'object' ? Object.keys(manifest['actions'] ?? {}) : [];
              for (const old of oldActions) {
                if (!newActions.includes(old)) {
                  breakingChanges.push(`Removed action: ${old}`);
                }
              }
              if (breakingChanges.length > 0) {
                return validateBreakingChange(input.projection, breakingChanges);
              }
            }
          }

          const warnings: string[] = [];
          if (Number(projection['shapes'] ?? 0) === 0) {
            warnings.push('Projection has no shapes');
          }

          return validateOk(input.projection, warnings);
        },
        storageError,
      ),
    ),

  diff: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const current = await storage.get('projection', input.projection);
          const previous = await storage.get('projection', input.previous);

          if (!current || !previous) {
            return diffIncompatible(
              `Cannot diff: ${!current ? input.projection : input.previous} not found`,
            );
          }

          const currentManifest = parseManifest(String(current['manifest'] ?? '{}'));
          const previousManifest = parseManifest(String(previous['manifest'] ?? '{}'));

          if (!currentManifest || !previousManifest) {
            return diffIncompatible('Cannot parse projection manifests for diff');
          }

          const currentKeys = new Set(Object.keys(currentManifest));
          const previousKeys = new Set(Object.keys(previousManifest));

          const added = [...currentKeys].filter((k) => !previousKeys.has(k));
          const removed = [...previousKeys].filter((k) => !currentKeys.has(k));
          const changed = [...currentKeys]
            .filter((k) => previousKeys.has(k))
            .filter((k) => JSON.stringify(currentManifest[k]) !== JSON.stringify(previousManifest[k]));

          return diffOk(added, removed, changed);
        },
        storageError,
      ),
    ),

  inferResources: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const projection = await storage.get('projection', input.projection);
          if (!projection) {
            return inferResourcesOk(input.projection, []);
          }

          const manifest = parseManifest(String(projection['manifest'] ?? '{}'));
          if (!manifest) {
            return inferResourcesOk(input.projection, []);
          }

          const resources: string[] = [];

          // Infer storage resource from state fields
          const state = manifest['state'];
          if (state && typeof state === 'object') {
            resources.push('database_table');
          }

          // Infer API resource from exposed actions
          const actions = manifest['actions'];
          if (actions && typeof actions === 'object') {
            resources.push('api_endpoint');
          }

          // Infer event bus from sync-triggering actions
          const syncs = manifest['syncs'];
          if (syncs && (Array.isArray(syncs) ? syncs.length > 0 : true)) {
            resources.push('event_bus');
          }

          // Infer cache from read-heavy patterns
          const traits = manifest['traits'];
          if (Array.isArray(traits) && traits.some((t: Record<string, unknown>) => String(t['name'] ?? '').includes('cacheable'))) {
            resources.push('cache_layer');
          }

          return inferResourcesOk(input.projection, resources);
        },
        storageError,
      ),
    ),
};
