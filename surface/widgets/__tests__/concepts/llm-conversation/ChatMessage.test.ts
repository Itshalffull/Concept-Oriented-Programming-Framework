import { describe, it, expect } from 'vitest';
import {
  chatMessageReducer,
  type ChatMessageState,
} from '../../../vanilla/components/widgets/concepts/llm-conversation/ChatMessage.ts';

describe('ChatMessage reducer', () => {
  describe('idle state', () => {
    const state: ChatMessageState = 'idle';

    it('transitions to hovered on HOVER', () => {
      expect(chatMessageReducer(state, { type: 'HOVER' })).toBe('hovered');
    });

    it('transitions to copied on COPY', () => {
      expect(chatMessageReducer(state, { type: 'COPY' })).toBe('copied');
    });

    it('ignores LEAVE', () => {
      expect(chatMessageReducer(state, { type: 'LEAVE' })).toBe('idle');
    });

    it('ignores STREAM_START', () => {
      expect(chatMessageReducer(state, { type: 'STREAM_START' })).toBe('idle');
    });

    it('ignores COPY_TIMEOUT', () => {
      expect(chatMessageReducer(state, { type: 'COPY_TIMEOUT' })).toBe('idle');
    });
  });

  describe('hovered state', () => {
    const state: ChatMessageState = 'hovered';

    it('transitions to idle on LEAVE', () => {
      expect(chatMessageReducer(state, { type: 'LEAVE' })).toBe('idle');
    });

    it('transitions to copied on COPY', () => {
      expect(chatMessageReducer(state, { type: 'COPY' })).toBe('copied');
    });

    it('ignores HOVER', () => {
      expect(chatMessageReducer(state, { type: 'HOVER' })).toBe('hovered');
    });

    it('ignores STREAM_START', () => {
      expect(chatMessageReducer(state, { type: 'STREAM_START' })).toBe('hovered');
    });
  });

  describe('copied state', () => {
    const state: ChatMessageState = 'copied';

    it('transitions to idle on COPY_TIMEOUT', () => {
      expect(chatMessageReducer(state, { type: 'COPY_TIMEOUT' })).toBe('idle');
    });

    it('ignores COPY', () => {
      expect(chatMessageReducer(state, { type: 'COPY' })).toBe('copied');
    });

    it('ignores HOVER', () => {
      expect(chatMessageReducer(state, { type: 'HOVER' })).toBe('copied');
    });

    it('ignores LEAVE', () => {
      expect(chatMessageReducer(state, { type: 'LEAVE' })).toBe('copied');
    });
  });

  describe('full cycle tests', () => {
    it('idle -> hovered -> idle', () => {
      let s: ChatMessageState = 'idle';
      s = chatMessageReducer(s, { type: 'HOVER' });
      expect(s).toBe('hovered');
      s = chatMessageReducer(s, { type: 'LEAVE' });
      expect(s).toBe('idle');
    });

    it('idle -> hovered -> copied -> idle', () => {
      let s: ChatMessageState = 'idle';
      s = chatMessageReducer(s, { type: 'HOVER' });
      s = chatMessageReducer(s, { type: 'COPY' });
      expect(s).toBe('copied');
      s = chatMessageReducer(s, { type: 'COPY_TIMEOUT' });
      expect(s).toBe('idle');
    });

    it('idle -> copied -> idle -> hovered', () => {
      let s: ChatMessageState = 'idle';
      s = chatMessageReducer(s, { type: 'COPY' });
      expect(s).toBe('copied');
      s = chatMessageReducer(s, { type: 'COPY_TIMEOUT' });
      expect(s).toBe('idle');
      s = chatMessageReducer(s, { type: 'HOVER' });
      expect(s).toBe('hovered');
    });
  });
});
