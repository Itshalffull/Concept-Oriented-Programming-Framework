'use client';

/**
 * StepInteractionSlot — Dispatches on step_type to render the appropriate
 * participant-facing interaction widget for a focused step.
 *
 * This is the primary extension point for the Process Street-style layout.
 *
 * Dispatch table:
 *   'manual'           → advance button ("Mark X Done")
 *   'vote'             → VoteWidget
 *   'brainstorm'       → BrainstormWidget
 *   'contest'          → ContestWidget
 *   'consent-agenda'   → ConsentAgendaWidget
 *   'content-creation' → ContentCreationWidget
 *   'action' | 'branch' | 'catch' | 'logic' | default → null
 */

import React from 'react';
import { VoteWidget } from './widgets/VoteWidget';
import { BrainstormWidget } from './widgets/BrainstormWidget';
import { ContestWidget } from './widgets/ContestWidget';
import { ConsentAgendaWidget } from './widgets/ConsentAgendaWidget';
import { ContentCreationWidget } from './widgets/ContentCreationWidget';

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
  currentUserId?: string;
  isFacilitator?: boolean;
}

// ---------------------------------------------------------------------------
// Config parsing helper
// ---------------------------------------------------------------------------

function parseConfig(input: string | null | undefined): Record<string, string> {
  if (!input) return {};
  try { return JSON.parse(input) as Record<string, string>; } catch { return {}; }
}

export const StepInteractionSlot: React.FC<StepInteractionSlotProps> = ({
  stepRun,
  processRunId,
  stepLabel,
  onAdvance,
  actionBusy = false,
  currentUserId = '',
  isFacilitator = false,
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
      const config = parseConfig(stepRun.input);
      return (
        <VoteWidget
          voteSessionId={config.voteSessionId ?? ''}
          processRunId={processRunId}
          stepRunId={stepRun.id ?? ''}
          currentUserId={currentUserId}
          deadline={config.deadline ?? null}
          quorum={Number(config.quorum ?? 0)}
          votingMethod={config.votingMethod ?? 'simple-majority'}
          allowChange={config.allowChange === 'true'}
          anonymous={config.anonymous === 'true'}
          initialStatus={stepRun.status ?? 'active'}
          initialOutcome={null}
        />
      );
    }

    case 'brainstorm': {
      const config = parseConfig(stepRun.input);
      return (
        <BrainstormWidget
          boardId={config.boardId ?? ''}
          stepRunId={stepRun.id ?? ''}
          processRunId={processRunId}
          currentUserId={currentUserId}
          isFacilitator={isFacilitator}
          initialPhase={config.phase ?? 'submit'}
          anonymous={config.anonymous === 'true'}
        />
      );
    }

    case 'contest': {
      const config = parseConfig(stepRun.input);
      return (
        <ContestWidget
          stepRunId={stepRun.id ?? ''}
          processRunId={processRunId}
          currentUserId={currentUserId}
          isFacilitator={isFacilitator}
          preseededProposalIds={
            config.preseededProposalIds
              ? JSON.parse(config.preseededProposalIds) as string[]
              : undefined
          }
        />
      );
    }

    case 'consent-agenda': {
      const config = parseConfig(stepRun.input);
      return (
        <ConsentAgendaWidget
          consentProcessId={config.consentProcessId ?? ''}
          stepRunId={stepRun.id ?? ''}
          processRunId={processRunId}
          currentUserId={currentUserId}
          isFacilitator={isFacilitator}
          proposalTitle={config.proposalTitle ?? ''}
          initialPhase={config.initialPhase ?? 'Presenting'}
          initialStatus={stepRun.status ?? 'active'}
        />
      );
    }

    case 'content-creation': {
      const config = parseConfig(stepRun.input);
      return (
        <ContentCreationWidget
          stepRunId={stepRun.id ?? ''}
          processRunId={processRunId}
          currentUserId={currentUserId}
          contentType={config.schemaId ?? ''}
          contentTypeName={config.contentTypeName ?? config.schemaId ?? ''}
          requiredFields={
            config.requiredFields
              ? JSON.parse(config.requiredFields) as string[]
              : []
          }
          initialStatus={stepRun.status ?? 'active'}
          initialNodeId={null}
        />
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
