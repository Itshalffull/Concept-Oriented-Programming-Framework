// ============================================================
// WidgetGen Unified Dispatcher Tests
//
// Tests for the collapsed widget-gen handler that maps targets
// directly to interpreter functions via the RenderProgram pipeline.
// - Unified dispatcher generate() for all 16 interpreter targets
// - listTargets() action
// - Error handling (invalid JSON, unknown target)
// - Framework handler (separate, class-based generator)
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';

// Unified dispatcher
import { widgetGenHandler } from '../handlers/ts/app/widget-gen.handler.js';

// Framework handler (kept separate — not part of the RenderProgram pipeline)
import { widgetGenFrameworkHandler, resetWidgetGenFrameworkCounter } from '../handlers/ts/app/widget-gen-framework.handler.js';

import type { ConceptStorage } from '../runtime/types.js';

// Test fixtures
const SIMPLE_AST = JSON.stringify({
  name: 'MyButton',
  props: [
    { name: 'label', type: 'string' },
    { name: 'count', type: 'number' },
  ],
});

const RICH_AST = JSON.stringify({
  name: 'MyButton',
  props: [
    { name: 'label', type: 'string' },
    { name: 'count', type: 'number' },
  ],
  anatomy: [
    { name: 'root', role: 'container', children: [{ name: 'label', role: 'text' }] },
  ],
  states: [
    { name: 'idle', initial: true, transitions: [{ event: 'PRESS', target: 'active' }] },
    { name: 'active', initial: false, transitions: [{ event: 'RELEASE', target: 'idle' }] },
  ],
  accessibility: {
    role: 'button',
    keyboard: [{ key: 'Enter', event: 'PRESS' }],
    focus: { strategy: 'roving', initialPart: 'root' },
  },
});

const NO_PROPS_AST = JSON.stringify({ name: 'Divider', props: [] });

// All interpreter targets available through the unified dispatcher
const INTERPRETER_TARGETS = [
  'react', 'vue', 'solid', 'svelte', 'vanilla', 'nextjs',
  'react-native', 'ink', 'nativescript', 'compose', 'wear',
  'swiftui', 'watchkit', 'appkit', 'winui', 'gtk',
];

// ============================================================
// Unified Dispatcher — Core Behavior
// ============================================================

describe('WidgetGen Unified Dispatcher', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('returns error for unknown target with available list', async () => {
    const result = await widgetGenHandler.generate(
      { gen: 'g1', target: 'unknown-target', widgetAst: SIMPLE_AST },
      storage,
    );
    expect(result.variant).toBe('error');
    expect(result.message).toContain('No interpreter for target "unknown-target"');
    expect(result.message).toContain('react');
    expect(result.message).toContain('vue');
  });

  it('returns error for invalid JSON widgetAst', async () => {
    const result = await widgetGenHandler.generate(
      { gen: 'g1', target: 'react', widgetAst: 'bad json' },
      storage,
    );
    expect(result.variant).toBe('error');
    expect(result.message).toContain('Failed to parse widget AST');
  });

  it('stores result in widgetGen collection', async () => {
    await widgetGenHandler.generate(
      { gen: 'g1', target: 'react', widgetAst: SIMPLE_AST },
      storage,
    );

    const record = await storage.get('widgetGen', 'g1');
    expect(record).not.toBeNull();
    expect(record!.target).toBe('react');
    expect(record!.status).toBe('completed');
    expect(typeof record!.output).toBe('string');
  });

  it('returns parts and props metadata', async () => {
    const result = await widgetGenHandler.generate(
      { gen: 'g1', target: 'react', widgetAst: SIMPLE_AST },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.parts).toBeDefined();
    expect(result.props).toBeDefined();
    expect(result.trace).toBeDefined();
  });

  it('auto-generates ID when gen is not provided', async () => {
    const result = await widgetGenHandler.generate(
      { target: 'react', widgetAst: SIMPLE_AST },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.gen).toBe('string');
    expect((result.gen as string).length).toBeGreaterThan(0);
  });
});

// ============================================================
// listTargets Action
// ============================================================

describe('WidgetGen listTargets', () => {
  it('returns all 16 interpreter targets sorted', async () => {
    const result = await widgetGenHandler.listTargets!({}, {} as any);
    expect(result.variant).toBe('ok');
    const targets = JSON.parse(result.targets as string) as string[];
    expect(targets).toEqual(INTERPRETER_TARGETS.sort());
    expect(targets).toHaveLength(16);
  });
});

// ============================================================
// Code Generation — All Interpreter Targets
// ============================================================

describe('WidgetGen Code Generation (all targets)', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // Every target should produce ok variant with non-empty output
  for (const target of INTERPRETER_TARGETS) {
    it(`${target}: generates output with ok variant`, async () => {
      const result = await widgetGenHandler.generate(
        { gen: `g-${target}`, target, widgetAst: SIMPLE_AST },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(typeof result.output).toBe('string');
      expect((result.output as string).length).toBeGreaterThan(0);
    });
  }

  // Most targets should include the component name in output
  // (Svelte and Vue use file-based component naming, so the name isn't in output)
  for (const target of INTERPRETER_TARGETS.filter(t => t !== 'svelte' && t !== 'vue')) {
    it(`${target}: output contains component name`, async () => {
      const result = await widgetGenHandler.generate(
        { gen: `g-${target}`, target, widgetAst: SIMPLE_AST },
        storage,
      );
      expect(result.output as string).toContain('MyButton');
    });
  }

  // React-specific assertions
  describe('react', () => {
    it('produces a functional component with props and data-part attributes', async () => {
      const result = await widgetGenHandler.generate(
        { gen: 'g1', target: 'react', widgetAst: RICH_AST },
        storage,
      );
      const output = result.output as string;
      expect(output).toContain('interface MyButtonProps');
      expect(output).toContain('label: string');
      expect(output).toContain('count: number');
      expect(output).toContain('export function MyButton');
      expect(output).toContain('data-part=');
    });

    it('produces state hooks for stateful widgets', async () => {
      const result = await widgetGenHandler.generate(
        { gen: 'g1', target: 'react', widgetAst: RICH_AST },
        storage,
      );
      const output = result.output as string;
      expect(output).toContain('useState');
    });
  });

  // Vue-specific assertions
  describe('vue', () => {
    it('produces a Vue SFC with template and script setup', async () => {
      const result = await widgetGenHandler.generate(
        { gen: 'g1', target: 'vue', widgetAst: SIMPLE_AST },
        storage,
      );
      const output = result.output as string;
      expect(output).toContain('<template>');
      expect(output).toContain('<script setup');
      expect(output).toContain('defineProps');
    });
  });

  // Solid-specific assertions
  describe('solid', () => {
    it('produces a SolidJS component with createSignal', async () => {
      const result = await widgetGenHandler.generate(
        { gen: 'g1', target: 'solid', widgetAst: RICH_AST },
        storage,
      );
      const output = result.output as string;
      expect(output).toContain('solid-js');
      expect(output).toContain('MyButton');
    });
  });

  // Svelte-specific assertions
  describe('svelte', () => {
    it('produces a Svelte component with script block', async () => {
      const result = await widgetGenHandler.generate(
        { gen: 'g1', target: 'svelte', widgetAst: SIMPLE_AST },
        storage,
      );
      const output = result.output as string;
      expect(output).toContain('<script');
      expect(output).toContain('export let label');
    });
  });

  // Ink-specific assertions
  describe('ink', () => {
    it('produces an Ink component with Box and Text', async () => {
      const result = await widgetGenHandler.generate(
        { gen: 'g1', target: 'ink', widgetAst: SIMPLE_AST },
        storage,
      );
      const output = result.output as string;
      expect(output).toContain('ink');
      expect(output).toContain('Box');
      expect(output).toContain('Text');
    });
  });

  // React Native-specific assertions
  describe('react-native', () => {
    it('produces a React Native component with View and Text', async () => {
      const result = await widgetGenHandler.generate(
        { gen: 'g1', target: 'react-native', widgetAst: SIMPLE_AST },
        storage,
      );
      const output = result.output as string;
      expect(output).toContain('react-native');
      expect(output).toContain('View');
      expect(output).toContain('Text');
    });
  });

  // SwiftUI-specific assertions
  describe('swiftui', () => {
    it('produces a SwiftUI View struct', async () => {
      const result = await widgetGenHandler.generate(
        { gen: 'g1', target: 'swiftui', widgetAst: SIMPLE_AST },
        storage,
      );
      const output = result.output as string;
      expect(output).toContain('struct MyButton');
      expect(output).toContain('View');
      expect(output).toContain('var label: String');
    });
  });

  // AppKit-specific assertions
  describe('appkit', () => {
    it('produces an NSView subclass', async () => {
      const result = await widgetGenHandler.generate(
        { gen: 'g1', target: 'appkit', widgetAst: SIMPLE_AST },
        storage,
      );
      const output = result.output as string;
      expect(output).toContain('AppKit');
      expect(output).toContain('NSView');
      expect(output).toContain('MyButton');
    });
  });

  // Compose-specific assertions
  describe('compose', () => {
    it('produces a @Composable function', async () => {
      const result = await widgetGenHandler.generate(
        { gen: 'g1', target: 'compose', widgetAst: SIMPLE_AST },
        storage,
      );
      const output = result.output as string;
      expect(output).toContain('@Composable');
      expect(output).toContain('fun MyButton');
      expect(output).toContain('Modifier');
    });
  });

  // GTK-specific assertions
  describe('gtk', () => {
    it('produces a C GtkWidget with gtk.h include', async () => {
      const result = await widgetGenHandler.generate(
        { gen: 'g1', target: 'gtk', widgetAst: SIMPLE_AST },
        storage,
      );
      const output = result.output as string;
      expect(output).toContain('#include <gtk/gtk.h>');
      expect(output).toContain('my_button');
    });
  });

  // NativeScript-specific assertions
  describe('nativescript', () => {
    it('produces a NativeScript component', async () => {
      const result = await widgetGenHandler.generate(
        { gen: 'g1', target: 'nativescript', widgetAst: SIMPLE_AST },
        storage,
      );
      const output = result.output as string;
      expect(output).toContain('@nativescript/core');
      expect(output).toContain('MyButton');
    });
  });

  // Next.js-specific assertions
  describe('nextjs', () => {
    it('produces a client component with use client directive', async () => {
      const result = await widgetGenHandler.generate(
        { gen: 'g1', target: 'nextjs', widgetAst: SIMPLE_AST },
        storage,
      );
      const output = result.output as string;
      expect(output).toContain("'use client'");
      expect(output).toContain('MyButton');
    });
  });

  // Vanilla-specific assertions
  describe('vanilla', () => {
    it('produces a Web Component with customElements.define', async () => {
      const result = await widgetGenHandler.generate(
        { gen: 'g1', target: 'vanilla', widgetAst: SIMPLE_AST },
        storage,
      );
      const output = result.output as string;
      expect(output).toContain('HTMLElement');
      expect(output).toContain('customElements.define');
      expect(output).toContain('attachShadow');
    });
  });

  // WatchKit-specific assertions
  describe('watchkit', () => {
    it('produces a WatchKit controller', async () => {
      const result = await widgetGenHandler.generate(
        { gen: 'g1', target: 'watchkit', widgetAst: SIMPLE_AST },
        storage,
      );
      const output = result.output as string;
      expect(output).toContain('WatchKit');
      expect(output).toContain('MyButton');
    });
  });

  // Wear-specific assertions
  describe('wear', () => {
    it('produces a Wear OS @Composable', async () => {
      const result = await widgetGenHandler.generate(
        { gen: 'g1', target: 'wear', widgetAst: SIMPLE_AST },
        storage,
      );
      const output = result.output as string;
      expect(output).toContain('@Composable');
      expect(output).toContain('fun MyButton');
      expect(output).toContain('wear');
    });
  });

  // WinUI-specific assertions
  describe('winui', () => {
    it('produces a C# UserControl', async () => {
      const result = await widgetGenHandler.generate(
        { gen: 'g1', target: 'winui', widgetAst: SIMPLE_AST },
        storage,
      );
      const output = result.output as string;
      expect(output).toContain('Microsoft.UI.Xaml');
      expect(output).toContain('MyButton');
      expect(output).toContain('UserControl');
    });
  });
});

// ============================================================
// Framework Handler (separate, not part of RenderProgram pipeline)
// ============================================================

describe('WidgetGen Framework Handler (standalone)', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetWidgetGenFrameworkCounter();
  });

  it('generates a TypeScript class with typed constructor', async () => {
    const result = await widgetGenFrameworkHandler.generate({ widgetAst: SIMPLE_AST }, storage);
    expect(result.variant).toBe('ok');
    const output = result.output as string;
    expect(output).toContain('export class MyButton');
    expect(output).toContain('interface MyButtonProps');
    expect(output).toContain('render(): string');
  });

  it('registers in plugin-registry on initialize', async () => {
    const result = await widgetGenFrameworkHandler.initialize!({}, storage);
    expect(result.variant).toBe('ok');
    expect(typeof result.instance).toBe('string');

    const registryEntries = await storage.find('plugin-registry', { pluginKind: 'widget-gen-provider', target: 'framework' });
    expect(registryEntries).toHaveLength(1);
  });

  it('is idempotent on initialize', async () => {
    const first = await widgetGenFrameworkHandler.initialize!({}, storage);
    const second = await widgetGenFrameworkHandler.initialize!({}, storage);
    expect(second.instance).toBe(first.instance);
  });

  it('returns error for invalid JSON', async () => {
    const result = await widgetGenFrameworkHandler.generate({ widgetAst: 'not json' }, storage);
    expect(result.variant).toBe('error');
    expect(result.message).toContain('Failed to parse');
  });
});
