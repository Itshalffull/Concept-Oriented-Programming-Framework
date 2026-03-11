import { describe, it, expect } from 'vitest';
import {
  artifactPanelReducer,
  type ArtifactPanelState,
  type ArtifactPanelEvent,
} from '../../../vanilla/components/widgets/concepts/llm-conversation/ArtifactPanel.ts';

describe('ArtifactPanel reducer', () => {
  describe('open state', () => {
    const state: ArtifactPanelState = 'open';

    it('transitions to copied on COPY', () => {
      expect(artifactPanelReducer(state, { type: 'COPY' })).toBe('copied');
    });

    it('transitions to fullscreen on FULLSCREEN', () => {
      expect(artifactPanelReducer(state, { type: 'FULLSCREEN' })).toBe('fullscreen');
    });

    it('transitions to closed on CLOSE', () => {
      expect(artifactPanelReducer(state, { type: 'CLOSE' })).toBe('closed');
    });

    it('stays open on VERSION_CHANGE', () => {
      expect(artifactPanelReducer(state, { type: 'VERSION_CHANGE' })).toBe('open');
    });

    it('ignores COPY_TIMEOUT', () => {
      expect(artifactPanelReducer(state, { type: 'COPY_TIMEOUT' })).toBe('open');
    });

    it('ignores EXIT_FULLSCREEN', () => {
      expect(artifactPanelReducer(state, { type: 'EXIT_FULLSCREEN' })).toBe('open');
    });

    it('ignores OPEN', () => {
      expect(artifactPanelReducer(state, { type: 'OPEN' })).toBe('open');
    });
  });

  describe('copied state', () => {
    const state: ArtifactPanelState = 'copied';

    it('transitions to open on COPY_TIMEOUT', () => {
      expect(artifactPanelReducer(state, { type: 'COPY_TIMEOUT' })).toBe('open');
    });

    it('ignores COPY', () => {
      expect(artifactPanelReducer(state, { type: 'COPY' })).toBe('copied');
    });

    it('ignores CLOSE', () => {
      expect(artifactPanelReducer(state, { type: 'CLOSE' })).toBe('copied');
    });

    it('ignores FULLSCREEN', () => {
      expect(artifactPanelReducer(state, { type: 'FULLSCREEN' })).toBe('copied');
    });
  });

  describe('fullscreen state', () => {
    const state: ArtifactPanelState = 'fullscreen';

    it('transitions to open on EXIT_FULLSCREEN', () => {
      expect(artifactPanelReducer(state, { type: 'EXIT_FULLSCREEN' })).toBe('open');
    });

    it('transitions to closed on CLOSE', () => {
      expect(artifactPanelReducer(state, { type: 'CLOSE' })).toBe('closed');
    });

    it('ignores COPY', () => {
      expect(artifactPanelReducer(state, { type: 'COPY' })).toBe('fullscreen');
    });

    it('ignores OPEN', () => {
      expect(artifactPanelReducer(state, { type: 'OPEN' })).toBe('fullscreen');
    });
  });

  describe('closed state', () => {
    const state: ArtifactPanelState = 'closed';

    it('transitions to open on OPEN', () => {
      expect(artifactPanelReducer(state, { type: 'OPEN' })).toBe('open');
    });

    it('ignores COPY', () => {
      expect(artifactPanelReducer(state, { type: 'COPY' })).toBe('closed');
    });

    it('ignores CLOSE', () => {
      expect(artifactPanelReducer(state, { type: 'CLOSE' })).toBe('closed');
    });

    it('ignores FULLSCREEN', () => {
      expect(artifactPanelReducer(state, { type: 'FULLSCREEN' })).toBe('closed');
    });
  });

  describe('full cycle tests', () => {
    it('open -> copied -> open', () => {
      let s: ArtifactPanelState = 'open';
      s = artifactPanelReducer(s, { type: 'COPY' });
      expect(s).toBe('copied');
      s = artifactPanelReducer(s, { type: 'COPY_TIMEOUT' });
      expect(s).toBe('open');
    });

    it('open -> fullscreen -> open -> closed -> open', () => {
      let s: ArtifactPanelState = 'open';
      s = artifactPanelReducer(s, { type: 'FULLSCREEN' });
      expect(s).toBe('fullscreen');
      s = artifactPanelReducer(s, { type: 'EXIT_FULLSCREEN' });
      expect(s).toBe('open');
      s = artifactPanelReducer(s, { type: 'CLOSE' });
      expect(s).toBe('closed');
      s = artifactPanelReducer(s, { type: 'OPEN' });
      expect(s).toBe('open');
    });

    it('fullscreen -> closed -> open', () => {
      let s: ArtifactPanelState = 'fullscreen';
      s = artifactPanelReducer(s, { type: 'CLOSE' });
      expect(s).toBe('closed');
      s = artifactPanelReducer(s, { type: 'OPEN' });
      expect(s).toBe('open');
    });
  });
});
