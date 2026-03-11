// ============================================================
// Clef Surface Framework Widgets — Main Entry Point
//
// Exports the shared bridge, all framework-specific component
// sets, and the adapter wiring that connects Clef Surface concept
// handlers to their UI renderers.
//
// Usage:
//   import { shared, react, vue, svelte, solid, vanilla, ink } from '@clef/framework-widgets';
//   import { createFrameworkAdapter } from '@clef/framework-widgets';
// ============================================================

// --- Shared Module ---
export * as shared from './shared/index.js';

// --- Framework-Specific Modules (Web) ---
export * as react from './react/components/index.js';
export * as vue from './vue/components/index.js';
export * as svelte from './svelte/components/index.js';
export * as solid from './solid/components/index.js';
export * as vanilla from './vanilla/components/index.js';
export * as ink from './ink/components/index.js';
export * as nextjs from './nextjs/components/index.js';

// --- Platform-Specific Modules (Mobile / Desktop / Wearable) ---
export * as nativescript from './nativescript/components/index.js';
export * as reactNative from './react-native/components/index.js';
// Note: SwiftUI, AppKit, WatchKit, Compose, WearCompose, WinUI, GTK
// are non-TypeScript providers (Swift, Kotlin, C#) and are not
// re-exported from this TypeScript entry point. They live alongside
// as peer directories for their respective build systems.

// --- Re-export key shared types for convenience ---
export type {
  Signal,
  WritableSignal,
  DesignTokenValue,
  ThemeConfig,
  ResolvedTheme,
  LayoutConfig,
  LayoutKind,
  ViewportState,
  Breakpoint,
  Orientation,
  WidgetSpec,
  MachineState,
  ConnectedProps,
  ElementConfig,
  ElementKind,
  UISchema,
  UISchemaView,
  UISchemaField,
  BindingMode,
  BindingConfig,
  SurfaceKind,
  SlotConfig,
  ElevationLevel,
  ShadowLayer,
  TypeScale,
  TextStyle,
  FontStack,
  ColorScale,
  SemanticRole,
  MotionDuration,
  MotionEasing,
  MotionTransition,
  TokenTier,
  TokenType,
} from './shared/types.js';

export {
  createSignal,
  createComputed,
  createMachine,
  resolveTheme,
  themeToCssVariables,
  layoutToCSS,
  layoutToStyleString,
  getBreakpoint,
  getOrientation,
  createViewportSignal,
  observeViewport,
  elevationToCSS,
  shadowLayersToCSS,
  generateTypeScale,
  textStyleToCSS,
  generateColorScale,
  contrastRatio,
  motionToCSS,
  reducedMotionCSS,
  mapElementToHTML,
} from './shared/surface-bridge.js';

// --- Framework Adapter Factory ---

export type FrameworkName =
  | 'react' | 'vue' | 'svelte' | 'solid' | 'vanilla' | 'ink'
  | 'nextjs' | 'nativescript' | 'react-native'
  | 'swiftui' | 'appkit' | 'watchkit'
  | 'compose' | 'wear-compose'
  | 'winui' | 'gtk';

export interface FrameworkAdapterConfig {
  framework: FrameworkName;
  mountTarget?: string | HTMLElement;
  theme?: import('./shared/types.js').ResolvedTheme;
  viewport?: import('./shared/types.js').ViewportState;
}

/**
 * Returns metadata about a framework adapter — which Clef Surface concepts
 * it provides widgets for, and the component registry.
 */
export function getFrameworkCapabilities(framework: FrameworkName): {
  name: FrameworkName;
  components: string[];
  surfaceKind: string;
  supportsSSR: boolean;
  supportsStreaming: boolean;
} {
  const baseComponents = [
    'DesignTokenProvider',
    'ThemeSwitch',
    'TypographyText',
    'PalettePreview',
    'ElevationBox',
    'MotionBox',
    'LayoutContainer',
    'ViewportProvider',
    'ElementRenderer',
    'WidgetMachine',
    'SlotOutlet',
    'BindingProvider',
    'UISchemaForm',
    'SurfaceRoot',
  ];

  const capMap: Record<FrameworkName, { surfaceKind: string; supportsSSR: boolean; supportsStreaming: boolean }> = {
    react: { surfaceKind: 'browser-dom', supportsSSR: true, supportsStreaming: true },
    vue: { surfaceKind: 'browser-dom', supportsSSR: true, supportsStreaming: false },
    svelte: { surfaceKind: 'browser-dom', supportsSSR: true, supportsStreaming: false },
    solid: { surfaceKind: 'browser-dom', supportsSSR: true, supportsStreaming: true },
    vanilla: { surfaceKind: 'browser-dom', supportsSSR: false, supportsStreaming: false },
    ink: { surfaceKind: 'terminal', supportsSSR: false, supportsStreaming: false },
    nextjs: { surfaceKind: 'browser-dom', supportsSSR: true, supportsStreaming: true },
    nativescript: { surfaceKind: 'native-mobile', supportsSSR: false, supportsStreaming: false },
    'react-native': { surfaceKind: 'react-native', supportsSSR: false, supportsStreaming: false },
    swiftui: { surfaceKind: 'native-apple', supportsSSR: false, supportsStreaming: false },
    appkit: { surfaceKind: 'native-macos', supportsSSR: false, supportsStreaming: false },
    watchkit: { surfaceKind: 'native-watchos', supportsSSR: false, supportsStreaming: false },
    compose: { surfaceKind: 'native-android', supportsSSR: false, supportsStreaming: false },
    'wear-compose': { surfaceKind: 'native-wearos', supportsSSR: false, supportsStreaming: false },
    winui: { surfaceKind: 'native-windows', supportsSSR: false, supportsStreaming: false },
    gtk: { surfaceKind: 'native-linux', supportsSSR: false, supportsStreaming: false },
  };

  return {
    name: framework,
    components: baseComponents,
    ...capMap[framework],
  };
}

/**
 * List all supported frameworks.
 */
export function listFrameworks(): FrameworkName[] {
  return [
    'react', 'vue', 'svelte', 'solid', 'vanilla', 'ink', 'nextjs',
    'nativescript', 'react-native',
    'swiftui', 'appkit', 'watchkit',
    'compose', 'wear-compose',
    'winui', 'gtk',
  ];
}
