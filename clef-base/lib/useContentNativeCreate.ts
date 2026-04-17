'use client';

/**
 * useContentNativeCreate — React hook for the Tier 1b content-native create flow.
 *
 * PRD:    docs/plans/creation-ux-prd.md §2.1 (Tier 1b), deliverable 5
 * Card:   CUX-05
 * Commit: dd49a1a0 (ContentNode/createWithSchema shipped)
 *
 * ## Flow
 *
 * When a destination's target Schema has `displayWidget` Property set
 * (the content-native page-as-record pattern), clicking Create should:
 *
 *   1. Derive a human-readable node ID from schemaId + title (when provided),
 *      or fall back to crypto.randomUUID for untitled nodes.
 *      Slug form: `{schemaId}:{slugifiedTitle}-{random6}` — readable AND
 *      collision-safe. This prevents raw UUIDs from appearing as card titles
 *      in list views that display the `node` field.
 *   2. Invoke ContentNode/createWithSchema(id, schemaId, body: "").
 *   3. Let the general sync foundation/syncs/content-native-schema.sync
 *      automatically scaffold default Template blocks for the schema —
 *      no manual work needed here.
 *   4. Navigate to /content/<id> — Next.js App Router redirects that path
 *      to /admin/content/<id> where the block editor mounts on the ContentNode.
 *
 * ## Usage
 *
 * ```tsx
 * const { create, isPending } = useContentNativeCreate();
 *
 * // In a Create button handler:
 * const result = await create('agent-persona', 'My New Agent');
 * if ('error' in result) {
 *   console.error(result.error);
 * }
 * // On success the hook has already navigated to /content/<entityId>.
 * // entityId will be e.g. "agent-persona:my-new-agent-k3f9x2"
 * ```
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useKernelInvoke } from './clef-provider';
import { slugify } from './slug';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a UUIDv4. Uses crypto.randomUUID when available (all modern
 * browsers and Node 14.17+), falling back to a Math.random-based v4
 * compatible string for older environments (e.g. Safari <15.4).
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: RFC-4122 v4 UUID via Math.random.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a 6-character random alphanumeric suffix for collision avoidance.
 * Uses crypto.getRandomValues when available, falls back to Math.random.
 */
function randomSuffix(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    for (const b of bytes) out += chars[b % chars.length];
  } else {
    for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * Derive a stable, human-readable node ID from a schema ID and an optional
 * title. When title is provided, produces `{schemaId}:{slugifiedTitle}-{random6}`.
 * When title is absent or empty, falls back to a raw UUID so the node is still
 * unique (consistent with legacy behaviour).
 *
 * The random suffix prevents collisions when the same title is used twice
 * without requiring a round-trip uniqueness check.
 */
function deriveNodeId(schemaId: string, title?: string): string {
  const trimmed = title?.trim() ?? '';
  if (!trimmed) return generateUUID();
  const slug = slugify(trimmed);
  if (!slug) return generateUUID();
  return `${schemaId}:${slug}-${randomSuffix()}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseContentNativeCreateResult {
  /**
   * Create a new content-native entity for the given schema.
   *
   * Generates an id, invokes ContentNode/createWithSchema, then navigates to
   * the entity detail page on success.
   *
   * @param schemaId - The schema to apply to the new node.
   * @param title - Optional user-supplied title stored on the node so the
   *   page shows a human-readable name instead of its raw UUID.
   *
   * Returns `{ entityId }` on success, or `{ error }` if the kernel returned
   * a non-ok variant or if a network error occurred.
   */
  create: (schemaId: string, title?: string) => Promise<{ entityId: string } | { error: string }>;
  /** True while the kernel round-trip is in flight. */
  isPending: boolean;
}

export function useContentNativeCreate(): UseContentNativeCreateResult {
  const kernelInvoke = useKernelInvoke();
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const create = useCallback(
    async (schemaId: string, title?: string): Promise<{ entityId: string } | { error: string }> => {
      const entityId = deriveNodeId(schemaId, title);
      setIsPending(true);

      let result: Record<string, unknown>;
      try {
        result = await kernelInvoke('ContentNode', 'createWithSchema', {
          node: entityId,
          schema: schemaId,
          body: '',
          title: title ?? '',
        });
      } catch (err) {
        setIsPending(false);
        const msg = err instanceof Error ? err.message : 'Network error';
        return { error: msg };
      }

      setIsPending(false);

      if (result.variant !== 'ok') {
        const msg =
          typeof result.message === 'string' ? result.message :
          typeof result.reason  === 'string' ? result.reason  :
          `ContentNode/createWithSchema returned: ${String(result.variant)}`;
        return { error: msg };
      }

      // Navigate to the entity detail page.  The App Router route at
      // clef-base/app/content/[id]/page.tsx redirects to
      // /admin/content/<id>, where the block editor mounts on the ContentNode.
      router.push(`/content/${encodeURIComponent(entityId)}`);

      return { entityId };
    },
    [kernelInvoke, router],
  );

  return { create, isPending };
}
