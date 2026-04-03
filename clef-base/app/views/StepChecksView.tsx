'use client';

/**
 * StepChecksView — Check verification results for a process step.
 *
 * Displays all CheckVerification records attached to a given step_ref,
 * showing status (pending/passing/failing/waived/error), evaluation mode
 * (automated/human/llm/rollup), score, and evidence for each check.
 *
 * Actions: evaluate (automated), judge (human/LLM), waive, reset.
 * Used as the step-checks View, defaultDisplayMode: check-result-inline.
 */

import React, { useState, useCallback } from 'react';
import { Card } from '../components/widgets/Card';
import { Badge } from '../components/widgets/Badge';
import { DataTable, type ColumnDef } from '../components/widgets/DataTable';
import { EmptyState } from '../components/widgets/EmptyState';
import { useConceptQuery } from '../../lib/use-concept-query';
import { useKernelInvoke } from '../../lib/clef-provider';

// --- Status badge variant map ---
const STATUS_VARIANT: Record<string, 'success' | 'error' | 'warning' | 'info' | 'secondary'> = {
  passing: 'success',
  failing: 'error',
  waived: 'warning',
  pending: 'secondary',
  evaluating: 'info',
  error: 'error',
};

// --- Mode badge variant map ---
const MODE_VARIANT: Record<string, 'primary' | 'info' | 'secondary'> = {
  automated: 'primary',
  human: 'info',
  llm: 'info',
  rollup: 'secondary',
};

interface CheckRecord {
  cv: string;
  step_ref: string;
  check_ref: string;
  status: string;
  mode: string;
  result_score: number | null;
  result_evidence: string | null;
}

interface StepChecksViewProps {
  stepRef: string;
}

export const StepChecksView: React.FC<StepChecksViewProps> = ({ stepRef }) => {
  const invoke = useKernelInvoke();
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [judgeInput, setJudgeInput] = useState<{ cv: string; verdict: string; evidence: string } | null>(null);
  const [waiveInput, setWaiveInput] = useState<{ cv: string; justification: string } | null>(null);

  // Fetch all verifications for this step
  const { data: verifications, loading, refetch } = useConceptQuery<CheckRecord[]>(
    'CheckVerification', 'list', { step_ref: stepRef },
  );

  const checks: CheckRecord[] = verifications ?? [];

  // --- Actions ---

  const handleEvaluate = useCallback(async (cv: string) => {
    setActingOn(cv);
    try {
      await invoke('CheckVerification', 'evaluate', { cv });
      refetch();
    } finally {
      setActingOn(null);
    }
  }, [invoke, refetch]);

  const handleReset = useCallback(async (cv: string) => {
    setActingOn(cv);
    try {
      await invoke('CheckVerification', 'reset', { cv });
      refetch();
    } finally {
      setActingOn(null);
    }
  }, [invoke, refetch]);

  const handleJudge = useCallback(async () => {
    if (!judgeInput) return;
    setActingOn(judgeInput.cv);
    try {
      await invoke('CheckVerification', 'judge', {
        cv: judgeInput.cv,
        verdict: judgeInput.verdict,
        evidence: judgeInput.evidence,
      });
      setJudgeInput(null);
      refetch();
    } finally {
      setActingOn(null);
    }
  }, [invoke, judgeInput, refetch]);

  const handleWaive = useCallback(async () => {
    if (!waiveInput) return;
    setActingOn(waiveInput.cv);
    try {
      await invoke('CheckVerification', 'waive', {
        cv: waiveInput.cv,
        justification: waiveInput.justification,
      });
      setWaiveInput(null);
      refetch();
    } finally {
      setActingOn(null);
    }
  }, [invoke, waiveInput, refetch]);

  // --- Table columns ---

  const columns: ColumnDef[] = [
    {
      key: 'check_ref',
      label: 'Check',
      render: (val) => <code style={{ fontSize: '12px' }}>{String(val)}</code>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => (
        <Badge variant={STATUS_VARIANT[String(val)] ?? 'secondary'}>
          {String(val)}
        </Badge>
      ),
    },
    {
      key: 'mode',
      label: 'Mode',
      render: (val) => (
        <Badge variant={MODE_VARIANT[String(val)] ?? 'secondary'}>
          {String(val)}
        </Badge>
      ),
    },
    {
      key: 'result_score',
      label: 'Score',
      render: (val) => {
        if (val === null || val === undefined || val === '') {
          return <span style={{ opacity: 0.4 }}>—</span>;
        }
        const score = Number(val);
        const color = score >= 0.7
          ? 'var(--palette-success, #2e7d32)'
          : score >= 0.4
            ? 'var(--palette-warning, #e65100)'
            : 'var(--palette-error, #c62828)';
        return (
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color }}>
            {(score * 100).toFixed(0)}%
          </span>
        );
      },
    },
    {
      key: 'result_evidence',
      label: 'Evidence',
      render: (val) => {
        if (!val) return <span style={{ opacity: 0.4 }}>—</span>;
        const s = String(val);
        return (
          <span title={s} style={{ fontSize: '12px', color: 'var(--palette-on-surface-variant)' }}>
            {s.length > 72 ? s.slice(0, 72) + '…' : s}
          </span>
        );
      },
    },
    {
      key: 'cv',
      label: 'Actions',
      render: (val, row) => {
        const cv = String(val);
        const rowRecord = row as Record<string, unknown>;
        const status = String(rowRecord.status ?? '');
        const mode = String(rowRecord.mode ?? '');
        const busy = actingOn === cv;

        return (
          <span style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            {mode === 'automated' && (status === 'pending' || status === 'error') && (
              <button
                data-part="button"
                data-variant="outlined"
                style={{ fontSize: '11px', padding: '3px 8px' }}
                disabled={busy}
                onClick={() => handleEvaluate(cv)}
              >
                {busy ? '…' : 'Evaluate'}
              </button>
            )}
            {(mode === 'human' || mode === 'llm') && status !== 'waived' && (
              <button
                data-part="button"
                data-variant="outlined"
                style={{ fontSize: '11px', padding: '3px 8px' }}
                disabled={busy}
                onClick={() => setJudgeInput({ cv, verdict: 'pass', evidence: '' })}
              >
                Judge
              </button>
            )}
            {status !== 'waived' && status !== 'passing' && (
              <button
                data-part="button"
                data-variant="outlined"
                style={{ fontSize: '11px', padding: '3px 8px', color: 'var(--palette-on-surface-variant)' }}
                disabled={busy}
                onClick={() => setWaiveInput({ cv, justification: '' })}
              >
                Waive
              </button>
            )}
            {(status === 'passing' || status === 'failing' || status === 'waived') && (
              <button
                data-part="button"
                data-variant="text"
                style={{ fontSize: '11px', padding: '3px 8px', opacity: 0.6 }}
                disabled={busy}
                onClick={() => handleReset(cv)}
              >
                Reset
              </button>
            )}
          </span>
        );
      },
    },
  ];

  // Aggregate status for the header
  const passing = checks.filter(c => c.status === 'passing').length;
  const failing = checks.filter(c => c.status === 'failing').length;
  const pending = checks.filter(c => c.status === 'pending').length;
  const waived = checks.filter(c => c.status === 'waived').length;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h2 style={{ fontSize: 'var(--typography-title-lg-size)', margin: 0 }}>
          Step Checks
        </h2>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
          {checks.length > 0 && (
            <>
              <Badge variant="success">{passing} passing</Badge>
              {failing > 0 && <Badge variant="error">{failing} failing</Badge>}
              {pending > 0 && <Badge variant="secondary">{pending} pending</Badge>}
              {waived > 0 && <Badge variant="warning">{waived} waived</Badge>}
            </>
          )}
          <Badge variant="info">{checks.length} total</Badge>
        </div>
      </div>

      {stepRef && (
        <p style={{ fontSize: '12px', color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-md)' }}>
          Checks for step: <code>{stepRef}</code>
        </p>
      )}

      {/* Check table */}
      <Card variant="outlined" padding="none">
        {loading ? (
          <div style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-on-surface-variant)' }}>
            Loading checks…
          </div>
        ) : checks.length === 0 ? (
          <EmptyState
            title="No checks for this step"
            description="Check verifications are created when a process step has defined quality checks."
          />
        ) : (
          <DataTable
            columns={columns}
            data={checks as unknown as Record<string, unknown>[]}
            ariaLabel="Step check verifications"
          />
        )}
      </Card>

      {/* Judge dialog */}
      {judgeInput && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <Card variant="elevated" style={{ width: 420, maxWidth: '90vw' }}>
            <h3 style={{ margin: '0 0 var(--spacing-md)', fontSize: 'var(--typography-title-md-size)' }}>
              Judge Check: <code style={{ fontSize: '13px' }}>{judgeInput.cv}</code>
            </h3>

            <div style={{ marginBottom: 'var(--spacing-sm)' }}>
              <label style={{ fontSize: '12px', color: 'var(--palette-on-surface-variant)', display: 'block', marginBottom: 4 }}>
                Verdict
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['pass', 'fail'] as const).map(v => (
                  <button
                    key={v}
                    data-part="button"
                    data-variant={judgeInput.verdict === v ? 'filled' : 'outlined'}
                    onClick={() => setJudgeInput(prev => prev ? { ...prev, verdict: v } : null)}
                    style={{ flex: 1 }}
                  >
                    {v === 'pass' ? 'Pass' : 'Fail'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <label style={{ fontSize: '12px', color: 'var(--palette-on-surface-variant)', display: 'block', marginBottom: 4 }}>
                Evidence / Justification
              </label>
              <textarea
                style={{
                  width: '100%', minHeight: 80, padding: '8px 10px',
                  fontSize: '13px', border: '1px solid var(--palette-outline-variant)',
                  borderRadius: 'var(--radius-sm)', background: 'var(--palette-surface)',
                  color: 'var(--palette-on-surface)', resize: 'vertical', boxSizing: 'border-box',
                }}
                placeholder="Describe the basis for your judgment…"
                value={judgeInput.evidence}
                onChange={e => setJudgeInput(prev => prev ? { ...prev, evidence: e.target.value } : null)}
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
              <button data-part="button" data-variant="outlined" onClick={() => setJudgeInput(null)}>
                Cancel
              </button>
              <button
                data-part="button"
                data-variant="filled"
                disabled={actingOn !== null || !judgeInput.evidence.trim()}
                onClick={handleJudge}
              >
                {actingOn ? '…' : 'Submit Judgment'}
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Waive dialog */}
      {waiveInput && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <Card variant="elevated" style={{ width: 420, maxWidth: '90vw' }}>
            <h3 style={{ margin: '0 0 var(--spacing-md)', fontSize: 'var(--typography-title-md-size)' }}>
              Waive Check: <code style={{ fontSize: '13px' }}>{waiveInput.cv}</code>
            </h3>

            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <label style={{ fontSize: '12px', color: 'var(--palette-on-surface-variant)', display: 'block', marginBottom: 4 }}>
                Justification
              </label>
              <textarea
                style={{
                  width: '100%', minHeight: 80, padding: '8px 10px',
                  fontSize: '13px', border: '1px solid var(--palette-outline-variant)',
                  borderRadius: 'var(--radius-sm)', background: 'var(--palette-surface)',
                  color: 'var(--palette-on-surface)', resize: 'vertical', boxSizing: 'border-box',
                }}
                placeholder="Why is this check being waived? (e.g. Not applicable to this process run)"
                value={waiveInput.justification}
                onChange={e => setWaiveInput(prev => prev ? { ...prev, justification: e.target.value } : null)}
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
              <button data-part="button" data-variant="outlined" onClick={() => setWaiveInput(null)}>
                Cancel
              </button>
              <button
                data-part="button"
                data-variant="filled"
                disabled={actingOn !== null || !waiveInput.justification.trim()}
                onClick={handleWaive}
              >
                {actingOn ? '…' : 'Waive Check'}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default StepChecksView;
