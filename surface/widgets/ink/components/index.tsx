// ============================================================
// Clef Surface Ink Widgets — Barrel Export
//
// Re-exports all Ink React components for the Clef Surface
// terminal adapter. Each component converts Clef Surface
// concepts (tokens, themes, layouts, elements, machines,
// slots, bindings, schemas) into interactive terminal UI
// using the Ink React rendering framework.
// ============================================================

// --- Design System ---
export { DesignTokenProvider, useDesignTokens } from './DesignTokenProvider.js';
export type { DesignTokenProviderProps } from './DesignTokenProvider.js';

export { ThemeSwitch } from './ThemeSwitch.js';
export type { ThemeSwitchProps } from './ThemeSwitch.js';

export { TypographyText } from './TypographyText.js';
export type { TypographyTextProps } from './TypographyText.js';

export { PalettePreview } from './PalettePreview.js';
export type { PalettePreviewProps } from './PalettePreview.js';

// --- Layout ---
export { ElevationBox } from './ElevationBox.js';
export type { ElevationBoxProps } from './ElevationBox.js';

export { MotionBox } from './MotionBox.js';
export type { MotionBoxProps } from './MotionBox.js';

export { LayoutContainer } from './LayoutContainer.js';
export type { LayoutContainerProps } from './LayoutContainer.js';

export { ViewportProvider, useViewport, useBreakpoint } from './ViewportProvider.js';
export type { ViewportProviderProps } from './ViewportProvider.js';

// --- Elements & Widgets ---
export { ElementRenderer } from './ElementRenderer.js';
export type { ElementRendererProps } from './ElementRenderer.js';

export { WidgetMachine } from './WidgetMachine.js';
export type { WidgetMachineProps } from './WidgetMachine.js';

// --- Composition ---
export { SlotOutlet, SlotProvider, SlotFromConfig, useSlotFill } from './SlotOutlet.js';
export type { SlotOutletProps, SlotProviderProps, SlotRegistryContextValue } from './SlotOutlet.js';

export { BindingProvider, useBinding, useBoundSignal } from './BindingProvider.js';
export type { BindingProviderProps, BindingContextValue } from './BindingProvider.js';

// --- Forms ---
export { UISchemaForm } from './UISchemaForm.js';
export type { UISchemaFormProps } from './UISchemaForm.js';

// --- Root ---
export { SurfaceRoot, useSurface, useSurfaceSize } from './SurfaceRoot.js';
export type { SurfaceRootProps, SurfaceContextValue, SurfaceStatus } from './SurfaceRoot.js';

// --- Repertoire Widgets (122) ---
export * as widgets from './widgets/index.js';
