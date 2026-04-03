'use client';

/**
 * MultiverseView — Version space manager.
 * Per spec §2.1: Version spaces and overrides are ContentNodes with
 * Schema "VersionSpace" and Schema "VersionOverride" applied.
 */

import React, { useMemo, useState } from 'react';
import { useKernelInvoke } from '../../lib/clef-provider';
import { useConceptQuery } from '../../lib/use-concept-query';
import { Card } from '../components/widgets/Card';
import { Badge } from '../components/widgets/Badge';
import { EmptyState } from '../components/widgets/EmptyState';
import { CreateForm } from '../components/widgets/CreateForm';

type VersionSpaceRecord = Record<string, unknown> & {
  node: string;
  name?: string;
  status?: string;
  owner?: string;
  overrideCount?: number;
  lastActivity?: string;
  description?: string;
  visibility?: string;
  parent?: string | null;
};

type OverrideRecord = Record<string, unknown> & {
  node: string;
  space: string;
  entity: string;
  operation: string;
  fields?: string[];
  summary?: string;
};

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : Number(value ?? fallback) || fallback;
}

export const MultiverseView: React.FC = () => {
  const invoke = useKernelInvoke();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Fetch nodes by schema via listBySchema — single server-side call per schema
  const { data: spacesRaw, loading: spacesLoading, refetch: refetchSpaces } =
    useConceptQuery<Record<string, unknown>>('ContentNode', 'listBySchema', { schema: 'VersionSpace' });
  const { data: overridesRaw, loading: overridesLoading, refetch: refetchOverrides } =
    useConceptQuery<Record<string, unknown>>('ContentNode', 'listBySchema', { schema: 'VersionOverride' });

  const spaces = useMemo(() => {
    if (!spacesRaw) return [] as VersionSpaceRecord[];
    const items = typeof (spacesRaw as Record<string, unknown>).items === 'string'
      ? JSON.parse((spacesRaw as Record<string, unknown>).items as string) : [];
    return (Array.isArray(items) ? items : []) as VersionSpaceRecord[];
  }, [spacesRaw]);
  const overrides = useMemo(() => {
    if (!overridesRaw) return [] as OverrideRecord[];
    const items = typeof (overridesRaw as Record<string, unknown>).items === 'string'
      ? JSON.parse((overridesRaw as Record<string, unknown>).items as string) : [];
    return (Array.isArray(items) ? items : []) as OverrideRecord[];
  }, [overridesRaw]);

  const selectedSpace = useMemo(() => {
    if (selectedSpaceId) {
      return spaces.find((space) => space.node === selectedSpaceId) ?? null;
    }
    return spaces[0] ?? null;
  }, [spaces, selectedSpaceId]);

  const selectedOverrides = useMemo(() => {
    if (!selectedSpace) return [];
    return overrides.filter((entry) => entry.space === selectedSpace.node);
  }, [overrides, selectedSpace]);

  const performAction = async (action: 'merge' | 'rebase' | 'promote' | 'archive') => {
    if (!selectedSpace) return;

    const nextPayload = {
      name: readString(selectedSpace.name, selectedSpace.node.replace(/^version-space:/, '')),
      status: action === 'archive' ? 'archived' : action === 'promote' ? 'promoted' : 'active',
      owner: readString(selectedSpace.owner, 'system'),
      overrideCount: selectedOverrides.length,
      lastActivity: new Date().toISOString(),
      visibility: readString(selectedSpace.visibility, 'shared'),
      parent: readString(selectedSpace.parent, '') || null,
      description: readString(selectedSpace.description, `${action} applied to ${selectedSpace.node}`),
      lastOperation: action,
    };

    try {
      await invoke('ContentNode', 'update', {
        node: selectedSpace.node,
        content: JSON.stringify(nextPayload),
      });
      setStatusMessage(`${action} applied to ${nextPayload.name}.`);
      refetchSpaces();
    } catch {
      setStatusMessage(`${action} failed for ${selectedSpace.node}.`);
    }
  };

  const handleCreated = () => {
    refetchSpaces();
    refetchOverrides();
  };

  const createFields = useMemo(() => [
    { name: 'node', label: 'Space ID', required: true, placeholder: 'version-space:editorial-pass' },
    { name: 'content', label: 'Space Payload (JSON)', type: 'textarea' as const, required: true, placeholder: '{"name":"Editorial Pass","status":"active","owner":"alice","overrideCount":0,"lastActivity":"2026-03-10T12:00:00.000Z","visibility":"shared","description":"Reviewing site copy"}' },
    { name: 'createdBy', label: 'Owner', required: true, placeholder: 'alice' },
  ], []);

  return (
    <div>
      <div className="page-header">
        <h1>Version Spaces</h1>
        <button data-part="button" data-variant="filled" onClick={() => setCreateOpen(true)}>
          Create Space
        </button>
      </div>

      <p style={{ color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-lg)' }}>
        The multiverse manager shows ContentNodes with Schema &quot;VersionSpace&quot; and their override entities.
        Select a space to inspect its deltas, then run merge, rebase, promote, or archive actions.
      </p>

      {statusMessage && (
        <Card variant="filled" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <span style={{ color: 'var(--palette-on-surface)' }}>{statusMessage}</span>
        </Card>
      )}

      {spacesLoading ? (
        <div style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-on-surface-variant)' }}>Loading version spaces...</div>
      ) : spaces.length === 0 ? (
        <Card variant="outlined">
          <EmptyState
            title="No version spaces"
            description="Create a version space to fork a working reality, capture overrides, and promote changes back into base."
            action={
              <button data-part="button" data-variant="filled" onClick={() => setCreateOpen(true)}>
                Create Version Space
              </button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="card-grid" style={{ marginBottom: 'var(--spacing-xl)' }}>
            {spaces.map((space) => {
              const isSelected = selectedSpace?.node === space.node;
              const displayName = readString(space.name, space.node.replace(/^version-space:/, ''));
              const overrideCount = readNumber(space.overrideCount, 0);
              return (
                <Card
                  key={space.node}
                  variant={isSelected ? 'filled' : 'outlined'}
                  onClick={() => setSelectedSpaceId(space.node)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                    <strong>{displayName}</strong>
                    <Badge variant={readString(space.status, 'active') === 'archived' ? 'warning' : 'success'}>
                      {readString(space.status, 'active')}
                    </Badge>
                    <Badge variant="secondary">{readString(space.visibility, 'shared')}</Badge>
                  </div>
                  <p style={{ color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-sm)' }}>
                    {readString(space.description, 'No description recorded.')}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                    <Badge variant="info">{overrideCount} overrides</Badge>
                    <Badge variant="secondary">{readString(space.owner, 'system')}</Badge>
                    <Badge variant="secondary">
                      {readString(space.lastActivity, '').slice(0, 10) || 'no activity'}
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>

          {selectedSpace && (
            <Card variant="outlined">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--spacing-md)', flexWrap: 'wrap', marginBottom: 'var(--spacing-md)' }}>
                <div>
                  <h2 style={{ margin: 0 }}>{readString(selectedSpace.name, selectedSpace.node)}</h2>
                  <p style={{ color: 'var(--palette-on-surface-variant)', margin: '4px 0 0' }}>
                    Owner: {readString(selectedSpace.owner, 'system')} · Parent: {readString(selectedSpace.parent, 'base') || 'base'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                  <button data-part="button" data-variant="outlined" onClick={() => performAction('merge')}>Merge</button>
                  <button data-part="button" data-variant="outlined" onClick={() => performAction('rebase')}>Rebase</button>
                  <button data-part="button" data-variant="filled" onClick={() => performAction('promote')}>Promote</button>
                  <button data-part="button" data-variant="outlined" onClick={() => performAction('archive')}>Archive</button>
                </div>
              </div>

              {overridesLoading ? (
                <div style={{ color: 'var(--palette-on-surface-variant)' }}>Loading overrides...</div>
              ) : selectedOverrides.length === 0 ? (
                <EmptyState
                  title="No overrides in this space"
                  description="Edits made inside the space will appear here as field-level deltas."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  {selectedOverrides.map((entry) => (
                    <Card key={entry.node} variant="filled">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                        <strong>{readString(entry.entity, entry.node)}</strong>
                        <Badge variant="info">{readString(entry.operation, 'update')}</Badge>
                      </div>
                      <p style={{ margin: 0, color: 'var(--palette-on-surface)' }}>
                        {readString(entry.summary, 'Override captured in this version space.')}
                      </p>
                      {Array.isArray(entry.fields) && entry.fields.length > 0 && (
                        <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap', marginTop: 'var(--spacing-sm)' }}>
                          {(entry.fields as string[]).map((field) => (
                            <Badge key={field} variant="secondary">{field}</Badge>
                          ))}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      <CreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
        concept="ContentNode"
        action="create"
        title="Create Version Space"
        fields={createFields}
      />
    </div>
  );
};

export default MultiverseView;
