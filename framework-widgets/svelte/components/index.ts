// ============================================================
// COIF Framework Widgets — Svelte Components Index
//
// Barrel export for all Svelte-compatible COIF components.
// Each component uses the imperative factory pattern:
//
//   const instance = createXxxComponent({ target, props });
//   instance.update({ ... });
//   instance.destroy();
//
// This mirrors Svelte's internal component API without
// requiring the Svelte compiler.
// ============================================================

// --- Design Token Provider ---
export {
  createDesignTokenProvider,
  getTokenContext,
  type DesignTokenProviderProps,
  type DesignTokenProviderInstance,
  type DesignTokenProviderOptions,
  type DesignTokenContext,
} from './DesignTokenProvider.js';

// --- Theme Switch ---
export {
  createThemeSwitch,
  type ThemeSwitchProps,
  type ThemeSwitchInstance,
  type ThemeSwitchOptions,
} from './ThemeSwitch.js';

// --- Typography Text ---
export {
  createTypographyText,
  type TypographyTextProps,
  type TypographyTextInstance,
  type TypographyTextOptions,
} from './TypographyText.js';

// --- Palette Preview ---
export {
  createPalettePreview,
  type PaletteEntry,
  type PalettePreviewProps,
  type PalettePreviewInstance,
  type PalettePreviewOptions,
} from './PalettePreview.js';

// --- Elevation Box ---
export {
  createElevationBox,
  type ElevationBoxProps,
  type ElevationBoxInstance,
  type ElevationBoxOptions,
} from './ElevationBox.js';

// --- Motion Box ---
export {
  createMotionBox,
  type MotionBoxProps,
  type MotionBoxInstance,
  type MotionBoxOptions,
} from './MotionBox.js';

// --- Layout Container ---
export {
  createLayoutContainer,
  type LayoutContainerProps,
  type LayoutContainerInstance,
  type LayoutContainerOptions,
} from './LayoutContainer.js';

// --- Viewport Provider ---
export {
  createViewportProvider,
  getViewportContext,
  type ViewportProviderProps,
  type ViewportProviderInstance,
  type ViewportProviderOptions,
  type ViewportContext,
} from './ViewportProvider.js';

// --- Element Renderer ---
export {
  createElementRenderer,
  type ElementRendererProps,
  type ElementRendererInstance,
  type ElementRendererOptions,
} from './ElementRenderer.js';

// --- Widget Machine ---
export {
  createWidgetMachine,
  type WidgetMachineProps,
  type WidgetMachineInstance,
  type WidgetMachineOptions,
  type WidgetRenderAPI,
} from './WidgetMachine.js';

// --- Slot Outlet ---
export {
  createSlotOutlet,
  type SlotOutletProps,
  type SlotOutletInstance,
  type SlotOutletOptions,
} from './SlotOutlet.js';

// --- Binding Provider ---
export {
  createBindingProvider,
  getBindingContext,
  type BindingProviderProps,
  type BindingProviderInstance,
  type BindingProviderOptions,
  type BindingContext,
} from './BindingProvider.js';

// --- UI Schema Form ---
export {
  createUISchemaForm,
  type UISchemaFormProps,
  type UISchemaFormInstance,
  type UISchemaFormOptions,
  type FormViewMode,
} from './UISchemaForm.js';

// --- Surface Root ---
export {
  createSurfaceRoot,
  type SurfaceRootProps,
  type SurfaceRootInstance,
  type SurfaceRootOptions,
  type SurfaceAPI,
  type SurfaceLifecyclePhase,
} from './SurfaceRoot.js';
