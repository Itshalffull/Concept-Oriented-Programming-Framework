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

import React, { useReducer } from 'react';
import { View, Text, Pressable } from 'react-native';

export interface ApprovalStepperProps {
  steps: unknown[];
  currentStep: string;
  status: string;
  assignee?: string | undefined;
  dueAt?: string | undefined;
  variant?: "sequential" | "parallel" | "mixed";
  orientation?: "horizontal" | "vertical";
  showSLA?: boolean;
  showAssignee?: boolean;
}

export function ApprovalStepper(props: ApprovalStepperProps) {
  const [state, send] = useReducer(approvalStepperReducer, 'viewing');

  return (
    <View
      accessibilityRole="none"
      accessibilityLabel="Multi-step approval flow visualization s"
      data-widget="approval-stepper"
      data-state={state}
    >
      <View>{/* stepList: Ordered list of approval steps */}</View>
      <View>{/* step: Single approval step with connector */}</View>
      <View>{/* stepIndicator: Numbered circle or status icon */}</View>
      <Text>{/* Step name or description */}</Text>
      <View>{/* stepAssignee: Assignee avatar and name */}</View>
    </View>
  );
}

export default ApprovalStepper;
