import { describe, it, expect } from 'vitest';
import {
  delegationGraphReducer,
  type DelegationGraphState,
  type DelegationGraphEvent,
} from '../../../vanilla/components/widgets/concepts/governance-structure/DelegationGraph.ts';

describe('DelegationGraph reducer', () => {
  it('starts in browsing', () => {
    const state: DelegationGraphState = 'browsing';
    expect(state).toBe('browsing');
  });

  describe('browsing state', () => {
    it('transitions to searching on SEARCH', () => {
      expect(delegationGraphReducer('browsing', { type: 'SEARCH', query: 'alice' })).toBe('searching');
    });

    it('transitions to selected on SELECT_DELEGATE', () => {
      expect(delegationGraphReducer('browsing', { type: 'SELECT_DELEGATE', id: 'd1' })).toBe('selected');
    });

    it('stays browsing on SWITCH_VIEW', () => {
      expect(delegationGraphReducer('browsing', { type: 'SWITCH_VIEW' })).toBe('browsing');
    });

    it('ignores CLEAR_SEARCH in browsing', () => {
      expect(delegationGraphReducer('browsing', { type: 'CLEAR_SEARCH' })).toBe('browsing');
    });

    it('ignores DESELECT in browsing', () => {
      expect(delegationGraphReducer('browsing', { type: 'DESELECT' })).toBe('browsing');
    });

    it('ignores DELEGATE in browsing', () => {
      expect(delegationGraphReducer('browsing', { type: 'DELEGATE' })).toBe('browsing');
    });
  });

  describe('searching state', () => {
    it('transitions to browsing on CLEAR_SEARCH', () => {
      expect(delegationGraphReducer('searching', { type: 'CLEAR_SEARCH' })).toBe('browsing');
    });

    it('transitions to selected on SELECT_DELEGATE', () => {
      expect(delegationGraphReducer('searching', { type: 'SELECT_DELEGATE', id: 'd1' })).toBe('selected');
    });

    it('ignores SEARCH in searching', () => {
      expect(delegationGraphReducer('searching', { type: 'SEARCH', query: 'bob' })).toBe('searching');
    });

    it('ignores SWITCH_VIEW in searching', () => {
      expect(delegationGraphReducer('searching', { type: 'SWITCH_VIEW' })).toBe('searching');
    });

    it('ignores DESELECT in searching', () => {
      expect(delegationGraphReducer('searching', { type: 'DESELECT' })).toBe('searching');
    });
  });

  describe('selected state', () => {
    it('transitions to browsing on DESELECT', () => {
      expect(delegationGraphReducer('selected', { type: 'DESELECT' })).toBe('browsing');
    });

    it('transitions to delegating on DELEGATE', () => {
      expect(delegationGraphReducer('selected', { type: 'DELEGATE' })).toBe('delegating');
    });

    it('transitions to undelegating on UNDELEGATE', () => {
      expect(delegationGraphReducer('selected', { type: 'UNDELEGATE' })).toBe('undelegating');
    });

    it('ignores SEARCH in selected', () => {
      expect(delegationGraphReducer('selected', { type: 'SEARCH', query: 'x' })).toBe('selected');
    });

    it('ignores SELECT_DELEGATE in selected', () => {
      expect(delegationGraphReducer('selected', { type: 'SELECT_DELEGATE', id: 'd2' })).toBe('selected');
    });

    it('ignores SWITCH_VIEW in selected', () => {
      expect(delegationGraphReducer('selected', { type: 'SWITCH_VIEW' })).toBe('selected');
    });
  });

  describe('delegating state', () => {
    it('transitions to browsing on DELEGATE_COMPLETE', () => {
      expect(delegationGraphReducer('delegating', { type: 'DELEGATE_COMPLETE' })).toBe('browsing');
    });

    it('transitions to selected on DELEGATE_ERROR', () => {
      expect(delegationGraphReducer('delegating', { type: 'DELEGATE_ERROR' })).toBe('selected');
    });

    it('ignores DESELECT in delegating', () => {
      expect(delegationGraphReducer('delegating', { type: 'DESELECT' })).toBe('delegating');
    });

    it('ignores DELEGATE in delegating', () => {
      expect(delegationGraphReducer('delegating', { type: 'DELEGATE' })).toBe('delegating');
    });
  });

  describe('undelegating state', () => {
    it('transitions to browsing on UNDELEGATE_COMPLETE', () => {
      expect(delegationGraphReducer('undelegating', { type: 'UNDELEGATE_COMPLETE' })).toBe('browsing');
    });

    it('transitions to selected on UNDELEGATE_ERROR', () => {
      expect(delegationGraphReducer('undelegating', { type: 'UNDELEGATE_ERROR' })).toBe('selected');
    });

    it('ignores DESELECT in undelegating', () => {
      expect(delegationGraphReducer('undelegating', { type: 'DESELECT' })).toBe('undelegating');
    });

    it('ignores UNDELEGATE in undelegating', () => {
      expect(delegationGraphReducer('undelegating', { type: 'UNDELEGATE' })).toBe('undelegating');
    });
  });
});
