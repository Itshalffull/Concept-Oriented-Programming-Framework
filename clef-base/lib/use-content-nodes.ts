'use client';

/**
 * useContentNodes — Fetches ContentNodes enriched with their Schema memberships.
 *
 * Per spec §2.1: A ContentNode's identity is the set of Schemas applied to it.
 * This hook composes ContentNode/list with Schema/listMemberships to produce
 * enriched records with a `schemas` array, replacing the old `type` field.
 *
 * Optional `schema` filter returns only ContentNodes that have a specific
 * Schema applied — the correct replacement for the old `{ type: "concept" }`
 * filter pattern.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useKernelInvoke } from './clef-provider';

export interface EnrichedContentNode extends Record<string, unknown> {
  node: string;
  schemas: string[];
}

interface Membership {
  entity_id: string;
  schema: string;
}

interface UseContentNodesResult {
  data: EnrichedContentNode[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useContentNodes(schemaFilter?: string): UseContentNodesResult {
  const invoke = useKernelInvoke();
  const [data, setData] = useState<EnrichedContentNode[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch nodes and memberships in parallel
      const [nodesResult, membershipsResult] = await Promise.all([
        invoke('ContentNode', 'list', {}),
        invoke('Schema', 'listMemberships', {}),
      ]);

      if (nodesResult.variant !== 'ok') {
        setError(nodesResult.message as string ?? 'Failed to load content nodes');
        setData(null);
        return;
      }

      const nodes: Record<string, unknown>[] = typeof nodesResult.items === 'string'
        ? JSON.parse(nodesResult.items)
        : [];

      const memberships: Membership[] = membershipsResult.variant === 'ok' && typeof membershipsResult.items === 'string'
        ? JSON.parse(membershipsResult.items)
        : [];

      // Build entity_id → schemas[] lookup
      const schemasByEntity = new Map<string, string[]>();
      for (const m of memberships) {
        const existing = schemasByEntity.get(m.entity_id) ?? [];
        existing.push(m.schema);
        schemasByEntity.set(m.entity_id, existing);
      }

      // Enrich nodes
      let enriched: EnrichedContentNode[] = nodes.map((node) => ({
        ...node,
        node: node.node as string,
        schemas: schemasByEntity.get(node.node as string) ?? [],
      }));

      // Apply schema filter
      if (schemaFilter) {
        enriched = enriched.filter((n) => n.schemas.includes(schemaFilter));
      }

      setData(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [invoke, schemaFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * useSchemaStats — Returns per-schema counts of ContentNodes.
 * Replacement for the old ContentNode/stats action that grouped by type.
 */
export function useSchemaStats() {
  const invoke = useKernelInvoke();
  const [stats, setStats] = useState<{ schema: string; count: number }[] | null>(null);
  const [totalNodes, setTotalNodes] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [nodesResult, membershipsResult, schemasResult] = await Promise.all([
        invoke('ContentNode', 'list', {}),
        invoke('Schema', 'listMemberships', {}),
        invoke('Schema', 'list', {}),
      ]);

      const nodes: Record<string, unknown>[] = nodesResult.variant === 'ok' && typeof nodesResult.items === 'string'
        ? JSON.parse(nodesResult.items) : [];
      const memberships: Membership[] = membershipsResult.variant === 'ok' && typeof membershipsResult.items === 'string'
        ? JSON.parse(membershipsResult.items) : [];
      const schemas: Record<string, unknown>[] = schemasResult.variant === 'ok' && typeof schemasResult.items === 'string'
        ? JSON.parse(schemasResult.items) : [];

      setTotalNodes(nodes.length);

      // Count entities per schema
      const counts = new Map<string, number>();
      for (const m of memberships) {
        counts.set(m.schema, (counts.get(m.schema) ?? 0) + 1);
      }

      // Include all defined schemas (even those with 0 entities)
      const allSchemaNames = new Set([
        ...schemas.map((s) => s.schema as string),
        ...counts.keys(),
      ]);

      const result = [...allSchemaNames].map((schema) => ({
        schema,
        count: counts.get(schema) ?? 0,
      })).sort((a, b) => b.count - a.count);

      setStats(result);
    } catch {
      setStats([]);
    } finally {
      setLoading(false);
    }
  }, [invoke]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { stats, totalNodes, loading, refetch: fetchData };
}
