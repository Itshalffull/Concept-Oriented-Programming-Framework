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
        // Unwrap the data array from the result generically:
        // 1. If result.items is a JSON-encoded string array, parse and use it.
        // 2. Else find the first key (excluding metadata keys) whose value is an
        //    Array or a JSON-encoded string that decodes to an Array.
        // 3. Else fall back to using result itself.
        const SKIP_KEYS = new Set(['variant', 'flowId', 'message']);
        let resolved: unknown = null;

        if (typeof result.items === 'string') {
          resolved = JSON.parse(result.items);
        } else if (Array.isArray(result.items)) {
          resolved = result.items;
        } else {
          for (const key of Object.keys(result)) {
            if (SKIP_KEYS.has(key)) continue;
            const val = result[key];
            if (Array.isArray(val)) {
              resolved = val;
              break;
            }
            if (typeof val === 'string') {
              try {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed)) {
                  resolved = parsed;
                  break;
                }
              } catch {
                // not a JSON array string — skip
              }
            }
          }
        }

        if (resolved !== null) {
          setData(resolved as T);
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
