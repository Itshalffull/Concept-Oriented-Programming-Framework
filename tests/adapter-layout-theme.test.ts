// ============================================================
// Tests for Layout + Theme Token Normalization Across All Adapters
//
// Validates that every framework adapter correctly normalizes
// layout props (LayoutConfig) into platform-specific container
// descriptions and theme props (ResolvedTheme) into platform-
// native token formats.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';

// --- Adapter handler imports ---
import { reactAdapterHandler } from '../handlers/ts/app/react-adapter.handler.js';
import { solidAdapterHandler } from '../handlers/ts/app/solid-adapter.handler.js';
import { vueAdapterHandler } from '../handlers/ts/app/vue-adapter.handler.js';
import { svelteAdapterHandler } from '../handlers/ts/app/svelte-adapter.handler.js';
import { nextjsAdapterHandler } from '../handlers/ts/app/nextjs-adapter.handler.js';
import { vanillaAdapterHandler } from '../handlers/ts/app/vanilla-adapter.handler.js';
import { inkAdapterHandler } from '../handlers/ts/app/ink-adapter.handler.js';
import { reactNativeAdapterHandler } from '../handlers/ts/app/react-native-adapter.handler.js';
import { appKitAdapterHandler } from '../handlers/ts/app/appkit-adapter.handler.js';
import { frameworkAdapterHandler } from '../handlers/ts/app/framework-adapter.handler.js';
import { gtkAdapterHandler } from '../handlers/ts/app/gtk-adapter.handler.js';
import { nativeScriptAdapterHandler } from '../handlers/ts/app/nativescript-adapter.handler.js';
import { watchKitAdapterHandler } from '../handlers/ts/app/watchkit-adapter.handler.js';
import { winUIAdapterHandler } from '../handlers/ts/app/winui-adapter.handler.js';
import { swiftUIAdapterHandler } from '../handlers/ts/app/swiftui-adapter.handler.js';
import { composeAdapterHandler } from '../handlers/ts/app/compose-adapter.handler.js';
import { wearComposeAdapterHandler } from '../handlers/ts/app/wear-compose-adapter.handler.js';

// --- Helper ---

type AdapterHandler = { normalize: (input: Record<string, unknown>, storage: any) => Promise<Record<string, unknown>> };

async function normalizeProps(handler: AdapterHandler, props: Record<string, unknown>): Promise<Record<string, unknown>> {
  const storage = createInMemoryStorage();
  const result = await handler.normalize(
    { adapter: 'test', props: JSON.stringify(props) },
    storage,
  ) as Record<string, unknown>;
  return JSON.parse(result.normalized as string);
}

// --- Shared test fixtures ---

const STACK_LAYOUT = { kind: 'stack', direction: 'column', gap: '8px' };
const ROW_LAYOUT = { kind: 'stack', direction: 'row', gap: '16px' };
const GRID_LAYOUT = { kind: 'grid', columns: '1fr 1fr 1fr', rows: 'auto', gap: '12px' };
const SPLIT_LAYOUT = { kind: 'split' };
const OVERLAY_LAYOUT = { kind: 'overlay' };
const FLOW_LAYOUT = { kind: 'flow', gap: '4px' };
const SIDEBAR_LAYOUT = { kind: 'sidebar' };
const CENTER_LAYOUT = { kind: 'center' };

const THEME = {
  name: 'brand',
  tokens: {
    'color-primary': 'oklch(0.7 0.15 200)',
    'color-secondary': '#6c757d',
    'spacing-md': '16px',
    'font-body': '16px/1.5 system-ui',
  },
};

// ==============================
// CSS-Based Adapters (React, Solid, Vue, Svelte, Next.js, Vanilla, Framework)
// ==============================

const CSS_ADAPTERS: Array<[string, AdapterHandler]> = [
  ['React', reactAdapterHandler],
  ['Solid', solidAdapterHandler],
  ['Vue', vueAdapterHandler],
  ['Svelte', svelteAdapterHandler],
  ['Next.js', nextjsAdapterHandler],
  ['Vanilla', vanillaAdapterHandler],
  ['Framework (fallback)', frameworkAdapterHandler],
];

describe.each(CSS_ADAPTERS)('%s Adapter — Layout Normalization', (_name, handler) => {
  it('normalizes stack column layout to CSS flex column', async () => {
    const result = await normalizeProps(handler, { layout: JSON.stringify(STACK_LAYOUT) });
    expect(result.__layout).toEqual({
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    });
  });

  it('normalizes stack row layout to CSS flex row', async () => {
    const result = await normalizeProps(handler, { layout: JSON.stringify(ROW_LAYOUT) });
    expect(result.__layout).toEqual({
      display: 'flex',
      flexDirection: 'row',
      gap: '16px',
    });
  });

  it('normalizes grid layout to CSS grid', async () => {
    const result = await normalizeProps(handler, { layout: JSON.stringify(GRID_LAYOUT) });
    const layout = result.__layout as Record<string, string>;
    expect(layout.display).toBe('grid');
    expect(layout.gridTemplateColumns).toBe('1fr 1fr 1fr');
    expect(layout.gridTemplateRows).toBe('auto');
    expect(layout.gap).toBe('12px');
  });

  it('normalizes split layout to flex row', async () => {
    const result = await normalizeProps(handler, { layout: JSON.stringify(SPLIT_LAYOUT) });
    const layout = result.__layout as Record<string, string>;
    expect(layout.display).toBe('flex');
    expect(layout.flexDirection).toBe('row');
  });

  it('normalizes overlay layout to position relative', async () => {
    const result = await normalizeProps(handler, { layout: JSON.stringify(OVERLAY_LAYOUT) });
    const layout = result.__layout as Record<string, string>;
    expect(layout.position).toBe('relative');
  });

  it('normalizes flow layout to flex wrap', async () => {
    const result = await normalizeProps(handler, { layout: JSON.stringify(FLOW_LAYOUT) });
    const layout = result.__layout as Record<string, string>;
    expect(layout.display).toBe('flex');
    expect(layout.flexWrap).toBe('wrap');
    expect(layout.gap).toBe('4px');
  });

  it('normalizes sidebar layout to grid with auto/1fr columns', async () => {
    const result = await normalizeProps(handler, { layout: JSON.stringify(SIDEBAR_LAYOUT) });
    const layout = result.__layout as Record<string, string>;
    expect(layout.display).toBe('grid');
    expect(layout.gridTemplateColumns).toBe('auto 1fr');
  });

  it('normalizes center layout to flex center', async () => {
    const result = await normalizeProps(handler, { layout: JSON.stringify(CENTER_LAYOUT) });
    const layout = result.__layout as Record<string, string>;
    expect(layout.display).toBe('flex');
    expect(layout.justifyContent).toBe('center');
    expect(layout.alignItems).toBe('center');
  });

  it('handles plain string layout kind', async () => {
    const result = await normalizeProps(handler, { layout: 'center' });
    const layout = result.__layout as Record<string, string>;
    expect(layout.justifyContent).toBe('center');
    expect(layout.alignItems).toBe('center');
  });

  it('defaults to stack when kind is missing', async () => {
    const result = await normalizeProps(handler, { layout: JSON.stringify({ gap: '8px' }) });
    const layout = result.__layout as Record<string, string>;
    expect(layout.display).toBe('flex');
    expect(layout.flexDirection).toBe('column');
  });
});

describe.each(CSS_ADAPTERS)('%s Adapter — Theme Token Normalization', (_name, handler) => {
  it('normalizes theme tokens to CSS custom properties', async () => {
    const result = await normalizeProps(handler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string>;
    expect(tokens['--color-primary']).toBe('oklch(0.7 0.15 200)');
    expect(tokens['--color-secondary']).toBe('#6c757d');
    expect(tokens['--spacing-md']).toBe('16px');
    expect(tokens['--font-body']).toBe('16px/1.5 system-ui');
  });

  it('handles theme as JSON string', async () => {
    const result = await normalizeProps(handler, { theme: JSON.stringify(THEME) });
    expect(result.__themeTokens).toBeDefined();
  });

  it('skips invalid theme JSON gracefully', async () => {
    const result = await normalizeProps(handler, { theme: '{not valid' });
    expect(result.__themeTokens).toBeUndefined();
  });
});

// ==============================
// Ink Adapter (Terminal)
// ==============================

describe('Ink Adapter — Layout Normalization', () => {
  it('normalizes stack column to flexDirection column', async () => {
    const result = await normalizeProps(inkAdapterHandler, { layout: JSON.stringify(STACK_LAYOUT) });
    const layout = result.__layout as Record<string, string>;
    expect(layout.flexDirection).toBe('column');
    expect(layout.gap).toBe('8px');
  });

  it('normalizes stack row to flexDirection row', async () => {
    const result = await normalizeProps(inkAdapterHandler, { layout: JSON.stringify(ROW_LAYOUT) });
    const layout = result.__layout as Record<string, string>;
    expect(layout.flexDirection).toBe('row');
  });

  it('normalizes flow to flex wrap', async () => {
    const result = await normalizeProps(inkAdapterHandler, { layout: JSON.stringify(FLOW_LAYOUT) });
    const layout = result.__layout as Record<string, string>;
    expect(layout.flexDirection).toBe('row');
    expect(layout.flexWrap).toBe('wrap');
  });

  it('normalizes center to justify/align center', async () => {
    const result = await normalizeProps(inkAdapterHandler, { layout: JSON.stringify(CENTER_LAYOUT) });
    const layout = result.__layout as Record<string, string>;
    expect(layout.justifyContent).toBe('center');
    expect(layout.alignItems).toBe('center');
  });

  it('falls back unsupported kinds (grid, split, overlay, sidebar) to stack', async () => {
    for (const kind of ['grid', 'split', 'overlay', 'sidebar']) {
      const result = await normalizeProps(inkAdapterHandler, { layout: JSON.stringify({ kind }) });
      const layout = result.__layout as Record<string, string>;
      expect(layout.flexDirection).toBe('column');
    }
  });
});

describe('Ink Adapter — Theme Token Normalization', () => {
  it('extracts color tokens by stripping color- prefix', async () => {
    const result = await normalizeProps(inkAdapterHandler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string | boolean>;
    expect(tokens['primary']).toBe('oklch(0.7 0.15 200)');
    expect(tokens['secondary']).toBe('#6c757d');
  });

  it('includes spacing tokens', async () => {
    const result = await normalizeProps(inkAdapterHandler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string | boolean>;
    expect(tokens['spacing-md']).toBe('16px');
  });

  it('excludes non-color/dimension tokens (font)', async () => {
    const result = await normalizeProps(inkAdapterHandler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string | boolean>;
    expect(tokens['font-body']).toBeUndefined();
  });
});

// ==============================
// React Native Adapter
// ==============================

describe('React Native Adapter — Layout Normalization', () => {
  it('normalizes stack column', async () => {
    const result = await normalizeProps(reactNativeAdapterHandler, { layout: JSON.stringify(STACK_LAYOUT) });
    const layout = result.__layout as Record<string, string>;
    expect(layout.flexDirection).toBe('column');
    expect(layout.gap).toBe('8px');
  });

  it('normalizes overlay to position absolute', async () => {
    const result = await normalizeProps(reactNativeAdapterHandler, { layout: JSON.stringify(OVERLAY_LAYOUT) });
    const layout = result.__layout as Record<string, string>;
    expect(layout.position).toBe('absolute');
  });

  it('normalizes flow to flex wrap', async () => {
    const result = await normalizeProps(reactNativeAdapterHandler, { layout: JSON.stringify(FLOW_LAYOUT) });
    const layout = result.__layout as Record<string, string>;
    expect(layout.flexWrap).toBe('wrap');
  });

  it('normalizes center', async () => {
    const result = await normalizeProps(reactNativeAdapterHandler, { layout: JSON.stringify(CENTER_LAYOUT) });
    const layout = result.__layout as Record<string, string>;
    expect(layout.justifyContent).toBe('center');
    expect(layout.alignItems).toBe('center');
  });

  it('falls back grid/split/sidebar to stack', async () => {
    for (const kind of ['grid', 'split', 'sidebar']) {
      const result = await normalizeProps(reactNativeAdapterHandler, { layout: JSON.stringify({ kind }) });
      const layout = result.__layout as Record<string, string>;
      expect(layout.flexDirection).toBe('column');
    }
  });
});

describe('React Native Adapter — Theme Token Normalization', () => {
  it('converts token names to camelCase', async () => {
    const result = await normalizeProps(reactNativeAdapterHandler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string | number>;
    expect(tokens['colorPrimary']).toBe('oklch(0.7 0.15 200)');
    expect(tokens['colorSecondary']).toBe('#6c757d');
  });

  it('parses px dimension values to numbers', async () => {
    const result = await normalizeProps(reactNativeAdapterHandler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string | number>;
    expect(tokens['spacingMd']).toBe(16);
  });

  it('preserves non-numeric values as strings', async () => {
    const result = await normalizeProps(reactNativeAdapterHandler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string | number>;
    expect(typeof tokens['fontBody']).toBe('string');
  });
});

// ==============================
// SwiftUI Adapter
// ==============================

describe('SwiftUI Adapter — Layout Normalization', () => {
  it('normalizes stack column to VStack', async () => {
    const result = await normalizeProps(swiftUIAdapterHandler, { layout: JSON.stringify(STACK_LAYOUT) });
    const layout = result.__container as Record<string, unknown>;
    expect(layout.container).toBe('VStack');
    expect(layout.spacing).toBe('8px');
  });

  it('normalizes stack row to HStack', async () => {
    const result = await normalizeProps(swiftUIAdapterHandler, { layout: JSON.stringify(ROW_LAYOUT) });
    const layout = result.__container as Record<string, unknown>;
    expect(layout.container).toBe('HStack');
  });

  it('normalizes grid to LazyVGrid', async () => {
    const result = await normalizeProps(swiftUIAdapterHandler, { layout: JSON.stringify(GRID_LAYOUT) });
    const layout = result.__container as Record<string, unknown>;
    expect(layout.container).toBe('LazyVGrid');
  });

  it('normalizes overlay to ZStack', async () => {
    const result = await normalizeProps(swiftUIAdapterHandler, { layout: JSON.stringify(OVERLAY_LAYOUT) });
    const layout = result.__container as Record<string, unknown>;
    expect(layout.container).toBe('ZStack');
  });

  it('normalizes split to HSplitView', async () => {
    const result = await normalizeProps(swiftUIAdapterHandler, { layout: JSON.stringify(SPLIT_LAYOUT) });
    const layout = result.__container as Record<string, unknown>;
    expect(layout.container).toBe('HSplitView');
  });

  it('normalizes sidebar to NavigationSplitView', async () => {
    const result = await normalizeProps(swiftUIAdapterHandler, { layout: JSON.stringify(SIDEBAR_LAYOUT) });
    const layout = result.__container as Record<string, unknown>;
    expect(layout.container).toBe('NavigationSplitView');
  });

  it('normalizes center with .center modifier', async () => {
    const result = await normalizeProps(swiftUIAdapterHandler, { layout: JSON.stringify(CENTER_LAYOUT) });
    const layout = result.__container as Record<string, unknown>;
    expect(layout.modifier).toBe('.center');
  });
});

describe('SwiftUI Adapter — Theme Token Normalization', () => {
  it('converts color tokens to Color: prefix', async () => {
    const result = await normalizeProps(swiftUIAdapterHandler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string>;
    expect(tokens['Color:primary']).toBe('oklch(0.7 0.15 200)');
    expect(tokens['Color:secondary']).toBe('#6c757d');
  });

  it('converts font tokens to Font: prefix', async () => {
    const result = await normalizeProps(swiftUIAdapterHandler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string>;
    expect(tokens['Font:body']).toBe('16px/1.5 system-ui');
  });

  it('passes non-prefixed tokens through', async () => {
    const result = await normalizeProps(swiftUIAdapterHandler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string>;
    expect(tokens['spacing-md']).toBe('16px');
  });
});

// ==============================
// AppKit Adapter
// ==============================

describe('AppKit Adapter — Layout Normalization', () => {
  it('normalizes stack column to NSStackView vertical', async () => {
    const result = await normalizeProps(appKitAdapterHandler, { layout: JSON.stringify(STACK_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('NSStackView');
    expect(layout.orientation).toBe('.vertical');
    expect(layout.spacing).toBe('8px');
  });

  it('normalizes stack row to NSStackView horizontal', async () => {
    const result = await normalizeProps(appKitAdapterHandler, { layout: JSON.stringify(ROW_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('NSStackView');
    expect(layout.orientation).toBe('.horizontal');
  });

  it('normalizes grid to NSGridView', async () => {
    const result = await normalizeProps(appKitAdapterHandler, { layout: JSON.stringify(GRID_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('NSGridView');
  });

  it('normalizes split to NSSplitView', async () => {
    const result = await normalizeProps(appKitAdapterHandler, { layout: JSON.stringify(SPLIT_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('NSSplitView');
  });

  it('normalizes overlay to NSView stacked', async () => {
    const result = await normalizeProps(appKitAdapterHandler, { layout: JSON.stringify(OVERLAY_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('NSView');
    expect(layout.subviewLayout).toBe('stacked');
  });

  it('normalizes flow to NSCollectionView flowLayout', async () => {
    const result = await normalizeProps(appKitAdapterHandler, { layout: JSON.stringify(FLOW_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('NSCollectionView');
    expect(layout.collectionLayout).toBe('flowLayout');
  });

  it('normalizes center to NSView centered constraints', async () => {
    const result = await normalizeProps(appKitAdapterHandler, { layout: JSON.stringify(CENTER_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('NSView');
    expect(layout.constraints).toBe('centered');
  });
});

describe('AppKit Adapter — Theme Token Normalization', () => {
  it('converts color tokens to NSColor: prefix', async () => {
    const result = await normalizeProps(appKitAdapterHandler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string>;
    expect(tokens['NSColor:primary']).toBe('oklch(0.7 0.15 200)');
  });

  it('converts font tokens to NSFont: prefix', async () => {
    const result = await normalizeProps(appKitAdapterHandler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string>;
    expect(tokens['NSFont:body']).toBe('16px/1.5 system-ui');
  });
});

// ==============================
// Compose Adapter
// ==============================

describe('Compose Adapter — Layout Normalization', () => {
  it('normalizes stack column to Column', async () => {
    const result = await normalizeProps(composeAdapterHandler, { layout: JSON.stringify(STACK_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('Column');
    expect(layout.spacing).toBe('8px');
  });

  it('normalizes stack row to Row', async () => {
    const result = await normalizeProps(composeAdapterHandler, { layout: JSON.stringify(ROW_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('Row');
  });

  it('normalizes grid to LazyVerticalGrid', async () => {
    const result = await normalizeProps(composeAdapterHandler, { layout: JSON.stringify(GRID_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('LazyVerticalGrid');
  });

  it('normalizes split to Row with weight', async () => {
    const result = await normalizeProps(composeAdapterHandler, { layout: JSON.stringify(SPLIT_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('Row');
    expect(layout.modifier).toBe('weight');
  });

  it('normalizes overlay to Box', async () => {
    const result = await normalizeProps(composeAdapterHandler, { layout: JSON.stringify(OVERLAY_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('Box');
  });

  it('normalizes flow to FlowRow', async () => {
    const result = await normalizeProps(composeAdapterHandler, { layout: JSON.stringify(FLOW_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('FlowRow');
  });

  it('normalizes sidebar to Scaffold with drawer', async () => {
    const result = await normalizeProps(composeAdapterHandler, { layout: JSON.stringify(SIDEBAR_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('Scaffold');
    expect(layout.drawer).toBe(true);
  });

  it('normalizes center to Box with Alignment.Center', async () => {
    const result = await normalizeProps(composeAdapterHandler, { layout: JSON.stringify(CENTER_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('Box');
    expect(layout.alignment).toBe('Alignment.Center');
  });
});

describe('Compose Adapter — Theme Token Normalization', () => {
  it('converts color tokens to colorScheme prefix', async () => {
    const result = await normalizeProps(composeAdapterHandler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string>;
    expect(tokens['colorScheme.primary']).toBe('oklch(0.7 0.15 200)');
  });

  it('converts font tokens to typography prefix', async () => {
    const result = await normalizeProps(composeAdapterHandler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string>;
    expect(tokens['typography.body']).toBe('16px/1.5 system-ui');
  });
});

// ==============================
// Wear Compose Adapter
// ==============================

describe('Wear Compose Adapter — Layout Normalization', () => {
  it('normalizes stack column to curved Column', async () => {
    const result = await normalizeProps(wearComposeAdapterHandler, { layout: JSON.stringify(STACK_LAYOUT) });
    const layout = result.__curvedLayout as Record<string, unknown>;
    expect(layout.container).toBe('Column');
    expect(layout.curved).toBe(true);
    expect(layout.spacing).toBe('8px');
  });

  it('normalizes stack row to curved Row', async () => {
    const result = await normalizeProps(wearComposeAdapterHandler, { layout: JSON.stringify(ROW_LAYOUT) });
    const layout = result.__curvedLayout as Record<string, unknown>;
    expect(layout.container).toBe('Row');
    expect(layout.curved).toBe(true);
  });

  it('normalizes center to Box with Alignment.Center', async () => {
    const result = await normalizeProps(wearComposeAdapterHandler, { layout: JSON.stringify(CENTER_LAYOUT) });
    const layout = result.__curvedLayout as Record<string, unknown>;
    expect(layout.container).toBe('Box');
    expect(layout.alignment).toBe('Alignment.Center');
  });

  it('falls back unsupported layout kinds to curved stack', async () => {
    for (const kind of ['grid', 'split', 'overlay', 'flow', 'sidebar']) {
      const result = await normalizeProps(wearComposeAdapterHandler, { layout: JSON.stringify({ kind }) });
      const layout = result.__curvedLayout as Record<string, unknown>;
      expect(layout.curved).toBe(true);
    }
  });
});

describe('Wear Compose Adapter — Theme Token Normalization', () => {
  it('converts color tokens to colorScheme prefix', async () => {
    const result = await normalizeProps(wearComposeAdapterHandler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string>;
    expect(tokens['colorScheme.primary']).toBe('oklch(0.7 0.15 200)');
  });

  it('converts font tokens to typography prefix', async () => {
    const result = await normalizeProps(wearComposeAdapterHandler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string>;
    expect(tokens['typography.body']).toBe('16px/1.5 system-ui');
  });
});

// ==============================
// GTK Adapter
// ==============================

describe('GTK Adapter — Layout Normalization', () => {
  it('normalizes stack column to GtkBox VERTICAL', async () => {
    const result = await normalizeProps(gtkAdapterHandler, { layout: JSON.stringify(STACK_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('GtkBox');
    expect(layout.orientation).toBe('VERTICAL');
    expect(layout.spacing).toBe('8px');
  });

  it('normalizes stack row to GtkBox HORIZONTAL', async () => {
    const result = await normalizeProps(gtkAdapterHandler, { layout: JSON.stringify(ROW_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('GtkBox');
    expect(layout.orientation).toBe('HORIZONTAL');
  });

  it('normalizes grid to GtkGrid', async () => {
    const result = await normalizeProps(gtkAdapterHandler, { layout: JSON.stringify(GRID_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('GtkGrid');
  });

  it('normalizes split to GtkPaned', async () => {
    const result = await normalizeProps(gtkAdapterHandler, { layout: JSON.stringify(SPLIT_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('GtkPaned');
  });

  it('normalizes overlay to GtkOverlay', async () => {
    const result = await normalizeProps(gtkAdapterHandler, { layout: JSON.stringify(OVERLAY_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('GtkOverlay');
  });

  it('normalizes flow to GtkFlowBox', async () => {
    const result = await normalizeProps(gtkAdapterHandler, { layout: JSON.stringify(FLOW_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('GtkFlowBox');
  });

  it('normalizes center to GtkBox with CENTER alignment', async () => {
    const result = await normalizeProps(gtkAdapterHandler, { layout: JSON.stringify(CENTER_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('GtkBox');
    expect(layout.halign).toBe('CENTER');
    expect(layout.valign).toBe('CENTER');
  });
});

describe('GTK Adapter — Theme Token Normalization', () => {
  it('converts color tokens to @define-color prefix', async () => {
    const result = await normalizeProps(gtkAdapterHandler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string>;
    expect(tokens['@define-color:primary']).toBe('oklch(0.7 0.15 200)');
  });

  it('passes font tokens through', async () => {
    const result = await normalizeProps(gtkAdapterHandler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string>;
    expect(tokens['font-body']).toBe('16px/1.5 system-ui');
  });
});

// ==============================
// NativeScript Adapter
// ==============================

describe('NativeScript Adapter — Layout Normalization', () => {
  it('normalizes stack to StackLayout', async () => {
    const result = await normalizeProps(nativeScriptAdapterHandler, { layout: JSON.stringify(STACK_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('StackLayout');
    expect(layout.spacing).toBe('8px');
  });

  it('normalizes stack row to StackLayout horizontal', async () => {
    const result = await normalizeProps(nativeScriptAdapterHandler, { layout: JSON.stringify(ROW_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('StackLayout');
    expect(layout.orientation).toBe('horizontal');
  });

  it('normalizes grid to GridLayout', async () => {
    const result = await normalizeProps(nativeScriptAdapterHandler, { layout: JSON.stringify(GRID_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('GridLayout');
  });

  it('normalizes overlay to AbsoluteLayout', async () => {
    const result = await normalizeProps(nativeScriptAdapterHandler, { layout: JSON.stringify(OVERLAY_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('AbsoluteLayout');
  });

  it('normalizes flow to WrapLayout', async () => {
    const result = await normalizeProps(nativeScriptAdapterHandler, { layout: JSON.stringify(FLOW_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('WrapLayout');
  });

  it('normalizes sidebar to SideDrawer', async () => {
    const result = await normalizeProps(nativeScriptAdapterHandler, { layout: JSON.stringify(SIDEBAR_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('SideDrawer');
  });

  it('normalizes center to GridLayout centered', async () => {
    const result = await normalizeProps(nativeScriptAdapterHandler, { layout: JSON.stringify(CENTER_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('GridLayout');
    expect(layout.horizontalAlignment).toBe('center');
    expect(layout.verticalAlignment).toBe('center');
  });
});

describe('NativeScript Adapter — Theme Token Normalization', () => {
  it('converts tokens to --ns- prefixed CSS variables', async () => {
    const result = await normalizeProps(nativeScriptAdapterHandler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string>;
    expect(tokens['--ns-color-primary']).toBe('oklch(0.7 0.15 200)');
    expect(tokens['--ns-spacing-md']).toBe('16px');
  });
});

// ==============================
// WatchKit Adapter
// ==============================

describe('WatchKit Adapter — Layout Normalization', () => {
  it('normalizes stack to WKInterfaceGroup vertical', async () => {
    const result = await normalizeProps(watchKitAdapterHandler, { layout: JSON.stringify(STACK_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('WKInterfaceGroup');
    expect(layout.orientation).toBe('vertical');
    expect(layout.spacing).toBe('8px');
  });

  it('normalizes stack row to WKInterfaceGroup horizontal', async () => {
    const result = await normalizeProps(watchKitAdapterHandler, { layout: JSON.stringify(ROW_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('WKInterfaceGroup');
    expect(layout.orientation).toBe('horizontal');
  });

  it('falls back unsupported kinds to WKInterfaceGroup', async () => {
    for (const kind of ['grid', 'split', 'overlay', 'flow', 'sidebar']) {
      const result = await normalizeProps(watchKitAdapterHandler, { layout: JSON.stringify({ kind }) });
      const layout = result.__layout as Record<string, unknown>;
      expect(layout.container).toBe('WKInterfaceGroup');
    }
  });
});

describe('WatchKit Adapter — Theme Token Normalization', () => {
  it('converts color tokens to nameColor format', async () => {
    const result = await normalizeProps(watchKitAdapterHandler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string>;
    expect(tokens['primaryColor']).toBe('oklch(0.7 0.15 200)');
    expect(tokens['secondaryColor']).toBe('#6c757d');
  });

  it('includes spacing tokens', async () => {
    const result = await normalizeProps(watchKitAdapterHandler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string>;
    expect(tokens['spacing-md']).toBe('16px');
  });

  it('excludes non-color/dimension tokens (font)', async () => {
    const result = await normalizeProps(watchKitAdapterHandler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string>;
    expect(tokens['Font:body']).toBeUndefined();
    expect(tokens['font-body']).toBeUndefined();
    expect(tokens['bodyFont']).toBeUndefined();
  });
});

// ==============================
// WinUI Adapter
// ==============================

describe('WinUI Adapter — Layout Normalization', () => {
  it('normalizes stack column to StackPanel Vertical', async () => {
    const result = await normalizeProps(winUIAdapterHandler, { layout: JSON.stringify(STACK_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('StackPanel');
    expect(layout.orientation).toBe('Vertical');
    expect(layout.spacing).toBe('8px');
  });

  it('normalizes stack row to StackPanel Horizontal', async () => {
    const result = await normalizeProps(winUIAdapterHandler, { layout: JSON.stringify(ROW_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('StackPanel');
    expect(layout.orientation).toBe('Horizontal');
  });

  it('normalizes grid to Grid', async () => {
    const result = await normalizeProps(winUIAdapterHandler, { layout: JSON.stringify(GRID_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('Grid');
    expect(layout.columnDefinitions).toBe('1fr 1fr 1fr');
  });

  it('normalizes split to SplitView', async () => {
    const result = await normalizeProps(winUIAdapterHandler, { layout: JSON.stringify(SPLIT_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('SplitView');
  });

  it('normalizes overlay to Canvas', async () => {
    const result = await normalizeProps(winUIAdapterHandler, { layout: JSON.stringify(OVERLAY_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('Canvas');
  });

  it('normalizes flow to ItemsWrapGrid', async () => {
    const result = await normalizeProps(winUIAdapterHandler, { layout: JSON.stringify(FLOW_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('ItemsWrapGrid');
  });

  it('normalizes sidebar to NavigationView', async () => {
    const result = await normalizeProps(winUIAdapterHandler, { layout: JSON.stringify(SIDEBAR_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('NavigationView');
  });

  it('normalizes center to Grid with Center alignment', async () => {
    const result = await normalizeProps(winUIAdapterHandler, { layout: JSON.stringify(CENTER_LAYOUT) });
    const layout = result.__layout as Record<string, unknown>;
    expect(layout.container).toBe('Grid');
    expect(layout.horizontalAlignment).toBe('Center');
    expect(layout.verticalAlignment).toBe('Center');
  });
});

describe('WinUI Adapter — Theme Token Normalization', () => {
  it('converts tokens to ThemeResource PascalCase keys', async () => {
    const result = await normalizeProps(winUIAdapterHandler, { theme: JSON.stringify(THEME) });
    const tokens = result.__themeTokens as Record<string, string>;
    expect(tokens['ThemeResource:ColorPrimary']).toBe('oklch(0.7 0.15 200)');
    expect(tokens['ThemeResource:SpacingMd']).toBe('16px');
    expect(tokens['ThemeResource:FontBody']).toBe('16px/1.5 system-ui');
  });
});

// ==============================
// Cross-Adapter: Layout + Theme coexistence
// ==============================

describe('Layout and Theme props coexist with other props', () => {
  it('React: layout + theme + event + class all produce correct outputs', async () => {
    const result = await normalizeProps(reactAdapterHandler, {
      layout: JSON.stringify(STACK_LAYOUT),
      theme: JSON.stringify(THEME),
      class: 'my-class',
      onclick: 'handleClick',
    });
    expect(result.__layout).toBeDefined();
    expect(result.__themeTokens).toBeDefined();
    expect(result.className).toBe('my-class');
    expect(result.onClick).toBeDefined();
  });

  it('SwiftUI: layout + theme + event all produce correct outputs', async () => {
    const result = await normalizeProps(swiftUIAdapterHandler, {
      layout: JSON.stringify(STACK_LAYOUT),
      theme: JSON.stringify(THEME),
      onclick: 'handleTap',
    });
    expect(result.__container).toBeDefined();
    expect(result.__themeTokens).toBeDefined();
    expect(result.onTapGesture).toBe('handleTap');
  });

  it('Compose: layout + theme + modifier all produce correct outputs', async () => {
    const result = await normalizeProps(composeAdapterHandler, {
      layout: JSON.stringify(STACK_LAYOUT),
      theme: JSON.stringify(THEME),
      onclick: 'handleClick',
    });
    expect(result.__layout).toBeDefined();
    expect(result.__themeTokens).toBeDefined();
    expect(result['Modifier.clickable']).toBe('handleClick');
  });
});

// ==============================
// Edge Cases
// ==============================

describe('Layout and Theme edge cases', () => {
  it('plain string layout kind (not JSON) works across adapters', async () => {
    const result = await normalizeProps(reactAdapterHandler, { layout: 'grid' });
    const layout = result.__layout as Record<string, string>;
    expect(layout.display).toBe('grid');
  });

  it('layout with only gap defaults to stack column', async () => {
    const result = await normalizeProps(solidAdapterHandler, { layout: JSON.stringify({ gap: '10px' }) });
    const layout = result.__layout as Record<string, string>;
    expect(layout.flexDirection).toBe('column');
    expect(layout.gap).toBe('10px');
  });

  it('theme with empty tokens produces empty token map', async () => {
    const result = await normalizeProps(reactAdapterHandler, {
      theme: JSON.stringify({ name: 'empty', tokens: {} }),
    });
    expect(result.__themeTokens).toEqual({});
  });

  it('invalid theme JSON is gracefully skipped', async () => {
    const result = await normalizeProps(vueAdapterHandler, { theme: 'not-json{' });
    expect(result.__themeTokens).toBeUndefined();
  });

  it('layout as object (not stringified) works', async () => {
    const result = await normalizeProps(reactAdapterHandler, {
      layout: JSON.stringify({ kind: 'center' }),
    });
    const layout = result.__layout as Record<string, string>;
    expect(layout.justifyContent).toBe('center');
  });
});
