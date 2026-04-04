'use client';

import { useState, useMemo, useCallback } from 'react';
import { useKernelInvoke } from './clef-provider';
import { useConceptQuery } from './use-concept-query';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface VersionPinInfo {
  pin: string;
  sourceEntity: string;
  versionRef: string;
  policy: 'auto' | 'pin' | 'best-effort';
  freshness: 'current' | 'outdated' | 'orphaned';
  ownerKind: string;
  ownerRef: string;
  versionsBehind: number;
}

export interface ReanchorAllResult {
  updated: string[];
  skipped: string[];
  failed: string[];
}

export interface UseVersionPinsResult {
  pins: VersionPinInfo[];
  outdatedCount: number;
  orphanedCount: number;
  loading: boolean;
  error: string | null;
  reanchor: (pinId: string) => Promise<void>;
  reanchorAll: () => Promise<ReanchorAllResult>;
  getOriginal: (pinId: string) => Promise<string>;
  setPolicy: (pinId: string, policy: 'auto' | 'pin' | 'best-effort') => Promise<void>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

/**
 * useVersionPins — manages version pins for any entity.
 *
 * Queries VersionPin/list for the given entity and exposes actions
 * for reanchoring, policy changes, and retrieving original content.
 *
 * @param entityRef - The entity ID to load version pins for
 */
export function useVersionPins(entityRef: string): UseVersionPinsResult {
  const invoke = useKernelInvoke();
  const [actionError, setActionError] = useState<string | null>(null);

  // Query VersionPin/list for this entity
  const { data, loading, error: queryError, refetch } = useConceptQuery<{ pins: string }>(
    'VersionPin',
    'list',
    { sourceEntity: entityRef },
  );

  const pins: VersionPinInfo[] = useMemo(() => {
    if (!data) return [];
    // Handle pins as a JSON string field or already-parsed data
    const raw = (data as Record<string, unknown>).pins;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as VersionPinInfo[];
      } catch {
        return [];
      }
    }
    if (Array.isArray(raw)) {
      return raw as VersionPinInfo[];
    }
    // Fallback: data itself might be the array (useConceptQuery parses items)
    if (Array.isArray(data)) {
      return data as unknown as VersionPinInfo[];
    }
    return [];
  }, [data]);

  const outdatedCount = useMemo(
    () => pins.filter(p => p.freshness === 'outdated').length,
    [pins],
  );

  const orphanedCount = useMemo(
    () => pins.filter(p => p.freshness === 'orphaned').length,
    [pins],
  );

  const error = actionError ?? queryError;

  const reanchor = useCallback(async (pinId: string) => {
    setActionError(null);
    try {
      const result = await invoke('VersionPin', 'forceReanchor', {
        pin: pinId,
        targetVersion: 'latest',
      });
      if (result.variant !== 'ok') {
        setActionError(
          (result.message as string) ?? `forceReanchor returned variant: ${result.variant}`,
        );
        return;
      }
      refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reanchor pin');
    }
  }, [invoke, refetch]);

  const reanchorAll = useCallback(async (): Promise<ReanchorAllResult> => {
    setActionError(null);
    const empty: ReanchorAllResult = { updated: [], skipped: [], failed: [] };
    try {
      const result = await invoke('VersionPin', 'batchReanchor', {
        sourceEntity: entityRef,
        targetVersion: 'latest',
      });
      if (result.variant !== 'ok') {
        setActionError(
          (result.message as string) ?? `batchReanchor returned variant: ${result.variant}`,
        );
        return empty;
      }
      refetch();

      // Parse structured result if available
      const parseField = (field: unknown): string[] => {
        if (typeof field === 'string') {
          try { return JSON.parse(field) as string[]; } catch { return []; }
        }
        if (Array.isArray(field)) return field as string[];
        return [];
      };

      return {
        updated: parseField(result.updated),
        skipped: parseField(result.skipped),
        failed: parseField(result.failed),
      };
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reanchor all pins');
      return empty;
    }
  }, [invoke, entityRef, refetch]);

  const getOriginal = useCallback(async (pinId: string): Promise<string> => {
    try {
      const result = await invoke('VersionPin', 'getOriginal', { pin: pinId });
      if (result.variant !== 'ok') return '';
      return (typeof result.content === 'string' ? result.content : '');
    } catch {
      return '';
    }
  }, [invoke]);

  const setPolicy = useCallback(async (
    pinId: string,
    policy: 'auto' | 'pin' | 'best-effort',
  ) => {
    setActionError(null);
    try {
      const result = await invoke('VersionPin', 'setPolicy', { pin: pinId, policy });
      if (result.variant !== 'ok') {
        setActionError(
          (result.message as string) ?? `setPolicy returned variant: ${result.variant}`,
        );
        return;
      }
      refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to set policy');
    }
  }, [invoke, refetch]);

  return {
    pins,
    outdatedCount,
    orphanedCount,
    loading,
    error,
    reanchor,
    reanchorAll,
    getOriginal,
    setPolicy,
  };
}
