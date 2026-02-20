// ============================================================
// COIF Framework Widgets — Solid.js Components
//
// Barrel export for all Solid-style components that implement
// the COIF concept rendering layer. Each component uses
// fine-grained reactivity (signals, effects, memos) with
// direct DOM manipulation — no virtual DOM.
// ============================================================

// --- Design Token Provider ---
export {
  DesignTokenProvider,
  getTokenContext,
  type DesignTokenProviderProps,
  type DesignTokenProviderResult,
  type TokenContext,
} from './DesignTokenProvider.js';

// --- Theme Switch ---
export {
  ThemeSwitch,
  type ThemeSwitchProps,
  type ThemeSwitchResult,
} from './ThemeSwitch.js';

// --- Typography Text ---
export {
  TypographyText,
  type TypographyTextProps,
  type TypographyTextResult,
  type TypographyTag,
} from './TypographyText.js';

// --- Palette Preview ---
export {
  PalettePreview,
  type PalettePreviewProps,
  type PalettePreviewResult,
} from './PalettePreview.js';

// --- Elevation Box ---
export {
  ElevationBox,
  type ElevationBoxProps,
  type ElevationBoxResult,
} from './ElevationBox.js';

// --- Motion Box ---
export {
  MotionBox,
  type MotionBoxProps,
  type MotionBoxResult,
} from './MotionBox.js';

// --- Layout Container ---
export {
  LayoutContainer,
  type LayoutContainerProps,
  type LayoutContainerResult,
} from './LayoutContainer.js';

// --- Viewport Provider ---
export {
  ViewportProvider,
  getViewportContext,
  type ViewportProviderProps,
  type ViewportProviderResult,
  type ViewportContext,
} from './ViewportProvider.js';

// --- Element Renderer ---
export {
  ElementRenderer,
  type ElementRendererProps,
  type ElementRendererResult,
} from './ElementRenderer.js';

// --- Widget Machine ---
export {
  WidgetMachine,
  type WidgetMachineProps,
  type WidgetMachineResult,
} from './WidgetMachine.js';

// --- Slot Outlet ---
export {
  SlotOutlet,
  type SlotOutletProps,
  type SlotOutletResult,
  type SlotContent,
  type SlotRenderFn,
} from './SlotOutlet.js';

// --- Binding Provider ---
export {
  BindingProvider,
  getBindingContext,
  type BindingProviderProps,
  type BindingProviderResult,
  type BindingContext,
} from './BindingProvider.js';

// --- UI Schema Form ---
export {
  UISchemaForm,
  type UISchemaFormProps,
  type UISchemaFormResult,
  type FormViewMode,
} from './UISchemaForm.js';

// --- Surface Root ---
export {
  SurfaceRoot,
  type SurfaceRootProps,
  type SurfaceRootResult,
  type LifecyclePhase,
} from './SurfaceRoot.js';
