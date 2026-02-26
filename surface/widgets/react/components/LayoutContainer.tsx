// ============================================================
// LayoutContainer — Renders children inside a flexbox/grid
// layout driven by a Clef Surface LayoutConfig.
//
// Uses layoutToCSS from the bridge to convert the abstract
// layout kind (stack, grid, split, overlay, flow, sidebar,
// center) into concrete CSS.  Handles responsive breakpoints
// by subscribing to the viewport signal provided by
// ViewportProvider.
// ============================================================

import React, {
  useMemo,
  useContext,
  type ReactNode,
  type CSSProperties,
  type HTMLAttributes,
} from 'react';

import type { LayoutConfig, Breakpoint } from '../../shared/types.js';
import { layoutToCSS } from '../../shared/surface-bridge.js';
import { ViewportContext, useViewport } from './ViewportProvider.js';

// --------------- Props ---------------

export interface LayoutContainerProps extends HTMLAttributes<HTMLDivElement> {
  /** The Clef Surface layout configuration. */
  layout: LayoutConfig;
  /** Render nested LayoutConfig children recursively. @default false */
  recursive?: boolean;
  /** Additional class name. */
  className?: string;
  /** Additional inline styles (merged after layout styles). */
  style?: CSSProperties;
  children?: ReactNode;
}

// --------------- Helpers ---------------

function kebabToCamel(s: string): string {
  return s.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

function bridgeCSSToReactStyle(
  css: Record<string, string>
): CSSProperties {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(css)) {
    out[kebabToCamel(key)] = value;
  }
  return out as CSSProperties;
}

/**
 * Merge responsive overrides into the base config for the
 * current breakpoint.
 *
 * Responsive config is keyed by breakpoint name.  We apply
 * overrides that are <= the current breakpoint so that "sm"
 * overrides are still active at "md" unless overridden again.
 */
const BREAKPOINT_ORDER: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl'];

function resolveResponsiveConfig(
  config: LayoutConfig,
  breakpoint: Breakpoint
): LayoutConfig {
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
}

// --------------- Component ---------------

export const LayoutContainer: React.FC<LayoutContainerProps> = ({
  layout,
  recursive = false,
  className,
  style,
  children,
  ...rest
}) => {
  // Read viewport from context (optional — degrades gracefully).
  const viewportCtx = useContext(ViewportContext);
  const breakpoint: Breakpoint = viewportCtx?.viewport.breakpoint ?? 'lg';

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
      />
    ));
  }, [recursive, resolvedConfig.children]);

  return (
    <div
      {...rest}
      className={className}
      style={mergedStyle}
      data-surface-layout=""
      data-layout-kind={resolvedConfig.kind}
      data-layout-name={resolvedConfig.name || undefined}
    >
      {nestedChildren ?? children}
    </div>
  );
};

LayoutContainer.displayName = 'LayoutContainer';
export default LayoutContainer;
