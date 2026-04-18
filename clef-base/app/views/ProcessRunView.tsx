'use client';

/**
 * ProcessRunView — Detail page for a single process run.
 *
 * Layout: Process Street-style two-panel shell.
 *   Left  (~240px): StepSidebar — vertical step list, click to focus
 *   Right (flex 1): Two zones stacked vertically
 *     Top:    Step context card — focused step title, description, config metadata
 *     Bottom: StepInteractionSlot — dispatches on step_type for participant interaction
 *
 * A "Details" tab row at the top-right gives access to the run Overview
 * (metadata grid) and Variables (I/O JSON) panels, preserving the original
 * three-tab content without removing it.
 *
 * All original behavior is preserved:
 *   - ProcessRun/get + StepRun/list data loading
 *   - stepLabelMap from ProcessSpec/getSteps
 *   - handleAdvanceStep → StepRun/complete → ProcessRun/resume
 *   - auto-refresh every 5s while status === 'running'
 *   - cancel / resume / complete header actions
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Card } from '../components/widgets/Card';
import { Badge } from '../components/widgets/Badge';
import { EmptyState } from '../components/widgets/EmptyState';
import { DataTable, type ColumnDef } from '../components/widgets/DataTable';
import { useKernelInvoke, useNavigator } from '../../lib/clef-provider';
import { StepSidebar } from '../components/process/StepSidebar';
import { StepInteractionSlot } from '../components/process/StepInteractionSlot';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DetailsTab = 'none' | 'overview' | 'variables' | 'steps';

const STATUS_VARIANT: Record<string, 'success' | 'error' | 'warning' | 'info' | 'secondary'> = {
  completed: 'success',
  failed:    'error',
  running:   'info',
  suspended: 'warning',
  cancelled: 'secondary',
  pending:   'secondary',
};

const STEP_STATUS_VARIANT: Record<string, 'success' | 'error' | 'warning' | 'info' | 'secondary'> = {
  completed: 'success',
  failed:    'error',
  active:    'info',
  skipped:   'secondary',
  pending:   'secondary',
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

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

function prettifyKey(key: string): string {
  return key
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Render a human-readable value for a step config key/value pair. */
function renderConfigValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return val || '—';
  return JSON.stringify(val);
}

/** Keys we skip in the config metadata display — internal / non-human-readable. */
const CONFIG_SKIP_KEYS = new Set(['id', 'stepId', 'specRef', 'parentId', 'edgeId', 'fromStepId', 'toStepId']);

// ---------------------------------------------------------------------------
// Record interfaces
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// StepContextCard — read-only top zone of the right panel
// ---------------------------------------------------------------------------

interface StepContextCardProps {
  stepRun: StepRunRecord;
  stepLabel: string;
}

const StepContextCard: React.FC<StepContextCardProps> = ({ stepRun, stepLabel }) => {
  const status = stepRun.status ?? 'pending';

  // Parse input for description/instructions + config metadata
  let parsedInput: Record<string, unknown> = {};
  if (stepRun.input) {
    try { parsedInput = JSON.parse(stepRun.input) as Record<string, unknown>; } catch { /* non-fatal */ }
  }

  const description =
    (parsedInput.description as string | undefined) ||
    (parsedInput.instructions as string | undefined) ||
    null;

  // Config metadata: human-readable pairs, skipping internal IDs
  const configPairs = Object.entries(parsedInput).filter(([k]) =>
    !CONFIG_SKIP_KEYS.has(k) && k !== 'description' && k !== 'instructions'
  );

  const borderColor =
    status === 'completed' ? 'var(--palette-success, #2e7d32)' :
    status === 'failed'    ? 'var(--palette-error)' :
    status === 'active'    ? 'var(--palette-primary)' :
                             'var(--palette-outline)';

  return (
    <div
      style={{
        border: `1px solid var(--palette-outline-variant, #e0e0e0)`,
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: 'var(--radius-card)',
        padding: '16px 20px',
        background: 'var(--palette-surface)',
        marginBottom: 'var(--spacing-md)',
      }}
    >
      {/* Step title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: '8px' }}>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{stepLabel}</h2>
        <Badge variant={STEP_STATUS_VARIANT[status] ?? 'secondary'}>{status}</Badge>
        {stepRun.step_type && <Badge variant="secondary">{stepRun.step_type}</Badge>}
      </div>

      {/* Description / instructions */}
      {description && (
        <p style={{ margin: '0 0 12px 0', fontSize: 'var(--typography-body-sm-size)', color: 'var(--palette-on-surface-variant)' }}>
          {description}
        </p>
      )}

      {/* Config metadata pairs */}
      {configPairs.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', marginTop: '8px' }}>
          {configPairs.map(([k, v]) => (
            <div key={k} style={{ minWidth: '120px' }}>
              <div style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '2px' }}>
                {prettifyKey(k)}
              </div>
              <div style={{ fontSize: '13px' }}>{renderConfigValue(v)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Timing */}
      <div style={{ display: 'flex', gap: '24px', marginTop: '12px', fontSize: '12px', color: 'var(--palette-on-surface-variant)' }}>
        <span>Started: {formatDate(stepRun.started_at)}</span>
        <span>Duration: {parseDuration(stepRun.started_at, stepRun.ended_at)}</span>
        {stepRun.attempt != null && <span>Attempt {stepRun.attempt}</span>}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const ProcessRunView: React.FC<ProcessRunViewProps> = ({ runId }) => {
  const invoke = useKernelInvoke();
  const { navigateToHref } = useNavigator();

  const [detailsTab, setDetailsTab] = useState<DetailsTab>('none');
  const [focusedStepKey, setFocusedStepKey] = useState<string | null>(null);

  const [run, setRun] = useState<RunRecord | null>(null);
  const [stepRuns, setStepRuns] = useState<StepRunRecord[]>([]);
  const [specName, setSpecName] = useState<string | null>(null);
  const [stepLabelMap, setStepLabelMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionBusy, setActionBusy] = useState(false);

  // -------------------------------------------------------------------------
  // Actions (unchanged from original)
  // -------------------------------------------------------------------------

  const handleRunAction = useCallback(async (action: 'cancel' | 'resume' | 'complete') => {
    setActionBusy(true);
    try {
      await invoke('ProcessRun', action, { run: runId });
      setRefreshKey(k => k + 1);
    } finally {
      setActionBusy(false);
    }
  }, [invoke, runId]);

  const handleAdvanceStep = useCallback(async () => {
    const activeStep = stepRuns.find(s => s.status === 'active');
    if (!activeStep?.id) {
      return handleRunAction('resume');
    }
    setActionBusy(true);
    try {
      await invoke('StepRun', 'complete', { step: activeStep.id, output: '{}' });
      await invoke('ProcessRun', 'resume', { run: runId });
      setRefreshKey(k => k + 1);
    } finally {
      setActionBusy(false);
    }
  }, [invoke, runId, stepRuns, handleRunAction]);

  // -------------------------------------------------------------------------
  // Data loading (unchanged from original)
  // -------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    Promise.all([
      invoke('ProcessRun', 'get', { run: runId }),
      invoke('StepRun', 'list', { run_ref: runId }),
    ]).then(async ([runResult, stepsResult]) => {
      if (cancelled) return;
      if (!runResult || (runResult as Record<string, unknown>).variant === 'not_found') {
        setNotFound(true);
        setRun(null);
      } else if ((runResult as Record<string, unknown>).variant === 'ok') {
        const r = runResult as RunRecord;
        setRun(r);
        if (r.spec_ref) {
          try {
            const [nodeResult, specStepsResult] = await Promise.all([
              invoke('ContentNode', 'get', { node: r.spec_ref }),
              invoke('ProcessSpec', 'getSteps', { spec: r.spec_ref }),
            ]);
            if (!cancelled && (nodeResult as Record<string, unknown>).variant === 'ok') {
              const content = (nodeResult as Record<string, unknown>).content as string | undefined;
              if (content) {
                const parsed = JSON.parse(content) as Record<string, unknown>;
                setSpecName((parsed.name as string) || null);
              }
            }
            if (!cancelled && (specStepsResult as Record<string, unknown>).variant === 'ok') {
              const rawSteps = (specStepsResult as Record<string, unknown>).steps;
              if (Array.isArray(rawSteps)) {
                const map: Record<string, string> = {};
                for (const s of rawSteps as Array<Record<string, unknown>>) {
                  if (s.stepId && s.stepLabel) map[s.stepId as string] = s.stepLabel as string;
                }
                setStepLabelMap(map);
              }
            }
          } catch { /* non-fatal */ }
        }
      }
      if (stepsResult && (stepsResult as Record<string, unknown>).variant === 'ok') {
        const sr = stepsResult as Record<string, unknown>;
        const raw = Array.isArray(sr.step_runs) ? (sr.step_runs as StepRunRecord[]) : [];
        const filtered = raw.filter(s => s.id !== '__registered');
        setStepRuns(filtered);
        // Auto-focus the active step on first load
        if (!focusedStepKey) {
          const activeStep = filtered.find(s => s.status === 'active');
          if (activeStep?.step_key) setFocusedStepKey(activeStep.step_key);
        }
      }
    }).catch(() => {
      if (!cancelled) setNotFound(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, invoke, refreshKey]);

  // Auto-refresh every 5s while running
  useEffect(() => {
    if (run?.status !== 'running') return;
    const t = setInterval(() => setRefreshKey(k => k + 1), 5000);
    return () => clearInterval(t);
  }, [run?.status]);

  // -------------------------------------------------------------------------
  // Step table columns (preserved from original)
  // -------------------------------------------------------------------------

  const stepColumns: ColumnDef[] = [
    {
      key: 'step_key',
      label: 'Step',
      render: (val) => {
        const key = String(val ?? '');
        const label = stepLabelMap[key] || key || '—';
        return (
          <span style={{ fontSize: 'var(--typography-code-sm-size)', fontWeight: focusedStepKey === key ? 700 : undefined }}>
            {label}
          </span>
        );
      },
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

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------

  const activeManualStep = stepRuns.find(s => s.status === 'active' && s.step_type === 'manual');
  const canCancel  = run?.status === 'running' || run?.status === 'suspended';
  const canAdvance = run?.status === 'suspended';
  const canResume  = run?.status === 'suspended' && !activeManualStep;
  const canComplete = run?.status === 'running';

  const focusedStepRun = focusedStepKey
    ? stepRuns.find(s => s.step_key === focusedStepKey) ?? null
    : null;
  const focusedStepLabel = focusedStepKey
    ? stepLabelMap[focusedStepKey] || prettifyKey(focusedStepKey)
    : '';

  // -------------------------------------------------------------------------
  // Loading / not found states (unchanged)
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Main render — two-panel layout
  // -------------------------------------------------------------------------

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* ------------------------------------------------------------------ */}
      {/* Page header — run identity + action buttons                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="page-header">
        <div>
          <h1 style={{ fontFamily: 'var(--typography-font-family-mono)', fontSize: '18px' }}>{runId}</h1>
          {run.spec_ref && (
            <p style={{ color: 'var(--palette-on-surface-variant)', marginTop: '2px', fontSize: 'var(--typography-body-sm-size)' }}>
              {specName ?? run.spec_ref}
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
          {canAdvance && !activeManualStep && (
            <button
              data-part="button"
              data-variant="filled"
              disabled={actionBusy}
              onClick={() => void handleAdvanceStep()}
              style={{ background: 'var(--palette-primary)', color: 'var(--palette-on-primary)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 16px', fontWeight: 600, cursor: actionBusy ? 'not-allowed' : 'pointer' }}
            >
              {actionBusy ? '…' : 'Advance'}
            </button>
          )}
          {canResume && (
            <button
              data-part="button"
              data-variant="secondary"
              disabled={actionBusy}
              onClick={() => void handleRunAction('resume')}
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

      {/* ------------------------------------------------------------------ */}
      {/* Details tab row — collapsed by default; expands on click           */}
      {/* ------------------------------------------------------------------ */}
      <div
        data-part="tabs"
        style={{
          borderBottom: '1px solid var(--palette-outline-variant, #e0e0e0)',
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          paddingLeft: '240px', // align with right panel
        }}
      >
        <span style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', padding: '0 12px', opacity: 0.6 }}>Details:</span>
        {(['overview', 'variables', 'steps'] as Array<'overview' | 'variables' | 'steps'>).map(tab => (
          <button
            key={tab}
            data-part="tab"
            data-active={detailsTab === tab ? 'true' : 'false'}
            onClick={() => setDetailsTab(prev => prev === tab ? 'none' : tab)}
            style={{ fontSize: '13px' }}
          >
            {tab === 'overview' ? 'Overview' :
             tab === 'variables' ? 'Variables' :
             <>Steps {stepRuns.length > 0 && <Badge variant="secondary" style={{ marginLeft: 4 }}>{stepRuns.length}</Badge>}</>}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Details panel (collapsible) — Overview, Variables, Steps table     */}
      {/* ------------------------------------------------------------------ */}
      {detailsTab !== 'none' && (
        <div style={{ padding: 'var(--spacing-md)', borderBottom: '1px solid var(--palette-outline-variant, #e0e0e0)', background: 'var(--palette-surface-variant, #f9f9f9)' }}>
          {/* Overview */}
          {detailsTab === 'overview' && (
            <Card variant="outlined">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                {[
                  { label: 'Run ID', value: <code style={{ fontSize: 'var(--typography-code-sm-size)' }}>{runId}</code> },
                  { label: 'Spec', value: run.spec_ref ? (
                    <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--palette-primary)', fontFamily: 'var(--typography-font-family-mono)', fontSize: 'var(--typography-code-sm-size)' }}
                      onClick={() => navigateToHref(`/admin/processes/${encodeURIComponent(run.spec_ref!)}`)}>
                      {specName ?? run.spec_ref}
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
          )}

          {/* Variables */}
          {detailsTab === 'variables' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
              <Card variant="outlined">
                <div style={{ marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>Input</div>
                <pre style={{ fontFamily: 'var(--typography-font-family-mono)', fontSize: '12px', background: 'var(--palette-surface-variant)', borderRadius: 'var(--radius-sm)', padding: 'var(--spacing-sm)', overflow: 'auto', maxHeight: '220px', color: 'var(--palette-on-surface)', margin: 0 }}>
                  {run.input ? (() => { try { return JSON.stringify(JSON.parse(run.input), null, 2); } catch { return run.input; } })() : 'No input recorded'}
                </pre>
              </Card>
              <Card variant="outlined">
                <div style={{ marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>Output</div>
                <pre style={{ fontFamily: 'var(--typography-font-family-mono)', fontSize: '12px', background: 'var(--palette-surface-variant)', borderRadius: 'var(--radius-sm)', padding: 'var(--spacing-sm)', overflow: 'auto', maxHeight: '220px', color: 'var(--palette-on-surface)', margin: 0 }}>
                  {run.output ? (() => { try { return JSON.stringify(JSON.parse(run.output), null, 2); } catch { return run.output; } })() : 'No output recorded'}
                </pre>
              </Card>
            </div>
          )}

          {/* Steps table */}
          {detailsTab === 'steps' && (
            stepRuns.length === 0 ? (
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
            )
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Two-panel body                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Left sidebar */}
        <StepSidebar
          stepRuns={stepRuns}
          focusedStepKey={focusedStepKey}
          stepLabelMap={stepLabelMap}
          onFocus={(key) => setFocusedStepKey(key)}
        />

        {/* Right panel */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--spacing-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-md)',
          }}
        >
          {stepRuns.length === 0 && (
            <Card variant="outlined">
              <EmptyState
                title={run.status === 'running' ? 'Process running' : 'No steps recorded'}
                description={
                  run.status === 'running'
                    ? 'No step runs recorded yet. The execution engine will populate steps as they execute.'
                    : 'Step execution records appear here as the process run progresses.'
                }
              />
            </Card>
          )}

          {/* Empty-selection prompt when steps exist but none is focused */}
          {stepRuns.length > 0 && !focusedStepRun && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--palette-on-surface-variant)',
                fontSize: 'var(--typography-body-sm-size)',
              }}
            >
              Select a step from the sidebar to view details.
            </div>
          )}

          {/* Step context card (top zone) */}
          {focusedStepRun && (
            <StepContextCard
              stepRun={focusedStepRun}
              stepLabel={focusedStepLabel}
            />
          )}

          {/* StepInteractionSlot (bottom zone) */}
          {focusedStepRun && (
            <StepInteractionSlot
              stepRun={focusedStepRun}
              processRunId={runId}
              stepLabel={focusedStepLabel}
              onAdvance={() => void handleAdvanceStep()}
              actionBusy={actionBusy}
              currentUserId={run?.principal ?? ''}
              isFacilitator={false}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcessRunView;
