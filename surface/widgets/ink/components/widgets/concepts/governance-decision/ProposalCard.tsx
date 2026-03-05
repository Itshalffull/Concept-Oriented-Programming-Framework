/* ---------------------------------------------------------------------------
 * ProposalCard — Ink (terminal) implementation
 * Compact navigation card summarizing a governance proposal
 * See widget spec: proposal-card.widget
 * ------------------------------------------------------------------------- */

export type ProposalCardState = 'idle' | 'hovered' | 'focused' | 'navigating';
export type ProposalCardEvent =
  | { type: 'HOVER' }
  | { type: 'UNHOVER' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'CLICK' }
  | { type: 'ENTER' }
  | { type: 'NAVIGATE_COMPLETE' };

export function proposalCardReducer(state: ProposalCardState, event: ProposalCardEvent): ProposalCardState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'FOCUS') return 'focused';
      if (event.type === 'CLICK') return 'navigating';
      return state;
    case 'hovered':
      if (event.type === 'UNHOVER') return 'idle';
      return state;
    case 'focused':
      if (event.type === 'BLUR') return 'idle';
      if (event.type === 'CLICK') return 'navigating';
      if (event.type === 'ENTER') return 'navigating';
      return state;
    case 'navigating':
      if (event.type === 'NAVIGATE_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useMemo, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '\u2026';
}

function formatTimeRemaining(timestamp: string): string {
  const target = new Date(timestamp).getTime();
  const now = Date.now();
  const diffMs = target - now;
  const absDiff = Math.abs(diffMs);
  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const isPast = diffMs < 0;
  const suffix = isPast ? ' ago' : ' remaining';
  if (days > 0) return `${days}d${suffix}`;
  if (hours > 0) return `${hours}h${suffix}`;
  if (minutes > 0) return `${minutes}m${suffix}`;
  return `${seconds}s${suffix}`;
}

function actionLabelForStatus(status: string): string {
  switch (status) {
    case 'Active': return 'Vote';
    case 'Passed':
    case 'Approved': return 'Execute';
    case 'Draft': return 'Edit';
    default: return 'View';
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'Active': return 'green';
    case 'Passed':
    case 'Approved':
    case 'Executed': return 'cyan';
    case 'Rejected':
    case 'Cancelled': return 'red';
    case 'Draft': return 'yellow';
    default: return 'white';
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export type ProposalStatus =
  | 'Draft' | 'Active' | 'Passed' | 'Rejected'
  | 'Executed' | 'Cancelled' | 'Approved'
  | (string & {});

export interface ProposalCardProps {
  title: string;
  description: string;
  author: string;
  status: ProposalStatus;
  timestamp: string;
  variant?: 'full' | 'compact' | 'minimal';
  showVoteBar?: boolean;
  showQuorum?: boolean;
  truncateDescription?: number;
  onClick?: () => void;
  onNavigate?: () => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export function ProposalCard({
  title,
  description,
  author,
  status,
  timestamp,
  variant = 'full',
  showVoteBar = true,
  showQuorum = false,
  truncateDescription = 120,
  onClick,
  onNavigate,
}: ProposalCardProps) {
  const [state, send] = useReducer(proposalCardReducer, 'idle');

  const truncatedDescription = useMemo(
    () => truncate(description, truncateDescription),
    [description, truncateDescription],
  );
  const relativeTime = useMemo(() => formatTimeRemaining(timestamp), [timestamp]);
  const actionLabel = useMemo(() => actionLabelForStatus(status), [status]);

  const showDescription = variant !== 'minimal';
  const showProposer = variant !== 'minimal';
  const showAction = variant !== 'minimal';

  useEffect(() => {
    if (state === 'navigating') {
      onClick?.();
      onNavigate?.();
      const id = setTimeout(() => send({ type: 'NAVIGATE_COMPLETE' }), 0);
      return () => clearTimeout(id);
    }
  }, [state, onClick, onNavigate]);

  useInput((input, key) => {
    if (key.return) {
      send({ type: 'ENTER' });
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      {/* Status badge and title */}
      <Box>
        <Text color={statusColor(status)} bold>[{status}]</Text>
        <Text> </Text>
        <Text bold>{title}</Text>
      </Box>

      {/* Description */}
      {showDescription && (
        <Box>
          <Text dimColor>{truncatedDescription}</Text>
        </Box>
      )}

      {/* Proposer and time */}
      <Box>
        {showProposer && (
          <>
            <Text>By </Text>
            <Text bold>{author}</Text>
            <Text> </Text>
          </>
        )}
        <Text dimColor>\u23F0 {relativeTime}</Text>
      </Box>

      {/* Vote bar slot indicator */}
      {showVoteBar && status === 'Active' && variant !== 'minimal' && (
        <Box>
          <Text dimColor>[Vote bar slot]</Text>
        </Box>
      )}

      {/* Action hint */}
      {showAction && (
        <Box>
          <Text dimColor>Enter to </Text>
          <Text color="cyan">{actionLabel}</Text>
        </Box>
      )}
    </Box>
  );
}

export default ProposalCard;
