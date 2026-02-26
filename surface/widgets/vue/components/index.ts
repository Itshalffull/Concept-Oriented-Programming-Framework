// ============================================================
// Clef Surface Framework Widgets — Vue 3 Components
//
// Barrel export for all Vue 3 Clef Surface concept components.
// Each component uses defineComponent() with h() render
// functions (no SFC compiler required) and Composition API.
// ============================================================

// --- Components ---

export { DesignTokenProvider } from './DesignTokenProvider.js';
export { ThemeSwitch } from './ThemeSwitch.js';
export { TypographyText } from './TypographyText.js';
export { PalettePreview } from './PalettePreview.js';
export { ElevationBox } from './ElevationBox.js';
export { MotionBox } from './MotionBox.js';
export { LayoutContainer } from './LayoutContainer.js';
export { ViewportProvider } from './ViewportProvider.js';
export { ElementRenderer } from './ElementRenderer.js';
export { WidgetMachine } from './WidgetMachine.js';
export { SlotOutlet } from './SlotOutlet.js';
export { BindingProvider } from './BindingProvider.js';
export { UISchemaForm } from './UISchemaForm.js';
export { SurfaceRoot } from './SurfaceRoot.js';

// --- Injection Keys ---

export { DESIGN_TOKENS_KEY } from './DesignTokenProvider.js';
export { VIEWPORT_KEY } from './ViewportProvider.js';
export { WIDGET_MACHINE_KEY } from './WidgetMachine.js';
export { BINDING_KEY } from './BindingProvider.js';
export { SURFACE_KEY } from './SurfaceRoot.js';

// --- Injection Context Types ---

export type { WidgetMachineContext } from './WidgetMachine.js';
export type { BindingContext } from './BindingProvider.js';
export type { SurfaceState, SurfaceLifecycle } from './SurfaceRoot.js';
export type { PaletteEntry } from './PalettePreview.js';
export type { UISchemaViewName } from './UISchemaForm.js';
