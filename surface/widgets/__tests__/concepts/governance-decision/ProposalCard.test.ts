import { describe, it, expect } from 'vitest';
import {
  proposalCardReducer,
  type ProposalCardState,
  type ProposalCardEvent,
} from '../../../vanilla/components/widgets/concepts/governance-decision/ProposalCard.ts';

describe('ProposalCard reducer', () => {
  it('starts in idle', () => {
    const state: ProposalCardState = 'idle';
    expect(state).toBe('idle');
  });

  describe('idle state', () => {
    it('transitions to hovered on HOVER', () => {
      expect(proposalCardReducer('idle', { type: 'HOVER' })).toBe('hovered');
    });

    it('transitions to focused on FOCUS', () => {
      expect(proposalCardReducer('idle', { type: 'FOCUS' })).toBe('focused');
    });

    it('transitions to navigating on CLICK', () => {
      expect(proposalCardReducer('idle', { type: 'CLICK' })).toBe('navigating');
    });

    it('ignores UNHOVER in idle', () => {
      expect(proposalCardReducer('idle', { type: 'UNHOVER' })).toBe('idle');
    });

    it('ignores BLUR in idle', () => {
      expect(proposalCardReducer('idle', { type: 'BLUR' })).toBe('idle');
    });

    it('ignores ENTER in idle', () => {
      expect(proposalCardReducer('idle', { type: 'ENTER' })).toBe('idle');
    });

    it('ignores NAVIGATE_COMPLETE in idle', () => {
      expect(proposalCardReducer('idle', { type: 'NAVIGATE_COMPLETE' })).toBe('idle');
    });
  });

  describe('hovered state', () => {
    it('transitions to idle on UNHOVER', () => {
      expect(proposalCardReducer('hovered', { type: 'UNHOVER' })).toBe('idle');
    });

    it('ignores HOVER in hovered', () => {
      expect(proposalCardReducer('hovered', { type: 'HOVER' })).toBe('hovered');
    });

    it('ignores CLICK in hovered', () => {
      expect(proposalCardReducer('hovered', { type: 'CLICK' })).toBe('hovered');
    });

    it('ignores FOCUS in hovered', () => {
      expect(proposalCardReducer('hovered', { type: 'FOCUS' })).toBe('hovered');
    });
  });

  describe('focused state', () => {
    it('transitions to idle on BLUR', () => {
      expect(proposalCardReducer('focused', { type: 'BLUR' })).toBe('idle');
    });

    it('transitions to navigating on CLICK', () => {
      expect(proposalCardReducer('focused', { type: 'CLICK' })).toBe('navigating');
    });

    it('transitions to navigating on ENTER', () => {
      expect(proposalCardReducer('focused', { type: 'ENTER' })).toBe('navigating');
    });

    it('ignores HOVER in focused', () => {
      expect(proposalCardReducer('focused', { type: 'HOVER' })).toBe('focused');
    });

    it('ignores UNHOVER in focused', () => {
      expect(proposalCardReducer('focused', { type: 'UNHOVER' })).toBe('focused');
    });
  });

  describe('navigating state', () => {
    it('transitions to idle on NAVIGATE_COMPLETE', () => {
      expect(proposalCardReducer('navigating', { type: 'NAVIGATE_COMPLETE' })).toBe('idle');
    });

    it('ignores HOVER in navigating', () => {
      expect(proposalCardReducer('navigating', { type: 'HOVER' })).toBe('navigating');
    });

    it('ignores CLICK in navigating', () => {
      expect(proposalCardReducer('navigating', { type: 'CLICK' })).toBe('navigating');
    });

    it('ignores BLUR in navigating', () => {
      expect(proposalCardReducer('navigating', { type: 'BLUR' })).toBe('navigating');
    });
  });
});
