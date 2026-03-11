export type ApprovalStepperState = 'viewing' | 'stepFocused' | 'acting';
export type ApprovalStepperEvent =
  | { type: 'FOCUS_STEP' }
  | { type: 'START_ACTION' }
  | { type: 'BLUR' }
  | { type: 'COMPLETE' }
  | { type: 'CANCEL' };

export function approvalStepperReducer(state: ApprovalStepperState, event: ApprovalStepperEvent): ApprovalStepperState {
  switch (state) {
    case 'viewing':
      if (event.type === 'FOCUS_STEP') return 'stepFocused';
      if (event.type === 'START_ACTION') return 'acting';
      return state;
    case 'stepFocused':
      if (event.type === 'BLUR') return 'viewing';
      if (event.type === 'START_ACTION') return 'acting';
      return state;
    case 'acting':
      if (event.type === 'COMPLETE') return 'viewing';
      if (event.type === 'CANCEL') return 'viewing';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface ApprovalStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'approved' | 'rejected' | 'skipped';
  assignee?: string;
  dueAt?: string;
}

const STEP_ICONS: Record<string, { icon: string; color: string }> = {
  pending: { icon: '\u25CB', color: 'gray' },
  active: { icon: '\u25CF', color: 'yellow' },
  approved: { icon: '\u2713', color: 'green' },
  rejected: { icon: '\u2717', color: 'red' },
  skipped: { icon: '\u2298', color: 'gray' },
};

export interface ApprovalStepperProps {
  steps: ApprovalStep[];
  currentStep: string;
  status: string;
  assignee?: string | undefined;
  dueAt?: string | undefined;
  variant?: 'sequential' | 'parallel' | 'mixed';
  orientation?: 'horizontal' | 'vertical';
  showSLA?: boolean;
  showAssignee?: boolean;
  onApprove?: (stepId: string) => void;
  onReject?: (stepId: string) => void;
  isFocused?: boolean;
}

export function ApprovalStepper({
  steps,
  currentStep,
  status,
  variant = 'sequential',
  orientation = 'vertical',
  showSLA = false,
  showAssignee = false,
  onApprove,
  onReject,
  isFocused = false,
}: ApprovalStepperProps) {
  const [state, send] = useReducer(approvalStepperReducer, 'viewing');
  const [cursorIndex, setCursorIndex] = useState(
    steps.findIndex(s => s.id === currentStep)
  );

  useInput((input, key) => {
    if (!isFocused) return;

    if (state === 'acting') {
      if (key.escape) send({ type: 'CANCEL' });
      return;
    }

    if (key.upArrow || input === 'k') {
      setCursorIndex(prev => Math.max(0, prev - 1));
      send({ type: 'FOCUS_STEP' });
    }
    if (key.downArrow || input === 'j') {
      setCursorIndex(prev => Math.min(steps.length - 1, prev + 1));
      send({ type: 'FOCUS_STEP' });
    }
    if (key.escape) send({ type: 'BLUR' });

    if (input === 'a') {
      const step = steps[cursorIndex];
      if (step && step.status === 'active') {
        send({ type: 'START_ACTION' });
        onApprove?.(step.id);
        send({ type: 'COMPLETE' });
      }
    }
    if (input === 'r') {
      const step = steps[cursorIndex];
      if (step && step.status === 'active') {
        send({ type: 'START_ACTION' });
        onReject?.(step.id);
        send({ type: 'COMPLETE' });
      }
    }
  });

  if (orientation === 'horizontal') {
    return (
      <Box borderStyle="single" borderColor={isFocused ? 'cyan' : undefined}>
        {steps.map((step, i) => {
          const { icon, color } = STEP_ICONS[step.status] ?? STEP_ICONS.pending;
          const isCursor = i === cursorIndex && isFocused;
          return (
            <Box key={step.id}>
              <Text color={isCursor ? 'cyan' : color}>
                {icon} {step.label}
              </Text>
              {i < steps.length - 1 && (
                <Text color="gray"> {variant === 'parallel' ? ' | ' : ' \u2192 '} </Text>
              )}
            </Box>
          );
        })}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? 'cyan' : undefined}>
      <Box justifyContent="space-between">
        <Text bold>Approval Flow</Text>
        <Text color="gray">{status}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {steps.map((step, i) => {
          const { icon, color } = STEP_ICONS[step.status] ?? STEP_ICONS.pending;
          const isCursor = i === cursorIndex && isFocused;
          const isLast = i === steps.length - 1;
          const connector = variant === 'parallel' ? '\u2502' : '\u2502';

          return (
            <Box key={step.id} flexDirection="column">
              <Box>
                <Text color={isCursor ? 'cyan' : undefined}>
                  {isCursor ? '\u25B6 ' : '  '}
                </Text>
                <Text color={color}>{icon} </Text>
                <Text bold={step.status === 'active'}>{step.label}</Text>
                {showAssignee && step.assignee && (
                  <Text color="gray"> ({step.assignee})</Text>
                )}
              </Box>
              {showSLA && step.dueAt && step.status === 'active' && (
                <Box paddingLeft={4}>
                  <Text color="yellow">Due: {step.dueAt}</Text>
                </Box>
              )}
              {!isLast && (
                <Box paddingLeft={3}>
                  <Text color="gray">{connector}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {isFocused && (
        <Box marginTop={1}>
          <Text color="gray">
            [{'\u2191\u2193'}] Navigate
            {steps[cursorIndex]?.status === 'active' ? ' [a]pprove [r]eject' : ''}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default ApprovalStepper;
