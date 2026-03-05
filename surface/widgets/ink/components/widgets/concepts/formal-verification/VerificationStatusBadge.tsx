/* ---------------------------------------------------------------------------
 * VerificationStatusBadge — Ink (terminal) implementation
 * Compact status indicator for formal verification results
 * See widget spec: verification-status-badge.widget
 * ------------------------------------------------------------------------- */

export type VerificationStatusBadgeState = 'idle' | 'hovered' | 'animating';
export type VerificationStatusBadgeEvent =
  | { type: 'HOVER' }
  | { type: 'STATUS_CHANGE' }
  | { type: 'LEAVE' }
  | { type: 'ANIMATION_END' };

export function verificationStatusBadgeReducer(
  state: VerificationStatusBadgeState,
  event: VerificationStatusBadgeEvent,
): VerificationStatusBadgeState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'STATUS_CHANGE') return 'animating';
      return state;
    case 'hovered':
      if (event.type === 'LEAVE') return 'idle';
      return state;
    case 'animating':
      if (event.type === 'ANIMATION_END') return 'idle';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

type VerificationStatus = 'proved' | 'refuted' | 'unknown' | 'timeout' | 'running';

const STATUS_ICONS: Record<VerificationStatus, string> = {
  proved: '\u2713',
  refuted: '\u2717',
  unknown: '?',
  timeout: '\u23F0',
  running: '\u25CF',
};

const STATUS_COLORS: Record<VerificationStatus, string> = {
  proved: 'green',
  refuted: 'red',
  unknown: 'yellow',
  timeout: 'magenta',
  running: 'cyan',
};

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface VerificationStatusBadgeProps {
  status?: VerificationStatus;
  label?: string;
  duration?: number | undefined;
  solver?: string | undefined;
  size?: 'sm' | 'md' | 'lg';
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export function VerificationStatusBadge({
  status = 'unknown',
  label = 'Unknown',
  duration,
  solver,
  size = 'md',
}: VerificationStatusBadgeProps) {
  const [state, send] = useReducer(verificationStatusBadgeReducer, 'idle');
  const prevStatusRef = useRef(status);

  // Trigger STATUS_CHANGE when status prop changes
  useEffect(() => {
    if (prevStatusRef.current !== status) {
      prevStatusRef.current = status;
      send({ type: 'STATUS_CHANGE' });
    }
  }, [status]);

  // Auto-end animation
  useEffect(() => {
    if (state === 'animating') {
      const timer = setTimeout(() => send({ type: 'ANIMATION_END' }), 200);
      return () => clearTimeout(timer);
    }
  }, [state]);

  const icon = STATUS_ICONS[status] ?? '?';
  const color = STATUS_COLORS[status] ?? 'white';

  const detailParts: string[] = [];
  if (solver) detailParts.push(solver);
  if (duration != null) detailParts.push(`${duration}ms`);
  const detailText = detailParts.join(' \u2014 ');

  return (
    <Box>
      <Text color={color} bold>
        {icon} {label}
      </Text>
      {detailText && (
        <Text dimColor> ({detailText})</Text>
      )}
    </Box>
  );
}

export default VerificationStatusBadge;
