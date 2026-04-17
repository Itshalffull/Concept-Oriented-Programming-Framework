'use client';

/**
 * ReconcilersView — Admin list + detail for ContentReconciler registrations.
 *
 * List mode: /admin/system/reconcilers
 *   Table of all reverse-projection registrations with status badges
 *   (in-sync / drift / registered / conflict / lossy / requires_review).
 *
 * Detail mode: /admin/system/reconcilers/:registrationId
 *   Per-registration page with metadata, "View Plan" and "Reconcile Now"
 *   actions, and the current status + last-reconciled timestamp.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card } from '../components/widgets/Card';
import { Badge } from '../components/widgets/Badge';
import { DataTable, type ColumnDef } from '../components/widgets/DataTable';
import { EmptyState } from '../components/widgets/EmptyState';
import { useConceptQuery } from '../../lib/use-concept-query';
import { useKernelInvoke, useNavigator } from '../../lib/clef-provider';

interface ReconcilerRecord {
  registration: string;
  sourceKind: string;
  sourceId: string;
  targetConcept: string;
  mapping: string;
  status: string;
  drift: string;
  lastReconciledAt: string;
  lastPlan: string;
}

const DRIFT_VARIANT: Record<string, 'success' | 'error' | 'warning' | 'info' | 'secondary'> = {
  'in-sync': 'success',
  drift: 'warning',
  conflict: 'error',
  lossy: 'warning',
  requires_review: 'info',
  registered: 'secondary',
};

function driftLabel(d: string): string {
  if (!d) return 'unknown';
  if (d === 'in-sync') return 'in sync';
  if (d === 'requires_review') return 'requires review';
  return d;
}

interface ReconcilersViewProps {
  registrationId?: string;
}

export const ReconcilersView: React.FC<ReconcilersViewProps> = ({ registrationId }) => {
  const invoke = useKernelInvoke();
  const { navigateToHref } = useNavigator();
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [planText, setPlanText] = useState<string | null>(null);

  const { data: all, loading, refetch } = useConceptQuery<ReconcilerRecord[]>(
    'ContentReconciler', 'list', {},
  );
  const rows: ReconcilerRecord[] = all ?? [];

  const handleReconcile = useCallback(async (row: ReconcilerRecord) => {
    setActingOn(row.registration);
    try {
      await invoke('ContentReconciler', 'reconcile', {
        sourceKind: row.sourceKind,
        sourceId: row.sourceId,
      });
      refetch();
    } finally {
      setActingOn(null);
    }
  }, [invoke, refetch]);

  const handlePlan = useCallback(async (row: ReconcilerRecord) => {
    setActingOn(row.registration);
    try {
      const res = await invoke('ContentReconciler', 'plan', {
        sourceKind: row.sourceKind,
        sourceId: row.sourceId,
      });
      if (res.variant === 'ok' && typeof res.changes === 'string') {
        setPlanText(res.changes);
      } else {
        setPlanText(JSON.stringify(res, null, 2));
      }
    } finally {
      setActingOn(null);
    }
  }, [invoke]);

  const selected = useMemo(() => {
    if (!registrationId) return null;
    return rows.find(r => r.registration === registrationId) ?? null;
  }, [registrationId, rows]);

  // --- Detail mode ---
  if (registrationId) {
    if (loading) {
      return (
        <div style={{ padding: 'var(--spacing-lg)' }}>
          <span style={{ color: 'var(--palette-on-surface-variant)' }}>Loading reconciler…</span>
        </div>
      );
    }
    if (!selected) {
      return (
        <div>
          <div className="page-header">
            <h2 style={{ fontSize: 'var(--typography-title-lg-size)', margin: 0 }}>
              Reconciler Not Found
            </h2>
          </div>
          <EmptyState
            title={`No registration with id "${registrationId}"`}
            description="The reconciler may have been deleted or never existed."
          />
          <div style={{ marginTop: 'var(--spacing-md)' }}>
            <button
              data-part="button"
              data-variant="outlined"
              onClick={() => navigateToHref('/admin/system/reconcilers')}
            >
              Back to reconcilers
            </button>
          </div>
        </div>
      );
    }

    return (
      <div data-testid="reconciler-detail">
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center', marginBottom: 'var(--spacing-md)',
          fontSize: '12px', color: 'var(--palette-on-surface-variant)',
        }}>
          <span
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => navigateToHref('/admin/system/reconcilers')}
          >
            Reconcilers
          </span>
          <span>&rarr;</span>
          <strong>{selected.sourceId}</strong>
        </div>

        <div className="page-header">
          <h2 style={{ fontSize: 'var(--typography-title-lg-size)', margin: 0 }}>
            {selected.sourceId}
          </h2>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge variant={DRIFT_VARIANT[selected.drift] ?? 'secondary'}>
              {driftLabel(selected.drift)}
            </Badge>
            <Badge variant="info">{selected.targetConcept}</Badge>
          </div>
        </div>

        <Card variant="outlined" padding="md" style={{ marginBottom: 'var(--spacing-md)' }}>
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', margin: 0 }}>
            <dt style={{ fontSize: '12px', color: 'var(--palette-on-surface-variant)' }}>Source kind</dt>
            <dd style={{ margin: 0, fontSize: '13px' }}><code>{selected.sourceKind}</code></dd>
            <dt style={{ fontSize: '12px', color: 'var(--palette-on-surface-variant)' }}>Source id</dt>
            <dd style={{ margin: 0, fontSize: '13px' }}><code>{selected.sourceId}</code></dd>
            <dt style={{ fontSize: '12px', color: 'var(--palette-on-surface-variant)' }}>Target concept</dt>
            <dd style={{ margin: 0, fontSize: '13px' }}><code>{selected.targetConcept}</code></dd>
            <dt style={{ fontSize: '12px', color: 'var(--palette-on-surface-variant)' }}>Last reconciled</dt>
            <dd style={{ margin: 0, fontSize: '13px' }}>
              {selected.lastReconciledAt
                ? <span>{new Date(selected.lastReconciledAt).toLocaleString()}</span>
                : <span style={{ opacity: 0.6 }}>never</span>}
            </dd>
            <dt style={{ fontSize: '12px', color: 'var(--palette-on-surface-variant)' }}>Mapping</dt>
            <dd style={{ margin: 0, fontSize: '12px' }}>
              <pre style={{
                margin: 0, padding: '8px 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                background: 'var(--palette-surface-variant)',
                borderRadius: 'var(--radius-sm)', fontSize: '11px',
              }}>{selected.mapping || '(empty)'}</pre>
            </dd>
          </dl>
        </Card>

        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <button
            data-part="button"
            data-variant="filled"
            data-testid="reconcile-now"
            disabled={actingOn === selected.registration}
            onClick={() => handleReconcile(selected)}
          >
            {actingOn === selected.registration ? '…' : 'Reconcile Now'}
          </button>
          <button
            data-part="button"
            data-variant="outlined"
            data-testid="view-plan"
            disabled={actingOn === selected.registration}
            onClick={() => handlePlan(selected)}
          >
            View Plan
          </button>
        </div>

        {planText !== null && (
          <Card variant="outlined" padding="md" style={{ marginTop: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
              <strong style={{ fontSize: '13px' }}>Dry-run plan</strong>
              <button
                data-part="button"
                data-variant="text"
                onClick={() => setPlanText(null)}
              >
                Dismiss
              </button>
            </div>
            <pre style={{
              margin: 0, padding: '10px 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              background: 'var(--palette-surface-variant)',
              borderRadius: 'var(--radius-sm)', fontSize: '11px',
            }}>{planText}</pre>
          </Card>
        )}
      </div>
    );
  }

  // --- List mode ---
  const columns: ColumnDef[] = [
    {
      key: 'sourceId',
      label: 'Source',
      render: (val, row) => {
        const r = row as unknown as ReconcilerRecord;
        return (
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <code style={{ fontSize: '12px' }}>{String(val)}</code>
            <span style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)' }}>
              {r.sourceKind}
            </span>
          </span>
        );
      },
    },
    {
      key: 'targetConcept',
      label: 'Target',
      render: (val) => <Badge variant="info">{String(val)}</Badge>,
    },
    {
      key: 'drift',
      label: 'Status',
      render: (val) => (
        <Badge variant={DRIFT_VARIANT[String(val)] ?? 'secondary'}>
          {driftLabel(String(val))}
        </Badge>
      ),
    },
    {
      key: 'lastReconciledAt',
      label: 'Last reconciled',
      render: (val) => {
        const s = String(val ?? '');
        if (!s) return <span style={{ opacity: 0.5 }}>never</span>;
        try {
          return <span style={{ fontSize: '12px' }}>{new Date(s).toLocaleString()}</span>;
        } catch {
          return <span style={{ fontSize: '12px' }}>{s}</span>;
        }
      },
    },
    {
      key: 'registration',
      label: 'Actions',
      render: (val, row) => {
        const r = row as unknown as ReconcilerRecord;
        const busy = actingOn === r.registration;
        return (
          <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button
              data-part="button"
              data-variant="outlined"
              style={{ fontSize: '11px', padding: '3px 8px' }}
              disabled={busy}
              onClick={(e) => { e.stopPropagation(); handleReconcile(r); }}
            >
              {busy ? '…' : 'Reconcile'}
            </button>
            <button
              data-part="button"
              data-variant="text"
              style={{ fontSize: '11px', padding: '3px 8px' }}
              onClick={(e) => { e.stopPropagation(); navigateToHref(`/admin/system/reconcilers/${encodeURIComponent(r.registration)}`); }}
            >
              Detail
            </button>
          </span>
        );
      },
    },
  ];

  const inSync = rows.filter(r => r.drift === 'in-sync').length;
  const drift = rows.filter(r => r.drift === 'drift').length;
  const registered = rows.filter(r => r.drift === 'registered').length;

  return (
    <div data-testid="reconcilers-list">
      <div className="page-header">
        <h2 style={{ fontSize: 'var(--typography-title-lg-size)', margin: 0 }}>
          Content Reconcilers
        </h2>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
          {rows.length > 0 && (
            <>
              {inSync > 0 && <Badge variant="success">{inSync} in sync</Badge>}
              {drift > 0 && <Badge variant="warning">{drift} drift</Badge>}
              {registered > 0 && <Badge variant="secondary">{registered} never reconciled</Badge>}
            </>
          )}
          <Badge variant="info">{rows.length} total</Badge>
        </div>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-md)' }}>
        Reverse-projection registrations that map authored content pages back to concept state.
      </p>

      <Card variant="outlined" padding="none">
        {loading ? (
          <div style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-on-surface-variant)' }}>
            Loading reconcilers…
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No reconcilers registered"
            description="Register a ContentReconciler to reverse-project live concept state back into authored content."
          />
        ) : (
          <DataTable
            columns={columns}
            data={rows as unknown as Record<string, unknown>[]}
            ariaLabel="Content reconciler registrations"
            onRowClick={(row) => {
              const r = row as unknown as ReconcilerRecord;
              navigateToHref(`/admin/system/reconcilers/${encodeURIComponent(r.registration)}`);
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default ReconcilersView;
