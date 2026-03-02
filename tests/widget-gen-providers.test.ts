// ============================================================
// WidgetGen Provider Architecture Tests
//
// Tests for the plugin-registry provider pattern:
// - Provider initialization and idempotency
// - Plugin-registry discovery
// - Code generation for all 17 targets
// - Main widget-gen handler delegation
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';

// Provider handlers
import { widgetGenReactHandler, resetWidgetGenReactCounter } from '../handlers/ts/app/widget-gen-react.handler.js';
import { widgetGenSolidHandler, resetWidgetGenSolidCounter } from '../handlers/ts/app/widget-gen-solid.handler.js';
import { widgetGenVueHandler, resetWidgetGenVueCounter } from '../handlers/ts/app/widget-gen-vue.handler.js';
import { widgetGenSvelteHandler, resetWidgetGenSvelteCounter } from '../handlers/ts/app/widget-gen-svelte.handler.js';
import { widgetGenInkHandler, resetWidgetGenInkCounter } from '../handlers/ts/app/widget-gen-ink.handler.js';
import { widgetGenReactNativeHandler, resetWidgetGenReactNativeCounter } from '../handlers/ts/app/widget-gen-react-native.handler.js';
import { widgetGenSwiftUIHandler, resetWidgetGenSwiftUICounter } from '../handlers/ts/app/widget-gen-swiftui.handler.js';
import { widgetGenAppKitHandler, resetWidgetGenAppKitCounter } from '../handlers/ts/app/widget-gen-appkit.handler.js';
import { widgetGenComposeHandler, resetWidgetGenComposeCounter } from '../handlers/ts/app/widget-gen-compose.handler.js';
import { widgetGenFrameworkHandler, resetWidgetGenFrameworkCounter } from '../handlers/ts/app/widget-gen-framework.handler.js';
import { widgetGenGtkHandler, resetWidgetGenGtkCounter } from '../handlers/ts/app/widget-gen-gtk.handler.js';
import { widgetGenNativeScriptHandler, resetWidgetGenNativeScriptCounter } from '../handlers/ts/app/widget-gen-nativescript.handler.js';
import { widgetGenNextjsHandler, resetWidgetGenNextjsCounter } from '../handlers/ts/app/widget-gen-nextjs.handler.js';
import { widgetGenVanillaHandler, resetWidgetGenVanillaCounter } from '../handlers/ts/app/widget-gen-vanilla.handler.js';
import { widgetGenWatchKitHandler, resetWidgetGenWatchKitCounter } from '../handlers/ts/app/widget-gen-watchkit.handler.js';
import { widgetGenWearHandler, resetWidgetGenWearCounter } from '../handlers/ts/app/widget-gen-wear.handler.js';
import { widgetGenWinUIHandler, resetWidgetGenWinUICounter } from '../handlers/ts/app/widget-gen-winui.handler.js';

// Main dispatcher
import { widgetGenHandler } from '../handlers/ts/app/widget-gen.handler.js';

import type { ConceptHandler, ConceptStorage } from '../runtime/types.js';

// Test fixtures
const SIMPLE_AST = JSON.stringify({ name: 'MyButton', props: [{ name: 'label', type: 'string' }, { name: 'count', type: 'number' }] });
const NO_PROPS_AST = JSON.stringify({ name: 'Divider', props: [] });

// All providers with their target names and reset functions
const ALL_PROVIDERS: Array<{
  target: string;
  handler: ConceptHandler;
  reset: () => void;
}> = [
  { target: 'react', handler: widgetGenReactHandler, reset: resetWidgetGenReactCounter },
  { target: 'solid', handler: widgetGenSolidHandler, reset: resetWidgetGenSolidCounter },
  { target: 'vue', handler: widgetGenVueHandler, reset: resetWidgetGenVueCounter },
  { target: 'svelte', handler: widgetGenSvelteHandler, reset: resetWidgetGenSvelteCounter },
  { target: 'ink', handler: widgetGenInkHandler, reset: resetWidgetGenInkCounter },
  { target: 'react-native', handler: widgetGenReactNativeHandler, reset: resetWidgetGenReactNativeCounter },
  { target: 'swiftui', handler: widgetGenSwiftUIHandler, reset: resetWidgetGenSwiftUICounter },
  { target: 'appkit', handler: widgetGenAppKitHandler, reset: resetWidgetGenAppKitCounter },
  { target: 'compose', handler: widgetGenComposeHandler, reset: resetWidgetGenComposeCounter },
  { target: 'framework', handler: widgetGenFrameworkHandler, reset: resetWidgetGenFrameworkCounter },
  { target: 'gtk', handler: widgetGenGtkHandler, reset: resetWidgetGenGtkCounter },
  { target: 'nativescript', handler: widgetGenNativeScriptHandler, reset: resetWidgetGenNativeScriptCounter },
  { target: 'nextjs', handler: widgetGenNextjsHandler, reset: resetWidgetGenNextjsCounter },
  { target: 'vanilla', handler: widgetGenVanillaHandler, reset: resetWidgetGenVanillaCounter },
  { target: 'watchkit', handler: widgetGenWatchKitHandler, reset: resetWidgetGenWatchKitCounter },
  { target: 'wear', handler: widgetGenWearHandler, reset: resetWidgetGenWearCounter },
  { target: 'winui', handler: widgetGenWinUIHandler, reset: resetWidgetGenWinUICounter },
];

// ============================================================
// Provider Initialization Tests
// ============================================================

describe('Widget-Gen Provider Initialization', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    ALL_PROVIDERS.forEach(p => p.reset());
  });

  for (const { target, handler, reset } of ALL_PROVIDERS) {
    describe(`WidgetGen ${target}`, () => {
      it('registers and returns ok with an instance ID', async () => {
        const result = await handler.initialize({}, storage);
        expect(result.variant).toBe('ok');
        expect(typeof result.instance).toBe('string');
        expect((result.instance as string).length).toBeGreaterThan(0);
      });

      it('stores provider metadata with correct target', async () => {
        const result = await handler.initialize({}, storage);
        const id = result.instance as string;

        const record = await storage.get(`widget-gen-${target}`, id);
        expect(record).not.toBeNull();
        expect(record!.providerRef).toBe(`widget-gen-provider:${target}`);
        expect(record!.target).toBe(target);
      });

      it('registers in plugin-registry as widget-gen-provider', async () => {
        const result = await handler.initialize({}, storage);
        const id = result.instance as string;

        const registryRecord = await storage.get('plugin-registry', `widget-gen-provider:${id}`);
        expect(registryRecord).not.toBeNull();
        expect(registryRecord!.pluginKind).toBe('widget-gen-provider');
        expect(registryRecord!.target).toBe(target);
        expect(registryRecord!.instanceId).toBe(id);
      });

      it('is idempotent: returns existing instance on second call', async () => {
        const first = await handler.initialize({}, storage);
        const second = await handler.initialize({}, storage);

        expect(second.variant).toBe('ok');
        expect(second.instance).toBe(first.instance);
      });
    });
  }
});

// ============================================================
// Provider Code Generation Tests
// ============================================================

describe('Widget-Gen Provider Code Generation', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    ALL_PROVIDERS.forEach(p => p.reset());
  });

  // All providers should handle invalid JSON
  for (const { target, handler } of ALL_PROVIDERS) {
    it(`${target}: returns error for invalid JSON`, async () => {
      const result = await handler.generate({ widgetAst: 'not json' }, storage);
      expect(result.variant).toBe('error');
      expect(result.message).toContain('Failed to parse');
    });
  }

  // React
  describe('react generate', () => {
    it('produces a functional component with props interface', async () => {
      const result = await widgetGenReactHandler.generate({ widgetAst: SIMPLE_AST }, storage);
      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain('interface MyButtonProps');
      expect(output).toContain('label: string');
      expect(output).toContain('count: number');
      expect(output).toContain('export function MyButton(props: MyButtonProps)');
      expect(output).toContain('<div>MyButton</div>');
    });

    it('omits props interface when no props', async () => {
      const result = await widgetGenReactHandler.generate({ widgetAst: NO_PROPS_AST }, storage);
      expect(result.variant).toBe('ok');
      expect(result.output as string).toContain('export function Divider()');
      expect(result.output as string).not.toContain('interface');
    });
  });

  // Solid
  describe('solid generate', () => {
    it('produces a Component export with typed props', async () => {
      const result = await widgetGenSolidHandler.generate({ widgetAst: SIMPLE_AST }, storage);
      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain("import { Component } from 'solid-js'");
      expect(output).toContain('export const MyButton: Component<');
      expect(output).toContain('label: string');
    });
  });

  // Vue
  describe('vue generate', () => {
    it('produces a Vue SFC with template and script setup', async () => {
      const result = await widgetGenVueHandler.generate({ widgetAst: SIMPLE_AST }, storage);
      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain('<template>');
      expect(output).toContain('<script setup lang="ts">');
      expect(output).toContain('defineProps<{');
    });
  });

  // Svelte
  describe('svelte generate', () => {
    it('produces a Svelte component with exported props', async () => {
      const result = await widgetGenSvelteHandler.generate({ widgetAst: SIMPLE_AST }, storage);
      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain('<script lang="ts">');
      expect(output).toContain('export let label: string');
      expect(output).toContain('export let count: number');
    });
  });

  // Ink
  describe('ink generate', () => {
    it('produces an Ink component with Box and Text', async () => {
      const result = await widgetGenInkHandler.generate({ widgetAst: SIMPLE_AST }, storage);
      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain("import { Box, Text } from 'ink'");
      expect(output).toContain('export function MyButton');
      expect(output).toContain('<Box><Text>');
    });
  });

  // React Native
  describe('react-native generate', () => {
    it('produces a React Native component with View and Text', async () => {
      const result = await widgetGenReactNativeHandler.generate({ widgetAst: SIMPLE_AST }, storage);
      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain("import { View, Text } from 'react-native'");
      expect(output).toContain('export function MyButton');
      expect(output).toContain('<View><Text>');
    });
  });

  // SwiftUI
  describe('swiftui generate', () => {
    it('produces a SwiftUI View struct with Swift types', async () => {
      const result = await widgetGenSwiftUIHandler.generate({ widgetAst: SIMPLE_AST }, storage);
      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain('struct MyButton: View');
      expect(output).toContain('var label: String');
      expect(output).toContain('var count: Int');
      expect(output).toContain('var body: some View');
    });
  });

  // AppKit
  describe('appkit generate', () => {
    it('produces an NSView subclass with configure method', async () => {
      const result = await widgetGenAppKitHandler.generate({ widgetAst: SIMPLE_AST }, storage);
      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain('import AppKit');
      expect(output).toContain('class MyButton: NSView');
      expect(output).toContain('var label: String');
      expect(output).toContain('private func configure()');
      expect(output).toContain('setAccessibilityRole(');
    });

    it('uses APPKIT_WIDGET_MAP when widget type is provided', async () => {
      const ast = JSON.stringify({ name: 'Submit', widget: 'button', props: [] });
      const result = await widgetGenAppKitHandler.generate({ widgetAst: ast }, storage);
      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain('class Submit: NSButton');
    });
  });

  // Compose
  describe('compose generate', () => {
    it('produces a @Composable function with Modifier', async () => {
      const result = await widgetGenComposeHandler.generate({ widgetAst: SIMPLE_AST }, storage);
      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain('@Composable');
      expect(output).toContain('fun MyButton(');
      expect(output).toContain('label: String');
      expect(output).toContain('modifier: Modifier = Modifier');
      expect(output).toContain('Column(modifier = modifier)');
    });
  });

  // Framework
  describe('framework generate', () => {
    it('produces a TypeScript class with typed constructor', async () => {
      const result = await widgetGenFrameworkHandler.generate({ widgetAst: SIMPLE_AST }, storage);
      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain('export class MyButton');
      expect(output).toContain('interface MyButtonProps');
      expect(output).toContain('render(): string');
    });
  });

  // GTK
  describe('gtk generate', () => {
    it('produces a C GtkWidget factory function', async () => {
      const result = await widgetGenGtkHandler.generate({ widgetAst: SIMPLE_AST }, storage);
      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain('#include <gtk/gtk.h>');
      expect(output).toContain('GtkWidget* my_button_new(');
      expect(output).toContain('gtk_box_new(GTK_ORIENTATION_VERTICAL');
      expect(output).toContain('gtk_label_new("MyButton")');
    });
  });

  // NativeScript
  describe('nativescript generate', () => {
    it('produces a View subclass with createNativeView', async () => {
      const result = await widgetGenNativeScriptHandler.generate({ widgetAst: SIMPLE_AST }, storage);
      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain("import { View } from '@nativescript/core'");
      expect(output).toContain('export class MyButton extends View');
      expect(output).toContain('createNativeView()');
      expect(output).toContain('disposeNativeView()');
    });
  });

  // Next.js
  describe('nextjs generate', () => {
    it('produces a client component with use client directive', async () => {
      const result = await widgetGenNextjsHandler.generate({ widgetAst: SIMPLE_AST }, storage);
      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain("'use client'");
      expect(output).toContain('interface MyButtonProps');
      expect(output).toContain('export function MyButton(props: MyButtonProps)');
    });
  });

  // Vanilla
  describe('vanilla generate', () => {
    it('produces a Web Component with customElements.define', async () => {
      const result = await widgetGenVanillaHandler.generate({ widgetAst: SIMPLE_AST }, storage);
      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain('class MyButton extends HTMLElement');
      expect(output).toContain('observedAttributes');
      expect(output).toContain('attachShadow');
      expect(output).toContain("customElements.define('x-my-button'");
    });
  });

  // WatchKit
  describe('watchkit generate', () => {
    it('produces a WKInterfaceObject subclass', async () => {
      const result = await widgetGenWatchKitHandler.generate({ widgetAst: SIMPLE_AST }, storage);
      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain('import WatchKit');
      expect(output).toContain('class MyButton: WKInterfaceObject');
      expect(output).toContain('var label: String');
    });
  });

  // Wear
  describe('wear generate', () => {
    it('produces a Wear OS @Composable with ScalingLazyColumn', async () => {
      const result = await widgetGenWearHandler.generate({ widgetAst: SIMPLE_AST }, storage);
      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain('@Composable');
      expect(output).toContain('fun MyButton(');
      expect(output).toContain('androidx.wear.compose.material.Text');
      expect(output).toContain('ScalingLazyColumn');
    });
  });

  // WinUI
  describe('winui generate', () => {
    it('produces a C# UserControl class', async () => {
      const result = await widgetGenWinUIHandler.generate({ widgetAst: SIMPLE_AST }, storage);
      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain('using Microsoft.UI.Xaml.Controls');
      expect(output).toContain('public sealed partial class MyButton : UserControl');
      expect(output).toContain('public string Label { get; set; }');
      expect(output).toContain('InitializeComponent()');
    });
  });
});

// ============================================================
// Plugin-Registry Discovery Tests
// ============================================================

describe('Widget-Gen Plugin-Registry Discovery', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    ALL_PROVIDERS.forEach(p => p.reset());
  });

  it('all 17 providers register distinct entries in plugin-registry', async () => {
    for (const { handler } of ALL_PROVIDERS) {
      await handler.initialize({}, storage);
    }

    const entries = await storage.find('plugin-registry', { pluginKind: 'widget-gen-provider' });
    expect(entries).toHaveLength(17);

    const targets = entries.map(e => e.target as string).sort();
    expect(targets).toEqual([
      'appkit', 'compose', 'framework', 'gtk', 'ink',
      'nativescript', 'nextjs', 'react', 'react-native',
      'solid', 'svelte', 'swiftui', 'vanilla', 'vue',
      'watchkit', 'wear', 'winui',
    ]);
  });

  it('each provider can be discovered by target from plugin-registry', async () => {
    for (const { handler } of ALL_PROVIDERS) {
      await handler.initialize({}, storage);
    }

    for (const { target } of ALL_PROVIDERS) {
      const matches = await storage.find('plugin-registry', {
        pluginKind: 'widget-gen-provider',
        target,
      });
      expect(matches).toHaveLength(1);
      expect(matches[0].target).toBe(target);
    }
  });
});

// ============================================================
// Main WidgetGen Dispatcher Tests
// ============================================================

describe('WidgetGen Dispatcher (plugin-registry delegation)', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    ALL_PROVIDERS.forEach(p => p.reset());
  });

  it('returns error when no providers are registered', async () => {
    const result = await widgetGenHandler.generate(
      { gen: 'g1', target: 'react', widgetAst: SIMPLE_AST },
      storage,
    );
    expect(result.variant).toBe('error');
    expect(result.message).toContain('No widget-gen-provider registered');
    expect(result.message).toContain('"react"');
  });

  it('returns error listing registered providers for unknown target', async () => {
    await widgetGenReactHandler.initialize({}, storage);
    await widgetGenVueHandler.initialize({}, storage);

    const result = await widgetGenHandler.generate(
      { gen: 'g1', target: 'unknown-target', widgetAst: SIMPLE_AST },
      storage,
    );
    expect(result.variant).toBe('error');
    expect(result.message).toContain('No widget-gen-provider registered');
    expect(result.message).toContain('react');
    expect(result.message).toContain('vue');
  });

  it('returns error for invalid JSON widgetAst', async () => {
    await widgetGenReactHandler.initialize({}, storage);

    const result = await widgetGenHandler.generate(
      { gen: 'g1', target: 'react', widgetAst: 'bad json' },
      storage,
    );
    expect(result.variant).toBe('error');
    expect(result.message).toContain('Failed to parse widget AST');
  });

  it('delegates to matching provider and returns delegateTo', async () => {
    await widgetGenReactHandler.initialize({}, storage);

    const result = await widgetGenHandler.generate(
      { gen: 'g1', target: 'react', widgetAst: SIMPLE_AST },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.delegateTo).toBeDefined();

    const delegate = result.delegateTo as { concept: string; action: string; input: Record<string, unknown> };
    expect(delegate.concept).toBe('WidgetGenReact');
    expect(delegate.action).toBe('generate');
    expect(delegate.input.componentName).toBe('MyButton');
  });

  it('stores delegation record in widgetGen storage', async () => {
    await widgetGenReactHandler.initialize({}, storage);

    await widgetGenHandler.generate(
      { gen: 'g1', target: 'react', widgetAst: SIMPLE_AST },
      storage,
    );

    const records = await storage.find('widgetGen', {});
    expect(records.length).toBeGreaterThan(0);
    const record = records[0];
    expect(record.target).toBe('react');
    expect(record.status).toBe('delegated');
    expect(record.providerRef).toBe('widget-gen-provider:react');
  });

  it('generates correct concept name for hyphenated targets', async () => {
    await widgetGenReactNativeHandler.initialize({}, storage);

    const result = await widgetGenHandler.generate(
      { gen: 'g1', target: 'react-native', widgetAst: SIMPLE_AST },
      storage,
    );
    expect(result.variant).toBe('ok');
    const delegate = result.delegateTo as { concept: string };
    expect(delegate.concept).toBe('WidgetGenReactNative');
  });
});
