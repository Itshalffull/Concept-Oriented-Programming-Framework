// ============================================================
// WidgetImplementationEntity diffFromSpec Tests — Monadic
//
// Tests for comparing generated widget implementations against
// widget specs via the StorageProgram DSL. All operations go
// through the interpreter for full traceability.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { interpret } from '../runtime/interpreter.js';
import { widgetDiffFromSpecHandler } from '../handlers/ts/score/widget-diff-from-spec.handler.js';

describe('WidgetImplementationEntity diffFromSpec (Monadic)', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  async function run(program: any) {
    const execResult = await interpret(program, storage);
    return { variant: execResult.variant, ...execResult.output };
  }

  // Helper: seed a widget entity
  async function seedWidget(name: string, opts: {
    parts?: Array<{ name: string }>;
    states?: Array<{ name: string; transitions?: Array<{ event: string; target: string }> }>;
    props?: Array<{ name: string }>;
    slots?: string[];
    accessibilityRole?: string;
    composedWidgets?: Array<string | { name: string }>;
    keyboardBindings?: Array<{ key: string; action: string }>;
  } = {}) {
    await storage.put('widget-entity', `widget:${name}`, {
      id: `widget:${name}`,
      name,
      anatomyParts: JSON.stringify(opts.parts || []),
      states: JSON.stringify(opts.states || []),
      props: JSON.stringify(opts.props || []),
      slots: JSON.stringify(opts.slots || []),
      accessibilityRole: opts.accessibilityRole || '',
      composedWidgets: JSON.stringify(opts.composedWidgets || []),
      keyboardBindings: JSON.stringify(opts.keyboardBindings || []),
    });
  }

  // Helper: seed a widget implementation
  async function seedImpl(id: string, widget: string, opts: {
    renderedParts?: Array<{ name: string }>;
    propsInterface?: Record<string, string> | Array<{ name: string }>;
    stateBindings?: Array<{ name: string }>;
    slotImplementations?: Array<{ name: string }>;
    accessibilityAttrs?: Array<{ attr: string; value?: string }>;
    eventHandlers?: Array<string | { name: string; event?: string }>;
    composedComponents?: Array<string | { name: string }>;
    keyboardHandlers?: Array<{ key: string }>;
  } = {}) {
    await storage.put('widget-implementations', `impl:${id}`, {
      id,
      widget,
      framework: 'react',
      renderedParts: JSON.stringify(opts.renderedParts || []),
      propsInterface: JSON.stringify(opts.propsInterface || {}),
      stateBindings: JSON.stringify(opts.stateBindings || []),
      slotImplementations: JSON.stringify(opts.slotImplementations || []),
      accessibilityAttrs: JSON.stringify(opts.accessibilityAttrs || []),
      eventHandlers: JSON.stringify(opts.eventHandlers || []),
      composedComponents: JSON.stringify(opts.composedComponents || []),
      keyboardHandlers: JSON.stringify(opts.keyboardHandlers || []),
    });
  }

  // ----------------------------------------------------------
  // In-sync case
  // ----------------------------------------------------------

  describe('inSync', () => {
    it('reports inSync when impl matches spec exactly', async () => {
      await seedWidget('Button', {
        parts: [{ name: 'root' }, { name: 'label' }],
        props: [{ name: 'variant' }, { name: 'size' }],
        states: [{ name: 'idle' }, { name: 'pressed' }],
      });
      await seedImpl('impl-1', 'Button', {
        renderedParts: [{ name: 'root' }, { name: 'label' }],
        propsInterface: { variant: 'string', size: 'string' },
        stateBindings: [{ name: 'idle' }, { name: 'pressed' }],
      });

      const result = await run(widgetDiffFromSpecHandler.diffFromSpec({
        impl: 'impl-1',
      }));

      expect(result.variant).toBe('inSync');
    });

    it('returns inSync for nonexistent impl', async () => {
      const result = await run(widgetDiffFromSpecHandler.diffFromSpec({
        impl: 'does-not-exist',
      }));

      expect(result.variant).toBe('inSync');
    });
  });

  // ----------------------------------------------------------
  // Missing anatomy parts
  // ----------------------------------------------------------

  describe('missing parts', () => {
    it('detects anatomy parts in spec but missing from implementation', async () => {
      await seedWidget('Dialog', {
        parts: [{ name: 'root' }, { name: 'overlay' }, { name: 'content' }, { name: 'close' }],
      });
      await seedImpl('impl-2', 'Dialog', {
        renderedParts: [{ name: 'root' }, { name: 'content' }],
      });

      const result = await run(widgetDiffFromSpecHandler.diffFromSpec({
        impl: 'impl-2',
      }));

      expect(result.variant).toBe('ok');
      const diffs = JSON.parse(result.differences as string);
      const missing = diffs.filter((d: any) => d.kind === 'missing_part');
      expect(missing).toHaveLength(2);
      expect(missing.map((d: any) => d.specValue)).toContain('overlay');
      expect(missing.map((d: any) => d.specValue)).toContain('close');
      expect(result.missing_parts).toBe(2);
    });
  });

  // ----------------------------------------------------------
  // Extra parts
  // ----------------------------------------------------------

  describe('extra parts', () => {
    it('detects parts in implementation but not in spec', async () => {
      await seedWidget('Card', {
        parts: [{ name: 'root' }],
      });
      await seedImpl('impl-3', 'Card', {
        renderedParts: [{ name: 'root' }, { name: 'footer' }, { name: 'badge' }],
      });

      const result = await run(widgetDiffFromSpecHandler.diffFromSpec({
        impl: 'impl-3',
      }));

      expect(result.variant).toBe('ok');
      const diffs = JSON.parse(result.differences as string);
      const extra = diffs.filter((d: any) => d.kind === 'extra_part');
      expect(extra).toHaveLength(2);
      expect(result.extra_parts).toBe(2);
    });
  });

  // ----------------------------------------------------------
  // Missing props
  // ----------------------------------------------------------

  describe('missing props', () => {
    it('detects props declared in spec but missing from implementation', async () => {
      await seedWidget('Input', {
        props: [{ name: 'value' }, { name: 'placeholder' }, { name: 'disabled' }],
      });
      await seedImpl('impl-4', 'Input', {
        propsInterface: { value: 'string' },
      });

      const result = await run(widgetDiffFromSpecHandler.diffFromSpec({
        impl: 'impl-4',
      }));

      expect(result.variant).toBe('ok');
      expect(result.missing_props).toBe(2);
    });
  });

  // ----------------------------------------------------------
  // Accessibility gaps
  // ----------------------------------------------------------

  describe('accessibility gaps', () => {
    it('detects missing ARIA role when spec declares one', async () => {
      await seedWidget('Tab', {
        parts: [{ name: 'root' }],
        accessibilityRole: 'tab',
      });
      await seedImpl('impl-5', 'Tab', {
        renderedParts: [{ name: 'root' }],
        accessibilityAttrs: [], // no role attribute
      });

      const result = await run(widgetDiffFromSpecHandler.diffFromSpec({
        impl: 'impl-5',
      }));

      expect(result.variant).toBe('ok');
      const diffs = JSON.parse(result.differences as string);
      const a11y = diffs.filter((d: any) => d.kind === 'accessibility_gap');
      expect(a11y).toHaveLength(1);
      expect(a11y[0].specValue).toContain('role="tab"');
      expect(result.accessibility_gaps).toBe(1);
    });

    it('passes when implementation includes the role attribute', async () => {
      await seedWidget('Tab', {
        parts: [{ name: 'root' }],
        accessibilityRole: 'tab',
      });
      await seedImpl('impl-6', 'Tab', {
        renderedParts: [{ name: 'root' }],
        accessibilityAttrs: [{ attr: 'role', value: 'tab' }],
      });

      const result = await run(widgetDiffFromSpecHandler.diffFromSpec({
        impl: 'impl-6',
      }));

      expect(result.variant).toBe('inSync');
    });
  });

  // ----------------------------------------------------------
  // Event / transition gaps
  // ----------------------------------------------------------

  describe('event checking', () => {
    it('detects missing event handlers for spec transitions', async () => {
      await seedWidget('Toggle', {
        parts: [{ name: 'root' }],
        states: [
          { name: 'off', transitions: [{ event: 'toggle', target: 'on' }] },
          { name: 'on', transitions: [{ event: 'toggle', target: 'off' }, { event: 'reset', target: 'off' }] },
        ],
      });
      await seedImpl('impl-evt-1', 'Toggle', {
        renderedParts: [{ name: 'root' }],
        stateBindings: [{ name: 'off' }, { name: 'on' }],
        eventHandlers: ['toggle'], // missing 'reset'
      });

      const result = await run(widgetDiffFromSpecHandler.diffFromSpec({
        impl: 'impl-evt-1',
      }));

      expect(result.variant).toBe('ok');
      const diffs = JSON.parse(result.differences as string);
      const missingEvents = diffs.filter((d: any) => d.kind === 'missing_event');
      expect(missingEvents).toHaveLength(1);
      expect(missingEvents[0].specValue).toBe('reset');
      expect(result.missing_events).toBe(1);
    });

    it('reports inSync when all events are handled', async () => {
      await seedWidget('Switch', {
        parts: [{ name: 'root' }],
        states: [
          { name: 'off', transitions: [{ event: 'flip', target: 'on' }] },
          { name: 'on', transitions: [{ event: 'flip', target: 'off' }] },
        ],
      });
      await seedImpl('impl-evt-2', 'Switch', {
        renderedParts: [{ name: 'root' }],
        stateBindings: [{ name: 'off' }, { name: 'on' }],
        eventHandlers: ['flip'],
      });

      const result = await run(widgetDiffFromSpecHandler.diffFromSpec({
        impl: 'impl-evt-2',
      }));

      expect(result.variant).toBe('inSync');
    });
  });

  // ----------------------------------------------------------
  // Compose checking
  // ----------------------------------------------------------

  describe('compose checking', () => {
    it('detects missing composed widget references', async () => {
      await seedWidget('Toolbar', {
        parts: [{ name: 'root' }],
        composedWidgets: ['Button', 'Separator', 'Menu'],
      });
      await seedImpl('impl-comp-1', 'Toolbar', {
        renderedParts: [{ name: 'root' }],
        composedComponents: ['Button'],
      });

      const result = await run(widgetDiffFromSpecHandler.diffFromSpec({
        impl: 'impl-comp-1',
      }));

      expect(result.variant).toBe('ok');
      const diffs = JSON.parse(result.differences as string);
      const missingCompose = diffs.filter((d: any) => d.kind === 'missing_compose');
      expect(missingCompose).toHaveLength(2);
      expect(missingCompose.map((d: any) => d.specValue)).toContain('Separator');
      expect(missingCompose.map((d: any) => d.specValue)).toContain('Menu');
      expect(result.missing_compose).toBe(2);
    });

    it('detects extra composed widgets in implementation', async () => {
      await seedWidget('Panel', {
        parts: [{ name: 'root' }],
        composedWidgets: ['Header'],
      });
      await seedImpl('impl-comp-2', 'Panel', {
        renderedParts: [{ name: 'root' }],
        composedComponents: ['Header', 'Footer'],
      });

      const result = await run(widgetDiffFromSpecHandler.diffFromSpec({
        impl: 'impl-comp-2',
      }));

      expect(result.variant).toBe('ok');
      const diffs = JSON.parse(result.differences as string);
      const extraCompose = diffs.filter((d: any) => d.kind === 'extra_compose');
      expect(extraCompose).toHaveLength(1);
      expect(extraCompose[0].implValue).toBe('Footer');
      expect(result.extra_compose).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // Keyboard binding gaps
  // ----------------------------------------------------------

  describe('keyboard binding checking', () => {
    it('detects missing keyboard handlers when spec declares bindings', async () => {
      await seedWidget('Menu', {
        parts: [{ name: 'root' }],
        keyboardBindings: [
          { key: 'ArrowDown', action: 'next' },
          { key: 'ArrowUp', action: 'prev' },
          { key: 'Enter', action: 'select' },
        ],
      });
      await seedImpl('impl-kb-1', 'Menu', {
        renderedParts: [{ name: 'root' }],
        keyboardHandlers: [], // no keyboard handlers
      });

      const result = await run(widgetDiffFromSpecHandler.diffFromSpec({
        impl: 'impl-kb-1',
      }));

      expect(result.variant).toBe('ok');
      const diffs = JSON.parse(result.differences as string);
      const kbGaps = diffs.filter((d: any) => d.kind === 'missing_keyboard');
      expect(kbGaps).toHaveLength(1);
      expect(kbGaps[0].specValue).toContain('3 keyboard binding(s)');
      expect(result.missing_keyboard).toBe(1);
    });

    it('passes when keyboard handlers are present', async () => {
      await seedWidget('Nav', {
        parts: [{ name: 'root' }],
        keyboardBindings: [{ key: 'Tab', action: 'next' }],
      });
      await seedImpl('impl-kb-2', 'Nav', {
        renderedParts: [{ name: 'root' }],
        keyboardHandlers: [{ key: 'Tab' }],
      });

      const result = await run(widgetDiffFromSpecHandler.diffFromSpec({
        impl: 'impl-kb-2',
      }));

      expect(result.variant).toBe('inSync');
    });
  });

  // ----------------------------------------------------------
  // Mixed drift
  // ----------------------------------------------------------

  describe('mixed drift', () => {
    it('detects multiple categories of drift simultaneously', async () => {
      await seedWidget('Select', {
        parts: [{ name: 'root' }, { name: 'trigger' }, { name: 'listbox' }],
        props: [{ name: 'value' }, { name: 'options' }],
        slots: ['icon'],
        accessibilityRole: 'combobox',
      });
      await seedImpl('impl-7', 'Select', {
        renderedParts: [{ name: 'root' }, { name: 'dropdown' }], // missing trigger, listbox; extra dropdown
        propsInterface: { value: 'string' },                      // missing options
        slotImplementations: [],                                   // missing icon slot
        accessibilityAttrs: [],                                    // missing role
      });

      const result = await run(widgetDiffFromSpecHandler.diffFromSpec({
        impl: 'impl-7',
      }));

      expect(result.variant).toBe('ok');
      expect(result.total_differences).toBeGreaterThanOrEqual(5);
    });
  });
});
