'use client';

/**
 * StepInteractionSlot — Dispatches on step_type to render the appropriate
 * participant-facing interaction widget for a focused step.
 *
 * This is the primary extension point for the Process Street-style layout.
 * Subsequent cards (MAG-996 through MAG-999) will replace the placeholder
 * divs with real widgets.
 *
 * Dispatch table:
 *   'manual'           → advance button ("Mark X Done")
 *   'vote'             → placeholder (MAG-996)
 *   'brainstorm'       → placeholder (MAG-997)
 *   'contest'          → placeholder (MAG-998)
 *   'consent-agenda'   → placeholder (MAG-999)
 *   'content-creation' → placeholder
 *   'action' | 'branch' | 'catch' | 'logic' | default → null
 */

import React from 'react';

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

export interface StepInteractionSlotProps {
  stepRun: StepRunRecord;
  processRunId: string;
  stepLabel: string;
  onAdvance: () => void;
  actionBusy?: boolean;
}

export const StepInteractionSlot: React.FC<StepInteractionSlotProps> = ({
  stepRun,
  stepLabel,
  onAdvance,
  actionBusy = false,
}) => {
  const stepType = stepRun.step_type ?? '';
  const isActive = stepRun.status === 'active';

  switch (stepType) {
    case 'manual': {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-sm)',
          }}
        >
          {isActive ? (
            <>
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--typography-body-sm-size)',
                  color: 'var(--palette-on-surface-variant)',
                }}
              >
                This step requires a manual action. When the work is complete,
                mark it done to advance the process.
              </p>
              <button
                data-part="button"
                data-variant="filled"
                disabled={actionBusy}
                onClick={onAdvance}
                style={{
                  alignSelf: 'flex-start',
                  background: 'var(--palette-primary)',
                  color: 'var(--palette-on-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 20px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: actionBusy ? 'not-allowed' : 'pointer',
                  opacity: actionBusy ? 0.7 : 1,
                }}
              >
                {actionBusy ? '…' : `✓ Mark "${stepLabel}" Done`}
              </button>
            </>
          ) : (
            <p
              style={{
                margin: 0,
                fontSize: 'var(--typography-body-sm-size)',
                color: 'var(--palette-on-surface-variant)',
              }}
            >
              {stepRun.status === 'completed'
                ? 'This step has been completed.'
                : 'This step is not yet active.'}
            </p>
          )}
        </div>
      );
    }

    case 'vote': {
      return (
        <div
          style={{
            padding: '12px',
            border: '1px dashed var(--palette-outline-variant, #e0e0e0)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--palette-on-surface-variant)',
            fontSize: 'var(--typography-body-sm-size)',
          }}
        >
          VoteWidget coming soon (MAG-996)
        </div>
      );
    }

    case 'brainstorm': {
      return (
        <div
          style={{
            padding: '12px',
            border: '1px dashed var(--palette-outline-variant, #e0e0e0)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--palette-on-surface-variant)',
            fontSize: 'var(--typography-body-sm-size)',
          }}
        >
          BrainstormWidget coming soon (MAG-997)
        </div>
      );
    }

    case 'contest': {
      return (
        <div
          style={{
            padding: '12px',
            border: '1px dashed var(--palette-outline-variant, #e0e0e0)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--palette-on-surface-variant)',
            fontSize: 'var(--typography-body-sm-size)',
          }}
        >
          ContestWidget coming soon (MAG-998)
        </div>
      );
    }

    case 'consent-agenda': {
      return (
        <div
          style={{
            padding: '12px',
            border: '1px dashed var(--palette-outline-variant, #e0e0e0)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--palette-on-surface-variant)',
            fontSize: 'var(--typography-body-sm-size)',
          }}
        >
          ConsentAgendaWidget coming soon (MAG-999)
        </div>
      );
    }

    case 'content-creation': {
      return (
        <div
          style={{
            padding: '12px',
            border: '1px dashed var(--palette-outline-variant, #e0e0e0)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--palette-on-surface-variant)',
            fontSize: 'var(--typography-body-sm-size)',
          }}
        >
          ContentCreationWidget coming soon
        </div>
      );
    }

    // Automated step types — no participant interaction needed
    case 'action':
    case 'branch':
    case 'catch':
    case 'logic':
    default:
      return null;
  }
};

export default StepInteractionSlot;
