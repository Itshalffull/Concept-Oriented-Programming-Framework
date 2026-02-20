// ============================================================
// COIF Framework Widgets — Shared Types
//
// Platform-agnostic types used by all framework adapters.
// These mirror the COIF concept state shapes and provide
// the contract between headless logic and framework renderers.
// ============================================================

// --- Signal Primitives ---

export interface Signal<T = unknown> {
  readonly id: string;
  get(): T;
  subscribe(listener: (value: T) => void): () => void;
}

export interface WritableSignal<T = unknown> extends Signal<T> {
  set(value: T): void;
  update(fn: (prev: T) => T): void;
}

// --- Design Token ---

export type TokenTier = 'primitive' | 'semantic' | 'component';
export type TokenType =
  | 'color' | 'dimension' | 'fontFamily' | 'fontWeight'
  | 'duration' | 'cubicBezier' | 'shadow' | 'border'
  | 'typography' | 'gradient';

export interface DesignTokenValue {
  name: string;
  value: string;
  type: TokenType;
  tier: TokenTier;
  description?: string;
  reference?: string;
  group?: string;
}

// --- Theme ---

export interface ThemeConfig {
  name: string;
  overrides: Record<string, string>;
  active: boolean;
  priority: number;
  base?: string;
}

export interface ResolvedTheme {
  name: string;
  tokens: Record<string, string>;
}

// --- Typography ---

export interface TypeScale {
  xs: number;
  sm: number;
  base: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
  '3xl': number;
  '4xl': number;
}

export interface FontStack {
  name: string;
  fonts: string[];
  category: 'serif' | 'sans-serif' | 'monospace' | 'display';
}

export interface TextStyle {
  name: string;
  scale: string;
  fontStack: string;
  weight: number;
  lineHeight: number;
  letterSpacing: string;
}

// --- Palette ---

export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

export type SemanticRole =
  | 'primary' | 'secondary' | 'accent' | 'success'
  | 'warning' | 'error' | 'neutral' | 'surface';

// --- Elevation ---

export interface ShadowLayer {
  x?: number;
  y: number;
  blur: number;
  spread?: number;
  color: string;
}

export type ElevationLevel = 0 | 1 | 2 | 3 | 4 | 5;

// --- Motion ---

export interface MotionDuration {
  name: string;
  ms: number;
}

export interface MotionEasing {
  name: string;
  value: string;
}

export interface MotionTransition {
  name: string;
  property: string;
  duration: string;
  easing: string;
}

// --- Layout ---

export type LayoutKind = 'stack' | 'grid' | 'split' | 'overlay' | 'flow' | 'sidebar' | 'center';

export interface LayoutConfig {
  name: string;
  kind: LayoutKind;
  direction?: 'row' | 'column';
  gap?: string;
  columns?: string;
  rows?: string;
  areas?: string;
  children?: LayoutConfig[];
  responsive?: Record<string, Partial<LayoutConfig>>;
}

// --- Viewport ---

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type Orientation = 'portrait' | 'landscape';

export interface ViewportState {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  orientation: Orientation;
}

// --- Widget/Machine (Headless component) ---

export interface AnatomyPart {
  name: string;
  props: Record<string, unknown>;
}

export interface MachineState {
  current: string;
  context: Record<string, unknown>;
}

export interface ConnectedProps {
  [partName: string]: Record<string, unknown>;
}

export interface WidgetSpec {
  name: string;
  anatomy: { parts: string[]; slots?: string[] };
  machineSpec: {
    initial: string;
    states: Record<string, {
      on?: Record<string, string | { target: string; guard?: string }>;
    }>;
  };
  a11ySpec: Record<string, unknown>;
  defaultConfig?: Record<string, unknown>;
}

// --- Element ---

export type ElementKind =
  | 'input-text' | 'input-number' | 'input-date' | 'input-bool'
  | 'selection-single' | 'selection-multi' | 'trigger' | 'navigation'
  | 'output-text' | 'output-number' | 'output-date' | 'output-bool'
  | 'group' | 'container' | 'rich-text' | 'file-upload' | 'media-display';

export interface ElementConfig {
  id: string;
  kind: ElementKind;
  label: string;
  dataType: string;
  required?: boolean;
  constraints?: Record<string, unknown>;
  children?: ElementConfig[];
}

// --- Binding ---

export type BindingMode = 'coupled' | 'rest' | 'graphql' | 'static';

export interface BindingConfig {
  concept: string;
  mode: BindingMode;
  endpoint?: string;
  signalMap: Record<string, Signal>;
}

// --- Surface ---

export type SurfaceKind =
  | 'browser-dom' | 'terminal' | 'react-native'
  | 'webview' | 'ssr' | 'static-html';

// --- UI Schema ---

export interface UISchemaField {
  name: string;
  element: ElementKind;
  label: string;
  dataType: string;
  required?: boolean;
  constraints?: Record<string, unknown>;
}

export interface UISchemaView {
  name: string;
  fields: UISchemaField[];
}

export interface UISchema {
  concept: string;
  views: {
    list?: UISchemaView;
    detail?: UISchemaView;
    create?: UISchemaView;
    edit?: UISchemaView;
  };
}

// --- Framework Adapter Contract ---

export interface FrameworkWidget<Props = Record<string, unknown>> {
  readonly name: string;
  readonly framework: string;
  render(props: Props): unknown;
  destroy?(): void;
}

// Slot concept
export interface SlotConfig {
  name: string;
  component: string;
  defaultContent?: unknown;
  scope?: Record<string, unknown>;
}
