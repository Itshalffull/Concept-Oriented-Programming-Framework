'use client';

/**
 * PolicyCompliancePanel — React component implementing the policy-compliance-panel.widget spec.
 *
 * Widget spec: repertoire/concepts/governance-policy/widgets/policy-compliance-panel.widget
 * Card: MAG-985
 *
 * Shows policy pass/fail status for an action/subject combination. Calls Policy/evaluate
 * on mount (when autoEvaluate is true) and renders per-clause deontic pass/fail rows plus
 * an overall enforcement outcome badge (Allowed / Warn / Blocked).
 *
 * FSM states (matching the widget spec):
 *   idle      — initial, no evaluation started
 *   checking  — awaiting Policy/evaluate result
 *   allowed   — all clauses pass, outcome = allowed
 *   warned    — non-blocking violation, outcome = warn
 *   blocked   — hard-stop violation, outcome = block
 *   empty     — no policies apply to this action context
 *
 * Degrades gracefully: any unexpected response shape or kernel error is treated as empty.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PolicyClause {
  clauseId: string;
  deontic: 'May' | 'Must' | 'MustNot';
  aim: string;
  satisfied: boolean;
}

export interface EvaluationResult {
  outcome: 'allowed' | 'warned' | 'blocked';
  clauses: PolicyClause[];
}

export type ComplianceState = 'idle' | 'checking' | 'allowed' | 'warned' | 'blocked' | 'empty';

export interface PolicyCompliancePanelProps {
  /** The action being evaluated (e.g. "publish", "delete", "approve") */
  actionContext: string;
  /** The subject (user/entity) performing the action */
  subjectId: string;
  /** Optional resource the action targets */
  resourceId?: string;
  /** When true, triggers Policy/evaluate on mount. Defaults to true. */
  autoEvaluate?: boolean;
}

// ---------------------------------------------------------------------------
// Helper — parse kernel response into EvaluationResult
// ---------------------------------------------------------------------------

function parseEvaluationResult(raw: Record<string, unknown>): EvaluationResult | null {
  try {
    // Support both nested { evaluationResult: { outcome, clauses } } and flat { outcome, clauses }
    const payload =
      raw.evaluationResult != null
        ? (raw.evaluationResult as Record<string, unknown>)
        : raw;

    const outcome = payload.outcome as string | undefined;
    if (outcome !== 'allowed' && outcome !== 'warned' && outcome !== 'blocked') return null;

    const rawClauses = Array.isArray(payload.clauses) ? payload.clauses : [];
    const clauses: PolicyClause[] = rawClauses.map((c: unknown) => {
      const clause = c as Record<string, unknown>;
      return {
        clauseId: String(clause.clauseId ?? clause.id ?? ''),
        deontic: (['May', 'Must', 'MustNot'].includes(String(clause.deontic))
          ? clause.deontic
          : 'Must') as PolicyClause['deontic'],
        aim: String(clause.aim ?? ''),
        satisfied: Boolean(clause.satisfied),
      };
    });

    return { outcome, clauses };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PolicyCompliancePanel: React.FC<PolicyCompliancePanelProps> = ({
  actionContext,
  subjectId,
  resourceId,
  autoEvaluate = true,
}) => {
  const invoke = useKernelInvoke();

  const [fsmState, setFsmState] = useState<ComplianceState>('idle');
  const [clauses, setClauses] = useState<PolicyClause[]>([]);

  // Maps FSM state → outcome data-attribute value
  const outcomeAttr =
    fsmState === 'allowed' ? 'allow'
    : fsmState === 'warned' ? 'warn'
    : fsmState === 'blocked' ? 'block'
    : 'none';

  // Maps FSM state → outcome badge text
  const outcomeBadgeText =
    fsmState === 'allowed' ? 'Allowed'
    : fsmState === 'warned' ? 'Warn'
    : fsmState === 'blocked' ? 'Blocked'
    : fsmState === 'checking' ? 'Checking...'
    : '';

  const runEvaluation = useCallback(async () => {
    setFsmState('checking');
    try {
      const input: Record<string, unknown> = { actionContext, subjectId };
      if (resourceId != null) input.resourceId = resourceId;

      const result = await invoke('Policy', 'evaluate', input);

      if (!result || result.variant !== 'ok') {
        setFsmState('empty');
        return;
      }

      const parsed = parseEvaluationResult(result);
      if (!parsed) {
        setFsmState('empty');
        return;
      }

      if (parsed.clauses.length === 0) {
        setFsmState('empty');
        return;
      }

      setClauses(parsed.clauses);
      if (parsed.outcome === 'allowed') setFsmState('allowed');
      else if (parsed.outcome === 'warned') setFsmState('warned');
      else if (parsed.outcome === 'blocked') setFsmState('blocked');
      else setFsmState('empty');
    } catch (err) {
      console.warn('[PolicyCompliancePanel] Policy/evaluate error — treating as empty:', err);
      setFsmState('empty');
    }
  }, [invoke, actionContext, subjectId, resourceId]);

  // Auto-evaluate on mount when actionContext + subjectId are both provided
  useEffect(() => {
    if (!autoEvaluate) return;
    if (!actionContext || !subjectId) return;
    runEvaluation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRecheck = () => {
    setClauses([]);
    setFsmState('idle');
    // Trigger on next tick so state is idle before evaluation starts
    setTimeout(() => runEvaluation(), 0);
  };

  const clauseListHidden = fsmState === 'idle' || fsmState === 'checking' || fsmState === 'empty';

  return (
    <div
      data-part="root"
      data-state={fsmState}
      data-outcome={outcomeAttr}
      role="region"
      aria-label="Policy compliance check"
    >
      {/* Header row */}
      <div data-part="header">
        <span style={{ fontWeight: 600 }}>Policy Check</span>
        <span
          data-part="outcome-badge"
          data-outcome={outcomeAttr}
          role="status"
          aria-live="polite"
          aria-label={
            fsmState === 'allowed' ? 'Outcome: Allowed'
            : fsmState === 'warned' ? 'Outcome: Warning'
            : fsmState === 'blocked' ? 'Outcome: Blocked'
            : 'Outcome: Pending'
          }
        >
          {outcomeBadgeText}
        </span>
      </div>

      {/* Clause list — hidden during idle/checking/empty */}
      <div
        data-part="clause-list"
        role="tree"
        aria-label="Policy clauses"
        hidden={clauseListHidden}
      >
        {!clauseListHidden &&
          clauses.map((clause) => (
            <div
              key={clause.clauseId}
              data-part="clause-row"
              data-deontic={clause.deontic}
              data-satisfied={clause.satisfied ? 'true' : 'false'}
              role="treeitem"
              aria-label={`${clause.deontic} - ${clause.aim}: ${clause.satisfied ? 'satisfied' : 'violated'}`}
            >
              <span data-part="deontic-chip" data-deontic={clause.deontic}>
                {clause.deontic}
              </span>
              <span data-part="clause-aim">{clause.aim}</span>
              {clause.satisfied && (
                <span data-part="pass-indicator" aria-hidden="true">
                  ✓
                </span>
              )}
              {!clause.satisfied && (
                <span data-part="fail-indicator" aria-hidden="true">
                  ✗
                </span>
              )}
            </div>
          ))}
      </div>

      {/* Warn banner — shown only in warned state */}
      <div
        data-part="warn-banner"
        role="alert"
        aria-live="polite"
        aria-label="Warning: non-blocking policy violation detected"
        hidden={fsmState !== 'warned'}
      >
        One or more policy clauses are violated. This action is permitted but flagged.
      </div>

      {/* Block banner — shown only in blocked state */}
      <div
        data-part="block-banner"
        role="alert"
        aria-live="assertive"
        aria-label="Blocked: policy hard stop — action cannot proceed"
        hidden={fsmState !== 'blocked'}
      >
        This action is blocked by policy. A required clause is violated.
      </div>

      {/* Empty state — shown only in empty state */}
      <div
        data-part="empty-state"
        role="status"
        aria-live="polite"
        aria-label="No policies apply to this action context"
        hidden={fsmState !== 'empty'}
      >
        No policies apply to this action context.
      </div>

      {/* Re-check button — available in all non-checking states */}
      {fsmState !== 'checking' && (
        <button
          data-part="recheck-button"
          onClick={handleRecheck}
          disabled={!actionContext || !subjectId}
          aria-label="Re-evaluate policy compliance"
        >
          Re-check
        </button>
      )}
    </div>
  );
};

export default PolicyCompliancePanel;
