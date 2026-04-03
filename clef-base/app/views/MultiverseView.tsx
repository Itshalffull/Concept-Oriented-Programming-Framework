'use client';

/**
 * MultiverseView — Version space manager (deployment dashboard).
 * Per spec §2.1: Version spaces and overrides are ContentNodes with
 * Schema "VersionSpace" and Schema "VersionOverride" applied.
 *
 * Renders the deployment-overview View through ViewRenderer for the
 * card grid of version spaces with status/owner/override metrics.
 * Selecting a space reveals its overrides and deploy/rollback controls.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { ViewRenderer } from '../components/ViewRenderer';
import { useContentNodes } from '../../lib/use-content-nodes';
import { useKernelInvoke } from '../../lib/clef-provider';
import { Card } from '../components/widgets/Card';
import { Badge } from '../components/widgets/Badge';
import { EmptyState } from '../components/widgets/EmptyState';

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

export const MultiverseView: React.FC = () => {
  const invoke = useKernelInvoke();
  const [selectedSpace, setSelectedSpace] = useState<Record<string, unknown> | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [viewKey, setViewKey] = useState(0);

  const { data: overridesData, loading: overridesLoading, refetch: refetchOverrides } =
    useContentNodes('VersionOverride');

  const overrides = useMemo(
    () => (overridesData ?? []) as unknown as OverrideRecord[],
    [overridesData],
  );

  const selectedOverrides = useMemo(() => {
    if (!selectedSpace) return [];
    return overrides.filter((entry) => entry.space === (selectedSpace.node as string));
  }, [overrides, selectedSpace]);

  // Handle card selection from ViewRenderer
  const handleSelect = useCallback((row: Record<string, unknown>) => {
    setSelectedSpace(row);
    refetchOverrides();
  }, [refetchOverrides]);

  // Deploy/rollback action handler
  const performAction = useCallback(async (action: 'merge' | 'promote' | 'archive') => {
    if (!selectedSpace) return;
    const nodeId = selectedSpace.node as string;
    const displayName = readString(selectedSpace.name, nodeId.replace(/^version-space:/, ''));
    const actionLabel = action === 'promote' ? 'Deploy' : action === 'archive' ? 'Rollback' : 'Merge';

    const nextPayload = {
      name: displayName,
      status: action === 'archive' ? 'archived' : action === 'promote' ? 'promoted' : 'active',
      owner: readString(selectedSpace.owner, 'system'),
      overrideCount: selectedOverrides.length,
      lastActivity: new Date().toISOString(),
      visibility: readString(selectedSpace.visibility, 'shared'),
      parent: readString(selectedSpace.parent, '') || null,
      description: readString(selectedSpace.description, `${actionLabel} applied to ${nodeId}`),
      lastOperation: action,
    };

    try {
      await invoke('ContentNode', 'update', {
        node: nodeId,
        content: JSON.stringify(nextPayload),
      });
      setStatusMessage(`${actionLabel} applied to ${displayName}.`);
      // Force ViewRenderer to re-fetch by changing key
      setViewKey((k) => k + 1);
      // Update local selectedSpace with new status
      setSelectedSpace({ ...selectedSpace, ...nextPayload });
    } catch {
      setStatusMessage(`${actionLabel} failed for ${displayName}.`);
    }
  }, [invoke, selectedSpace, selectedOverrides.length]);

  return (
    <div>
      {statusMessage && (
        <Card variant="filled" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <span style={{ color: 'var(--palette-on-surface)' }}>{statusMessage}</span>
          <button
            data-part="button"
            data-variant="ghost"
            style={{ marginLeft: 'var(--spacing-md)' }}
            onClick={() => setStatusMessage(null)}
          >
            Dismiss
          </button>
        </Card>
      )}

      <ViewRenderer
        key={viewKey}
        viewId="deployment-overview"
        onSelect={handleSelect}
      />

      {selectedSpace && (
        <Card variant="outlined" style={{ marginTop: 'var(--spacing-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--spacing-md)', flexWrap: 'wrap', marginBottom: 'var(--spacing-md)' }}>
            <div>
              <h2 style={{ margin: 0 }}>
                {readString(selectedSpace.name, (selectedSpace.node as string))}
              </h2>
              <p style={{ color: 'var(--palette-on-surface-variant)', margin: '4px 0 0' }}>
                Owner: {readString(selectedSpace.owner, 'system')} · Parent: {readString(selectedSpace.parent, 'base') || 'base'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
              <button data-part="button" data-variant="outlined" onClick={() => performAction('merge')}>Merge</button>
              <button data-part="button" data-variant="filled" onClick={() => performAction('promote')}>Deploy</button>
              <button data-part="button" data-variant="outlined" onClick={() => performAction('archive')}>Rollback</button>
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
    </div>
  );
};

export default MultiverseView;
