// ============================================================
// ElevationBox — A <div> wrapper that applies box-shadow based
// on a COIF ElevationLevel (0-5).
//
// Uses elevationToCSS from the bridge to resolve the shadow
// string for each level. Supports custom shadow layers and an
// optional interactive hover level.
// ============================================================

import React, {
  useMemo,
  useState,
  useCallback,
  type ReactNode,
  type CSSProperties,
  type HTMLAttributes,
} from 'react';

import type { ElevationLevel, ShadowLayer } from '../../shared/types.js';
import { elevationToCSS, shadowLayersToCSS } from '../../shared/coif-bridge.js';

// --------------- Props ---------------

export interface ElevationBoxProps extends HTMLAttributes<HTMLDivElement> {
  /** Elevation level 0-5. */
  level: ElevationLevel;
  /**
   * Optional elevation level to transition to on hover.
   * Useful for cards that "lift" when hovered.
   */
  hoverLevel?: ElevationLevel;
  /**
   * Custom shadow layers that override the default for
   * the given level.  When provided, these take precedence.
   */
  customShadow?: ShadowLayer[];
  /**
   * CSS transition duration for the shadow change.
   * @default "200ms"
   */
  transitionDuration?: string;
  /** Additional class name. */
  className?: string;
  /** Additional inline styles. */
  style?: CSSProperties;
  children?: ReactNode;
}

// --------------- Component ---------------

export const ElevationBox: React.FC<ElevationBoxProps> = ({
  level,
  hoverLevel,
  customShadow,
  transitionDuration = '200ms',
  className,
  style,
  children,
  ...rest
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = useCallback(() => {
    if (hoverLevel !== undefined) setIsHovered(true);
  }, [hoverLevel]);

  const handleMouseLeave = useCallback(() => {
    if (hoverLevel !== undefined) setIsHovered(false);
  }, [hoverLevel]);

  const effectiveLevel: ElevationLevel =
    isHovered && hoverLevel !== undefined ? hoverLevel : level;

  const shadow = useMemo(() => {
    if (customShadow && customShadow.length > 0) {
      return shadowLayersToCSS(customShadow);
    }
    return elevationToCSS(effectiveLevel);
  }, [customShadow, effectiveLevel]);

  const mergedStyle = useMemo<CSSProperties>(
    () => ({
      boxShadow: shadow,
      transition: hoverLevel !== undefined
        ? `box-shadow ${transitionDuration} ease`
        : undefined,
      ...style,
    }),
    [shadow, hoverLevel, transitionDuration, style]
  );

  return (
    <div
      {...rest}
      className={className}
      style={mergedStyle}
      data-coif-elevation=""
      data-elevation-level={effectiveLevel}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
};

ElevationBox.displayName = 'ElevationBox';
export default ElevationBox;
