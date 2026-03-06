import { describe, it, expect } from 'vitest';
import {
  approvalStepperReducer,
  type ApprovalStepperState,
} from '../../../vanilla/components/widgets/concepts/process-human/ApprovalStepper.ts';

describe('ApprovalStepper reducer', () => {
  describe('viewing state', () => {
    const state: ApprovalStepperState = 'viewing';

    it('transitions to stepFocused on FOCUS_STEP', () => {
      expect(approvalStepperReducer(state, { type: 'FOCUS_STEP' })).toBe('stepFocused');
    });

    it('transitions to acting on START_ACTION', () => {
      expect(approvalStepperReducer(state, { type: 'START_ACTION' })).toBe('acting');
    });

    it('ignores BLUR', () => {
      expect(approvalStepperReducer(state, { type: 'BLUR' })).toBe('viewing');
    });

    it('ignores COMPLETE', () => {
      expect(approvalStepperReducer(state, { type: 'COMPLETE' })).toBe('viewing');
    });

    it('ignores CANCEL', () => {
      expect(approvalStepperReducer(state, { type: 'CANCEL' })).toBe('viewing');
    });
  });

  describe('stepFocused state', () => {
    const state: ApprovalStepperState = 'stepFocused';

    it('transitions to viewing on BLUR', () => {
      expect(approvalStepperReducer(state, { type: 'BLUR' })).toBe('viewing');
    });

    it('transitions to acting on START_ACTION', () => {
      expect(approvalStepperReducer(state, { type: 'START_ACTION' })).toBe('acting');
    });

    it('ignores FOCUS_STEP', () => {
      expect(approvalStepperReducer(state, { type: 'FOCUS_STEP' })).toBe('stepFocused');
    });

    it('ignores COMPLETE', () => {
      expect(approvalStepperReducer(state, { type: 'COMPLETE' })).toBe('stepFocused');
    });

    it('ignores CANCEL', () => {
      expect(approvalStepperReducer(state, { type: 'CANCEL' })).toBe('stepFocused');
    });
  });

  describe('acting state', () => {
    const state: ApprovalStepperState = 'acting';

    it('transitions to viewing on COMPLETE', () => {
      expect(approvalStepperReducer(state, { type: 'COMPLETE' })).toBe('viewing');
    });

    it('transitions to viewing on CANCEL', () => {
      expect(approvalStepperReducer(state, { type: 'CANCEL' })).toBe('viewing');
    });

    it('ignores FOCUS_STEP', () => {
      expect(approvalStepperReducer(state, { type: 'FOCUS_STEP' })).toBe('acting');
    });

    it('ignores START_ACTION', () => {
      expect(approvalStepperReducer(state, { type: 'START_ACTION' })).toBe('acting');
    });

    it('ignores BLUR', () => {
      expect(approvalStepperReducer(state, { type: 'BLUR' })).toBe('acting');
    });
  });

  describe('full cycle tests', () => {
    it('viewing -> stepFocused -> viewing', () => {
      let s: ApprovalStepperState = 'viewing';
      s = approvalStepperReducer(s, { type: 'FOCUS_STEP' });
      expect(s).toBe('stepFocused');
      s = approvalStepperReducer(s, { type: 'BLUR' });
      expect(s).toBe('viewing');
    });

    it('viewing -> acting -> viewing (complete)', () => {
      let s: ApprovalStepperState = 'viewing';
      s = approvalStepperReducer(s, { type: 'START_ACTION' });
      expect(s).toBe('acting');
      s = approvalStepperReducer(s, { type: 'COMPLETE' });
      expect(s).toBe('viewing');
    });

    it('viewing -> stepFocused -> acting -> viewing (cancel)', () => {
      let s: ApprovalStepperState = 'viewing';
      s = approvalStepperReducer(s, { type: 'FOCUS_STEP' });
      expect(s).toBe('stepFocused');
      s = approvalStepperReducer(s, { type: 'START_ACTION' });
      expect(s).toBe('acting');
      s = approvalStepperReducer(s, { type: 'CANCEL' });
      expect(s).toBe('viewing');
    });
  });
});
