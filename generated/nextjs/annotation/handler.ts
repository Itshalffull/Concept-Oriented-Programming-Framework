// Annotation — Source code annotation management: attach structured metadata to concepts,
// validate annotation scopes, query annotations by concept and type.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  AnnotationStorage,
  AnnotationAnnotateInput,
  AnnotationAnnotateOutput,
  AnnotationResolveInput,
  AnnotationResolveOutput,
} from './types.js';

import {
  annotateOk,
  annotateInvalidScope,
  resolveOk,
  resolveNotFound,
} from './types.js';

export interface AnnotationError {
  readonly code: string;
  readonly message: string;
}

export interface AnnotationHandler {
  readonly annotate: (
    input: AnnotationAnnotateInput,
    storage: AnnotationStorage,
  ) => TE.TaskEither<AnnotationError, AnnotationAnnotateOutput>;
  readonly resolve: (
    input: AnnotationResolveInput,
    storage: AnnotationStorage,
  ) => TE.TaskEither<AnnotationError, AnnotationResolveOutput>;
}

// --- Helpers ---

const toStorageError = (error: unknown): AnnotationError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const VALID_SCOPES: readonly string[] = [
  'concept',
  'operation',
  'field',
  'variant',
  'sync',
  'handler',
  'type',
  'module',
] as const;

const parseAnnotationContent = (content: string): {
  readonly ok: boolean;
  readonly keys: readonly string[];
  readonly error?: string;
} => {
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false, keys: [], error: 'Annotation content must be a JSON object' };
    }
    const keys = Object.keys(parsed);
    return { ok: true, keys };
  } catch {
    // If not valid JSON, treat as a single key-value text annotation
    return { ok: true, keys: ['value'] };
  }
};

// --- Implementation ---

export const annotationHandler: AnnotationHandler = {
  annotate: (input, storage) =>
    pipe(
      TE.of(input.scope),
      TE.chain((scope) => {
        // Validate the annotation scope
        if (!VALID_SCOPES.includes(scope)) {
          return TE.right(annotateInvalidScope(scope) as AnnotationAnnotateOutput);
        }

        const contentResult = parseAnnotationContent(input.content);
        if (!contentResult.ok) {
          return TE.right(annotateInvalidScope(
            `Invalid content: ${contentResult.error}`,
          ) as AnnotationAnnotateOutput);
        }

        const annotationId = `${input.concept}:${input.scope}:${Date.now()}`;

        return pipe(
          TE.tryCatch(
            () => storage.find('annotations', { concept: input.concept, scope: input.scope }),
            toStorageError,
          ),
          TE.chain((existing) =>
            pipe(
              TE.tryCatch(
                async () => {
                  // Store the new annotation alongside any existing ones
                  await storage.put('annotations', annotationId, {
                    annotationId,
                    concept: input.concept,
                    scope: input.scope,
                    content: input.content,
                    keyCount: contentResult.keys.length,
                    keys: contentResult.keys,
                    createdAt: new Date().toISOString(),
                    index: existing.length,
                  });

                  return annotateOk(annotationId, contentResult.keys.length);
                },
                toStorageError,
              ),
            ),
          ),
        );
      }),
    ),

  resolve: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('annotations', { concept: input.concept }),
        toStorageError,
      ),
      TE.map((records) => {
        if (records.length === 0) {
          return resolveNotFound(input.concept) as AnnotationResolveOutput;
        }

        // Collect all annotation content strings for the concept
        const annotations = records.map((r) => {
          const rec = r as Record<string, unknown>;
          return String(rec.content ?? '');
        });

        return resolveOk(annotations);
      }),
    ),
};
