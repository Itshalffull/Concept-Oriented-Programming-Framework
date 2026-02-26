// ============================================================
// WidgetEntity Handler Tests
//
// Tests for widget-entity: registration, duplicate detection,
// get, affordance queries, composition tracing, generated
// components, accessibility audit, and concept binding trace.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  widgetEntityHandler,
  resetWidgetEntityCounter,
} from '../handlers/ts/widget-entity.handler.js';

describe('WidgetEntity Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetWidgetEntityCounter();
  });

  // ----------------------------------------------------------
  // register
  // ----------------------------------------------------------

  describe('register', () => {
    it('registers a new widget entity and returns ok', async () => {
      const result = await widgetEntityHandler.register(
        {
          name: 'Button',
          source: 'widgets/button.widget',
          ast: JSON.stringify({
            purpose: 'Clickable button',
            version: 1,
            category: 'input',
            anatomy: [{ name: 'root', role: 'container' }],
            states: [{ name: 'idle' }, { name: 'pressed' }],
            props: [{ name: 'label', type: 'string' }],
            slots: [{ name: 'icon' }],
            compose: ['Icon'],
            affordances: [{ interactor: 'Tap' }],
            accessibility: {
              role: 'button',
              focusTrap: false,
              keyboard: [{ key: 'Enter', action: 'activate' }],
            },
          }),
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.entity).toBe('widget-entity-1');
    });

    it('extracts metadata from AST', async () => {
      await widgetEntityHandler.register(
        {
          name: 'Button',
          source: 'button.widget',
          ast: JSON.stringify({
            purpose: 'Click me',
            version: 2,
            category: 'action',
            anatomy: ['root'],
            props: ['label'],
            compose: ['Icon'],
            affordances: [{ interactor: 'Tap' }],
            accessibility: { role: 'button', focusTrap: true, keyboard: [{ key: 'Space' }] },
          }),
        },
        storage,
      );
      const record = await storage.get('widget-entity', 'widget-entity-1');
      expect(record!.purposeText).toBe('Click me');
      expect(record!.version).toBe(2);
      expect(record!.category).toBe('action');
      expect(record!.accessibilityRole).toBe('button');
      expect(record!.hasFocusTrap).toBe('true');
    });

    it('returns alreadyRegistered for duplicate name', async () => {
      const first = await widgetEntityHandler.register(
        { name: 'Button', source: 'a.widget', ast: '{}' },
        storage,
      );
      const second = await widgetEntityHandler.register(
        { name: 'Button', source: 'b.widget', ast: '{}' },
        storage,
      );
      expect(second.variant).toBe('alreadyRegistered');
      expect(second.existing).toBe(first.entity);
    });

    it('handles non-JSON AST gracefully', async () => {
      const result = await widgetEntityHandler.register(
        { name: 'Broken', source: 'x.widget', ast: 'invalid' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });
  });

  // ----------------------------------------------------------
  // get
  // ----------------------------------------------------------

  describe('get', () => {
    it('returns the entity by name', async () => {
      const reg = await widgetEntityHandler.register(
        { name: 'Button', source: 'a.widget', ast: '{}' },
        storage,
      );
      const result = await widgetEntityHandler.get({ name: 'Button' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.entity).toBe(reg.entity);
    });

    it('returns notfound for unknown name', async () => {
      const result = await widgetEntityHandler.get({ name: 'Nope' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // findByAffordance
  // ----------------------------------------------------------

  describe('findByAffordance', () => {
    it('finds widgets with matching affordance', async () => {
      await widgetEntityHandler.register(
        {
          name: 'Switch',
          source: 'a.widget',
          ast: JSON.stringify({ affordances: [{ interactor: 'Toggle' }] }),
        },
        storage,
      );
      await widgetEntityHandler.register(
        {
          name: 'Button',
          source: 'b.widget',
          ast: JSON.stringify({ affordances: [{ interactor: 'Tap' }] }),
        },
        storage,
      );

      const result = await widgetEntityHandler.findByAffordance({ interactor: 'Toggle' }, storage);
      expect(result.variant).toBe('ok');
      const widgets = JSON.parse(result.widgets as string);
      expect(widgets).toHaveLength(1);
      expect(widgets[0].name).toBe('Switch');
    });

    it('matches string-type affordances', async () => {
      await widgetEntityHandler.register(
        {
          name: 'TextInput',
          source: 'a.widget',
          ast: JSON.stringify({ affordances: ['TextEntry'] }),
        },
        storage,
      );

      const result = await widgetEntityHandler.findByAffordance({ interactor: 'TextEntry' }, storage);
      const widgets = JSON.parse(result.widgets as string);
      expect(widgets).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------
  // findComposing (parents)
  // ----------------------------------------------------------

  describe('findComposing', () => {
    it('finds parent widgets that compose this widget', async () => {
      await widgetEntityHandler.register(
        { name: 'Icon', source: 'icon.widget', ast: '{}' },
        storage,
      );
      await widgetEntityHandler.register(
        {
          name: 'Button',
          source: 'button.widget',
          ast: JSON.stringify({ compose: ['Icon'] }),
        },
        storage,
      );

      const iconRecord = await storage.find('widget-entity', { name: 'Icon' });
      const result = await widgetEntityHandler.findComposing(
        { widget: iconRecord[0].id as string },
        storage,
      );
      expect(result.variant).toBe('ok');
      const parents = JSON.parse(result.parents as string);
      expect(parents).toHaveLength(1);
      expect(parents[0].name).toBe('Button');
    });

    it('returns empty for nonexistent widget', async () => {
      const result = await widgetEntityHandler.findComposing({ widget: 'nope' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.parents).toBe('[]');
    });
  });

  // ----------------------------------------------------------
  // findComposedBy (children)
  // ----------------------------------------------------------

  describe('findComposedBy', () => {
    it('finds child widgets composed by this widget', async () => {
      await widgetEntityHandler.register(
        { name: 'Icon', source: 'icon.widget', ast: '{}' },
        storage,
      );
      const parent = await widgetEntityHandler.register(
        {
          name: 'Button',
          source: 'button.widget',
          ast: JSON.stringify({ compose: ['Icon'] }),
        },
        storage,
      );

      const result = await widgetEntityHandler.findComposedBy({ widget: parent.entity }, storage);
      expect(result.variant).toBe('ok');
      const children = JSON.parse(result.children as string);
      expect(children).toHaveLength(1);
      expect(children[0].name).toBe('Icon');
    });

    it('returns empty for nonexistent widget', async () => {
      const result = await widgetEntityHandler.findComposedBy({ widget: 'nope' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.children).toBe('[]');
    });
  });

  // ----------------------------------------------------------
  // generatedComponents
  // ----------------------------------------------------------

  describe('generatedComponents', () => {
    it('returns provenance records for the widget symbol', async () => {
      const reg = await widgetEntityHandler.register(
        { name: 'Button', source: 'a.widget', ast: '{}' },
        storage,
      );

      await storage.put('provenance', 'prov-1', {
        id: 'prov-1',
        sourceSymbol: 'copf/widget/Button',
        framework: 'react',
        targetFile: 'generated/Button.tsx',
      });

      const result = await widgetEntityHandler.generatedComponents({ widget: reg.entity }, storage);
      expect(result.variant).toBe('ok');
      const components = JSON.parse(result.components as string);
      expect(components).toHaveLength(1);
      expect(components[0].framework).toBe('react');
    });
  });

  // ----------------------------------------------------------
  // accessibilityAudit
  // ----------------------------------------------------------

  describe('accessibilityAudit', () => {
    it('returns ok when all accessibility properties present', async () => {
      const reg = await widgetEntityHandler.register(
        {
          name: 'Button',
          source: 'a.widget',
          ast: JSON.stringify({
            accessibility: {
              role: 'button',
              keyboard: [{ key: 'Enter' }],
            },
          }),
        },
        storage,
      );

      const result = await widgetEntityHandler.accessibilityAudit({ widget: reg.entity }, storage);
      expect(result.variant).toBe('ok');
    });

    it('returns incomplete when role is missing', async () => {
      const reg = await widgetEntityHandler.register(
        {
          name: 'BadWidget',
          source: 'a.widget',
          ast: JSON.stringify({}),
        },
        storage,
      );

      const result = await widgetEntityHandler.accessibilityAudit({ widget: reg.entity }, storage);
      expect(result.variant).toBe('incomplete');
      const missing = JSON.parse(result.missing as string);
      expect(missing).toContain('role');
      expect(missing).toContain('keyboard-bindings');
    });

    it('returns incomplete when keyboard bindings are missing', async () => {
      const reg = await widgetEntityHandler.register(
        {
          name: 'BadWidget',
          source: 'a.widget',
          ast: JSON.stringify({ accessibility: { role: 'button' } }),
        },
        storage,
      );

      const result = await widgetEntityHandler.accessibilityAudit({ widget: reg.entity }, storage);
      expect(result.variant).toBe('incomplete');
      const missing = JSON.parse(result.missing as string);
      expect(missing).toContain('keyboard-bindings');
      expect(missing).not.toContain('role');
    });
  });

  // ----------------------------------------------------------
  // traceToConcept
  // ----------------------------------------------------------

  describe('traceToConcept', () => {
    it('returns noConceptBinding when no bindings or affordances', async () => {
      const reg = await widgetEntityHandler.register(
        { name: 'Plain', source: 'a.widget', ast: JSON.stringify({}) },
        storage,
      );

      const result = await widgetEntityHandler.traceToConcept({ widget: reg.entity }, storage);
      expect(result.variant).toBe('noConceptBinding');
    });

    it('returns concepts via affordances when no direct bindings', async () => {
      const reg = await widgetEntityHandler.register(
        {
          name: 'Switch',
          source: 'a.widget',
          ast: JSON.stringify({ affordances: [{ interactor: 'Toggle', concept: 'Settings' }] }),
        },
        storage,
      );

      const result = await widgetEntityHandler.traceToConcept({ widget: reg.entity }, storage);
      expect(result.variant).toBe('ok');
      const concepts = JSON.parse(result.concepts as string);
      expect(concepts).toHaveLength(1);
      expect(concepts[0].concept).toBe('Settings');
    });

    it('returns noConceptBinding for nonexistent widget', async () => {
      const result = await widgetEntityHandler.traceToConcept({ widget: 'nope' }, storage);
      expect(result.variant).toBe('noConceptBinding');
    });
  });
});
