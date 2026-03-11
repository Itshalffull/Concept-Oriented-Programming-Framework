'use client';

import { useState, useEffect, useCallback } from 'react';
import { useKernelInvoke } from './clef-provider';

interface ConceptQueryResult<T = unknown> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * React hook that invokes a concept action and manages loading/error state.
 * Parses JSON `items` field from the response for list actions.
 */
export function useConceptQuery<T = unknown>(
  concept: string,
  action: string,
  input?: Record<string, unknown>,
): ConceptQueryResult<T> {
  const invoke = useKernelInvoke();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable key to avoid re-fetching on every render
  const inputKey = JSON.stringify(input ?? {});

  const fetchData = useCallback(async () => {
    // Skip query if concept/action are placeholder values (waiting for config to load)
    if (concept === '__none__' || action === '__none__') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await invoke(concept, action, input ?? {});
      if (result.variant === 'ok') {
        // List actions return items as JSON string
        if (typeof result.items === 'string') {
          setData(JSON.parse(result.items) as T);
        } else {
          setData(result as T);
        }
      } else {
        setError(result.message as string ?? `Action returned variant: ${result.variant}`);
        setData(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [concept, action, inputKey, invoke]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
