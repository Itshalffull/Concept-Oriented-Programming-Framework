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
 *   1. Generate a new entity id via crypto.randomUUID (with a fallback).
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
 * const result = await create('agent-persona');
 * if ('error' in result) {
 *   console.error(result.error);
 * }
 * // On success the hook has already navigated to /content/<entityId>.
 * ```
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useKernelInvoke } from './clef-provider';

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
      const entityId = generateUUID();
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
