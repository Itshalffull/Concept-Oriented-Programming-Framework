// ============================================================
// COIF Ink Widgets — Index
//
// Terminal-rendered widget components for all COIF concepts.
// These target terminal/CLI rendering using Ink's concepts
// (Box, Text, flexbox layout) mapped to character-cell output
// with ANSI escape sequences.
//
// Each component produces a TerminalNode tree that describes
// the terminal output structure. Interactive variants manage
// keyboard input and state updates.
// ============================================================

// --- Core Types ---

export type { TerminalNode } from './DesignTokenProvider.js';

// --- Design Token Provider ---

export {
  createDesignTokenProvider,
  DesignTokenProviderInteractive,
  hexToAnsiFg,
  hexToAnsiBg,
  parseHex,
  resolveColor,
  buildAnsiTokenMap,
} from './DesignTokenProvider.js';
export type {
  DesignTokenProviderProps,
  AnsiTokenMap,
} from './DesignTokenProvider.js';

// --- Theme Switch ---

export {
  createThemeSwitch,
  ThemeSwitchInteractive,
} from './ThemeSwitch.js';
export type { ThemeSwitchProps } from './ThemeSwitch.js';

// --- Typography Text ---

export {
  createTypographyText,
  measureTextWidth,
} from './TypographyText.js';
export type {
  TypographyTextProps,
  TypographyVariant,
} from './TypographyText.js';

// --- Palette Preview ---

export {
  createPalettePreview,
  PalettePreviewInteractive,
} from './PalettePreview.js';
export type { PalettePreviewProps } from './PalettePreview.js';

// --- Elevation Box ---

export {
  createElevationBox,
  getElevationBorder,
  getElevationAnsi,
} from './ElevationBox.js';
export type { ElevationBoxProps } from './ElevationBox.js';

// --- Motion Box ---

export {
  createMotionBox,
  MotionBoxInteractive,
  prefersReducedMotion,
} from './MotionBox.js';
export type {
  MotionBoxProps,
  SpinnerStyle,
} from './MotionBox.js';

// --- Layout Container ---

export {
  createLayoutContainer,
  getTerminalSize,
} from './LayoutContainer.js';
export type { LayoutContainerProps } from './LayoutContainer.js';

// --- Viewport Provider ---

export {
  createViewportProvider,
  ViewportProviderInteractive,
  getTerminalBreakpoint,
  getTerminalOrientation,
  readTerminalDimensions,
  terminalToViewportState,
} from './ViewportProvider.js';
export type {
  ViewportProviderProps,
  TerminalDimensions,
} from './ViewportProvider.js';

// --- Element Renderer ---

export {
  createElementRenderer,
  ElementRendererInteractive,
} from './ElementRenderer.js';
export type { ElementRendererProps } from './ElementRenderer.js';

// --- Widget Machine ---

export {
  createWidgetMachine,
  WidgetMachineInteractive,
} from './WidgetMachine.js';
export type { WidgetMachineProps } from './WidgetMachine.js';

// --- Slot Outlet ---

export {
  createSlotOutlet,
  createSlotFromConfig,
  SlotRegistry,
} from './SlotOutlet.js';
export type {
  SlotOutletProps,
  SlotRegistryEntry,
} from './SlotOutlet.js';

// --- Binding Provider ---

export {
  createBindingProvider,
  BindingProviderInteractive,
} from './BindingProvider.js';
export type {
  BindingProviderProps,
  ConnectionState,
} from './BindingProvider.js';

// --- UI Schema Form ---

export {
  createUISchemaForm,
  UISchemaFormInteractive,
} from './UISchemaForm.js';
export type { UISchemaFormProps } from './UISchemaForm.js';

// --- Surface Root ---

export {
  createSurfaceRoot,
  SurfaceRootInteractive,
  terminalControl,
} from './SurfaceRoot.js';
export type {
  SurfaceRootProps,
  SurfaceState,
} from './SurfaceRoot.js';
