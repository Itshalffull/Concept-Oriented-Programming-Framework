import { describe, it, expect } from 'vitest';
import {
  proofSessionTreeReducer,
  type ProofSessionTreeState,
  type ProofSessionTreeEvent,
} from '../../../vanilla/components/widgets/concepts/formal-verification/ProofSessionTree.ts';

describe('ProofSessionTree reducer', () => {
  it('starts in idle', () => {
    const state: ProofSessionTreeState = 'idle';
    expect(state).toBe('idle');
  });

  describe('idle state', () => {
    it('transitions to selected on SELECT', () => {
      expect(proofSessionTreeReducer('idle', { type: 'SELECT' })).toBe('selected');
    });

    it('stays idle on EXPAND', () => {
      expect(proofSessionTreeReducer('idle', { type: 'EXPAND' })).toBe('idle');
    });

    it('stays idle on COLLAPSE', () => {
      expect(proofSessionTreeReducer('idle', { type: 'COLLAPSE' })).toBe('idle');
    });

    it('ignores DESELECT in idle', () => {
      expect(proofSessionTreeReducer('idle', { type: 'DESELECT' })).toBe('idle');
    });

    it('ignores LOAD_CHILDREN in idle', () => {
      expect(proofSessionTreeReducer('idle', { type: 'LOAD_CHILDREN' })).toBe('idle');
    });

    it('ignores LOAD_COMPLETE in idle', () => {
      expect(proofSessionTreeReducer('idle', { type: 'LOAD_COMPLETE' })).toBe('idle');
    });
  });

  describe('selected state', () => {
    it('transitions to idle on DESELECT', () => {
      expect(proofSessionTreeReducer('selected', { type: 'DESELECT' })).toBe('idle');
    });

    it('stays selected on SELECT (reselect)', () => {
      expect(proofSessionTreeReducer('selected', { type: 'SELECT' })).toBe('selected');
    });

    it('ignores EXPAND in selected', () => {
      expect(proofSessionTreeReducer('selected', { type: 'EXPAND' })).toBe('selected');
    });

    it('ignores COLLAPSE in selected', () => {
      expect(proofSessionTreeReducer('selected', { type: 'COLLAPSE' })).toBe('selected');
    });

    it('ignores LOAD_CHILDREN in selected', () => {
      expect(proofSessionTreeReducer('selected', { type: 'LOAD_CHILDREN' })).toBe('selected');
    });
  });

  describe('ready state', () => {
    it('transitions to fetching on LOAD_CHILDREN', () => {
      expect(proofSessionTreeReducer('ready', { type: 'LOAD_CHILDREN' })).toBe('fetching');
    });

    it('ignores SELECT in ready', () => {
      expect(proofSessionTreeReducer('ready', { type: 'SELECT' })).toBe('ready');
    });

    it('ignores DESELECT in ready', () => {
      expect(proofSessionTreeReducer('ready', { type: 'DESELECT' })).toBe('ready');
    });
  });

  describe('fetching state', () => {
    it('transitions to ready on LOAD_COMPLETE', () => {
      expect(proofSessionTreeReducer('fetching', { type: 'LOAD_COMPLETE' })).toBe('ready');
    });

    it('transitions to ready on LOAD_ERROR', () => {
      expect(proofSessionTreeReducer('fetching', { type: 'LOAD_ERROR' })).toBe('ready');
    });

    it('ignores SELECT in fetching', () => {
      expect(proofSessionTreeReducer('fetching', { type: 'SELECT' })).toBe('fetching');
    });

    it('ignores LOAD_CHILDREN in fetching', () => {
      expect(proofSessionTreeReducer('fetching', { type: 'LOAD_CHILDREN' })).toBe('fetching');
    });
  });
});
