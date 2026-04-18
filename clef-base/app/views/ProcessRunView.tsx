'use client';

/**
 * ProcessRunView — Detail page for a single process run.
 * Loads run metadata via ProcessRun/get and step records via StepRun/list.
 * Three tabs: Overview (metadata + step progress), Do (step detail table), Variables (I/O).
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Card } from '../components/widgets/Card';
import { Badge } from '../components/widgets/Badge';
import { EmptyState } from '../components/widgets/EmptyState';
import { DataTable, type ColumnDef } from '../components/widgets/DataTable';
import { useKernelInvoke, useNavigator } from '../../lib/clef-provider';

type TabMode = 'overview' | 'do' | 'variables';

const STATUS_VARIANT: Record<string, 'success' | 'error' | 'warning' | 'info' | 'secondary'> = {
  completed: 'success',
  failed: 'error',
  running: 'info',
  suspended: 'warning',
  cancelled: 'secondary',
  pending: 'secondary',
};

const STEP_STATUS_VARIANT: Record<string, 'success' | 'error' | 'warning' | 'info' | 'secondary'> = {
  completed: 'success',
  failed: 'error',
  active: 'info',
  skipped: 'secondary',
  pending: 'secondary',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function parseDuration(started: string | null | undefined, ended: string | null | undefined): string {
  if (!started) return '—';
  const start = new Date(started).getTime();
  const end = ended ? new Date(ended).getTime() : Date.now();
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

interface ProcessRunViewProps {
  runId: string;
}

interface RunRecord {
  run: string;
  spec_ref?: string;
  spec_version?: number;
  status?: string;
  started_at?: string;
  ended_at?: string | null;
  input?: string | null;
  output?: string | null;
  error?: string | null;
  principal?: string | null;
  parent_run?: string | null;
}

interface StepRunRecord {
  id?: string;
  run_ref?: string;
  step_key?: string;
  step_type?: string;
  status?: string;
  attempt?: number;
  started_at?: string;
  ended_at?: string | null;
  input?: string | null;
  output?: string | null;
  error?: string | null;
}

export const ProcessRunView: React.FC<ProcessRunViewProps> = ({ runId }) => {
  const invoke = useKernelInvoke();
  const { navigateToHref } = useNavigator();

  const [activeTab, setActiveTab] = useState<TabMode>('overview');
  const [focusedStepKey, setFocusedStepKey] = useState<string | null>(null);

  const [run, setRun] = useState<RunRecord | null>(null);
  const [stepRuns, setStepRuns] = useState<StepRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionBusy, setActionBusy] = useState(false);

  const handleRunAction = useCallback(async (action: 'cancel' | 'resume' | 'complete') => {
    setActionBusy(true);
    try {
      await invoke('ProcessRun', action, { run: runId });
      setRefreshKey(k => k + 1);
    } finally {
      setActionBusy(false);
    }
  }, [invoke, runId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    Promise.all([
      invoke('ProcessRun', 'get', { run: runId }),
      invoke('StepRun', 'list', { run_ref: runId }),
    ]).then(([runResult, stepsResult]) => {
      if (cancelled) return;
      if (!runResult || (runResult as Record<string, unknown>).variant === 'not_found') {
        setNotFound(true);
        setRun(null);
      } else if ((runResult as Record<string, unknown>).variant === 'ok') {
        setRun(runResult as RunRecord);
      }
      if (stepsResult && (stepsResult as Record<string, unknown>).variant === 'ok') {
        const sr = stepsResult as Record<string, unknown>;
        const raw = Array.isArray(sr.step_runs) ? (sr.step_runs as StepRunRecord[]) : [];
        setStepRuns(raw.filter(s => s.id !== '__registered'));
      }
    }).catch(() => {
      if (!cancelled) setNotFound(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [runId, invoke, refreshKey]);

  // Auto-refresh every 5s while running
  useEffect(() => {
    if (run?.status !== 'running') return;
    const t = setInterval(() => setRefreshKey(k => k + 1), 5000);
    return () => clearInterval(t);
  }, [run?.status]);

  const stepColumns: ColumnDef[] = [
    {
      key: 'step_key',
      label: 'Step',
      render: (val) => (
        <code style={{ fontSize: 'var(--typography-code-sm-size)', fontWeight: focusedStepKey === String(val) ? 700 : undefined }}>
          {String(val ?? '—')}
        </code>
      ),
    },
    {
      key: 'step_type',
      label: 'Type',
      render: (val) => <Badge variant="secondary">{String(val ?? '—')}</Badge>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => {
        const s = String(val ?? '');
        return <Badge variant={STEP_STATUS_VARIANT[s] ?? 'secondary'}>{s || '—'}</Badge>;
      },
    },
    {
      key: 'attempt',
      label: 'Attempt',
      render: (val) => <span>{String(val ?? 1)}</span>,
    },
    {
      key: 'started_at',
      label: 'Started',
      render: (val) => <span style={{ fontSize: 'var(--typography-body-sm-size)' }}>{formatDate(val as string)}</span>,
    },
    {
      key: 'ended_at',
      label: 'Duration',
      render: (_val, row) => {
        const r = row as StepRunRecord;
        return <span>{parseDuration(r.started_at, r.ended_at)}</span>;
      },
    },
  ];

  if (loading) {
    return (
      <div>
        <div className="page-header"><h1>Process Run</h1></div>
        <p style={{ color: 'var(--palette-on-surface-variant)' }}>Loading…</p>
      </div>
    );
  }

  if (notFound || !run) {
    return (
      <div>
        <div className="page-header"><h1>Process Run</h1></div>
        <Card variant="outlined">
          <EmptyState
            title="Run not found"
            description={`No process run exists with ID "${runId}".`}
            action={
              <button data-part="button" data-variant="outlined" onClick={() => navigateToHref('/admin/automations')}>
                Back to automations
              </button>
            }
          />
        </Card>
      </div>
    );
  }

  const canCancel = run.status === 'running' || run.status === 'suspended';
  const canResume = run.status === 'suspended';
  const canComplete = run.status === 'running';

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 style={{ fontFamily: 'var(--typography-font-family-mono)', fontSize: '18px' }}>{runId}</h1>
          {run.spec_ref && (
            <p style={{ color: 'var(--palette-on-surface-variant)', marginTop: '2px', fontSize: 'var(--typography-body-sm-size)' }}>
              {run.spec_ref}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
          {run.status && (
            <Badge variant={STATUS_VARIANT[run.status] ?? 'secondary'}>{run.status}</Badge>
          )}
          {canComplete && (
            <button
              data-part="button"
              data-variant="filled"
              disabled={actionBusy}
              onClick={() => void handleRunAction('complete')}
            >
              {actionBusy ? '…' : 'Mark Complete'}
            </button>
          )}
          {canResume && (
            <button
              data-part="button"
              data-variant="secondary"
              disabled={actionBusy}
              onClick={() => handleRunAction('resume')}
            >
              {actionBusy ? '…' : 'Resume'}
            </button>
          )}
          {canCancel && (
            <button
              data-part="button"
              data-variant="ghost"
              disabled={actionBusy}
              onClick={() => {
                if (!confirm('Cancel this process run?')) return;
                void handleRunAction('cancel');
              }}
            >
              {actionBusy ? '…' : 'Cancel'}
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div data-part="tabs" style={{ marginBottom: 'var(--spacing-lg)' }}>
        {(['overview', 'do', 'variables'] as TabMode[]).map(tab => (
          <button
            key={tab}
            data-part="tab"
            data-active={activeTab === tab ? 'true' : 'false'}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' ? 'Overview' : tab === 'do' ? (
              <>Do {stepRuns.length > 0 && <Badge variant="secondary" style={{ marginLeft: 6 }}>{stepRuns.length}</Badge>}</>
            ) : 'Variables'}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div>
          <Card variant="outlined">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
              {[
                { label: 'Run ID', value: <code style={{ fontSize: 'var(--typography-code-sm-size)' }}>{runId}</code> },
                { label: 'Spec', value: run.spec_ref ? (
                  <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--palette-primary)', fontFamily: 'var(--typography-font-family-mono)', fontSize: 'var(--typography-code-sm-size)' }}
                    onClick={() => navigateToHref(`/admin/processes/${encodeURIComponent(run.spec_ref!)}`)}>
                    {run.spec_ref}
                  </button>
                ) : '—' },
                { label: 'Status', value: run.status ? <Badge variant={STATUS_VARIANT[run.status] ?? 'secondary'}>{run.status}</Badge> : '—' },
                { label: 'Duration', value: parseDuration(run.started_at, run.ended_at ?? null) },
                { label: 'Started', value: formatDate(run.started_at) },
                { label: 'Ended', value: formatDate(run.ended_at) },
                { label: 'Steps completed', value: `${stepRuns.filter(s => s.status === 'completed').length} / ${stepRuns.length}` },
                { label: 'Created by', value: run.principal ?? '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{label}</div>
                  <div>{value}</div>
                </div>
              ))}
              {run.error && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '11px', color: 'var(--palette-error)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Error</div>
                  <pre style={{ fontFamily: 'var(--typography-font-family-mono)', fontSize: '11px', color: 'var(--palette-error)', background: 'var(--palette-error-container, #fdecea)', padding: '8px', borderRadius: 'var(--radius-sm)', overflow: 'auto', margin: 0 }}>
                    {run.error}
                  </pre>
                </div>
              )}
            </div>
          </Card>

          {/* Step progress chips */}
          {stepRuns.length > 0 && (
            <div className="section" style={{ marginTop: 'var(--spacing-lg)' }}>
              <div className="section__header">
                <h2 className="section__title">Step Progress</h2>
                <Badge variant="info">{stepRuns.length} steps</Badge>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {stepRuns.map((step) => {
                  const status = step.status ?? 'pending';
                  const colorMap: Record<string, string> = {
                    completed: 'var(--palette-success, #2e7d32)', failed: 'var(--palette-error)',
                    active: 'var(--palette-primary)', skipped: 'var(--palette-outline)',
                    pending: 'var(--palette-surface-variant)',
                  };
                  return (
                    <button
                      key={step.id ?? step.step_key}
                      title={`${step.step_key}: ${status}`}
                      onClick={() => { setFocusedStepKey(step.step_key ?? null); setActiveTab('do'); }}
                      style={{
                        padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                        background: colorMap[status] ?? 'var(--palette-surface-variant)',
                        color: status === 'pending' ? 'var(--palette-on-surface-variant)' : 'white',
                        fontSize: '12px', fontFamily: 'var(--typography-font-family-mono)',
                        cursor: 'pointer', border: 'none', outline: 'none',
                      }}
                    >
                      {step.step_key}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {stepRuns.length === 0 && run.status === 'running' && (
            <Card variant="outlined" style={{ marginTop: 'var(--spacing-lg)' }}>
              <EmptyState
                title="Process running"
                description="No step runs recorded yet. The execution engine will populate steps as they execute."
              />
            </Card>
          )}
        </div>
      )}

      {/* Do tab */}
      {activeTab === 'do' && (
        <div>
          {focusedStepKey && (() => {
            const focused = stepRuns.find(s => s.step_key === focusedStepKey);
            if (!focused) return null;
            const status = focused.status ?? 'pending';
            return (
              <Card variant="outlined" style={{ marginBottom: 'var(--spacing-lg)', borderLeft: `4px solid ${status === 'completed' ? 'var(--palette-success, #2e7d32)' : status === 'failed' ? 'var(--palette-error)' : status === 'active' ? 'var(--palette-primary)' : 'var(--palette-outline)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-md)' }}>
                  <div>
                    <code style={{ fontSize: '14px', fontWeight: 700 }}>{focused.step_key}</code>
                    <div style={{ marginTop: '4px', display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                      <Badge variant={STEP_STATUS_VARIANT[status] ?? 'secondary'}>{status}</Badge>
                      {focused.step_type && <Badge variant="secondary">{focused.step_type}</Badge>}
                      {focused.attempt != null && <Badge variant="secondary">attempt {focused.attempt}</Badge>}
                    </div>
                  </div>
                  <button data-part="button" data-variant="text" style={{ fontSize: '11px', opacity: 0.6 }}
                    onClick={() => setFocusedStepKey(null)}>Clear focus</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)', fontSize: '12px' }}>
                  <div>
                    <div style={{ color: 'var(--palette-on-surface-variant)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Started</div>
                    <span>{formatDate(focused.started_at)}</span>
                  </div>
                  <div>
                    <div style={{ color: 'var(--palette-on-surface-variant)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Duration</div>
                    <span>{parseDuration(focused.started_at, focused.ended_at)}</span>
                  </div>
                </div>
                {focused.output && (
                  <div style={{ marginTop: 'var(--spacing-sm)' }}>
                    <div style={{ color: 'var(--palette-on-surface-variant)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Output</div>
                    <pre style={{ fontFamily: 'var(--typography-font-family-mono)', fontSize: '11px', background: 'var(--palette-surface-variant)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', overflow: 'auto', maxHeight: '120px', color: 'var(--palette-on-surface)', margin: 0 }}>
                      {focused.output}
                    </pre>
                  </div>
                )}
              </Card>
            );
          })()}

          {stepRuns.length === 0 ? (
            <Card variant="outlined">
              <EmptyState
                title="No step runs recorded"
                description="Step execution records appear here as the process run progresses through its steps."
              />
            </Card>
          ) : (
            <Card variant="outlined" padding="none">
              <DataTable
                columns={stepColumns}
                data={stepRuns as unknown as Record<string, unknown>[]}
                ariaLabel="Step runs"
                sortable
                onRowClick={(row) => {
                  const key = row.step_key as string | undefined;
                  if (key) setFocusedStepKey(key);
                }}
              />
            </Card>
          )}
        </div>
      )}

      {/* Variables tab */}
      {activeTab === 'variables' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
          <Card variant="outlined">
            <div style={{ marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>Input</div>
            <pre style={{ fontFamily: 'var(--typography-font-family-mono)', fontSize: '12px', background: 'var(--palette-surface-variant)', borderRadius: 'var(--radius-sm)', padding: 'var(--spacing-sm)', overflow: 'auto', maxHeight: '300px', color: 'var(--palette-on-surface)', margin: 0 }}>
              {run.input ? JSON.stringify(JSON.parse(run.input), null, 2) : 'No input recorded'}
            </pre>
          </Card>
          <Card variant="outlined">
            <div style={{ marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>Output</div>
            <pre style={{ fontFamily: 'var(--typography-font-family-mono)', fontSize: '12px', background: 'var(--palette-surface-variant)', borderRadius: 'var(--radius-sm)', padding: 'var(--spacing-sm)', overflow: 'auto', maxHeight: '300px', color: 'var(--palette-on-surface)', margin: 0 }}>
              {run.output ? JSON.stringify(JSON.parse(run.output), null, 2) : 'No output recorded'}
            </pre>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ProcessRunView;
