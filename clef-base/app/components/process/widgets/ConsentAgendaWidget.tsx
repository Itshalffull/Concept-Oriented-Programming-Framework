'use client';

/**
 * ConsentAgendaWidget — React adapter for the ConsentAgendaWidget.widget spec.
 *
 * Renders in StepInteractionSlot when step_type === 'consent-agenda'. Guides a
 * group through the five sociocratic consent phases: Presenting, Clarifying,
 * Reacting, Objection Round, and Decision. Binds to four ConsentProcess actions:
 *   - advancePhase        (facilitator only)
 *   - raiseObjection      (any participant during objection-round)
 *   - integrateObjection  (facilitator only)
 *   - resolve             (facilitator only, during objection-round)
 *
 * Two parallel FSMs (mirroring the widget spec):
 *   phase FSM:  presenting → clarifying → reacting → objection-round
 *               ↕ integrating (when objection raised)
 *               → consented | blocked (terminal)
 *   api FSM:    idle ↔ busy
 *
 * Widget spec: surface/ConsentAgendaWidget.widget
 * Anatomy parts (data-part attributes): root, header, phase-indicator,
 *   phase-description, objection-form, objection-reason, paramount-checkbox,
 *   raise-button, objection-list, objection-item, integration-input,
 *   integrate-button, advance-phase-button, resolve-button, result
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConsentAgendaWidgetProps {
  consentProcessId: string;
  stepRunId: string;
  processRunId: string;
  currentUserId: string;
  isFacilitator: boolean;
  proposalTitle: string;
  /** "Presenting"|"Clarifying"|"Reacting"|"ObjectionRound"|"Integrated"|"Consented"|"Blocked" */
  initialPhase: string;
  /** "active" | "completed" */
  initialStatus: string;
}

/** Phase FSM — mirrors the widget spec states.phase block exactly */
type Phase =
  | 'presenting'
  | 'clarifying'
  | 'reacting'
  | 'objection-round'
  | 'integrating'
  | 'consented'
  | 'blocked';

/** API FSM — mirrors the widget spec states.api [parallel] block */
type ApiState = 'idle' | 'busy';

interface Objection {
  objectionIndex: number;
  objector: string;
  reason: string;
  isParamount: boolean;
  integrated: boolean;
  amendment?: string;
}

interface ConsentProcessState {
  phase: Phase;
  objections: Objection[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise the initialPhase prop (API uses PascalCase; FSM uses kebab-case) */
function normalisePhase(raw: string): Phase {
  switch (raw.toLowerCase().replace(/[\s_]/g, '-')) {
    case 'presenting':     return 'presenting';
    case 'clarifying':     return 'clarifying';
    case 'reacting':       return 'reacting';
    case 'objection-round':
    case 'objectionround': return 'objection-round';
    case 'integrated':
    case 'integrating':    return 'integrating';
    case 'consented':      return 'consented';
    case 'blocked':        return 'blocked';
    default:               return 'presenting';
  }
}

/** Map phase → 1-based progress value for aria-valuenow */
function phaseToProgressValue(phase: Phase): number {
  switch (phase) {
    case 'presenting':     return 1;
    case 'clarifying':     return 2;
    case 'reacting':       return 3;
    case 'objection-round':
    case 'integrating':    return 4;
    case 'consented':
    case 'blocked':        return 5;
  }
}

/** Per-phase guidance text — matches connect.phaseDescription in the widget spec */
function phaseDescription(phase: Phase): string {
  switch (phase) {
    case 'presenting':
      return 'Presenting: The proposal is being introduced. Listen and take notes.';
    case 'clarifying':
      return 'Clarifying: Ask clarifying questions to understand the proposal. Reactions and objections come later.';
    case 'reacting':
      return 'Reacting: Share your reactions, concerns, and appreciations about the proposal.';
    case 'objection-round':
      return 'Objection Round: Raise a formal objection if you see a reason the proposal would harm the group. Otherwise, signal consent.';
    case 'integrating':
      return 'Integrating: The facilitator is working with objectors to integrate amendments.';
    case 'consented':
      return 'The proposal has received consent. No paramount objections remain.';
    case 'blocked':
      return 'The proposal is blocked. Outstanding paramount objections could not be integrated.';
  }
}

/** The five visible step labels for the phase indicator progress bar */
const PHASE_STEPS: { key: Phase | 'decision'; label: string; phases: Phase[] }[] = [
  { key: 'presenting',    label: 'Presenting',     phases: ['presenting'] },
  { key: 'clarifying',   label: 'Clarifying',     phases: ['clarifying'] },
  { key: 'reacting',     label: 'Reacting',        phases: ['reacting'] },
  { key: 'objection-round', label: 'Objection Round', phases: ['objection-round', 'integrating'] },
  { key: 'decision',     label: 'Decision',        phases: ['consented', 'blocked'] },
];

function stepStatus(stepPhases: Phase[], current: Phase): 'completed' | 'active' | 'upcoming' {
  const currentValue = phaseToProgressValue(current);
  const stepValue    = phaseToProgressValue(stepPhases[0]);
  if (currentValue > stepValue) return 'completed';
  if (stepPhases.includes(current)) return 'active';
  return 'upcoming';
}

// ---------------------------------------------------------------------------
// ConsentAgendaWidget
// ---------------------------------------------------------------------------

export const ConsentAgendaWidget: React.FC<ConsentAgendaWidgetProps> = ({
  consentProcessId,
  stepRunId: _stepRunId,
  processRunId: _processRunId,
  currentUserId,
  isFacilitator,
  proposalTitle,
  initialPhase,
  initialStatus,
}) => {
  // ---- Phase FSM state ----
  const [phase, setPhase] = useState<Phase>(() => normalisePhase(initialPhase));

  // ---- API FSM state ----
  const [apiState, setApiState] = useState<ApiState>('idle');

  // ---- Objection list ----
  const [objections, setObjections] = useState<Objection[]>([]);

  // ---- Objection form local state ----
  const [objectionReason, setObjectionReason] = useState('');
  const [isParamount, setIsParamount] = useState(false);

  // ---- Per-objection amendment inputs ----
  const [amendments, setAmendments] = useState<Record<number, string>>({});

  // ---- Error banner ----
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ---- Poll interval ref ----
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isTerminal = phase === 'consented' || phase === 'blocked';
  const isActive   = initialStatus === 'active';

  // ---- Shared fetch helper ----
  const invokeConsentProcess = useCallback(
    async (action: string, body: Record<string, unknown>): Promise<Record<string, unknown>> => {
      const res = await fetch(`/api/invoke/ConsentProcess/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`ConsentProcess/${action} failed: HTTP ${res.status}`);
      }
      return res.json() as Promise<Record<string, unknown>>;
    },
    [],
  );

  // ---- Load current process state ----
  const loadState = useCallback(async () => {
    if (!consentProcessId) return;
    try {
      const data = await invokeConsentProcess('getState', { process: consentProcessId });
      if (data.phase) {
        setPhase(normalisePhase(data.phase as string));
      }
      if (Array.isArray(data.objections)) {
        setObjections(data.objections as Objection[]);
      }
    } catch {
      // Non-fatal — keep current state
    }
  }, [consentProcessId, invokeConsentProcess]);

  // ---- Poll every 5 s while active and not terminal ----
  useEffect(() => {
    if (!isActive || isTerminal) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    // Initial load
    loadState();

    pollRef.current = setInterval(() => {
      loadState();
    }, 5000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isActive, isTerminal, loadState]);

  // ---- advancePhase (facilitator only) ----
  const handleAdvancePhase = useCallback(async () => {
    if (!isFacilitator || apiState === 'busy' || isTerminal) return;
    setApiState('busy');
    setErrorMsg(null);
    try {
      const result = await invokeConsentProcess('advancePhase', { process: consentProcessId });
      if (result.variant === 'ok' || result.variant === undefined) {
        // Reload to get canonical server-side phase
        await loadState();
      } else {
        setErrorMsg(`advancePhase returned: ${result.variant}`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to advance phase');
    } finally {
      setApiState('idle');
    }
  }, [isFacilitator, apiState, isTerminal, consentProcessId, invokeConsentProcess, loadState]);

  // ---- raiseObjection ----
  const handleRaiseObjection = useCallback(async () => {
    if (phase !== 'objection-round' || apiState === 'busy') return;
    if (!objectionReason.trim()) {
      setErrorMsg('Please describe your objection.');
      return;
    }
    setApiState('busy');
    setErrorMsg(null);
    try {
      const result = await invokeConsentProcess('raiseObjection', {
        process:     consentProcessId,
        objector:    currentUserId,
        reason:      objectionReason.trim(),
        isParamount: isParamount,
      });
      if (result.variant === 'ok' || result.variant === undefined) {
        setObjectionReason('');
        setIsParamount(false);
        await loadState();
      } else {
        setErrorMsg(`raiseObjection returned: ${result.variant}`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to raise objection');
    } finally {
      setApiState('idle');
    }
  }, [
    phase, apiState, consentProcessId, currentUserId,
    objectionReason, isParamount, invokeConsentProcess, loadState,
  ]);

  // ---- integrateObjection (facilitator only) ----
  const handleIntegrate = useCallback(async (objectionIndex: number) => {
    if (!isFacilitator || apiState === 'busy') return;
    const amendment = (amendments[objectionIndex] ?? '').trim();
    if (!amendment) {
      setErrorMsg('Please describe the amendment before integrating.');
      return;
    }
    setApiState('busy');
    setErrorMsg(null);
    try {
      const result = await invokeConsentProcess('integrateObjection', {
        process:         consentProcessId,
        objectionIndex:  objectionIndex,
        amendment:       amendment,
      });
      if (result.variant === 'ok' || result.variant === undefined) {
        setAmendments((prev) => {
          const next = { ...prev };
          delete next[objectionIndex];
          return next;
        });
        await loadState();
      } else {
        setErrorMsg(`integrateObjection returned: ${result.variant}`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to integrate objection');
    } finally {
      setApiState('idle');
    }
  }, [isFacilitator, apiState, consentProcessId, amendments, invokeConsentProcess, loadState]);

  // ---- resolve (facilitator only) ----
  const handleResolve = useCallback(async () => {
    if (!isFacilitator || phase !== 'objection-round' || apiState === 'busy') return;
    setApiState('busy');
    setErrorMsg(null);
    try {
      const result = await invokeConsentProcess('resolve', { process: consentProcessId });
      if (result.variant === 'ok' || result.variant === undefined) {
        await loadState();
      } else {
        setErrorMsg(`resolve returned: ${result.variant}`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to resolve process');
    } finally {
      setApiState('idle');
    }
  }, [isFacilitator, phase, apiState, consentProcessId, invokeConsentProcess, loadState]);

  // ---- Keyboard handlers ----
  const handleObjectionKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleRaiseObjection();
      } else if (e.key === 'Escape') {
        setObjectionReason('');
        setIsParamount(false);
      }
    },
    [handleRaiseObjection],
  );

  // ---- Derived visibility / disabled flags ----
  const showObjectionForm     = phase === 'objection-round';
  const showObjectionList     = phase === 'objection-round' || phase === 'integrating';
  const showResult            = phase === 'consented' || phase === 'blocked';
  const advanceButtonDisabled = isTerminal || apiState === 'busy';
  const resolveButtonHidden   = !(isFacilitator && phase === 'objection-round');

  const progressValue = phaseToProgressValue(phase);

  return (
    <div
      data-part="root"
      data-state={phase}
      data-api={apiState}
      data-process={consentProcessId}
      data-proposal={proposalTitle}
      role="region"
      aria-label="Consent Process"
      aria-busy={apiState === 'busy' ? 'true' : 'false'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md, 16px)',
        padding: 'var(--spacing-md, 16px)',
        border: '1px solid var(--palette-outline-variant, #e0e0e0)',
        borderRadius: 'var(--radius-sm, 6px)',
        background: 'var(--palette-surface)',
        fontFamily: 'var(--typography-font-family, inherit)',
        fontSize: 'var(--typography-body-sm-size, 14px)',
      }}
    >
      {/* ---- header ---- */}
      <div
        data-part="header"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--palette-on-surface-variant)',
          }}
        >
          Consent Process
        </span>
        <span
          style={{
            fontSize: 'var(--typography-body-size, 15px)',
            fontWeight: 600,
            color: 'var(--palette-on-surface)',
          }}
        >
          {proposalTitle}
        </span>
      </div>

      {/* ---- phaseIndicator: horizontal 5-step progress bar ---- */}
      <div
        data-part="phase-indicator"
        data-phase={phase}
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={progressValue}
        aria-label="Consent phase progress"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '4px',
        }}
      >
        {PHASE_STEPS.map((step, idx) => {
          const status = stepStatus(step.phases as Phase[], phase);
          return (
            <React.Fragment key={step.key}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {/* Step dot */}
                <div
                  aria-hidden="true"
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    flexShrink: 0,
                    background:
                      status === 'completed'
                        ? 'var(--palette-secondary, #6c757d)'
                        : status === 'active'
                        ? 'var(--palette-primary)'
                        : 'var(--palette-surface-variant, #f5f5f5)',
                    color:
                      status === 'completed'
                        ? '#fff'
                        : status === 'active'
                        ? 'var(--palette-on-primary, #fff)'
                        : 'var(--palette-on-surface-variant)',
                    border:
                      status === 'active'
                        ? '2px solid var(--palette-primary)'
                        : '2px solid transparent',
                    opacity: status === 'upcoming' ? 0.5 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  {status === 'completed' ? '✓' : idx + 1}
                </div>
                {/* Step label */}
                <span
                  aria-hidden="true"
                  style={{
                    marginTop: '4px',
                    fontSize: '10px',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '64px',
                    fontWeight: status === 'active' ? 700 : 400,
                    color:
                      status === 'active'
                        ? 'var(--palette-primary)'
                        : status === 'completed'
                        ? 'var(--palette-secondary, #6c757d)'
                        : 'var(--palette-on-surface-variant)',
                    opacity: status === 'upcoming' ? 0.5 : 1,
                  }}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line between steps */}
              {idx < PHASE_STEPS.length - 1 && (
                <div
                  aria-hidden="true"
                  style={{
                    height: '2px',
                    flex: '0 0 12px',
                    marginTop: '11px',
                    background:
                      progressValue > idx + 1
                        ? 'var(--palette-secondary, #6c757d)'
                        : 'var(--palette-outline-variant, #e0e0e0)',
                    transition: 'background 0.2s',
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ---- phaseDescription ---- */}
      <p
        data-part="phase-description"
        style={{
          margin: 0,
          fontSize: 'var(--typography-body-sm-size, 13px)',
          color: 'var(--palette-on-surface-variant)',
          lineHeight: 1.5,
          padding: '8px 12px',
          background: 'var(--palette-surface-variant, #f5f5f5)',
          borderRadius: 'var(--radius-xs, 4px)',
          borderLeft: '3px solid var(--palette-primary)',
        }}
      >
        {phaseDescription(phase)}
      </p>

      {/* ---- errorMsg banner ---- */}
      {errorMsg && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            padding: '8px 12px',
            background: 'var(--palette-error-container, #fde7e7)',
            color: 'var(--palette-on-error-container, #b71c1c)',
            borderRadius: 'var(--radius-xs, 4px)',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            aria-label="Dismiss error"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              color: 'inherit',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ---- objectionForm: visible ONLY during objection-round ---- */}
      <div
        data-part="objection-form"
        role="form"
        aria-label="Raise an objection"
        aria-hidden={showObjectionForm ? 'false' : 'true'}
        hidden={!showObjectionForm}
        style={
          showObjectionForm
            ? {
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-sm, 8px)',
                padding: '12px',
                border: '1px solid var(--palette-outline-variant, #e0e0e0)',
                borderRadius: 'var(--radius-sm, 6px)',
                background: 'var(--palette-surface)',
              }
            : { display: 'none' }
        }
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--palette-on-surface)',
          }}
        >
          Raise a Formal Objection
        </span>

        {/* objectionReason textarea */}
        <textarea
          data-part="objection-reason"
          placeholder="Describe your objection..."
          value={objectionReason}
          onChange={(e) => setObjectionReason(e.target.value)}
          onKeyDown={handleObjectionKeyDown}
          disabled={!showObjectionForm || apiState === 'busy'}
          rows={3}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid var(--palette-outline-variant, #e0e0e0)',
            borderRadius: 'var(--radius-xs, 4px)',
            fontSize: '13px',
            fontFamily: 'inherit',
            resize: 'vertical',
            boxSizing: 'border-box',
            background: 'var(--palette-surface)',
            color: 'var(--palette-on-surface)',
          }}
        />

        {/* paramountCheckbox */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            cursor: 'pointer',
            color: 'var(--palette-on-surface)',
          }}
        >
          <input
            data-part="paramount-checkbox"
            type="checkbox"
            checked={isParamount}
            onChange={(e) => setIsParamount(e.target.checked)}
            disabled={!showObjectionForm || apiState === 'busy'}
            aria-label="This objection is paramount"
            style={{ cursor: 'pointer' }}
          />
          This objection is paramount (blocks resolution until integrated)
        </label>

        {/* raiseButton */}
        <button
          data-part="raise-button"
          role="button"
          aria-label="Raise Objection"
          aria-disabled={showObjectionForm ? 'false' : 'true'}
          disabled={!showObjectionForm || apiState === 'busy'}
          onClick={handleRaiseObjection}
          style={{
            alignSelf: 'flex-start',
            padding: '7px 16px',
            background: 'var(--palette-primary)',
            color: 'var(--palette-on-primary, #fff)',
            border: 'none',
            borderRadius: 'var(--radius-sm, 6px)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: apiState === 'busy' ? 'not-allowed' : 'pointer',
            opacity: apiState === 'busy' ? 0.7 : 1,
          }}
        >
          {apiState === 'busy' ? '…' : 'Raise Objection'}
        </button>
      </div>

      {/* ---- objectionList: visible during objection-round and integrating ---- */}
      <div
        data-part="objection-list"
        role="list"
        aria-label="Raised objections"
        hidden={!showObjectionList}
        style={
          showObjectionList
            ? {
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-sm, 8px)',
              }
            : { display: 'none' }
        }
      >
        {objections.length === 0 && showObjectionList && (
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: 'var(--palette-on-surface-variant)',
              fontStyle: 'italic',
            }}
          >
            No objections raised yet.
          </p>
        )}

        {objections.map((obj) => {
          const amendmentValue = amendments[obj.objectionIndex] ?? '';
          const showIntegrationInput =
            isFacilitator && (phase === 'integrating' || phase === 'objection-round');
          const integrateDisabled =
            !isFacilitator ||
            apiState === 'busy' ||
            !(phase === 'integrating' || phase === 'objection-round');

          return (
            <div
              key={obj.objectionIndex}
              data-part="objection-item"
              role="listitem"
              style={{
                padding: '10px 12px',
                border: '1px solid var(--palette-outline-variant, #e0e0e0)',
                borderRadius: 'var(--radius-xs, 4px)',
                background: obj.integrated
                  ? 'var(--palette-success-container, #e8f5e9)'
                  : 'var(--palette-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {/* Objection header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--palette-on-surface)',
                  }}
                >
                  {obj.objector}
                </span>
                {obj.isParamount && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '10px',
                      background: 'var(--palette-error-container, #fde7e7)',
                      color: 'var(--palette-on-error-container, #b71c1c)',
                    }}
                  >
                    PARAMOUNT
                  </span>
                )}
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: '10px',
                    marginLeft: 'auto',
                    background: obj.integrated
                      ? 'var(--palette-success-container, #e8f5e9)'
                      : 'var(--palette-surface-variant, #f5f5f5)',
                    color: obj.integrated
                      ? 'var(--palette-on-success-container, #1b5e20)'
                      : 'var(--palette-on-surface-variant)',
                  }}
                >
                  {obj.integrated ? 'Integrated' : 'Open'}
                </span>
              </div>

              {/* Objection reason */}
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  color: 'var(--palette-on-surface)',
                  lineHeight: 1.4,
                }}
              >
                {obj.reason}
              </p>

              {/* Integrated amendment, if present */}
              {obj.integrated && obj.amendment && (
                <p
                  style={{
                    margin: 0,
                    fontSize: '12px',
                    color: 'var(--palette-on-surface-variant)',
                    fontStyle: 'italic',
                  }}
                >
                  Amendment: {obj.amendment}
                </p>
              )}

              {/* integrationInput + integrateButton — facilitator only, unintegrated objections */}
              {!obj.integrated && showIntegrationInput && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '4px' }}>
                  <textarea
                    data-part="integration-input"
                    placeholder="Describe the amendment..."
                    value={amendmentValue}
                    onChange={(e) =>
                      setAmendments((prev) => ({
                        ...prev,
                        [obj.objectionIndex]: e.target.value,
                      }))
                    }
                    rows={2}
                    disabled={integrateDisabled}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      border: '1px solid var(--palette-outline-variant, #e0e0e0)',
                      borderRadius: 'var(--radius-xs, 4px)',
                      fontSize: '12px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      background: 'var(--palette-surface)',
                      color: 'var(--palette-on-surface)',
                    }}
                  />
                  <button
                    data-part="integrate-button"
                    role="button"
                    aria-label="Integrate objection"
                    aria-hidden={isFacilitator ? 'false' : 'true'}
                    disabled={integrateDisabled || !amendmentValue.trim()}
                    onClick={() => handleIntegrate(obj.objectionIndex)}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--palette-secondary, #6c757d)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 'var(--radius-sm, 6px)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: integrateDisabled ? 'not-allowed' : 'pointer',
                      opacity: integrateDisabled ? 0.6 : 1,
                      flexShrink: 0,
                      alignSelf: 'flex-end',
                    }}
                  >
                    Integrate
                  </button>
                </div>
              )}

              {/* integrateButton hidden for non-facilitators (aria-hidden) */}
              {!isFacilitator && (
                <button
                  data-part="integrate-button"
                  aria-hidden="true"
                  hidden
                  tabIndex={-1}
                  style={{ display: 'none' }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ---- Facilitator action row: advancePhaseButton + resolveButton ---- */}
      {isFacilitator && (
        <div
          style={{
            display: 'flex',
            gap: 'var(--spacing-sm, 8px)',
            flexWrap: 'wrap',
          }}
        >
          {/* advancePhaseButton — hidden for non-facilitators */}
          {phase !== 'objection-round' && !isTerminal && (
            <button
              data-part="advance-phase-button"
              role="button"
              aria-label="Advance to next phase"
              aria-hidden="false"
              disabled={advanceButtonDisabled}
              onClick={handleAdvancePhase}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdvancePhase();
              }}
              style={{
                padding: '8px 18px',
                background: 'var(--palette-primary)',
                color: 'var(--palette-on-primary, #fff)',
                border: 'none',
                borderRadius: 'var(--radius-sm, 6px)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: advanceButtonDisabled ? 'not-allowed' : 'pointer',
                opacity: advanceButtonDisabled ? 0.6 : 1,
              }}
            >
              {apiState === 'busy' ? '…' : 'Next Phase'}
            </button>
          )}

          {/* resolveButton — facilitator + objection-round only */}
          {!resolveButtonHidden && (
            <button
              data-part="resolve-button"
              role="button"
              aria-label="Resolve consent process"
              aria-hidden="false"
              disabled={phase !== 'objection-round' || apiState === 'busy'}
              onClick={handleResolve}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleResolve();
              }}
              style={{
                padding: '8px 18px',
                background: 'var(--palette-success, #2e7d32)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-sm, 6px)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: apiState === 'busy' ? 'not-allowed' : 'pointer',
                opacity: apiState === 'busy' ? 0.6 : 1,
              }}
            >
              {apiState === 'busy' ? '…' : 'Resolve'}
            </button>
          )}
        </div>
      )}

      {/* Hidden sentinel elements for non-facilitators (aria contract) */}
      {!isFacilitator && (
        <>
          <button
            data-part="advance-phase-button"
            aria-hidden="true"
            hidden
            tabIndex={-1}
            style={{ display: 'none' }}
          />
          <button
            data-part="resolve-button"
            aria-hidden="true"
            hidden
            tabIndex={-1}
            style={{ display: 'none' }}
          />
        </>
      )}

      {/* ---- result: terminal state panel — aria-live assertive ---- */}
      <div
        data-part="result"
        data-outcome={
          phase === 'consented' ? 'consented' : phase === 'blocked' ? 'blocked' : ''
        }
        aria-live="assertive"
        aria-atomic="true"
        hidden={!showResult}
        style={
          showResult
            ? {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                padding: '20px 16px',
                borderRadius: 'var(--radius-sm, 6px)',
                background:
                  phase === 'consented'
                    ? 'var(--palette-success-container, #e8f5e9)'
                    : 'var(--palette-error-container, #fde7e7)',
                textAlign: 'center',
              }
            : { display: 'none' }
        }
      >
        {phase === 'consented' && (
          <>
            <span
              aria-hidden="true"
              style={{ fontSize: '32px', color: 'var(--palette-success, #2e7d32)' }}
            >
              ✓
            </span>
            <span
              style={{
                fontWeight: 700,
                fontSize: '15px',
                color: 'var(--palette-on-success-container, #1b5e20)',
              }}
            >
              Consented
            </span>
            <span
              style={{
                fontSize: '13px',
                color: 'var(--palette-on-success-container, #1b5e20)',
              }}
            >
              The proposal has received consent. No paramount objections remain.
            </span>
          </>
        )}
        {phase === 'blocked' && (
          <>
            <span
              aria-hidden="true"
              style={{ fontSize: '32px', color: 'var(--palette-error)' }}
            >
              ✗
            </span>
            <span
              style={{
                fontWeight: 700,
                fontSize: '15px',
                color: 'var(--palette-on-error-container, #b71c1c)',
              }}
            >
              Blocked
            </span>
            <span
              style={{
                fontSize: '13px',
                color: 'var(--palette-on-error-container, #b71c1c)',
              }}
            >
              The proposal is blocked. Outstanding paramount objections could not be integrated.
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default ConsentAgendaWidget;
