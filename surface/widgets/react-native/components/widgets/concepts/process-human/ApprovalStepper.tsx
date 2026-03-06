export type ApprovalStepperState = 'viewing' | 'stepFocused' | 'acting';
export type ApprovalStepperEvent =
  | { type: 'FOCUS_STEP'; id?: string }
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

import React, { forwardRef, useCallback, useReducer, useState, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';

export interface ApprovalStep {
  id: string;
  label: string;
  approver?: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped' | 'active';
  timestamp?: string;
  quorumRequired?: number;
  quorumCurrent?: number;
}

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
  onDelegate?: (stepId: string) => void;
  onClaim?: (stepId: string) => void;
  children?: ReactNode;
}

function stepStatusIcon(status: ApprovalStep['status']): string {
  switch (status) {
    case 'approved': return '\u2713';
    case 'rejected': return '\u2717';
    case 'skipped': return '\u2014';
    case 'active': return '\u25CF';
    case 'pending':
    default: return '\u25CB';
  }
}

const STEP_COLORS: Record<string, string> = {
  approved: '#22c55e',
  rejected: '#dc2626',
  active: '#3b82f6',
  pending: '#d1d5db',
  skipped: '#9ca3af',
};

function connectorColor(prevStatus: ApprovalStep['status']): string {
  switch (prevStatus) {
    case 'approved': return '#22c55e';
    case 'rejected': return '#dc2626';
    case 'active': return '#3b82f6';
    default: return '#d1d5db';
  }
}

function formatTimeRemaining(dueAt: string): string {
  const now = Date.now();
  const due = new Date(dueAt).getTime();
  const diff = due - now;
  if (diff <= 0) return 'Overdue';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const ApprovalStepper = forwardRef<View, ApprovalStepperProps>(function ApprovalStepper(
  {
    steps,
    currentStep,
    status,
    assignee,
    dueAt,
    variant = 'sequential',
    orientation = 'horizontal',
    showSLA = true,
    showAssignee = true,
    onApprove,
    onReject,
    onDelegate,
    onClaim,
    children,
  },
  ref,
) {
  const [state, send] = useReducer(approvalStepperReducer, 'viewing');
  const [focusedStepId, setFocusedStepId] = useState<string | null>(null);
  const [actingStepId, setActingStepId] = useState<string | null>(null);

  const handleFocusStep = useCallback((id: string) => {
    setFocusedStepId(id);
    send({ type: 'FOCUS_STEP', id });
  }, []);

  const handleStartAction = useCallback((stepId: string) => {
    setActingStepId(stepId);
    send({ type: 'START_ACTION' });
  }, []);

  const handleApprove = useCallback((stepId: string) => {
    onApprove?.(stepId);
    send({ type: 'COMPLETE' });
    setActingStepId(null);
  }, [onApprove]);

  const handleReject = useCallback((stepId: string) => {
    onReject?.(stepId);
    send({ type: 'COMPLETE' });
    setActingStepId(null);
  }, [onReject]);

  const handleDelegate = useCallback((stepId: string) => {
    onDelegate?.(stepId);
    send({ type: 'COMPLETE' });
    setActingStepId(null);
  }, [onDelegate]);

  const handleCancelAction = useCallback(() => {
    send({ type: 'CANCEL' });
    setActingStepId(null);
  }, []);

  const isHorizontal = orientation === 'horizontal';

  return (
    <View ref={ref} testID="approval-stepper" accessibilityRole="list" accessibilityLabel="Approval steps" style={s.root}>
      <ScrollView horizontal={isHorizontal} showsHorizontalScrollIndicator={false}>
        <View style={isHorizontal ? s.stepListH : s.stepListV}>
          {steps.map((step, index) => {
            const isCurrent = step.id === currentStep;
            const isActing = actingStepId === step.id && state === 'acting';
            const showConnector = index < steps.length - 1;

            return (
              <View key={step.id} style={isHorizontal ? s.stepWrapperH : s.stepWrapperV}>
                <Pressable
                  onPress={() => handleFocusStep(step.id)}
                  onLongPress={() => {
                    if (isCurrent || step.status === 'active') handleStartAction(step.id);
                  }}
                  accessibilityRole="none"
                  accessibilityLabel={`Step ${index + 1}: ${step.label} \u2014 ${step.status}`}
                  style={[s.step, isCurrent && s.stepCurrent]}
                >
                  {/* Indicator */}
                  <View style={[s.indicator, { backgroundColor: STEP_COLORS[step.status] ?? '#d1d5db' }]}>
                    <Text style={s.indicatorText}>
                      {step.status === 'pending' || step.status === 'active' ? String(index + 1) : stepStatusIcon(step.status)}
                    </Text>
                  </View>

                  {/* Label */}
                  <Text style={s.stepLabel}>{step.label}</Text>

                  {/* Assignee */}
                  {showAssignee && step.approver && (
                    <Text style={s.approverText}>{step.approver}</Text>
                  )}

                  {/* Status badge */}
                  <View style={[s.statusBadge, { backgroundColor: STEP_COLORS[step.status] ?? '#d1d5db' }]}>
                    <Text style={s.statusBadgeText}>{step.status}</Text>
                  </View>

                  {/* Quorum */}
                  {variant !== 'sequential' && step.quorumRequired != null && (
                    <Text style={s.quorumText} accessibilityLabel={`${step.quorumCurrent ?? 0} of ${step.quorumRequired} approvals`}>
                      {step.quorumCurrent ?? 0}/{step.quorumRequired}
                    </Text>
                  )}

                  {/* Timestamp */}
                  {step.timestamp && <Text style={s.timestampText}>{step.timestamp}</Text>}
                </Pressable>

                {/* Action bar */}
                {isActing && (
                  <View style={s.actionBar} accessibilityRole="toolbar" accessibilityLabel="Approval actions">
                    <Pressable onPress={() => handleApprove(step.id)} accessibilityRole="button" accessibilityLabel={`Approve step: ${step.label}`} style={s.approveBtn}>
                      <Text style={s.actionBtnText}>Approve</Text>
                    </Pressable>
                    <Pressable onPress={() => handleReject(step.id)} accessibilityRole="button" accessibilityLabel={`Reject step: ${step.label}`} style={s.rejectBtn}>
                      <Text style={s.actionBtnText}>Reject</Text>
                    </Pressable>
                    <Pressable onPress={() => handleDelegate(step.id)} accessibilityRole="button" accessibilityLabel={`Delegate step: ${step.label}`} style={s.delegateBtn}>
                      <Text style={s.actionBtnText}>Delegate</Text>
                    </Pressable>
                    <Pressable onPress={handleCancelAction} accessibilityRole="button" accessibilityLabel="Cancel" style={s.cancelBtn}>
                      <Text style={s.cancelBtnText}>Cancel</Text>
                    </Pressable>
                  </View>
                )}

                {/* Connector */}
                {showConnector && (
                  <View style={[
                    isHorizontal ? s.connectorH : s.connectorV,
                    { backgroundColor: connectorColor(step.status) },
                  ]} />
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* SLA indicator */}
      {showSLA && dueAt && (
        <View style={s.slaIndicator} accessibilityRole="timer" accessibilityLabel="Time remaining">
          <Text style={s.slaLabel}>SLA: </Text>
          <Text style={[s.slaCountdown, new Date(dueAt).getTime() < Date.now() && s.slaOverdue]}>
            {formatTimeRemaining(dueAt)}
          </Text>
        </View>
      )}

      {children}
    </View>
  );
});

const s = StyleSheet.create({
  root: { padding: 12 },
  stepListH: { flexDirection: 'row', alignItems: 'flex-start' },
  stepListV: { flexDirection: 'column' },
  stepWrapperH: { flexDirection: 'row', alignItems: 'center' },
  stepWrapperV: { flexDirection: 'column' },
  step: { alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6 },
  stepCurrent: { backgroundColor: '#eff6ff', borderRadius: 8 },
  indicator: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  indicatorText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  stepLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 2 },
  approverText: { fontSize: 11, color: '#6b7280' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, marginTop: 2 },
  statusBadgeText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  quorumText: { fontSize: 11, color: '#6366f1', fontWeight: '600', marginTop: 2 },
  timestampText: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
  connectorH: { width: 24, height: 2, marginHorizontal: -4 },
  connectorV: { width: 2, height: 16, alignSelf: 'center', marginVertical: 2 },
  actionBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, justifyContent: 'center' },
  approveBtn: { backgroundColor: '#22c55e', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4 },
  rejectBtn: { backgroundColor: '#dc2626', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4 },
  delegateBtn: { backgroundColor: '#6366f1', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4 },
  cancelBtn: { backgroundColor: '#f3f4f6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4 },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  cancelBtnText: { color: '#374151', fontSize: 12, fontWeight: '600' },
  slaIndicator: { flexDirection: 'row', marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  slaLabel: { fontSize: 13, color: '#6b7280' },
  slaCountdown: { fontSize: 13, fontWeight: '700', color: '#374151' },
  slaOverdue: { color: '#dc2626' },
});

ApprovalStepper.displayName = 'ApprovalStepper';
export { ApprovalStepper };
export default ApprovalStepper;
