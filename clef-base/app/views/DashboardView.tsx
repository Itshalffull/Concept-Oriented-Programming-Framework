'use client';

/**
 * DashboardView — Admin dashboard composed from views and blocks.
 * Per spec §2.1: Stats are aggregated by Schema membership, not by type field.
 */

import React, { useEffect, useState } from 'react';
import { StatCard } from '../components/widgets/StatCard';
import { Card } from '../components/widgets/Card';
import { DataTable, type ColumnDef } from '../components/widgets/DataTable';
import { Badge } from '../components/widgets/Badge';
import { useHost } from '../../lib/clef-provider';
import { useConceptQuery } from '../../lib/use-concept-query';
import { useSchemaStats } from '../../lib/use-content-nodes';

interface KernelState {
  concepts: { uri: string; hasStorage: boolean }[];
  syncs: number;
  health: { status: string };
}

export const DashboardView: React.FC = () => {
  const [state, setState] = useState<KernelState | null>(null);
  const [loading, setLoading] = useState(true);
  const { host } = useHost();

  // Live counts from concept queries
  const { stats: schemaStats, totalNodes, loading: statsLoading } = useSchemaStats();
  const { data: schemas } = useConceptQuery<Record<string, unknown>[]>('Schema', 'list');
  const { data: displayModes } = useConceptQuery<Record<string, unknown>[]>('DisplayMode', 'list');
  const { data: themes } = useConceptQuery<Record<string, unknown>[]>('Theme', 'list');

  useEffect(() => {
    async function loadState() {
      try {
        const healthRes = await fetch('/api/health');
        const health = await healthRes.json();
        const concepts: { uri: string; hasStorage: boolean }[] =
          Array.isArray(health.concepts) ? health.concepts : [];
        setState({
          concepts,
          syncs: 50,
          health: { status: health.status },
        });
      } catch (err) {
        console.error('Failed to load dashboard state:', err);
      } finally {
        setLoading(false);
      }
    }
    loadState();
  }, []);

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1>Dashboard</h1>
        </div>
        <p style={{ color: 'var(--palette-on-surface-variant)' }}>Loading...</p>
      </div>
    );
  }

  const conceptColumns: ColumnDef[] = [
    {
      key: 'uri',
      label: 'Concept URI',
      render: (val) => {
        const name = String(val).replace('urn:clef/', '');
        return <code>{name}</code>;
      },
    },
    {
      key: 'hasStorage',
      label: 'Storage',
      render: (val) => (
        <Badge variant={val ? 'success' : 'secondary'}>
          {val ? 'persistent' : 'stateless'}
        </Badge>
      ),
    },
    {
      key: 'uri',
      label: 'Type',
      render: (val) => {
        const name = String(val);
        if (name.includes('Source')) return <Badge variant="info">provider</Badge>;
        if (name.includes('Hub') || name.includes('Browser'))
          return <Badge variant="primary">platform</Badge>;
        if (name.includes('Navigator') || name.includes('Host') || name.includes('Shell'))
          return <Badge variant="warning">ui-app</Badge>;
        if (name.includes('Adapter') || name.includes('Transport'))
          return <Badge variant="info">adapter</Badge>;
        if (['ContentNode', 'Schema', 'View', 'Workflow', 'AutomationRule', 'Taxonomy', 'DisplayMode', 'Theme', 'Query', 'ContentStorage', 'Property', 'Outline'].some(c => name.includes(c)))
          return <Badge variant="success">domain</Badge>;
        return <Badge variant="secondary">core</Badge>;
      },
    },
  ];

  return (
    <div data-host-id={host?.id} data-host-status={host?.status}>
      <div className="page-header">
        <h1>Dashboard</h1>
        <Badge variant="success">{state?.health?.status ?? 'unknown'}</Badge>
      </div>

      {/* Stat cards — live KPIs */}
      <div className="section">
        <div className="card-grid card-grid--stats">
          <StatCard
            label="Registered Concepts"
            value={String(state?.concepts.length ?? 0)}
            description="Active concept handlers in kernel"
          />
          <StatCard
            label="Content Nodes"
            value={String(totalNodes)}
            description="Entities in the content pool"
          />
          <StatCard
            label="Schema Definitions"
            value={String(schemas?.length ?? 0)}
            description="Composable data shapes defined"
          />
          <StatCard
            label="Display Modes"
            value={String(displayModes?.length ?? 0)}
            description="Presentation profiles"
          />
          <StatCard
            label="Themes"
            value={String(themes?.length ?? 0)}
            description="Design system themes"
          />
          <StatCard
            label="Sync Rules"
            value={String(state?.syncs ?? 0)}
            trend={{ direction: 'neutral', value: 'stable' }}
            description="Across all suites"
          />
        </div>
      </div>

      {/* Schema membership stats */}
      {schemaStats && schemaStats.length > 0 && (
        <div className="section">
          <div className="section__header">
            <h2 className="section__title">Entities by Schema</h2>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
            {schemaStats.map(({ schema, count }) => (
              <Card key={schema} variant="outlined" style={{ padding: 'var(--spacing-sm) var(--spacing-md)', minWidth: '120px' }}>
                <div style={{ fontWeight: 600, fontSize: '20px' }}>{count}</div>
                <div style={{ fontSize: '12px', color: 'var(--palette-on-surface-variant)' }}>{schema}</div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Registered concepts — data-table view */}
      <div className="section">
        <div className="section__header">
          <h2 className="section__title">Registered Concepts</h2>
          <Badge variant="info">{state?.concepts.length ?? 0}</Badge>
        </div>
        <Card variant="outlined" padding="none">
          <DataTable
            columns={conceptColumns}
            data={state?.concepts ?? []}
            sortable
            ariaLabel="Registered concepts"
          />
        </Card>
      </div>
    </div>
  );
};

export default DashboardView;
