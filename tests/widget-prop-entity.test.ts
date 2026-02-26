// ============================================================
// WidgetPropEntity Handler Tests
//
// Tests for widget-prop-entity: registration, retrieval,
// widget queries, and field tracing via bindings.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  widgetPropEntityHandler,
  resetWidgetPropEntityCounter,
} from '../implementations/typescript/widget-prop-entity.impl.js';

describe('WidgetPropEntity Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetWidgetPropEntityCounter();
  });

  // ----------------------------------------------------------
  // register
  // ----------------------------------------------------------

  describe('register', () => {
    it('registers a new widget prop and returns ok', async () => {
      const result = await widgetPropEntityHandler.register(
        { widget: 'Button', name: 'label', typeExpr: 'string', defaultValue: '' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.prop).toBe('widget-prop-entity-1');
    });

    it('stores the prop with the correct symbol', async () => {
      await widgetPropEntityHandler.register(
        { widget: 'Button', name: 'disabled', typeExpr: 'boolean', defaultValue: 'false' },
        storage,
      );
      const record = await storage.get('widget-prop-entity', 'widget-prop-entity-1');
      expect(record).not.toBeNull();
      expect(record!.symbol).toBe('copf/prop/Button/disabled');
      expect(record!.typeExpr).toBe('boolean');
      expect(record!.defaultValue).toBe('false');
      expect(record!.connectedParts).toBe('[]');
    });

    it('allows multiple props on the same widget', async () => {
      const a = await widgetPropEntityHandler.register(
        { widget: 'Button', name: 'label', typeExpr: 'string', defaultValue: '' },
        storage,
      );
      const b = await widgetPropEntityHandler.register(
        { widget: 'Button', name: 'disabled', typeExpr: 'boolean', defaultValue: 'false' },
        storage,
      );
      expect(a.prop).not.toBe(b.prop);
    });
  });

  // ----------------------------------------------------------
  // get
  // ----------------------------------------------------------

  describe('get', () => {
    it('returns the prop details after registration', async () => {
      const reg = await widgetPropEntityHandler.register(
        { widget: 'Button', name: 'label', typeExpr: 'string', defaultValue: 'Click' },
        storage,
      );
      const result = await widgetPropEntityHandler.get({ prop: reg.prop }, storage);
      expect(result.variant).toBe('ok');
      expect(result.widget).toBe('Button');
      expect(result.name).toBe('label');
      expect(result.typeExpr).toBe('string');
      expect(result.defaultValue).toBe('Click');
    });

    it('returns notfound for nonexistent prop', async () => {
      const result = await widgetPropEntityHandler.get({ prop: 'nope' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // findByWidget
  // ----------------------------------------------------------

  describe('findByWidget', () => {
    it('returns props filtered by widget', async () => {
      await widgetPropEntityHandler.register(
        { widget: 'Button', name: 'label', typeExpr: 'string', defaultValue: '' },
        storage,
      );
      await widgetPropEntityHandler.register(
        { widget: 'Button', name: 'disabled', typeExpr: 'boolean', defaultValue: 'false' },
        storage,
      );
      await widgetPropEntityHandler.register(
        { widget: 'Input', name: 'value', typeExpr: 'string', defaultValue: '' },
        storage,
      );

      const result = await widgetPropEntityHandler.findByWidget({ widget: 'Button' }, storage);
      expect(result.variant).toBe('ok');
      const props = JSON.parse(result.props as string);
      expect(props).toHaveLength(2);
      expect(props.every((p: Record<string, unknown>) => p.widget === 'Button')).toBe(true);
    });

    it('returns empty for a widget with no props', async () => {
      const result = await widgetPropEntityHandler.findByWidget({ widget: 'Empty' }, storage);
      expect(result.variant).toBe('ok');
      expect(JSON.parse(result.props as string)).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // traceToField
  // ----------------------------------------------------------

  describe('traceToField', () => {
    it('returns noBinding when no binding records exist', async () => {
      const reg = await widgetPropEntityHandler.register(
        { widget: 'Button', name: 'label', typeExpr: 'string', defaultValue: '' },
        storage,
      );

      const result = await widgetPropEntityHandler.traceToField({ prop: reg.prop }, storage);
      expect(result.variant).toBe('noBinding');
    });

    it('returns the bound field and concept via a binding record', async () => {
      const reg = await widgetPropEntityHandler.register(
        { widget: 'TodoItem', name: 'title', typeExpr: 'string', defaultValue: '' },
        storage,
      );

      await storage.put('binding', 'bind-1', {
        id: 'bind-1',
        propSymbol: 'copf/prop/TodoItem/title',
        fieldSymbol: 'copf/field/Todo/title',
        concept: 'Todo',
      });

      const result = await widgetPropEntityHandler.traceToField({ prop: reg.prop }, storage);
      expect(result.variant).toBe('ok');
      expect(result.field).toBe('copf/field/Todo/title');
      expect(result.concept).toBe('Todo');
    });

    it('returns noBinding for nonexistent prop', async () => {
      const result = await widgetPropEntityHandler.traceToField({ prop: 'nope' }, storage);
      expect(result.variant).toBe('noBinding');
    });
  });

  // ----------------------------------------------------------
  // Multi-step: register and query round trip
  // ----------------------------------------------------------

  describe('register then findByWidget round trip', () => {
    it('persists data correctly across register and findByWidget', async () => {
      await widgetPropEntityHandler.register(
        { widget: 'Card', name: 'title', typeExpr: 'string', defaultValue: '' },
        storage,
      );
      await widgetPropEntityHandler.register(
        { widget: 'Card', name: 'elevation', typeExpr: 'number', defaultValue: '1' },
        storage,
      );

      const found = await widgetPropEntityHandler.findByWidget({ widget: 'Card' }, storage);
      const props = JSON.parse(found.props as string);
      expect(props).toHaveLength(2);

      const names = props.map((p: Record<string, unknown>) => p.name).sort();
      expect(names).toEqual(['elevation', 'title']);
    });
  });
});
