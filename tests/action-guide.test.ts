// ============================================================
// ActionGuide Handler Tests
//
// Workflow sequencing and rendering for concept actions across
// interface targets. See Architecture doc Section 1.8.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  actionGuideHandler,
  resetActionGuideCounter,
} from '../handlers/ts/action-guide.handler.js';

describe('ActionGuide', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetActionGuideCounter();
  });

  describe('define', () => {
    it('defines a workflow with ordered steps', async () => {
      const result = await actionGuideHandler.define!(
        {
          concept: 'Todo',
          steps: ['add', 'complete', 'remove'],
          content: '{}',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.workflow).toBe('action-guide-1');
      expect(result.stepCount).toBe(3);
    });

    it('returns emptySteps when steps array is empty', async () => {
      const result = await actionGuideHandler.define!(
        { concept: 'Todo', steps: [], content: '{}' },
        storage,
      );
      expect(result.variant).toBe('emptySteps');
    });

    it('stores the workflow in storage', async () => {
      await actionGuideHandler.define!(
        { concept: 'Auth', steps: ['login', 'logout'], content: '{}' },
        storage,
      );
      const stored = await storage.get('action-guide', 'action-guide-1');
      expect(stored).not.toBeNull();
      expect(stored!.concept).toBe('Auth');
    });
  });

  describe('render', () => {
    it('renders in skill-md format', async () => {
      await actionGuideHandler.define!(
        { concept: 'Todo', steps: ['add', 'complete'], content: '{}' },
        storage,
      );
      const result = await actionGuideHandler.render!(
        { workflow: 'action-guide-1', format: 'skill-md' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const content = result.content as string;
      expect(content).toContain('# Action Guide: Todo');
      expect(content).toContain('1. **add**');
      expect(content).toContain('2. **complete**');
    });

    it('renders in cli-help format', async () => {
      await actionGuideHandler.define!(
        { concept: 'Auth', steps: ['login', 'logout'], content: '{}' },
        storage,
      );
      const result = await actionGuideHandler.render!(
        { workflow: 'action-guide-1', format: 'cli-help' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const content = result.content as string;
      expect(content).toContain('Action Guide: Auth');
      expect(content).toContain('Steps:');
    });

    it('renders in rest-guide format', async () => {
      await actionGuideHandler.define!(
        { concept: 'User', steps: ['create', 'update'], content: '{}' },
        storage,
      );
      const result = await actionGuideHandler.render!(
        { workflow: 'action-guide-1', format: 'rest-guide' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const content = result.content as string;
      expect(content).toContain('# User REST Guide');
    });

    it('renders in generic format', async () => {
      await actionGuideHandler.define!(
        { concept: 'Item', steps: ['fetch'], content: '{}' },
        storage,
      );
      const result = await actionGuideHandler.render!(
        { workflow: 'action-guide-1', format: 'generic' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const content = result.content as string;
      expect(content).toContain('Action Guide: Item');
      expect(content).toContain('Step 1: fetch');
    });

    it('returns unknownFormat for unsupported format', async () => {
      await actionGuideHandler.define!(
        { concept: 'X', steps: ['a'], content: '{}' },
        storage,
      );
      const result = await actionGuideHandler.render!(
        { workflow: 'action-guide-1', format: 'unsupported' },
        storage,
      );
      expect(result.variant).toBe('unknownFormat');
    });

    it('renders decoration content from JSON', async () => {
      const decorations = JSON.stringify({
        'design-principles': [
          { title: 'DRY', rule: 'Do not repeat yourself' },
        ],
        'anti-patterns': ['global mutable state'],
      });
      await actionGuideHandler.define!(
        { concept: 'Code', steps: ['write', 'review'], content: decorations },
        storage,
      );
      const result = await actionGuideHandler.render!(
        { workflow: 'action-guide-1', format: 'skill-md' },
        storage,
      );
      const content = result.content as string;
      expect(content).toContain('Design Principles');
      expect(content).toContain('DRY');
    });
  });
});
