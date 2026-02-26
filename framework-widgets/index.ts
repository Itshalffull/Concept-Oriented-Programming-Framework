// ============================================================
// COIF Framework Widgets — Main Entry Point
//
// Exports the shared bridge, all framework-specific component
// sets, and the adapter wiring that connects COIF concept
// handlers to their UI renderers.
//
// Usage:
//   import { shared, react, vue, svelte, solid, vanilla, ink } from '@clef/framework-widgets';
//   import { createFrameworkAdapter } from '@clef/framework-widgets';
// ============================================================

// --- Shared Module ---
export * as shared from './shared/index.js';

// --- Framework-Specific Modules ---
export * as react from './react/components/index.js';
export * as vue from './vue/components/index.js';
export * as svelte from './svelte/components/index.js';
export * as solid from './solid/components/index.js';
export * as vanilla from './vanilla/components/index.js';
export * as ink from './ink/components/index.js';

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
} from './shared/coif-bridge.js';

// --- Framework Adapter Factory ---

export type FrameworkName = 'react' | 'vue' | 'svelte' | 'solid' | 'vanilla' | 'ink';

export interface FrameworkAdapterConfig {
  framework: FrameworkName;
  mountTarget?: string | HTMLElement;
  theme?: import('./shared/types.js').ResolvedTheme;
  viewport?: import('./shared/types.js').ViewportState;
}

/**
 * Returns metadata about a framework adapter — which COIF concepts
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
  return ['react', 'vue', 'svelte', 'solid', 'vanilla', 'ink'];
}
