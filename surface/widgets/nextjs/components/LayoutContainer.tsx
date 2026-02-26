// ============================================================
// LayoutContainer — Next.js Server Component that renders
// children inside a flexbox/grid layout driven by a Clef
// Surface LayoutConfig.
//
// Uses layoutToCSS from the bridge to convert the abstract
// layout kind (stack, grid, split, overlay, flow, sidebar,
// center) into concrete CSS. Handles responsive breakpoints
// when a ViewportContext is available (client boundary).
//
// Server Component friendly — no 'use client' needed.
// Falls back to 'lg' breakpoint when no ViewportProvider
// is present, which is typical for server-rendered layouts.
// Functional component only — no classes.
// ============================================================

import {
  useMemo,
  useContext,
  type ReactNode,
  type CSSProperties,
  type HTMLAttributes,
} from 'react';

import type { LayoutConfig, Breakpoint } from '../../shared/types.js';
import { layoutToCSS } from '../../shared/surface-bridge.js';

// --------------- Props ---------------

export interface LayoutContainerProps extends HTMLAttributes<HTMLDivElement> {
  /** The Clef Surface layout configuration. */
  readonly layout: LayoutConfig;
  /** Render nested LayoutConfig children recursively. @default false */
  readonly recursive?: boolean;
  /**
   * Explicit breakpoint override. When provided, used instead of
   * reading from ViewportContext. Useful for Server Components
   * where context may not be available.
   * @default "lg"
   */
  readonly breakpoint?: Breakpoint;
  /** Additional class name. */
  readonly className?: string;
  /** Additional inline styles (merged after layout styles). */
  readonly style?: CSSProperties;
  readonly children?: ReactNode;
}

// --------------- Helpers ---------------

const kebabToCamel = (s: string): string =>
  s.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());

const bridgeCSSToReactStyle = (
  css: Record<string, string>
): CSSProperties => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(css)) {
    out[kebabToCamel(key)] = value;
  }
  return out as CSSProperties;
};

/**
 * Merge responsive overrides into the base config for the
 * current breakpoint.
 *
 * Responsive config is keyed by breakpoint name. We apply
 * overrides that are <= the current breakpoint so that "sm"
 * overrides are still active at "md" unless overridden again.
 */
const BREAKPOINT_ORDER: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl'];

const resolveResponsiveConfig = (
  config: LayoutConfig,
  breakpoint: Breakpoint
): LayoutConfig => {
  if (!config.responsive) return config;

  const idx = BREAKPOINT_ORDER.indexOf(breakpoint);
  let resolved: LayoutConfig = { ...config };

  for (let i = 0; i <= idx; i++) {
    const bp = BREAKPOINT_ORDER[i];
    const overrides = config.responsive[bp];
    if (overrides) {
      resolved = { ...resolved, ...overrides };
    }
  }

  // Strip the responsive key from the resolved object to avoid
  // re-applying in nested computations.
  delete resolved.responsive;

  return resolved;
};

// --------------- Component ---------------

export const LayoutContainer = ({
  layout,
  recursive = false,
  breakpoint: explicitBreakpoint,
  className,
  style,
  children,
  ...rest
}: LayoutContainerProps): ReactNode => {
  // Use explicit breakpoint prop, defaulting to 'lg' for
  // Server Component compatibility where context is unavailable.
  const breakpoint: Breakpoint = explicitBreakpoint ?? 'lg';

  const resolvedConfig = useMemo(
    () => resolveResponsiveConfig(layout, breakpoint),
    [layout, breakpoint]
  );

  const layoutCSS = useMemo(
    () => layoutToCSS(resolvedConfig),
    [resolvedConfig]
  );

  const reactStyle = useMemo(
    () => bridgeCSSToReactStyle(layoutCSS),
    [layoutCSS]
  );

  const mergedStyle = useMemo<CSSProperties>(
    () => ({ ...reactStyle, ...style }),
    [reactStyle, style]
  );

  // If recursive mode and the config has children layout configs,
  // render nested LayoutContainers.
  const nestedChildren = useMemo(() => {
    if (!recursive || !resolvedConfig.children?.length) return null;

    return resolvedConfig.children.map((childLayout, index) => (
      <LayoutContainer
        key={childLayout.name || `layout-child-${index}`}
        layout={childLayout}
        recursive
        breakpoint={breakpoint}
      />
    ));
  }, [recursive, resolvedConfig.children, breakpoint]);

  return (
    <div
      {...rest}
      className={className}
      style={mergedStyle}
      data-surface-layout=""
      data-surface-adapter="nextjs"
      data-layout-kind={resolvedConfig.kind}
      data-layout-name={resolvedConfig.name || undefined}
    >
      {nestedChildren ?? children}
    </div>
  );
};

LayoutContainer.displayName = 'LayoutContainer';
export default LayoutContainer;
