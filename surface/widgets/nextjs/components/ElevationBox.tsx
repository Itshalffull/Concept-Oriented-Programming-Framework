// ============================================================
// ElevationBox — Next.js Server Component friendly <div>
// wrapper that applies box-shadow based on a Clef Surface
// ElevationLevel (0-5).
//
// Uses elevationToCSS from the bridge to resolve the shadow
// string for each level. Supports custom shadow layers. The
// interactive hover level feature from the React version is
// omitted here for Server Component compatibility — use a
// client wrapper or CSS :hover for hover elevation changes.
//
// Server Component friendly — no 'use client' needed.
// Functional component only — no classes.
// ============================================================

import { type ReactNode, type CSSProperties, type HTMLAttributes } from 'react';

import type { ElevationLevel, ShadowLayer } from '../../shared/types.js';
import { elevationToCSS, shadowLayersToCSS } from '../../shared/surface-bridge.js';

// --------------- Props ---------------

export interface ElevationBoxProps extends HTMLAttributes<HTMLDivElement> {
  /** Elevation level 0-5. */
  readonly level: ElevationLevel;
  /**
   * Optional elevation level to transition to on hover.
   * Applied via CSS custom properties and a :hover selector
   * in the data attribute, allowing CSS-only hover elevation
   * without requiring client JS.
   */
  readonly hoverLevel?: ElevationLevel;
  /**
   * Custom shadow layers that override the default for
   * the given level. When provided, these take precedence.
   */
  readonly customShadow?: ShadowLayer[];
  /**
   * CSS transition duration for the shadow change.
   * @default "200ms"
   */
  readonly transitionDuration?: string;
  /** Additional class name. */
  readonly className?: string;
  /** Additional inline styles. */
  readonly style?: CSSProperties;
  readonly children?: ReactNode;
}

// --------------- Component ---------------

export const ElevationBox = ({
  level,
  hoverLevel,
  customShadow,
  transitionDuration = '200ms',
  className,
  style,
  children,
  ...rest
}: ElevationBoxProps): ReactNode => {
  const shadow =
    customShadow && customShadow.length > 0
      ? shadowLayersToCSS(customShadow)
      : elevationToCSS(level);

  const hoverShadow =
    hoverLevel !== undefined ? elevationToCSS(hoverLevel) : undefined;

  const mergedStyle: CSSProperties = {
    boxShadow: shadow,
    transition: hoverLevel !== undefined
      ? `box-shadow ${transitionDuration} ease`
      : undefined,
    // Expose hover shadow as a CSS custom property so that
    // a companion stylesheet or parent can apply it via :hover.
    ...(hoverShadow
      ? { '--surface-elevation-hover-shadow': hoverShadow } as CSSProperties
      : {}),
    ...style,
  };

  return (
    <div
      {...rest}
      className={className}
      style={mergedStyle}
      data-surface-elevation=""
      data-surface-adapter="nextjs"
      data-elevation-level={level}
      data-elevation-hover-level={hoverLevel !== undefined ? hoverLevel : undefined}
    >
      {children}
    </div>
  );
};

ElevationBox.displayName = 'ElevationBox';
export default ElevationBox;
