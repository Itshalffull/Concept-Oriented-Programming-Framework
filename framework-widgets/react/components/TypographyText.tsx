// ============================================================
// TypographyText — Renders text styled by a named Clef Surface text
// style (heading-1, body, caption, label, code, etc.).
//
// Resolves the TextStyle against a TypeScale and FontStack set
// using textStyleToCSS from the bridge, then applies the
// resulting font-size, weight, line-height, letter-spacing as
// inline styles.  The HTML element tag is inferred from the
// style name but can be overridden.
// ============================================================

import React, { useMemo, type ReactNode, type CSSProperties } from 'react';

import type { TextStyle, TypeScale, FontStack } from '../../shared/types.js';
import { textStyleToCSS } from '../../shared/surface-bridge.js';

// --------------- Props ---------------

export interface TypographyTextProps {
  /** The named text style to apply (must match a TextStyle.name). */
  styleName: string;
  /** Registry of available text styles. */
  textStyles: TextStyle[];
  /** The resolved type scale to size against. */
  typeScale: TypeScale;
  /** Available font stacks. */
  fontStacks: FontStack[];
  /**
   * Override the rendered HTML element.
   * If omitted the component infers the tag from the style name:
   *   heading-1 -> h1, heading-2 -> h2, ... heading-6 -> h6,
   *   body/paragraph -> p, caption/label -> span, code -> code.
   */
  as?: keyof JSX.IntrinsicElements;
  /** Additional class name. */
  className?: string;
  /** Additional inline styles (merged after typography styles). */
  style?: CSSProperties;
  children: ReactNode;
}

// --------------- Helpers ---------------

const TAG_INFERENCE: Record<string, keyof JSX.IntrinsicElements> = {
  'heading-1': 'h1',
  'heading-2': 'h2',
  'heading-3': 'h3',
  'heading-4': 'h4',
  'heading-5': 'h5',
  'heading-6': 'h6',
  body: 'p',
  paragraph: 'p',
  caption: 'span',
  label: 'span',
  code: 'code',
  overline: 'span',
  subtitle: 'p',
};

/**
 * The bridge returns kebab-case CSS keys.  React inline styles
 * need camelCase, so we convert.
 */
function kebabToCamel(s: string): string {
  return s.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

function bridgeCSSToReactStyle(
  css: Record<string, string>
): CSSProperties {
  const react: Record<string, string> = {};
  for (const [key, value] of Object.entries(css)) {
    react[kebabToCamel(key)] = value;
  }
  return react as CSSProperties;
}

// --------------- Component ---------------

export const TypographyText: React.FC<TypographyTextProps> = ({
  styleName,
  textStyles,
  typeScale,
  fontStacks,
  as,
  className,
  style: propStyle,
  children,
}) => {
  const textStyle = useMemo(
    () => textStyles.find((ts) => ts.name === styleName),
    [textStyles, styleName]
  );

  const computedCSS = useMemo(() => {
    if (!textStyle) return {};
    return textStyleToCSS(textStyle, typeScale, fontStacks);
  }, [textStyle, typeScale, fontStacks]);

  const reactStyle = useMemo(
    () => bridgeCSSToReactStyle(computedCSS),
    [computedCSS]
  );

  const mergedStyle = useMemo<CSSProperties>(
    () => ({ ...reactStyle, ...propStyle }),
    [reactStyle, propStyle]
  );

  // Determine the HTML tag to render.
  const Tag = (as ??
    TAG_INFERENCE[styleName] ??
    'span') as keyof JSX.IntrinsicElements;

  if (!textStyle) {
    // Fallback: render children unstyled with a data attribute
    // indicating the missing style for debuggability.
    return (
      <Tag
        className={className}
        style={propStyle}
        data-surface-typography=""
        data-surface-style-missing={styleName}
      >
        {children}
      </Tag>
    );
  }

  return (
    <Tag
      className={className}
      style={mergedStyle}
      data-surface-typography=""
      data-surface-style={styleName}
    >
      {children}
    </Tag>
  );
};

TypographyText.displayName = 'TypographyText';
export default TypographyText;
