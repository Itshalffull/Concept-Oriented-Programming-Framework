// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Resource Concept Implementation
//
// Tracks input resources to generation pipelines. Each resource
// has a content digest for change detection.
// See clef-generation-suite.md Part 1.1
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom, mapBindings, putFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';
import { randomUUID } from 'crypto';

type Result = { variant: string; [key: string]: unknown };

const RESOURCES_RELATION = 'resources';

const _handler: FunctionalConceptHandler = {
  /**
   * Upsert a resource by locator. Returns created/changed/unchanged
   * based on whether the resource is new, has a different digest,
   * or is identical to the stored version.
   */
  upsert(input: Record<string, unknown>) {
    const locator = input.locator as string;
    const kind = input.kind as string;
    const digest = input.digest as string;
    const lastModified = input.lastModified as string | undefined;
    const size = input.size as number | undefined;

    let p = createProgram();
    p = get(p, RESOURCES_RELATION, locator, 'existing');

    p = branch(p, 'existing',
      (b) => {
        return branch(b,
          (bindings) => {
            const existing = bindings.existing as Record<string, unknown>;
            return (existing.digest as string) === digest;
          },
          // Unchanged
          (b2) => completeFrom(b2, 'unchanged', (bindings) => {
            const existing = bindings.existing as Record<string, unknown>;
            return { resource: existing.id as string };
          }),
          // Changed — update digest and metadata
          (b2) => {
            let b3 = mapBindings(b2, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              return existing.digest as string;
            }, 'previousDigest');

            b3 = putFrom(b3, RESOURCES_RELATION, locator, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              return {
                ...existing,
                digest,
                kind,
                lastModified: lastModified || existing.lastModified,
                size: size ?? existing.size,
              };
            });

            return completeFrom(b3, 'changed', (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              return {
                resource: existing.id as string,
                previousDigest: bindings.previousDigest as string,
              };
            });
          },
        );
      },
      // New resource
      (b) => {
        const resourceId = randomUUID();
        const b2 = put(b, RESOURCES_RELATION, locator, {
          id: resourceId,
          locator,
          kind,
          digest,
          lastModified: lastModified || null,
          size: size ?? null,
        });
        return complete(b2, 'ok', { resource: resourceId });
      },
    );

    return p as StorageProgram<Result>;
  },

  /**
   * Get a resource by locator.
   */
  get(input: Record<string, unknown>) {
    const locator = input.locator as string;

    let p = createProgram();
    p = get(p, RESOURCES_RELATION, locator, 'existing');

    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        return {
          resource: existing.id as string,
          kind: existing.kind as string,
          digest: existing.digest as string,
        };
      }),
      (b) => complete(b, 'notFound', { locator }),
    );

    return p as StorageProgram<Result>;
  },

  /**
   * List all tracked resources, optionally filtered by kind.
   */
  list(input: Record<string, unknown>) {
    const kind = input.kind as string | undefined;

    let p = createProgram();
    p = kind
      ? find(p, RESOURCES_RELATION, { kind }, 'allResources')
      : find(p, RESOURCES_RELATION, {}, 'allResources');

    return completeFrom(p, 'ok', (bindings) => {
      const allResources = bindings.allResources as Array<Record<string, unknown>>;
      const resources = allResources.map(r => ({
        locator: r.locator as string,
        kind: r.kind as string,
        digest: r.digest as string,
      }));
      return { resources };
    }) as StorageProgram<Result>;
  },

  /**
   * Remove a resource from tracking.
   */
  remove(input: Record<string, unknown>) {
    const locator = input.locator as string;

    let p = createProgram();
    p = get(p, RESOURCES_RELATION, locator, 'existing');

    p = branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return existing.id as string;
        }, 'resourceId');
        b2 = del(b2, RESOURCES_RELATION, locator);
        return completeFrom(b2, 'ok', (bindings) => ({
          resource: bindings.resourceId as string,
        }));
      },
      (b) => complete(b, 'notFound', { locator }),
    );

    return p as StorageProgram<Result>;
  },

  /**
   * Classify the change type for a resource kind.
   * Initial implementation returns 'unknown' for all kinds —
   * kind-specific differs can be registered later.
   */
  diff(input: Record<string, unknown>) {
    const locator = input.locator as string;

    let p = createProgram();
    return complete(p, 'unknown', {
      message: `No kind-specific differ registered for resource at ${locator}`,
    }) as StorageProgram<Result>;
  },
};

export const resourceHandler = autoInterpret(_handler);
