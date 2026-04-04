'use client';

import { useState, useEffect, useCallback } from 'react';
import { useKernelInvoke } from './clef-provider';

// ─── Types ─────────────────────────────────────────────────────────────────

/**
 * A resolved fragment of a TextSpan, scoped to a single block.
 * Produced by TextSpan/resolve against current content.
 */
export interface SpanFragment {
  spanId: string;
  startOffset: number;
  endOffset: number;
  kind: string;
  color?: string;
  status: string;
  freshness: 'current' | 'outdated' | 'orphaned';
  versionPolicy: 'auto' | 'pin' | 'best-effort';
  versionsBehind: number;
}

/**
 * useEntitySpans — fetches all active TextSpans for an entity and resolves
 * each one against current content to produce per-block fragment maps.
 *
 * Implements §4.2 of text-span-addressing.md.
 *
 * @param entityRef - ContentNode ID to load spans for
 * @param content   - JSON-serialized blocks array (passed to TextSpan/resolve)
 * @returns Map from blockId → array of SpanFragment covering that block
 */
export function useEntitySpans(
  entityRef: string | undefined,
  content: string,
): Map<string, SpanFragment[]> {
  const invoke = useKernelInvoke();
  const [fragmentsByBlock, setFragmentsByBlock] = useState<Map<string, SpanFragment[]>>(
    () => new Map(),
  );

  // Re-resolve whenever the entity or content changes
  const load = useCallback(async () => {
    if (!entityRef) {
      setFragmentsByBlock(new Map());
      return;
    }

    try {
      // 1. List all spans for this entity
      const listResult = await invoke('TextSpan', 'list', { entityRef });
      if (listResult.variant !== 'ok') {
        setFragmentsByBlock(new Map());
        return;
      }

      // Spans may be returned as JSON string or as an array directly
      let spans: Array<{ span: string; kind: string; color?: string; status: string }> = [];
      if (typeof listResult.items === 'string') {
        spans = JSON.parse(listResult.items) as typeof spans;
      } else if (Array.isArray(listResult.items)) {
        spans = listResult.items as typeof spans;
      } else if (Array.isArray(listResult.spans)) {
        spans = listResult.spans as typeof spans;
      }

      // Only resolve active spans — stale/broken spans are not rendered
      const activeSpans = spans.filter(s => s.status === 'active' || !s.status);

      if (activeSpans.length === 0) {
        setFragmentsByBlock(new Map());
        return;
      }

      // 2. Resolve each span against current content to get fragments
      const byBlock = new Map<string, SpanFragment[]>();

      await Promise.all(
        activeSpans.map(async (spanRecord) => {
          try {
            const resolveResult = await invoke('TextSpan', 'resolve', {
              span: spanRecord.span,
              currentContent: content,
            });

            // Accept ok, stale — both have fragments we can render
            if (resolveResult.variant !== 'ok' && resolveResult.variant !== 'stale') {
              return;
            }

            // fragments: [{ blockId, startOffset, endOffset, text }]
            let fragments: Array<{ blockId: string; startOffset: number; endOffset: number }> = [];
            if (typeof resolveResult.fragments === 'string') {
              fragments = JSON.parse(resolveResult.fragments) as typeof fragments;
            } else if (Array.isArray(resolveResult.fragments)) {
              fragments = resolveResult.fragments as typeof fragments;
            }

            for (const frag of fragments) {
              const entry: SpanFragment = {
                spanId: spanRecord.span,
                startOffset: frag.startOffset,
                endOffset: frag.endOffset,
                kind: spanRecord.kind,
                color: spanRecord.color,
                status: resolveResult.variant as string,
                freshness: 'current',
                versionPolicy: 'auto',
                versionsBehind: 0,
              };
              const existing = byBlock.get(frag.blockId) ?? [];
              existing.push(entry);
              byBlock.set(frag.blockId, existing);
            }
          } catch {
            // Silently skip spans that fail to resolve — non-fatal
          }
        }),
      );

      // 3. Enrich fragments with version pin data
      //    Fetch version pins for each unique span and overlay freshness/policy fields
      const uniqueSpanIds = new Set<string>();
      for (const frags of byBlock.values()) {
        for (const f of frags) {
          uniqueSpanIds.add(f.spanId);
        }
      }

      if (uniqueSpanIds.size > 0) {
        // Build a spanId → version info lookup from VersionPin/listByOwner results
        const versionMap = new Map<string, {
          freshness: 'current' | 'outdated' | 'orphaned';
          versionPolicy: 'auto' | 'pin' | 'best-effort';
          versionsBehind: number;
        }>();

        await Promise.all(
          Array.from(uniqueSpanIds).map(async (spanId) => {
            try {
              const pinResult = await invoke('VersionPin', 'listByOwner', { owner: spanId });
              if (pinResult.variant !== 'ok') return;

              let pins: Array<{
                freshness?: string;
                policy?: string;
                versionsBehind?: number;
              }> = [];
              if (typeof pinResult.items === 'string') {
                pins = JSON.parse(pinResult.items) as typeof pins;
              } else if (Array.isArray(pinResult.items)) {
                pins = pinResult.items as typeof pins;
              } else if (Array.isArray(pinResult.pins)) {
                pins = pinResult.pins as typeof pins;
              }

              // Use the first pin entry for enrichment (most recent / primary)
              if (pins.length > 0) {
                const pin = pins[0];
                versionMap.set(spanId, {
                  freshness: (pin.freshness as 'current' | 'outdated' | 'orphaned') ?? 'current',
                  versionPolicy: (pin.policy as 'auto' | 'pin' | 'best-effort') ?? 'auto',
                  versionsBehind: pin.versionsBehind ?? 0,
                });
              }
            } catch {
              // No version pin — defaults already applied during fragment construction
            }
          }),
        );

        // Apply version enrichment to fragments
        if (versionMap.size > 0) {
          for (const frags of byBlock.values()) {
            for (const f of frags) {
              const ver = versionMap.get(f.spanId);
              if (ver) {
                f.freshness = ver.freshness;
                f.versionPolicy = ver.versionPolicy;
                f.versionsBehind = ver.versionsBehind;
              }
            }
          }
        }
      }

      setFragmentsByBlock(byBlock);
    } catch {
      setFragmentsByBlock(new Map());
    }
  }, [entityRef, content, invoke]);

  useEffect(() => {
    void load();
  }, [load]);

  return fragmentsByBlock;
}
