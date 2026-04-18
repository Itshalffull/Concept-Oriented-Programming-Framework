'use client';

/**
 * VoteWidget — Participant-facing voting interaction for process run steps
 * where step_type === 'vote'.
 *
 * Implements the VoteWidget spec (surface/VoteWidget.widget).
 *
 * FSM states: idle → submitting → voted → closed → tallied
 *   CHANGE event: voted → idle
 *   VOTE_FAILED event: submitting → idle
 *   STEP_COMPLETED event: idle → tallied (used when initialStatus === 'completed' on mount)
 *
 * Anatomy parts (all carry data-part for test selectors):
 *   root, header, options, option (×3), submitButton, deadline,
 *   progress, receipt, changeLink, result
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FsmState = 'idle' | 'submitting' | 'voted' | 'closed' | 'tallied';
type VoteChoice = 'yes' | 'no' | 'abstain';

export interface VoteWidgetProps {
  voteSessionId: string;
  processRunId: string;
  stepRunId: string;
  currentUserId: string;
  deadline?: string | null;
  quorum: number;
  votingMethod: string;
  allowChange: boolean;
  anonymous: boolean;
  initialStatus: string;        // "active" | "completed"
  initialOutcome?: string | null;
  initialDetails?: string | null;
}

interface TallyData {
  outcome?: string | null;
  details?: string | null;
}

// ---------------------------------------------------------------------------
// Deadline formatting
// ---------------------------------------------------------------------------

function formatDeadlineRemaining(deadline: string): string {
  const now = Date.now();
  const end = new Date(deadline).getTime();
  const diffMs = end - now;
  if (diffMs <= 0) return 'Deadline passed';
  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return `Deadline: ${parts.join(' ')} remaining`;
}

// ---------------------------------------------------------------------------
// Option definitions (spec: Yes / No / Abstain radio buttons)
// ---------------------------------------------------------------------------

const VOTE_OPTIONS: Array<{ value: VoteChoice; label: string }> = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'abstain', label: 'Abstain' },
];

// ---------------------------------------------------------------------------
// VoteWidget
// ---------------------------------------------------------------------------

export function VoteWidget({
  voteSessionId,
  processRunId: _processRunId,
  stepRunId: _stepRunId,
  currentUserId,
  deadline,
  quorum,
  votingMethod,
  allowChange,
  anonymous: _anonymous,
  initialStatus,
  initialOutcome,
  initialDetails,
}: VoteWidgetProps): React.ReactElement {
  // FSM state — spec: idle is initial; skip to tallied when initialStatus === 'completed'
  const [fsmState, setFsmState] = useState<FsmState>(
    initialStatus === 'completed' ? 'tallied' : 'idle',
  );

  // Tally data shown in tallied state
  const [tallyData, setTallyData] = useState<TallyData>({
    outcome: initialOutcome,
    details: initialDetails,
  });

  // Selected radio choice
  const [selected, setSelected] = useState<VoteChoice | null>(null);

  // Error message shown on VOTE_FAILED
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Ref for the chosen vote so the async handler always sees the latest value
  const selectedRef = useRef<VoteChoice | null>(null);
  selectedRef.current = selected;

  // Deadline countdown string (re-computed on every render; a timer could
  // be added for live updates but is outside the widget spec scope)
  const deadlineText = deadline ? formatDeadlineRemaining(deadline) : null;

  // Load tally if we land directly in tallied state without outcome data
  useEffect(() => {
    if (initialStatus === 'completed' && !initialOutcome) {
      fetch('/api/invoke/Vote/tally', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: voteSessionId }),
      })
        .then((r) => r.json())
        .then((data: { outcome?: string; details?: string }) => {
          setTallyData({ outcome: data.outcome ?? null, details: data.details ?? null });
        })
        .catch(() => {
          // Non-fatal — leave tallyData as-is
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------
  // FSM event handlers
  // ------------------------------------------------------------------

  // SUBMIT — idle → submitting → voted | VOTE_FAILED → idle
  const handleSubmit = useCallback(async () => {
    if (fsmState !== 'idle') return;
    const choice = selectedRef.current;
    if (!choice) return;

    // entry [disableSubmitButton] — reflected by fsmState === 'submitting'
    setFsmState('submitting');
    setErrorMsg(null);

    try {
      const res = await fetch('/api/invoke/Vote/castVote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: voteSessionId,
          voter: currentUserId,
          choice,
          weight: 1.0,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      // VOTE_RECORDED → voted
      setFsmState('voted');
    } catch (err) {
      // VOTE_FAILED → idle  (exit [enableSubmitButton] — reflected by fsmState === 'idle')
      setFsmState('idle');
      setErrorMsg(
        err instanceof Error ? err.message : 'Vote failed. Please try again.',
      );
    }
  }, [fsmState, voteSessionId, currentUserId]);

  // CHANGE — voted → idle
  const handleChange = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
      if (fsmState !== 'voted') return;
      setFsmState('idle');
      setSelected(null);
      setErrorMsg(null);
    },
    [fsmState],
  );

  // Roving tabindex keyboard navigation between radio options
  const handleOptionKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, idx: number) => {
      if (fsmState !== 'idle') return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = (idx + 1) % VOTE_OPTIONS.length;
        setSelected(VOTE_OPTIONS[next].value);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = (idx - 1 + VOTE_OPTIONS.length) % VOTE_OPTIONS.length;
        setSelected(VOTE_OPTIONS[prev].value);
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setSelected(VOTE_OPTIONS[idx].value);
      }
    },
    [fsmState],
  );

  // ------------------------------------------------------------------
  // Visibility helpers (from spec connect block)
  // ------------------------------------------------------------------

  const optionsHidden = fsmState !== 'idle';
  const submitHidden =
    fsmState === 'voted' || fsmState === 'closed' || fsmState === 'tallied';
  const submitDisabled = fsmState !== 'idle';
  const receiptHidden = fsmState !== 'voted' && fsmState !== 'closed';
  const changeLinkHidden = !(allowChange && fsmState === 'voted');
  const resultHidden = fsmState !== 'tallied';

  // ------------------------------------------------------------------
  // Styles (tokens from spec + button style matching StepInteractionSlot)
  // ------------------------------------------------------------------

  const rootStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-sm)',
  };

  const headerStyle: React.CSSProperties = {
    margin: 0,
    fontWeight: 600,
    fontSize: '15px',
    color: 'var(--palette-on-surface-variant)',
  };

  const radioGroupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  };

  const radioOptionStyle = (isSelected: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    border: `1px solid ${isSelected ? 'var(--palette-primary)' : 'var(--palette-outline-variant, #e0e0e0)'}`,
    background: isSelected ? 'color-mix(in srgb, var(--palette-primary) 8%, transparent)' : 'transparent',
    cursor: fsmState === 'idle' ? 'pointer' : 'default',
    transition: 'border-color 0.15s, background 0.15s',
  });

  const radioCircleStyle = (isSelected: boolean): React.CSSProperties => ({
    width: 16,
    height: 16,
    borderRadius: '50%',
    border: `2px solid ${isSelected ? 'var(--palette-primary)' : 'var(--palette-outline-variant, #9e9e9e)'}`,
    background: isSelected ? 'var(--palette-primary)' : 'transparent',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color 0.15s, background 0.15s',
  });

  const radioInnerDotStyle: React.CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--palette-on-primary)',
  };

  const radioLabelStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--palette-on-surface-variant)',
    userSelect: 'none',
  };

  const submitButtonStyle: React.CSSProperties = {
    alignSelf: 'flex-start',
    background: submitDisabled ? undefined : 'var(--palette-primary)',
    color: submitDisabled ? undefined : 'var(--palette-on-primary)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 20px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: submitDisabled ? 'not-allowed' : !selected ? 'not-allowed' : 'pointer',
    opacity: submitDisabled || !selected ? 0.6 : 1,
  };

  const deadlineStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--palette-on-surface-variant)',
    margin: 0,
  };

  const progressStyle: React.CSSProperties = {
    padding: '6px 10px',
    background: 'var(--palette-surface-variant, #f5f5f5)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '12px',
    color: 'var(--palette-on-surface-variant)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  const receiptStyle: React.CSSProperties = {
    padding: '12px',
    border: '1px solid var(--palette-outline-variant, #e0e0e0)',
    borderRadius: 'var(--radius-sm)',
    background: 'color-mix(in srgb, var(--palette-primary) 5%, transparent)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  };

  const receiptTextStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '14px',
    color: 'var(--palette-on-surface-variant)',
  };

  const changeLinkStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: 0,
    color: 'var(--palette-primary)',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
    textDecoration: 'underline',
    alignSelf: 'flex-start',
  };

  const resultStyle: React.CSSProperties = {
    padding: '12px',
    border: '1px solid var(--palette-outline-variant, #e0e0e0)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--palette-surface-variant, #f5f5f5)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  };

  const resultHeadingStyle: React.CSSProperties = {
    margin: 0,
    fontWeight: 700,
    fontSize: '14px',
    color: 'var(--palette-on-surface-variant)',
  };

  const resultOutcomeStyle: React.CSSProperties = {
    margin: 0,
    fontWeight: 600,
    fontSize: '16px',
    color: 'var(--palette-primary)',
    textTransform: 'capitalize',
  };

  const resultDetailsStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '13px',
    color: 'var(--palette-on-surface-variant)',
  };

  const errorStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#c62828',
    margin: 0,
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div
      data-part="root"
      data-state={fsmState}
      data-session={voteSessionId}
      data-method={votingMethod}
      role="form"
      aria-label="Cast your vote"
      aria-busy={fsmState === 'submitting' ? 'true' : 'false'}
      style={rootStyle}
    >
      {/* header */}
      <p data-part="header" style={headerStyle}>
        Cast your vote
      </p>

      {/* deadline — hidden when no deadline prop */}
      {deadlineText && (
        <p
          data-part="deadline"
          data-deadline={deadline}
          style={deadlineStyle}
        >
          {deadlineText}
        </p>
      )}

      {/* progress — quorum indicator */}
      <div
        data-part="progress"
        data-quorum={quorum}
        style={progressStyle}
      >
        <span>Quorum: {quorum}%</span>
        <span style={{ fontWeight: 600 }}>{votingMethod}</span>
      </div>

      {/* options — hidden when not idle (spec: hidden if state !== idle) */}
      {!optionsHidden && (
        <div
          data-part="options"
          role="radiogroup"
          aria-label="Vote options"
          aria-disabled="false"
          style={radioGroupStyle}
        >
          {VOTE_OPTIONS.map((opt, idx) => {
            const isSelected = selected === opt.value;
            return (
              <div
                key={opt.value}
                data-part="option"
                role="radio"
                aria-checked={isSelected}
                aria-label={opt.label}
                tabIndex={isSelected || (selected === null && idx === 0) ? 0 : -1}
                style={radioOptionStyle(isSelected)}
                onClick={() => fsmState === 'idle' && setSelected(opt.value)}
                onKeyDown={(e) => handleOptionKeyDown(e, idx)}
              >
                <div style={radioCircleStyle(isSelected)}>
                  {isSelected && <div style={radioInnerDotStyle} />}
                </div>
                <span style={radioLabelStyle}>{opt.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* submitButton — hidden in voted/closed/tallied states */}
      {!submitHidden && (
        <button
          data-part="submit-button"
          type="button"
          disabled={submitDisabled || !selected}
          aria-disabled={submitDisabled ? 'true' : 'false'}
          aria-busy={fsmState === 'submitting' ? 'true' : 'false'}
          aria-label="Submit Vote"
          onClick={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
          style={submitButtonStyle}
        >
          {fsmState === 'submitting' ? 'Submitting…' : 'Submit Vote'}
        </button>
      )}

      {/* error message on VOTE_FAILED */}
      {errorMsg && (
        <p role="alert" style={errorStyle}>
          {errorMsg}
        </p>
      )}

      {/* receipt — shown in voted + closed states */}
      {!receiptHidden && (
        <div
          data-part="receipt"
          aria-live="polite"
          aria-atomic="true"
          style={receiptStyle}
        >
          <p style={receiptTextStyle}>
            Your vote has been recorded.
            {selected && (
              <>
                {' '}You voted: <strong>{selected}</strong>.
              </>
            )}
          </p>
          {fsmState === 'closed' && (
            <p style={receiptTextStyle}>
              The session is closed. Awaiting tally…
            </p>
          )}

          {/* changeLink — only when allowChange === true and state === voted */}
          {!changeLinkHidden && (
            <button
              data-part="change-link"
              type="button"
              tabIndex={0}
              style={changeLinkStyle}
              onClick={handleChange}
              onKeyDown={handleChange}
              aria-label="Change your vote"
            >
              Change
            </button>
          )}
        </div>
      )}

      {/* result — only in tallied state */}
      {!resultHidden && (
        <div
          data-part="result"
          aria-live="assertive"
          aria-atomic="true"
          data-outcome={tallyData.outcome}
          data-details={tallyData.details}
          style={resultStyle}
        >
          <p style={resultHeadingStyle}>Vote Outcome</p>
          {tallyData.outcome ? (
            <p style={resultOutcomeStyle}>{tallyData.outcome}</p>
          ) : (
            <p style={resultOutcomeStyle}>Pending</p>
          )}
          {tallyData.details && (
            <p style={resultDetailsStyle}>{tallyData.details}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default VoteWidget;
