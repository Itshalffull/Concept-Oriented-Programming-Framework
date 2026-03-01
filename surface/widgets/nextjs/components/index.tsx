// ============================================================
// Clef Surface Next.js Components — Barrel Export
//
// Re-exports all Clef Surface concept widget components, their
// props interfaces, context values, and hooks for external
// consumers. Adapted for Next.js App Router with Server
// Component and Client Component boundaries.
// ============================================================

// --- DesignTokenProvider (client) ---
export {
  DesignTokenProvider,
  DesignTokenContext,
  useDesignTokens,
  type DesignTokenProviderProps,
  type DesignTokenContextValue,
} from './DesignTokenProvider.js';

// --- ThemeSwitch (client) ---
export {
  ThemeSwitch,
  type ThemeSwitchProps,
} from './ThemeSwitch.js';

// --- TypographyText (server compatible) ---
export {
  TypographyText,
  type TypographyTextProps,
} from './TypographyText.js';

// --- PalettePreview (server compatible) ---
export {
  PalettePreview,
  type PalettePreviewProps,
} from './PalettePreview.js';

// --- ElevationBox (server compatible) ---
export {
  ElevationBox,
  type ElevationBoxProps,
} from './ElevationBox.js';

// --- MotionBox (client) ---
export {
  MotionBox,
  type MotionBoxProps,
} from './MotionBox.js';

// --- ViewportProvider (client) ---
export {
  ViewportProvider,
  ViewportContext,
  useViewport,
  useBreakpoint,
  type ViewportProviderProps,
  type ViewportContextValue,
} from './ViewportProvider.js';

// --- LayoutContainer (server compatible) ---
export {
  LayoutContainer,
  type LayoutContainerProps,
} from './LayoutContainer.js';

// --- ElementRenderer (client) ---
export {
  ElementRenderer,
  type ElementRendererProps,
} from './ElementRenderer.js';

// --- WidgetMachine (client) ---
export {
  WidgetMachine,
  type WidgetMachineProps,
  type WidgetRenderAPI,
} from './WidgetMachine.js';

// --- SlotOutlet (client) ---
export {
  SlotOutlet,
  SlotProvider,
  SlotRegistryContext,
  useSlotFill,
  type SlotOutletProps,
  type SlotProviderProps,
  type SlotFill,
  type SlotRegistryContextValue,
} from './SlotOutlet.js';

// --- BindingProvider (client) ---
export {
  BindingProvider,
  BindingContext,
  useBinding,
  useBoundSignal,
  type BindingProviderProps,
  type BindingContextValue,
  type InvokeFn,
} from './BindingProvider.js';

// --- UISchemaForm (client) ---
export {
  UISchemaForm,
  type UISchemaFormProps,
} from './UISchemaForm.js';

// --- SurfaceRoot (client) ---
export {
  SurfaceRoot,
  type SurfaceRootProps,
  type SurfaceState,
  type SurfaceStatus,
} from './SurfaceRoot.js';

// --- Widget Components (all categories) ---
export * from './widgets/index.js';
