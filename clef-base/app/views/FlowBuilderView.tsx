'use client';

/**
 * FlowBuilderView — View wrapper for the FlowBuilder widget.
 *
 * Accepts a processSpecId route param, loads the ProcessSpec from the kernel,
 * and mounts the FlowBuilder three-pane shell.
 *
 * Route: /admin/processes/:processSpecId/edit
 * (registered alongside the existing /admin/processes/:processSpecId detail route)
 *
 * The view follows the same structural pattern as ProcessRunView and EntityDetailView:
 * - Load entity from kernel via useKernelInvoke
 * - Render a page-header with entity name + status badge
 * - Mount the composed widget below the header
 * - Use HostedPage as the outer wrapper
 *
 * Section 16.12 — view adapters that host widget specs.
 */

import React, { useEffect, useState } from 'react';
import { FlowBuilder } from '../components/widgets/FlowBuilder';
import { Card } from '../components/widgets/Card';
import { Badge } from '../components/widgets/Badge';
import { EmptyState } from '../components/widgets/EmptyState';
import { useKernelInvoke, useNavigator } from '../../lib/clef-provider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProcessSpecRecord {
  spec: string;
  name?: string;
  description?: string;
  status?: string;
  stepCount?: number;
  content?: string;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'secondary'> = {
  published: 'success',
  draft:     'warning',
  archived:  'secondary',
  active:    'info',
};

// ---------------------------------------------------------------------------
// FlowBuilderView
// ---------------------------------------------------------------------------

export interface FlowBuilderViewProps {
  processSpecId: string;
}

export const FlowBuilderView: React.FC<FlowBuilderViewProps> = ({ processSpecId }) => {
  const invoke = useKernelInvoke();
  const { navigateToHref } = useNavigator();

  const [spec, setSpec] = useState<ProcessSpecRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  // Load ProcessSpec from kernel
  useEffect(() => {
    if (!processSpecId) return;
    let cancelled = false;

    setLoading(true);
    invoke('ProcessSpec', 'get', { spec: processSpecId })
      .then((result) => {
        if (cancelled) return;
        setLoading(false);
        if (result && (result as Record<string, unknown>).variant === 'ok') {
          const r = result as Record<string, unknown>;
          let parsed: Record<string, unknown> = {};
          try {
            parsed = r.content ? JSON.parse(String(r.content)) : {};
          } catch { /* ignore */ }
          setSpec({
            spec: processSpecId,
            name: String(r.name ?? parsed.name ?? processSpecId),
            description: String(r.description ?? parsed.description ?? ''),
            status: String(r.status ?? parsed.status ?? 'draft'),
            stepCount: Number(r.stepCount ?? parsed.stepCount ?? 0),
          });
        } else {
          // Fallback: spec not found under ProcessSpec/get; try reading as ContentNode
          invoke('ContentNode', 'get', { node: processSpecId })
            .then((nr) => {
              if (cancelled) return;
              if (nr && (nr as Record<string, unknown>).variant === 'ok') {
                const nr2 = nr as Record<string, unknown>;
                setSpec({
                  spec: processSpecId,
                  name: String(nr2.node ?? processSpecId),
                  status: 'draft',
                });
              } else {
                setSpec(null);
              }
            })
            .catch(() => {
              if (!cancelled) setSpec(null);
            });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setSpec(null);
        }
      });

    return () => { cancelled = true; };
  }, [processSpecId, invoke]);

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1>Flow Builder</h1>
        </div>
        <p style={{ color: 'var(--palette-on-surface-variant)' }}>Loading…</p>
      </div>
    );
  }

  if (!spec) {
    return (
      <div>
        <div className="page-header">
          <h1>Flow Builder</h1>
        </div>
        <Card variant="outlined">
          <EmptyState
            title="Process spec not found"
            description={`No ProcessSpec exists with ID "${processSpecId}".`}
            action={
              <button
                data-part="button"
                data-variant="outlined"
                onClick={() => navigateToHref('/admin/automations')}
              >
                Back to automations
              </button>
            }
          />
        </Card>
      </div>
    );
  }

  const statusVariant = STATUS_VARIANT[spec.status ?? 'draft'] ?? 'secondary';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: 0 }}>
      {/* Page header */}
      <div
        className="page-header"
        style={{ flexShrink: 0, paddingBottom: 'var(--spacing-sm)' }}
      >
        <div>
          <h1 style={{ fontFamily: 'var(--typography-font-family-mono)', fontSize: '18px' }}>
            {spec.name}
          </h1>
          {spec.description && (
            <p style={{
              color: 'var(--palette-on-surface-variant)',
              marginTop: '2px',
              fontSize: 'var(--typography-body-sm-size)',
            }}>
              {spec.description}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
          {selectedStepId && (
            <Badge variant="secondary">
              <span style={{ fontFamily: 'var(--typography-font-family-mono)', fontSize: '11px' }}>
                step: {selectedStepId}
              </span>
            </Badge>
          )}
          <Badge variant={statusVariant}>
            {spec.status ?? 'draft'}
          </Badge>
          <button
            data-part="button"
            data-variant="outlined"
            style={{ fontSize: '12px', padding: '4px 10px' }}
            onClick={() => navigateToHref(`/admin/automations`)}
          >
            Back
          </button>
        </div>
      </div>

      {/* Flow Builder — fills remaining height */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <FlowBuilder
          processSpecId={processSpecId}
          initialView="steps"
          onStepSelected={setSelectedStepId}
        />
      </div>
    </div>
  );
};

export default FlowBuilderView;
