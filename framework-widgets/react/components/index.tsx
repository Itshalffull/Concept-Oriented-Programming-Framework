// ============================================================
// COIF React Components — Barrel Export
//
// Re-exports all COIF concept widget components, their props
// interfaces, context values, and hooks for external consumers.
// ============================================================

// --- DesignTokenProvider ---
export {
  DesignTokenProvider,
  DesignTokenContext,
  useDesignTokens,
  type DesignTokenProviderProps,
  type DesignTokenContextValue,
} from './DesignTokenProvider.js';

// --- ThemeSwitch ---
export {
  ThemeSwitch,
  type ThemeSwitchProps,
} from './ThemeSwitch.js';

// --- TypographyText ---
export {
  TypographyText,
  type TypographyTextProps,
} from './TypographyText.js';

// --- PalettePreview ---
export {
  PalettePreview,
  type PalettePreviewProps,
} from './PalettePreview.js';

// --- ElevationBox ---
export {
  ElevationBox,
  type ElevationBoxProps,
} from './ElevationBox.js';

// --- MotionBox ---
export {
  MotionBox,
  type MotionBoxProps,
} from './MotionBox.js';

// --- ViewportProvider ---
export {
  ViewportProvider,
  ViewportContext,
  useViewport,
  useBreakpoint,
  type ViewportProviderProps,
  type ViewportContextValue,
} from './ViewportProvider.js';

// --- LayoutContainer ---
export {
  LayoutContainer,
  type LayoutContainerProps,
} from './LayoutContainer.js';

// --- ElementRenderer ---
export {
  ElementRenderer,
  type ElementRendererProps,
} from './ElementRenderer.js';

// --- WidgetMachine ---
export {
  WidgetMachine,
  type WidgetMachineProps,
  type WidgetRenderAPI,
} from './WidgetMachine.js';

// --- SlotOutlet ---
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

// --- BindingProvider ---
export {
  BindingProvider,
  BindingContext,
  useBinding,
  useBoundSignal,
  type BindingProviderProps,
  type BindingContextValue,
  type InvokeFn,
} from './BindingProvider.js';

// --- UISchemaForm ---
export {
  UISchemaForm,
  type UISchemaFormProps,
} from './UISchemaForm.js';

// --- SurfaceRoot ---
export {
  SurfaceRoot,
  type SurfaceRootProps,
  type SurfaceState,
  type SurfaceStatus,
} from './SurfaceRoot.js';
