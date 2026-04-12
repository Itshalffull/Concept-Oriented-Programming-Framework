'use client';

/**
 * ProcessRunView — Detail page for a single process run.
 * Three-mode tabs: Overview (run metadata + step map), Do (step-by-step
 * execution detail with step selection), and Variables (raw I/O inspection).
 *
 * Step navigation: clicking a step chip in Overview or a row in Do switches
 * to the Do tab and focuses that step's full detail panel. This mirrors
 * the step-click-switches-tab sync rule (syncs/app/step-click-switches-tab.sync).
 */

import React, { useState, useCallback } from 'react';
import { Card } from '../components/widgets/Card';
import { Badge } from '../components/widgets/Badge';
import { EmptyState } from '../components/widgets/EmptyState';
import { DataTable, type ColumnDef } from '../components/widgets/DataTable';
import { useContentNodes } from '../../lib/use-content-nodes';
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
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
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

function parseJson(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

interface ProcessRunViewProps {
  runId: string;
}

interface RunRecord {
  node: string;
  type?: string;
  content?: string;
  createdBy?: string;
  run_spec_ref?: string;
  run_status?: string;
  run_started_at?: string;
  run_ended_at?: string;
}

interface StepRunRecord {
  node: string;
  step_key?: string;
  step_type?: string;
  step_status?: string;
  step_attempt?: number;
  step_run_ref?: string;
  step_started_at?: string;
  step_ended_at?: string;
  content?: string;
}

export const ProcessRunView: React.FC<ProcessRunViewProps> = ({ runId }) => {
  const [activeTab, setActiveTab] = useState<TabMode>('overview');
  const [focusedStepKey, setFocusedStepKey] = useState<string | null>(null);
  const [versionSpace, setVersionSpace] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const invoke = useKernelInvoke();
  const { navigateToHref } = useNavigator();

  // VersionSpace fork/compare/merge handlers
  const handleForkReality = useCallback(async () => {
    const name = window.prompt('Name for forked reality:');
    if (!name) return;
    setActionError(null);
    setActionPending(true);
    try {
      const result = await invoke('VersionSpace', 'fork', { scope: runId, name });
      if (result?.version_space) {
        setVersionSpace(result.version_space as string);
      } else if (result.variant !== 'ok') {
        setActionError((result.message as string | undefined) ?? 'Failed to fork reality.');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to fork reality.');
    } finally {
      setActionPending(false);
    }
  }, [invoke, runId]);

  const handleCompareRealities = useCallback(async () => {
    if (!versionSpace) return;
    setActionError(null);
    setActionPending(true);
    try {
      const result = await invoke('VersionSpace', 'diff', { version_space: versionSpace, scope: runId });
      if (result.variant !== 'ok') {
        setActionError((result.message as string | undefined) ?? 'Failed to compare realities.');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to compare realities.');
    } finally {
      setActionPending(false);
    }
  }, [invoke, runId, versionSpace]);

  const handleMergeReality = useCallback(async () => {
    if (!versionSpace) return;
    setActionError(null);
    setActionPending(true);
    try {
      const result = await invoke('VersionSpace', 'merge', { version_space: versionSpace, scope: runId });
      if (result.variant === 'ok') {
        setVersionSpace(null);
      } else {
        setActionError((result.message as string | undefined) ?? 'Failed to merge reality.');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to merge reality.');
    } finally {
      setActionPending(false);
    }
  }, [invoke, runId, versionSpace]);

  // Derive version_space from run content if present (on first load)
  const [vsInitialized, setVsInitialized] = useState(false);

  // Load the run ContentNode by node ID
  const { data: allNodes, loading: nodesLoading } = useContentNodes();

  const run = (allNodes ?? []).find(
    (n) => n.node === runId || n.node === `process-run:${runId}`,
  ) as RunRecord | undefined;

  // Parse run content fields
  const runContent = parseJson(run?.content);
  const specRef = (run?.run_spec_ref ?? runContent.run_spec_ref) as string | undefined;
  const runStatus = (run?.run_status ?? runContent.run_status) as string | undefined;
  const startedAt = (run?.run_started_at ?? runContent.run_started_at) as string | undefined;
  const endedAt = (run?.run_ended_at ?? runContent.run_ended_at) as string | undefined;

  // Initialize version space from run data on first load
  if (!vsInitialized && runContent.version_space) {
    setVersionSpace(runContent.version_space as string);
    setVsInitialized(true);
  } else if (!vsInitialized && run) {
    setVsInitialized(true);
  }

  // Load step runs for this run
  const stepRunNodes = (allNodes ?? []).filter((n) => {
    const rec = n as StepRunRecord;
    const ref = rec.step_run_ref ?? (parseJson(rec.content).step_run_ref as string | undefined);
    return ref === runId || ref === `process-run:${runId}`;
  }) as StepRunRecord[];

  const stepRunsEnriched: StepRunRecord[] = stepRunNodes.map((n) => {
    const content = parseJson(n.content);
    return {
      ...n,
      step_key: n.step_key ?? content.step_key as string,
      step_type: n.step_type ?? content.step_type as string,
      step_status: n.step_status ?? content.step_status as string,
      step_attempt: n.step_attempt ?? content.step_attempt as number,
      step_run_ref: n.step_run_ref ?? content.step_run_ref as string,
      step_started_at: n.step_started_at ?? content.step_started_at as string,
      step_ended_at: n.step_ended_at ?? content.step_ended_at as string,
    };
  });

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
      key: 'step_status',
      label: 'Status',
      render: (val) => {
        const s = String(val ?? '');
        return <Badge variant={STEP_STATUS_VARIANT[s] ?? 'secondary'}>{s || '—'}</Badge>;
      },
    },
    {
      key: 'step_attempt',
      label: 'Attempt',
      render: (val) => <span>{String(val ?? 1)}</span>,
    },
    {
      key: 'step_started_at',
      label: 'Started',
      render: (val) => <span style={{ fontSize: 'var(--typography-body-sm-size)' }}>{formatDate(val as string)}</span>,
    },
    {
      key: 'step_ended_at',
      label: 'Duration',
      render: (_val, row) => {
        const r = row as StepRunRecord;
        return <span>{parseDuration(r.step_started_at, r.step_ended_at)}</span>;
      },
    },
  ];

  // Run lifecycle actions
  const handleCancel = async () => {
    setActionError(null);
    setActionPending(true);
    try {
      const result = await invoke('ProcessRun', 'cancel', { run: runId });
      if (result.variant !== 'ok') {
        setActionError((result.message as string | undefined) ?? 'Failed to cancel run.');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to cancel run.');
    } finally {
      setActionPending(false);
    }
  };

  const handleResume = async () => {
    setActionError(null);
    setActionPending(true);
    try {
      const result = await invoke('ProcessRun', 'resume', { run: runId });
      if (result.variant !== 'ok') {
        setActionError((result.message as string | undefined) ?? 'Failed to resume run.');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to resume run.');
    } finally {
      setActionPending(false);
    }
  };

  const canCancel = runStatus === 'running' || runStatus === 'suspended';
  const canResume = runStatus === 'suspended';

  if (nodesLoading) {
    return (
      <div>
        <div className="page-header"><h1>Process Run</h1></div>
        <p style={{ color: 'var(--palette-on-surface-variant)' }}>Loading...</p>
      </div>
    );
  }

  if (!run) {
    return (
      <div>
        <div className="page-header"><h1>Process Run</h1></div>
        <Card variant="outlined">
          <EmptyState
            title="Run not found"
            description={`No process run exists with ID "${runId}".`}
            action={
              <button data-part="button" data-variant="outlined" onClick={() => navigateToHref('/admin/process-runs')}>
                Back to runs
              </button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 style={{ fontFamily: 'var(--typography-font-family-mono)', fontSize: '18px' }}>
            {runId}
          </h1>
          {specRef && (
            <p style={{ color: 'var(--palette-on-surface-variant)', marginTop: '2px', fontSize: 'var(--typography-body-sm-size)' }}>
              {specRef}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
          {versionSpace && (
            <Badge variant="info" style={{ fontFamily: 'var(--typography-font-family-mono)', fontSize: '11px' }}>
              VS: {versionSpace}
            </Badge>
          )}
          {runStatus && (
            <Badge variant={STATUS_VARIANT[runStatus] ?? 'secondary'}>
              {runStatus}
            </Badge>
          )}
          <button data-part="button" data-variant="outlined" onClick={handleForkReality} disabled={actionPending}>
            Fork Reality
          </button>
          {versionSpace && (
            <button data-part="button" data-variant="outlined" onClick={handleCompareRealities} disabled={actionPending}>
              Compare Realities
            </button>
          )}
          {versionSpace && (
            <button data-part="button" data-variant="outlined" onClick={handleMergeReality} disabled={actionPending}>
              Merge Reality
            </button>
          )}
          {canResume && (
            <button data-part="button" data-variant="outlined" onClick={handleResume} disabled={actionPending}>
              {actionPending ? '...' : 'Resume'}
            </button>
          )}
          {canCancel && (
            <button data-part="button" data-variant="outlined" onClick={handleCancel} disabled={actionPending}>
              {actionPending ? '...' : 'Cancel'}
            </button>
          )}
        </div>
      </div>

      {/* Action error banner */}
      {actionError && (
        <div style={{
          marginBottom: 'var(--spacing-md)',
          padding: '8px 12px',
          background: 'var(--palette-error-container)',
          color: 'var(--palette-on-error-container)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '13px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}>
          <span>{actionError}</span>
          <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 14, lineHeight: 1 }} onClick={() => setActionError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* Three-mode tab bar: Overview (map), Do (step execution), Variables */}
      <div data-part="tabs" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <button
          data-part="tab"
          data-active={activeTab === 'overview' ? 'true' : 'false'}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          data-part="tab"
          data-active={activeTab === 'do' ? 'true' : 'false'}
          onClick={() => setActiveTab('do')}
        >
          Do
          {stepRunsEnriched.length > 0 && (
            <Badge variant="secondary" style={{ marginLeft: '6px' }}>{stepRunsEnriched.length}</Badge>
          )}
        </button>
        <button
          data-part="tab"
          data-active={activeTab === 'variables' ? 'true' : 'false'}
          onClick={() => setActiveTab('variables')}
        >
          Variables
        </button>
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div>
          <Card variant="outlined">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                  Run ID
                </div>
                <code style={{ fontSize: 'var(--typography-code-sm-size)' }}>{runId}</code>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                  Spec
                </div>
                {specRef ? (
                  <button
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--palette-primary)', fontFamily: 'var(--typography-font-family-mono)', fontSize: 'var(--typography-code-sm-size)' }}
                    onClick={() => navigateToHref(`/admin/processes/${encodeURIComponent(specRef)}`)}
                  >
                    {specRef}
                  </button>
                ) : (
                  <span style={{ color: 'var(--palette-on-surface-variant)' }}>—</span>
                )}
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                  Status
                </div>
                {runStatus ? (
                  <Badge variant={STATUS_VARIANT[runStatus] ?? 'secondary'}>{runStatus}</Badge>
                ) : (
                  <span style={{ color: 'var(--palette-on-surface-variant)' }}>—</span>
                )}
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                  Duration
                </div>
                <span>{parseDuration(startedAt, endedAt)}</span>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                  Started
                </div>
                <span>{formatDate(startedAt)}</span>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                  Ended
                </div>
                <span>{formatDate(endedAt)}</span>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                  Steps completed
                </div>
                <span>{stepRunsEnriched.filter((s) => s.step_status === 'completed').length} / {stepRunsEnriched.length}</span>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                  Created by
                </div>
                <span>{String(run.createdBy ?? '—')}</span>
              </div>
            </div>
          </Card>

          {/* Mini step progress bar */}
          {stepRunsEnriched.length > 0 && (
            <div className="section" style={{ marginTop: 'var(--spacing-lg)' }}>
              <div className="section__header">
                <h2 className="section__title">Step Progress</h2>
                <Badge variant="info">{stepRunsEnriched.length} steps</Badge>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {stepRunsEnriched.map((step) => {
                  const status = step.step_status ?? 'pending';
                  const colorMap: Record<string, string> = {
                    completed: 'var(--palette-success)',
                    failed: 'var(--palette-error)',
                    active: 'var(--palette-primary)',
                    skipped: 'var(--palette-outline)',
                    pending: 'var(--palette-surface-variant)',
                  };
                  const stepKey = step.step_key ?? '?';
                  return (
                    <button
                      key={step.node}
                      title={`${stepKey}: ${status} — click to open in Do tab`}
                      onClick={() => {
                        setFocusedStepKey(stepKey);
                        setActiveTab('do');
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: colorMap[status] ?? 'var(--palette-surface-variant)',
                        color: status === 'pending' ? 'var(--palette-on-surface-variant)' : 'white',
                        fontSize: '12px',
                        fontFamily: 'var(--typography-font-family-mono)',
                        cursor: 'pointer',
                        border: 'none',
                        outline: 'none',
                      }}
                    >
                      {stepKey}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Do tab — step-by-step execution detail */}
      {activeTab === 'do' && (
        <div>
          {/* Step detail panel — shown when a step node was clicked */}
          {focusedStepKey && (() => {
            const focused = stepRunsEnriched.find(s => s.step_key === focusedStepKey);
            if (!focused) return null;
            const status = focused.step_status ?? 'pending';
            return (
              <Card variant="outlined" style={{ marginBottom: 'var(--spacing-lg)', borderLeft: `4px solid ${status === 'completed' ? 'var(--palette-success)' : status === 'failed' ? 'var(--palette-error)' : status === 'active' ? 'var(--palette-primary)' : 'var(--palette-outline)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-md)' }}>
                  <div>
                    <code style={{ fontSize: '14px', fontWeight: 700 }}>{focused.step_key}</code>
                    <div style={{ marginTop: '4px', display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                      <Badge variant={STEP_STATUS_VARIANT[status] ?? 'secondary'}>{status}</Badge>
                      {focused.step_type && <Badge variant="secondary">{focused.step_type}</Badge>}
                      {focused.step_attempt != null && (
                        <Badge variant="secondary">attempt {focused.step_attempt}</Badge>
                      )}
                    </div>
                  </div>
                  <button
                    data-part="button"
                    data-variant="text"
                    style={{ fontSize: '11px', opacity: 0.6 }}
                    onClick={() => setFocusedStepKey(null)}
                  >
                    Clear focus
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)', fontSize: '12px' }}>
                  <div>
                    <div style={{ color: 'var(--palette-on-surface-variant)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Started</div>
                    <span>{formatDate(focused.step_started_at)}</span>
                  </div>
                  <div>
                    <div style={{ color: 'var(--palette-on-surface-variant)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Duration</div>
                    <span>{parseDuration(focused.step_started_at, focused.step_ended_at)}</span>
                  </div>
                </div>
                {focused.content && (
                  <div style={{ marginTop: 'var(--spacing-sm)' }}>
                    <div style={{ color: 'var(--palette-on-surface-variant)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Output</div>
                    <pre style={{
                      fontFamily: 'var(--typography-font-family-mono)',
                      fontSize: '11px',
                      background: 'var(--palette-surface-variant)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 10px',
                      overflow: 'auto',
                      maxHeight: '120px',
                      color: 'var(--palette-on-surface)',
                      margin: 0,
                    }}>
                      {focused.content}
                    </pre>
                  </div>
                )}
              </Card>
            );
          })()}

          {/* All step runs table */}
          {stepRunsEnriched.length === 0 ? (
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
                data={stepRunsEnriched as unknown as Record<string, unknown>[]}
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
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
            <Card variant="outlined">
              <div style={{ marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>Input</div>
              <pre style={{
                fontFamily: 'var(--typography-font-family-mono)',
                fontSize: '12px',
                background: 'var(--palette-surface-variant)',
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--spacing-sm)',
                overflow: 'auto',
                maxHeight: '300px',
                color: 'var(--palette-on-surface)',
                margin: 0,
              }}>
                {JSON.stringify(runContent, null, 2) || 'No input recorded'}
              </pre>
            </Card>
            <Card variant="outlined">
              <div style={{ marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>Step Variable Snapshots</div>
              {stepRunsEnriched.length === 0 ? (
                <p style={{ color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-body-sm-size)' }}>
                  No steps recorded yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  {stepRunsEnriched.map((step) => (
                    <div key={step.node} style={{
                      borderLeft: `3px solid ${step.step_status === 'completed' ? 'var(--palette-success)' : step.step_status === 'failed' ? 'var(--palette-error)' : 'var(--palette-outline)'}`,
                      paddingLeft: 'var(--spacing-sm)',
                    }}>
                      <div style={{ fontSize: '12px', fontFamily: 'var(--typography-font-family-mono)', fontWeight: 600 }}>
                        {step.step_key}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)' }}>
                        {step.step_status} · attempt {step.step_attempt ?? 1} · {parseDuration(step.step_started_at, step.step_ended_at)}
                      </div>
                      {step.content && (
                        <pre style={{
                          fontFamily: 'var(--typography-font-family-mono)',
                          fontSize: '11px',
                          background: 'var(--palette-surface-variant)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '4px 8px',
                          overflow: 'auto',
                          maxHeight: '80px',
                          color: 'var(--palette-on-surface)',
                          margin: '4px 0 0',
                        }}>
                          {step.content}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessRunView;
