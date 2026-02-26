// ============================================================
// Resource Concept Implementation
//
// Tracks input resources to generation pipelines. Each resource
// has a content digest for change detection.
// See clef-generation-suite.md Part 1.1
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../kernel/src/types.js';
import { randomUUID } from 'crypto';

const RESOURCES_RELATION = 'resources';

export const resourceHandler: ConceptHandler = {
  /**
   * Upsert a resource by locator. Returns created/changed/unchanged
   * based on whether the resource is new, has a different digest,
   * or is identical to the stored version.
   */
  async upsert(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const locator = input.locator as string;
    const kind = input.kind as string;
    const digest = input.digest as string;
    const lastModified = input.lastModified as string | undefined;
    const size = input.size as number | undefined;

    const existing = await storage.get(RESOURCES_RELATION, locator);

    if (!existing) {
      // New resource
      const resourceId = randomUUID();
      await storage.put(RESOURCES_RELATION, locator, {
        id: resourceId,
        locator,
        kind,
        digest,
        lastModified: lastModified || null,
        size: size ?? null,
      });
      return { variant: 'created', resource: resourceId };
    }

    const storedDigest = existing.digest as string;

    if (storedDigest === digest) {
      // Unchanged
      return { variant: 'unchanged', resource: existing.id as string };
    }

    // Changed — update digest and metadata
    const previousDigest = storedDigest;
    await storage.put(RESOURCES_RELATION, locator, {
      ...existing,
      digest,
      kind,
      lastModified: lastModified || existing.lastModified,
      size: size ?? existing.size,
    });

    return {
      variant: 'changed',
      resource: existing.id as string,
      previousDigest,
    };
  },

  /**
   * Get a resource by locator.
   */
  async get(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const locator = input.locator as string;
    const existing = await storage.get(RESOURCES_RELATION, locator);

    if (!existing) {
      return { variant: 'notFound', locator };
    }

    return {
      variant: 'ok',
      resource: existing.id as string,
      kind: existing.kind as string,
      digest: existing.digest as string,
    };
  },

  /**
   * List all tracked resources, optionally filtered by kind.
   */
  async list(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const kind = input.kind as string | undefined;

    const allResources = kind
      ? await storage.find(RESOURCES_RELATION, { kind })
      : await storage.find(RESOURCES_RELATION);

    const resources = allResources.map(r => ({
      locator: r.locator as string,
      kind: r.kind as string,
      digest: r.digest as string,
    }));

    return { variant: 'ok', resources };
  },

  /**
   * Remove a resource from tracking.
   */
  async remove(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const locator = input.locator as string;
    const existing = await storage.get(RESOURCES_RELATION, locator);

    if (!existing) {
      return { variant: 'notFound', locator };
    }

    await storage.del(RESOURCES_RELATION, locator);

    return { variant: 'ok', resource: existing.id as string };
  },

  /**
   * Classify the change type for a resource kind.
   * Initial implementation returns 'unknown' for all kinds —
   * kind-specific differs can be registered later.
   */
  async diff(
    input: Record<string, unknown>,
    _storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const locator = input.locator as string;
    const _oldDigest = input.oldDigest as string;
    const _newDigest = input.newDigest as string;

    // Kind-specific diffing is not yet implemented.
    // Future: register diff functions per kind (concept-spec, sync-spec, etc.)
    return {
      variant: 'unknown',
      message: `No kind-specific differ registered for resource at ${locator}`,
    };
  },
};
