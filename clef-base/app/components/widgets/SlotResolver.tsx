'use client';

/**
 * SlotResolver — generic PluginRegistry-driven slot mount helper.
 *
 * useSlotResolver queries PluginRegistry/getDefinitions for all plugins
 * registered under a given type string and returns a stable, sorted array
 * of slot entries. Consumers iterate the array and mount each widgetId
 * via whatever widget-mount mechanism the host prefers (data-widget
 * attribute dispatch, direct React component lookup, etc.).
 *
 * Design notes
 * ─────────────
 * • The hook calls PluginRegistry/getDefinitions (not the lower-level
 *   discover action) because getDefinitions returns the full stored
 *   definition records — including metadata — without requiring an
 *   additional createInstance round-trip.
 * • Results are re-fetched whenever pluginType changes.
 * • Errors are non-fatal: the hook returns an empty array and logs to
 *   the console. Editor rendering never blocks on registry availability.
 * • The context parameter is forwarded as-is to metadata resolution
 *   callers; the hook itself treats it as opaque.
 *
 * PRD: docs/plans/block-editor-parity-prd.md §3.5 (Plugin slot resolver)
 * Card: PP-slot-resolver (id 02c08cb0-0fb3-494a-a2cc-ad9bd0df8b99)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * One resolved slot entry as returned by useSlotResolver.
 *
 * widgetId     — the widget identifier registered in PluginRegistry metadata
 *                (e.g. "comment-gutter-marker", "outline-panel")
 * name         — the plugin registration name (unique within a type)
 * metadata     — the full parsed metadata object as registered
 * order        — numeric rendering order (lower = rendered first; default 50)
 */
export interface SlotEntry {
  widgetId: string;
  name: string;
  metadata: Record<string, unknown>;
  order: number;
}

// ---------------------------------------------------------------------------
// Internal: parse the JSON string that PluginRegistry/getDefinitions returns
// ---------------------------------------------------------------------------

interface RawDefinition {
  name?: string;
  type?: string;
  metadata?: string | Record<string, unknown>;
  [key: string]: unknown;
}

function parseDefinitions(raw: unknown): SlotEntry[] {
  let defs: RawDefinition[];

  if (typeof raw === 'string') {
    try {
      defs = JSON.parse(raw) as RawDefinition[];
    } catch {
      return [];
    }
  } else if (Array.isArray(raw)) {
    defs = raw as RawDefinition[];
  } else {
    return [];
  }

  const entries: SlotEntry[] = [];

  for (const def of defs) {
    // Metadata may arrive as a pre-parsed object or as a JSON string
    let meta: Record<string, unknown> = {};
    if (typeof def.metadata === 'string') {
      try {
        meta = JSON.parse(def.metadata) as Record<string, unknown>;
      } catch {
        meta = {};
      }
    } else if (def.metadata && typeof def.metadata === 'object') {
      meta = def.metadata as Record<string, unknown>;
    }

    const widgetId = typeof meta.widget === 'string' ? meta.widget : (def.name ?? '');
    if (!widgetId) continue;

    const order = typeof meta.order === 'number' ? meta.order : 50;

    entries.push({
      widgetId,
      name: typeof def.name === 'string' ? def.name : widgetId,
      metadata: meta,
      order,
    });
  }

  // Sort ascending by order so that lower-order entries render first
  entries.sort((a, b) => a.order - b.order);

  return entries;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useSlotResolver
 *
 * Resolves all PluginRegistry entries of the given type and returns them as
 * a stable sorted array of SlotEntry objects ready for mounting.
 *
 * @param pluginType   PluginRegistry type key, e.g. "decoration-layer",
 *                     "editor-panel", "header-slot", "footer-slot",
 *                     "status-bar".
 * @param context      Optional opaque context record forwarded to consumers
 *                     for prop-template resolution. The hook stores the latest
 *                     value via ref so it does not cause re-fetches.
 *
 * @returns Sorted array of SlotEntry. Empty while loading or on error.
 */
export function useSlotResolver(
  pluginType: string,
  context?: Record<string, unknown>,
): SlotEntry[] {
  const invoke = useKernelInvoke();
  const [entries, setEntries] = useState<SlotEntry[]>([]);

  // Keep context in a ref so changes to it don't re-trigger the effect.
  // Callers that need context-sensitive filtering should apply it themselves
  // on the returned entries array.
  const contextRef = useRef(context);
  useEffect(() => {
    contextRef.current = context;
  });

  const fetch = useCallback(async () => {
    if (!pluginType) {
      setEntries([]);
      return;
    }
    try {
      const result = await invoke('PluginRegistry', 'getDefinitions', { type: pluginType });
      if (result.variant === 'ok') {
        setEntries(parseDefinitions(result.definitions));
      } else {
        // Non-ok variant (e.g. empty type) — treat as empty, not a crash
        setEntries([]);
      }
    } catch (err) {
      console.warn(`[useSlotResolver] PluginRegistry/getDefinitions(${pluginType}) failed:`, err);
      setEntries([]);
    }
  }, [pluginType, invoke]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return entries;
}

// ---------------------------------------------------------------------------
// SlotMount — thin wrapper that renders a single slot entry as a data-widget
// host div. The widget interpreter (wired separately) dispatches on the
// data-widget attribute to instantiate the actual component.
// ---------------------------------------------------------------------------

interface SlotMountProps {
  entry: SlotEntry;
  /** Additional data-* attributes to place on the host div. */
  hostAttrs?: Record<string, string>;
  style?: React.CSSProperties;
}

import React from 'react';

export const SlotMount: React.FC<SlotMountProps> = ({ entry, hostAttrs = {}, style }) => {
  return (
    <div
      data-slot-widget={entry.widgetId}
      data-slot-name={entry.name}
      data-slot-order={String(entry.order)}
      {...hostAttrs}
      style={style}
    />
  );
};
