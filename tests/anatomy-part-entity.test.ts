// ============================================================
// AnatomyPartEntity Handler Tests
//
// Tests for anatomy-part-entity: registration, retrieval,
// role-based queries, field/action binding lookups.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  anatomyPartEntityHandler,
  resetAnatomyPartEntityCounter,
} from '../handlers/ts/anatomy-part-entity.handler.js';

describe('AnatomyPartEntity Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetAnatomyPartEntityCounter();
  });

  // ----------------------------------------------------------
  // register
  // ----------------------------------------------------------

  describe('register', () => {
    it('registers a new anatomy part and returns ok', async () => {
      const result = await anatomyPartEntityHandler.register(
        { widget: 'Button', name: 'root', role: 'container', required: 'true' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.part).toBe('anatomy-part-entity-1');
    });

    it('stores the part with correct symbol and defaults', async () => {
      await anatomyPartEntityHandler.register(
        { widget: 'Button', name: 'label', role: 'text', required: 'false' },
        storage,
      );
      const record = await storage.get('anatomy-part-entity', 'anatomy-part-entity-1');
      expect(record).not.toBeNull();
      expect(record!.symbol).toBe('clef/anatomy/Button/label');
      expect(record!.semanticRole).toBe('text');
      expect(record!.connectProps).toBe('[]');
      expect(record!.boundField).toBe('');
      expect(record!.boundAction).toBe('');
    });

    it('allows multiple parts on the same widget', async () => {
      const a = await anatomyPartEntityHandler.register(
        { widget: 'Button', name: 'root', role: 'container', required: 'true' },
        storage,
      );
      const b = await anatomyPartEntityHandler.register(
        { widget: 'Button', name: 'icon', role: 'decoration', required: 'false' },
        storage,
      );
      expect(a.part).not.toBe(b.part);
    });
  });

  // ----------------------------------------------------------
  // get
  // ----------------------------------------------------------

  describe('get', () => {
    it('returns the part details after registration', async () => {
      const reg = await anatomyPartEntityHandler.register(
        { widget: 'Button', name: 'root', role: 'container', required: 'true' },
        storage,
      );
      const result = await anatomyPartEntityHandler.get({ part: reg.part }, storage);
      expect(result.variant).toBe('ok');
      expect(result.widget).toBe('Button');
      expect(result.name).toBe('root');
      expect(result.semanticRole).toBe('container');
      expect(result.required).toBe('true');
    });

    it('returns notfound for a nonexistent part', async () => {
      const result = await anatomyPartEntityHandler.get({ part: 'nope' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // findByRole
  // ----------------------------------------------------------

  describe('findByRole', () => {
    it('returns parts matching the given role', async () => {
      await anatomyPartEntityHandler.register(
        { widget: 'Button', name: 'root', role: 'container', required: 'true' },
        storage,
      );
      await anatomyPartEntityHandler.register(
        { widget: 'Card', name: 'wrapper', role: 'container', required: 'true' },
        storage,
      );
      await anatomyPartEntityHandler.register(
        { widget: 'Button', name: 'label', role: 'text', required: 'false' },
        storage,
      );

      const result = await anatomyPartEntityHandler.findByRole({ role: 'container' }, storage);
      expect(result.variant).toBe('ok');
      const parts = JSON.parse(result.parts as string);
      expect(parts).toHaveLength(2);
    });

    it('returns empty array when no parts match the role', async () => {
      const result = await anatomyPartEntityHandler.findByRole({ role: 'nonexistent' }, storage);
      expect(result.variant).toBe('ok');
      expect(JSON.parse(result.parts as string)).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // findBoundToField
  // ----------------------------------------------------------

  describe('findBoundToField', () => {
    it('returns parts bound to a specific field', async () => {
      await anatomyPartEntityHandler.register(
        { widget: 'Input', name: 'input', role: 'input', required: 'true' },
        storage,
      );
      // Manually bind the part to a field
      const record = await storage.get('anatomy-part-entity', 'anatomy-part-entity-1');
      await storage.put('anatomy-part-entity', 'anatomy-part-entity-1', {
        ...record!,
        boundField: 'state-field-1',
      });

      const result = await anatomyPartEntityHandler.findBoundToField(
        { field: 'state-field-1' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const parts = JSON.parse(result.parts as string);
      expect(parts).toHaveLength(1);
      expect(parts[0].name).toBe('input');
    });

    it('returns empty when no parts bound to the field', async () => {
      const result = await anatomyPartEntityHandler.findBoundToField(
        { field: 'nope' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(JSON.parse(result.parts as string)).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // findBoundToAction
  // ----------------------------------------------------------

  describe('findBoundToAction', () => {
    it('returns parts bound to a specific action', async () => {
      await anatomyPartEntityHandler.register(
        { widget: 'Button', name: 'root', role: 'trigger', required: 'true' },
        storage,
      );
      const record = await storage.get('anatomy-part-entity', 'anatomy-part-entity-1');
      await storage.put('anatomy-part-entity', 'anatomy-part-entity-1', {
        ...record!,
        boundAction: 'action-entity-5',
      });

      const result = await anatomyPartEntityHandler.findBoundToAction(
        { action: 'action-entity-5' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const parts = JSON.parse(result.parts as string);
      expect(parts).toHaveLength(1);
      expect(parts[0].name).toBe('root');
    });
  });

  // ----------------------------------------------------------
  // Multi-step: register then get
  // ----------------------------------------------------------

  describe('register then get round trip', () => {
    it('persists data correctly across register and get', async () => {
      const reg = await anatomyPartEntityHandler.register(
        { widget: 'Dialog', name: 'overlay', role: 'backdrop', required: 'true' },
        storage,
      );
      const get = await anatomyPartEntityHandler.get({ part: reg.part }, storage);
      expect(get.variant).toBe('ok');
      expect(get.widget).toBe('Dialog');
      expect(get.name).toBe('overlay');
      expect(get.semanticRole).toBe('backdrop');
    });
  });
});
