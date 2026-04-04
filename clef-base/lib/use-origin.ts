'use client';

import { useConceptQuery } from './use-concept-query';

interface OriginInfo {
  kind: 'local' | 'space' | 'kernel' | 'external';
  displayName: string;
  icon?: string;
  status: 'connected' | 'stale' | 'unreachable';
  qualifier: string;
}

const LOCAL_DEFAULT: OriginInfo = {
  kind: 'local',
  displayName: '',
  status: 'connected',
  qualifier: '',
};

export function useOrigin(originId: string | null) {
  const { data, loading, error } = useConceptQuery<any>(
    originId ? 'Origin' : '__none__',
    originId ? 'get' : '__none__',
    { origin: originId ?? '__none__' },
  );

  if (!originId || !data) {
    return { origin: LOCAL_DEFAULT, loading: false, error: null };
  }

  return {
    origin: {
      kind: data.kind,
      displayName: data.displayName,
      icon: data.icon,
      status: data.status,
      qualifier: data.qualifier,
    } as OriginInfo,
    loading,
    error,
  };
}
