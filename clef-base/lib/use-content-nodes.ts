'use client';

import { useMemo } from 'react';
import { useConceptQuery } from './use-concept-query';

export type ContentNodeRecord = Record<string, unknown> & {
  node: string;
  schemas: string[];
};

interface SchemaMembershipRecord {
  entity_id: string;
  schema: string;
}

interface UseContentNodesResult {
  data: ContentNodeRecord[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function parseItems<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === 'object' && raw !== null && 'items' in raw) {
    const items = (raw as Record<string, unknown>).items;
    if (Array.isArray(items)) return items as T[];
    if (typeof items === 'string') {
      try {
        return JSON.parse(items) as T[];
      } catch {
        return [];
      }
    }
  }
  return [];
}

export function useContentNodes(schema?: string): UseContentNodesResult {
  const {
    data: nodesRaw,
    loading: nodesLoading,
    error: nodesError,
    refetch: refetchNodes,
  } = useConceptQuery<unknown>('ContentNode', 'list', {});
  const {
    data: membershipsRaw,
    loading: membershipsLoading,
    error: membershipsError,
    refetch: refetchMemberships,
  } = useConceptQuery<unknown>('Schema', 'listMemberships', {});

  const data = useMemo(() => {
    const nodes = parseItems<Record<string, unknown>>(nodesRaw);
    if (nodes.length === 0) return null;

    const memberships = parseItems<SchemaMembershipRecord>(membershipsRaw);
    const schemasByEntity = new Map<string, string[]>();

    for (const membership of memberships) {
      const current = schemasByEntity.get(membership.entity_id) ?? [];
      current.push(membership.schema);
      schemasByEntity.set(membership.entity_id, current);
    }

    const enriched = nodes.map((node) => ({
      ...node,
      node: String(node.node ?? ''),
      schemas: schemasByEntity.get(String(node.node ?? '')) ?? [],
    }));

    if (!schema) return enriched;
    return enriched.filter((node) => node.schemas.includes(schema));
  }, [membershipsRaw, nodesRaw, schema]);

  return {
    data,
    loading: nodesLoading || membershipsLoading,
    error: nodesError ?? membershipsError,
    refetch: () => {
      refetchNodes();
      refetchMemberships();
    },
  };
}
