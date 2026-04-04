'use client';

import { useMemo } from 'react';
import { useConceptQuery } from './use-concept-query';

interface SpaceInfo {
  id: string;
  name: string;
  color?: string;
}

/**
 * React hook that returns the current VersionContext space stack for a user.
 * When the stack is empty, the user is in the base (default) space.
 */
export function useActiveSpace(userId: string) {
  const { data, loading, error } = useConceptQuery<any>(
    'VersionContext', 'get', { user: userId },
  );

  const spaceStack: SpaceInfo[] = useMemo(() => {
    if (!data?.stack) return [];
    try {
      const ids = typeof data.stack === 'string' ? JSON.parse(data.stack) : data.stack;
      return Array.isArray(ids)
        ? ids.map((id: string) => ({ id, name: id, color: undefined }))
        : [];
    } catch {
      return [];
    }
  }, [data]);

  const isInSpace = spaceStack.length > 0;
  const currentSpace = spaceStack.length > 0 ? spaceStack[spaceStack.length - 1] : null;

  return { spaceStack, isInSpace, currentSpace, loading, error };
}
