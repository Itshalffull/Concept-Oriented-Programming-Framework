'use client';

/**
 * ContestWidget — Participant-facing proposal contest surface rendered in the
 * bottom zone of a Process Street participant view when step_type === "contest".
 *
 * Implements the ContestWidget spec (surface/ContestWidget.widget).
 *
 * FSM (primary phase machine):
 *   open [initial] → reviewing → decided → completed
 *   Any non-terminal phase → busy → back to that phase
 *
 *   Events:
 *     SUBMISSION_CLOSED  : open → reviewing
 *     PROPOSAL_SPONSORED : open → reviewing
 *     PROPOSAL_ADVANCED  : reviewing → decided
 *     STEP_COMPLETED     : decided → completed
 *     API_START          : open|reviewing|decided → busy
 *     API_DONE_OPEN      : busy → open
 *     API_DONE_REVIEWING : busy → reviewing
 *     API_DONE_DECIDED   : busy → decided
 *     API_DONE_COMPLETED : busy → completed
 *
 * Concept bindings (Proposal concept):
 *   Proposal/create(proposer, title, description, actions)        → submit a proposal
 *   Proposal/sponsor(proposal, sponsorId)                         → sponsor a proposal
 *   Proposal/activate(proposal)                                   → move to Active
 *   Proposal/advance(proposal, newStatus)                         → advance status
 *   Proposal/detectConflicts(proposal)                            → detect conflicts
 *
 * Anatomy parts (data-part attributes):
 *   root, header, header-title, prompt, proposal-form, title-input,
 *   description-input, submit-button, proposal-list, proposal-item,
 *   status-badge, proposer-label, sponsor-button, activate-button,
 *   advance-button, conflict-warning, result, busy-overlay
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Primary FSM phase — mirrors widget spec states.phase block */
type PhaseState = 'open' | 'reviewing' | 'decided' | 'completed' | 'busy';

/** Tracks which phase to return to after a busy API call completes */
type PhaseBeforeBusy = Exclude<PhaseState, 'busy'>;

export interface ContestWidgetProps {
  stepRunId: string;
  processRunId: string;
  currentUserId: string;
  isFacilitator: boolean;
  preseededProposalIds?: string[];
  /** Motion or question text shown above the form */
  prompt?: string;
  /** Starting phase — "open" | "reviewing" | "decided" | "completed" */
  initialStatus?: string;
}

interface ProposalRow {
  id: string;
  title: string;
  description: string;
  proposer: string;       // proposer user ID
  proposerName: string;   // display name (falls back to truncated ID)
  status: string;         // Draft | Pending | Sponsored | Active | Passed | Failed | …
  conflicts: string[];    // IDs of conflicting proposals detected for this row
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a raw initialStatus string to the FSM PhaseState. */
function resolveInitialPhase(initialStatus: string | undefined): PhaseState {
  switch (initialStatus) {
    case 'reviewing': return 'reviewing';
    case 'decided':   return 'decided';
    case 'completed': return 'completed';
    default:          return 'open';
  }
}

/** Human-readable label for each phase. */
function headerTitleForPhase(phase: PhaseState): string {
  if (phase === 'completed') return 'Contest Closed';
  if (phase === 'decided' || phase === 'reviewing') return 'Proposals Under Review';
  return 'Submit a Proposal';
}

/** Status badge colours via CSS custom properties */
function badgeStyle(status: string): React.CSSProperties {
  const normalised = status.toLowerCase();
  let bg = 'var(--palette-surface-variant, #e0e0e0)';
  let color = 'var(--palette-on-surface-variant)';
  if (normalised === 'passed') {
    bg = 'color-mix(in srgb, #4caf50 20%, transparent)';
    color = '#2e7d32';
  } else if (normalised === 'failed' || normalised === 'cancelled') {
    bg = 'color-mix(in srgb, #f44336 20%, transparent)';
    color = '#c62828';
  } else if (normalised === 'active') {
    bg = 'color-mix(in srgb, var(--palette-primary) 15%, transparent)';
    color = 'var(--palette-primary)';
  } else if (normalised === 'sponsored') {
    bg = 'color-mix(in srgb, #ff9800 15%, transparent)';
    color = '#e65100';
  }
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 600,
    background: bg,
    color,
    textTransform: 'capitalize',
    letterSpacing: '0.02em',
  };
}

// ---------------------------------------------------------------------------
// ContestWidget
// ---------------------------------------------------------------------------

export function ContestWidget({
  stepRunId,
  processRunId: _processRunId,
  currentUserId,
  isFacilitator,
  preseededProposalIds,
  prompt = '',
  initialStatus,
}: ContestWidgetProps): React.ReactElement {
  // -- FSM state --
  const [phase, setPhase] = useState<PhaseState>(resolveInitialPhase(initialStatus));
  // Remember which phase we were in before entering busy, so we can return.
  const phaseBeforeBusyRef = useRef<PhaseBeforeBusy>('open');

  // -- Form state --
  const [titleValue, setTitleValue] = useState('');
  const [descriptionValue, setDescriptionValue] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // -- Proposal list --
  const [proposals, setProposals] = useState<ProposalRow[]>([]);

  // -- Error displayed at root level --
  const [globalError, setGlobalError] = useState<string | null>(null);

  // -- Result (winning/passed proposal) --
  const [resultProposal, setResultProposal] = useState<ProposalRow | null>(null);

  // ---------------------------------------------------------------------------
  // Busy-overlay helpers
  // ---------------------------------------------------------------------------

  function enterBusy(currentPhase: PhaseBeforeBusy) {
    phaseBeforeBusyRef.current = currentPhase;
    setPhase('busy');
  }

  function exitBusy(nextPhase?: PhaseBeforeBusy) {
    const returnTo = nextPhase ?? phaseBeforeBusyRef.current;
    setPhase(returnTo);
  }

  // ---------------------------------------------------------------------------
  // On mount: load pre-seeded proposals
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!preseededProposalIds || preseededProposalIds.length === 0) return;

    // Fetch details for each pre-seeded proposal by listing from the step run.
    // We call a lightweight list endpoint; fall back to stubbing rows with IDs only.
    fetch('/api/invoke/Proposal/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepRunId }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { proposals?: ProposalRow[] }) => {
        if (Array.isArray(data.proposals) && data.proposals.length > 0) {
          setProposals(data.proposals);
        } else {
          // Build stub rows for seeded IDs until full data arrives
          const stubs: ProposalRow[] = preseededProposalIds.map((id) => ({
            id,
            title: id,
            description: '',
            proposer: '',
            proposerName: `Proposal ${id.slice(0, 6)}`,
            status: 'Pending',
            conflicts: [],
          }));
          setProposals(stubs);
        }
      })
      .catch(() => {
        // Non-fatal: render empty list; user can still submit new proposals
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Action: Proposal/create  (submitButton)
  // ---------------------------------------------------------------------------

  const handleSubmitProposal = useCallback(async () => {
    if (phase !== 'open') return;
    const title = titleValue.trim();
    const description = descriptionValue.trim();
    if (!title) {
      setFormError('Proposal title is required.');
      return;
    }
    if (!description) {
      setFormError('Proposal description is required.');
      return;
    }
    setFormError(null);

    enterBusy('open');
    setGlobalError(null);

    try {
      const res = await fetch('/api/invoke/Proposal/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposer: currentUserId,
          title,
          description,
          actions: [`stepRun:${stepRunId}`],
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as {
        variant: string;
        proposal?: string;
        reason?: string;
      };

      if (data.variant === 'ok' && data.proposal) {
        const newRow: ProposalRow = {
          id: data.proposal,
          title,
          description,
          proposer: currentUserId,
          proposerName: `User ${currentUserId.slice(0, 6)}`,
          status: 'Pending',
          conflicts: [],
        };
        setProposals((prev) => [...prev, newRow]);
        setTitleValue('');
        setDescriptionValue('');
        // stay in open phase (spec: submitButton.ensures ok → state = "open")
        exitBusy('open');
      } else {
        setGlobalError(data.reason ?? 'Proposal submission failed.');
        exitBusy('open');
      }
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
      exitBusy('open');
    }
  }, [phase, titleValue, descriptionValue, currentUserId, stepRunId]);

  // ---------------------------------------------------------------------------
  // Action: Proposal/sponsor  (sponsorButton)
  // ---------------------------------------------------------------------------

  const handleSponsor = useCallback(
    async (proposalId: string) => {
      const currentPhase = phase as PhaseBeforeBusy;
      if (phase === 'busy' || phase === 'completed') return;
      enterBusy(currentPhase);
      setGlobalError(null);

      try {
        const res = await fetch('/api/invoke/Proposal/sponsor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposal: proposalId, sponsorId: currentUserId }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as { variant: string };

        // Update local status
        setProposals((prev) =>
          prev.map((p) =>
            p.id === proposalId ? { ...p, status: 'Sponsored' } : p,
          ),
        );

        // PROPOSAL_SPONSORED: open → reviewing
        if (data.variant === 'ok') {
          exitBusy('reviewing');
        } else {
          exitBusy(currentPhase);
        }
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : 'Sponsor action failed.');
        exitBusy(currentPhase);
      }
    },
    [phase, currentUserId],
  );

  // ---------------------------------------------------------------------------
  // Action: Proposal/activate  (activateButton — facilitator only)
  // ---------------------------------------------------------------------------

  const handleActivate = useCallback(
    async (proposalId: string) => {
      if (!isFacilitator) return;
      const currentPhase = phase as PhaseBeforeBusy;
      if (phase === 'busy' || phase === 'completed') return;
      enterBusy(currentPhase);
      setGlobalError(null);

      try {
        const res = await fetch('/api/invoke/Proposal/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposal: proposalId }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        setProposals((prev) =>
          prev.map((p) =>
            p.id === proposalId ? { ...p, status: 'Active' } : p,
          ),
        );
        exitBusy(currentPhase);
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : 'Activate action failed.');
        exitBusy(currentPhase);
      }
    },
    [isFacilitator, phase],
  );

  // ---------------------------------------------------------------------------
  // Action: Proposal/detectConflicts  (called before advance)
  // ---------------------------------------------------------------------------

  const detectConflicts = useCallback(
    async (proposalId: string): Promise<string[]> => {
      try {
        const res = await fetch('/api/invoke/Proposal/detectConflicts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposal: proposalId }),
        });
        if (!res.ok) return [];
        const data = (await res.json()) as { variant: string; conflicts?: string };
        if (data.variant === 'ok' && data.conflicts) {
          try {
            return JSON.parse(data.conflicts) as string[];
          } catch {
            return [];
          }
        }
        return [];
      } catch {
        return [];
      }
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Action: Proposal/advance  (advanceButton — facilitator only)
  // ---------------------------------------------------------------------------

  const handleAdvance = useCallback(
    async (proposalId: string) => {
      if (!isFacilitator) return;
      const currentPhase = phase as PhaseBeforeBusy;
      if (phase === 'busy' || phase === 'completed') return;
      enterBusy(currentPhase);
      setGlobalError(null);

      // Detect conflicts before advancing (spec: conflictWarning shown when conflicts detected)
      const conflicts = await detectConflicts(proposalId);

      if (conflicts.length > 0) {
        // Surface the conflict on the row and stay in current phase
        setProposals((prev) =>
          prev.map((p) =>
            p.id === proposalId ? { ...p, conflicts } : p,
          ),
        );
        exitBusy(currentPhase);
        return;
      }

      // No conflicts — advance to Passed
      try {
        const res = await fetch('/api/invoke/Proposal/advance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposal: proposalId, newStatus: 'Passed' }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as {
          variant: string;
          proposal?: string;
          status?: string;
        };

        if (data.variant === 'ok') {
          setProposals((prev) =>
            prev.map((p) =>
              p.id === proposalId ? { ...p, status: data.status ?? 'Passed', conflicts: [] } : p,
            ),
          );

          // Find the passed proposal for the result panel
          setProposals((prev) => {
            const passed = prev.find((p) => p.id === proposalId);
            if (passed) setResultProposal({ ...passed, status: data.status ?? 'Passed' });
            return prev;
          });

          // PROPOSAL_ADVANCED: reviewing → decided
          exitBusy('decided');
        } else {
          exitBusy(currentPhase);
        }
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : 'Advance action failed.');
        exitBusy(currentPhase);
      }
    },
    [isFacilitator, phase, detectConflicts],
  );

  // ---------------------------------------------------------------------------
  // Derived visibility (from widget spec connect block)
  // ---------------------------------------------------------------------------

  const isBusy       = phase === 'busy';
  const isCompleted  = phase === 'completed';
  const formHidden   = isCompleted;                 // spec: proposalForm hidden in completed
  const resultHidden = !isCompleted;               // spec: result hidden outside completed
  const overlayHidden = !isBusy;                   // spec: busyOverlay hidden unless busy

  // Effective phase for data-state on root (spec: data-state reflects FSM phase)
  const dataState = phase;

  // ---------------------------------------------------------------------------
  // Styles (CSS custom properties; no external UI library)
  // ---------------------------------------------------------------------------

  const rootStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-sm, 12px)',
    position: 'relative',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  const headerTitleStyle: React.CSSProperties = {
    margin: 0,
    fontWeight: 700,
    fontSize: '15px',
    color: 'var(--palette-on-surface-variant)',
  };

  const promptStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '13px',
    color: 'var(--palette-on-surface-variant)',
    opacity: 0.8,
    fontStyle: 'italic',
  };

  const formStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px',
    border: '1px solid var(--palette-outline-variant, #e0e0e0)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--palette-surface, #fff)',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    fontSize: '14px',
    border: '1px solid var(--palette-outline-variant, #ccc)',
    borderRadius: 'var(--radius-xs, 4px)',
    background: 'var(--palette-surface)',
    color: 'var(--palette-on-surface)',
    boxSizing: 'border-box',
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: '72px',
    resize: 'vertical',
    fontFamily: 'inherit',
  };

  const submitButtonStyle: React.CSSProperties = {
    alignSelf: 'flex-start',
    padding: '8px 20px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: isBusy ? 'var(--palette-surface-variant, #e0e0e0)' : 'var(--palette-primary)',
    color: isBusy ? 'var(--palette-on-surface-variant)' : 'var(--palette-on-primary)',
    fontWeight: 600,
    fontSize: '14px',
    cursor: isBusy ? 'not-allowed' : 'pointer',
    opacity: isBusy ? 0.6 : 1,
    transition: 'opacity 0.15s',
  };

  const formErrorStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#c62828',
    margin: 0,
  };

  const listStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  };

  const proposalItemStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '10px 12px',
    border: '1px solid var(--palette-outline-variant, #e0e0e0)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--palette-surface, #fff)',
  };

  const proposalItemHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  };

  const proposalTitleStyle: React.CSSProperties = {
    margin: 0,
    fontWeight: 600,
    fontSize: '14px',
    color: 'var(--palette-on-surface-variant)',
    flex: 1,
  };

  const proposerLabelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--palette-on-surface-variant)',
    opacity: 0.65,
  };

  const descriptionStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '13px',
    color: 'var(--palette-on-surface-variant)',
    opacity: 0.8,
  };

  const actionRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    marginTop: '4px',
  };

  function actionButtonStyle(hidden: boolean, variant: 'primary' | 'secondary' = 'secondary'): React.CSSProperties {
    return {
      display: hidden ? 'none' : 'inline-flex',
      alignItems: 'center',
      padding: '4px 12px',
      border: variant === 'primary' ? 'none' : '1px solid var(--palette-outline-variant, #ccc)',
      borderRadius: 'var(--radius-xs, 4px)',
      background: variant === 'primary' ? 'var(--palette-primary)' : 'transparent',
      color: variant === 'primary' ? 'var(--palette-on-primary)' : 'var(--palette-on-surface-variant)',
      fontSize: '12px',
      fontWeight: 600,
      cursor: isBusy ? 'not-allowed' : 'pointer',
      opacity: isBusy ? 0.5 : 1,
    };
  }

  const conflictWarningStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: 'var(--radius-xs, 4px)',
    background: 'color-mix(in srgb, #ff9800 15%, transparent)',
    border: '1px solid #ff9800',
    fontSize: '12px',
    color: '#e65100',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  };

  const globalErrorStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: 'var(--radius-xs, 4px)',
    background: 'color-mix(in srgb, #f44336 10%, transparent)',
    border: '1px solid #f44336',
    fontSize: '12px',
    color: '#c62828',
  };

  const resultPanelStyle: React.CSSProperties = {
    padding: '12px',
    border: '1px solid var(--palette-outline-variant, #e0e0e0)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--palette-surface-variant, #f5f5f5)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  const resultHeadingStyle: React.CSSProperties = {
    margin: 0,
    fontWeight: 700,
    fontSize: '14px',
    color: 'var(--palette-on-surface-variant)',
  };

  const resultTitleStyle: React.CSSProperties = {
    margin: 0,
    fontWeight: 600,
    fontSize: '15px',
    color: 'var(--palette-primary)',
  };

  const resultDescStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '13px',
    color: 'var(--palette-on-surface-variant)',
    opacity: 0.8,
  };

  const busyOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'rgba(255,255,255,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
    zIndex: 10,
    pointerEvents: 'all',
  };

  const spinnerStyle: React.CSSProperties = {
    width: 24,
    height: 24,
    border: '3px solid var(--palette-outline-variant, #e0e0e0)',
    borderTopColor: 'var(--palette-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      data-part="root"
      data-state={dataState}
      role="region"
      aria-label="Proposal contest"
      aria-busy={isBusy ? 'true' : 'false'}
      style={rootStyle}
    >
      {/* header */}
      <div data-part="header" style={headerStyle}>
        <p data-part="header-title" style={headerTitleStyle}>
          {headerTitleForPhase(phase)}
        </p>
        {prompt && (
          <p data-part="prompt" style={promptStyle}>
            {prompt}
          </p>
        )}
      </div>

      {/* global error */}
      {globalError && (
        <p role="alert" style={globalErrorStyle}>
          {globalError}
        </p>
      )}

      {/* proposal-form — hidden in completed phase */}
      {!formHidden && (
        <div
          data-part="proposal-form"
          data-state={phase === 'open' ? 'visible' : 'hidden'}
          role="form"
          aria-label="Submit a proposal"
          style={formStyle}
        >
          <input
            data-part="title-input"
            type="text"
            placeholder="Proposal title"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            disabled={isBusy}
            aria-label="Proposal title"
            aria-required="true"
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isBusy) void handleSubmitProposal();
            }}
          />
          <textarea
            data-part="description-input"
            placeholder="Describe your proposal…"
            value={descriptionValue}
            onChange={(e) => setDescriptionValue(e.target.value)}
            disabled={isBusy}
            aria-label="Proposal description"
            aria-multiline="true"
            aria-required="true"
            style={textareaStyle}
          />
          {formError && (
            <p role="alert" style={formErrorStyle}>
              {formError}
            </p>
          )}
          <button
            data-part="submit-button"
            type="button"
            disabled={isBusy}
            aria-disabled={isBusy ? 'true' : 'false'}
            aria-label="Submit proposal"
            onClick={() => void handleSubmitProposal()}
            style={submitButtonStyle}
          >
            {isBusy ? 'Submitting…' : 'Submit Proposal'}
          </button>
        </div>
      )}

      {/* proposal-list */}
      <ul
        data-part="proposal-list"
        role="list"
        aria-label="Submitted proposals"
        aria-live="polite"
        style={listStyle}
      >
        {proposals.map((proposal) => {
          const isOwnProposal = proposal.proposer === currentUserId;
          const hasConflicts = proposal.conflicts.length > 0;

          return (
            <li
              key={proposal.id}
              data-part="proposal-item"
              data-proposal-id={proposal.id}
              data-status={proposal.status}
              role="listitem"
              style={proposalItemStyle}
            >
              {/* row header: title + status badge + proposer */}
              <div style={proposalItemHeaderStyle}>
                <p data-part="proposal-title" style={proposalTitleStyle}>
                  {proposal.title}
                </p>
                <span
                  data-part="status-badge"
                  data-status={proposal.status}
                  aria-label={`Status: ${proposal.status}`}
                  aria-live="polite"
                  style={badgeStyle(proposal.status)}
                >
                  {proposal.status}
                </span>
              </div>

              {/* proposer label */}
              <span data-part="proposer-label" style={proposerLabelStyle}>
                {proposal.proposerName || `User ${proposal.proposer.slice(0, 6)}`}
              </span>

              {/* description */}
              {proposal.description && (
                <p data-part="proposal-description" style={descriptionStyle}>
                  {proposal.description}
                </p>
              )}

              {/* conflict warning — shown per row when conflicts detected */}
              <div
                data-part="conflict-warning"
                role="alert"
                aria-live="assertive"
                aria-label="Conflict detected"
                style={{
                  ...conflictWarningStyle,
                  display: hasConflicts ? 'flex' : 'none',
                }}
              >
                Conflicts detected with: {proposal.conflicts.join(', ')}
              </div>

              {/* action buttons row */}
              <div style={actionRowStyle}>
                {/* sponsorButton — hidden for own proposals */}
                <button
                  data-part="sponsor-button"
                  type="button"
                  disabled={isBusy}
                  aria-disabled={isBusy ? 'true' : 'false'}
                  aria-label="Sponsor this proposal"
                  onClick={() => void handleSponsor(proposal.id)}
                  style={actionButtonStyle(isOwnProposal)}
                >
                  Sponsor
                </button>

                {/* activateButton — facilitator only */}
                <button
                  data-part="activate-button"
                  type="button"
                  disabled={isBusy}
                  aria-disabled={isBusy ? 'true' : 'false'}
                  aria-label="Activate proposal"
                  onClick={() => void handleActivate(proposal.id)}
                  style={actionButtonStyle(!isFacilitator, 'secondary')}
                >
                  Activate
                </button>

                {/* advanceButton — facilitator only */}
                <button
                  data-part="advance-button"
                  type="button"
                  disabled={isBusy}
                  aria-disabled={isBusy ? 'true' : 'false'}
                  aria-label="Advance proposal status"
                  onClick={() => void handleAdvance(proposal.id)}
                  style={actionButtonStyle(!isFacilitator, 'primary')}
                >
                  Mark Passed
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* result panel — visible only in completed phase */}
      {!resultHidden && (
        <div
          data-part="result"
          role="region"
          aria-label="Contest result"
          style={resultPanelStyle}
        >
          <p style={resultHeadingStyle}>Contest Result</p>
          {resultProposal ? (
            <>
              <p style={resultTitleStyle}>{resultProposal.title}</p>
              {resultProposal.description && (
                <p style={resultDescStyle}>{resultProposal.description}</p>
              )}
              <span style={badgeStyle(resultProposal.status)}>
                {resultProposal.status}
              </span>
            </>
          ) : (
            <p style={resultDescStyle}>No passed proposal recorded.</p>
          )}
        </div>
      )}

      {/* busyOverlay — shown during in-flight API calls (spec: aria-hidden true, not focusable) */}
      {!overlayHidden && (
        <div
          data-part="busy-overlay"
          aria-hidden="true"
          // tabIndex -1 ensures assistive tech cannot focus the overlay
          tabIndex={-1}
          style={busyOverlayStyle}
        >
          <div style={spinnerStyle} />
        </div>
      )}

      {/* Keyframe for spinner — injected as a style tag so no CSS import is needed */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default ContestWidget;
