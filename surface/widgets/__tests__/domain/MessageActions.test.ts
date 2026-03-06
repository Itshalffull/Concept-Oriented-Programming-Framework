import { describe, it, expect } from 'vitest';
import {
  messageActionsReducer,
  type MessageActionsState,
} from '../../vanilla/components/widgets/domain/MessageActions.ts';

describe('MessageActions reducer', () => {
  describe('hidden state', () => {
    const state: MessageActionsState = 'hidden';

    it('transitions to visible on SHOW', () => {
      expect(messageActionsReducer(state, { type: 'SHOW' })).toBe('visible');
    });

    it('ignores HIDE', () => {
      expect(messageActionsReducer(state, { type: 'HIDE' })).toBe('hidden');
    });

    it('ignores COPY', () => {
      expect(messageActionsReducer(state, { type: 'COPY' })).toBe('hidden');
    });

    it('ignores COPY_TIMEOUT', () => {
      expect(messageActionsReducer(state, { type: 'COPY_TIMEOUT' })).toBe('hidden');
    });
  });

  describe('visible state', () => {
    const state: MessageActionsState = 'visible';

    it('transitions to hidden on HIDE', () => {
      expect(messageActionsReducer(state, { type: 'HIDE' })).toBe('hidden');
    });

    it('transitions to copied on COPY', () => {
      expect(messageActionsReducer(state, { type: 'COPY' })).toBe('copied');
    });

    it('ignores SHOW', () => {
      expect(messageActionsReducer(state, { type: 'SHOW' })).toBe('visible');
    });

    it('ignores COPY_TIMEOUT', () => {
      expect(messageActionsReducer(state, { type: 'COPY_TIMEOUT' })).toBe('visible');
    });
  });

  describe('copied state', () => {
    const state: MessageActionsState = 'copied';

    it('transitions to visible on COPY_TIMEOUT', () => {
      expect(messageActionsReducer(state, { type: 'COPY_TIMEOUT' })).toBe('visible');
    });

    it('ignores SHOW', () => {
      expect(messageActionsReducer(state, { type: 'SHOW' })).toBe('copied');
    });

    it('ignores HIDE', () => {
      expect(messageActionsReducer(state, { type: 'HIDE' })).toBe('copied');
    });

    it('ignores COPY', () => {
      expect(messageActionsReducer(state, { type: 'COPY' })).toBe('copied');
    });
  });

  describe('full cycle tests', () => {
    it('hidden -> visible -> hidden', () => {
      let s: MessageActionsState = 'hidden';
      s = messageActionsReducer(s, { type: 'SHOW' });
      expect(s).toBe('visible');
      s = messageActionsReducer(s, { type: 'HIDE' });
      expect(s).toBe('hidden');
    });

    it('hidden -> visible -> copied -> visible -> hidden', () => {
      let s: MessageActionsState = 'hidden';
      s = messageActionsReducer(s, { type: 'SHOW' });
      s = messageActionsReducer(s, { type: 'COPY' });
      expect(s).toBe('copied');
      s = messageActionsReducer(s, { type: 'COPY_TIMEOUT' });
      expect(s).toBe('visible');
      s = messageActionsReducer(s, { type: 'HIDE' });
      expect(s).toBe('hidden');
    });
  });
});
