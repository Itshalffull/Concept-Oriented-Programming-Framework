// ============================================================
// Clef Surface Ink Widget — TypographyText
//
// Renders text with Ink formatting that maps Clef Surface
// typography concepts to terminal styles. Font weights map to
// bold/dim, variants map to underline/italic, and scale maps
// to visual emphasis patterns.
// ============================================================

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';

import type { TextStyle, FontStack } from '../../shared/types.js';

// --------------- Variant Definitions ---------------

export type TypographyVariant =
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  | 'body1' | 'body2'
  | 'subtitle1' | 'subtitle2'
  | 'caption' | 'overline'
  | 'code' | 'pre'
  | 'label' | 'button';

interface VariantStyle {
  bold?: boolean;
  dimColor?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  inverse?: boolean;
  upperCase?: boolean;
  prefix?: string;
  suffix?: string;
  decoration?: string;
}

const VARIANT_STYLES: Record<TypographyVariant, VariantStyle> = {
  h1: { bold: true, underline: true, decoration: '═' },
  h2: { bold: true, decoration: '─' },
  h3: { bold: true },
  h4: { bold: true },
  h5: { bold: true, dimColor: true },
  h6: { dimColor: true, underline: true },
  body1: {},
  body2: { dimColor: true },
  subtitle1: { italic: true },
  subtitle2: { dimColor: true, italic: true },
  caption: { dimColor: true },
  overline: { dimColor: true, upperCase: true },
  code: { dimColor: true, prefix: '`', suffix: '`' },
  pre: { dimColor: true },
  label: { bold: true, suffix: ':' },
  button: { bold: true, inverse: true, prefix: '[ ', suffix: ' ]' },
};

// --------------- Props ---------------

export interface TypographyTextProps {
  /** The text content to render. */
  text: string;
  /** Typography variant for preset formatting. */
  variant?: TypographyVariant;
  /** Clef Surface TextStyle for precise typography control. */
  textStyle?: TextStyle;
  /** Font weight override (100-900). */
  weight?: number;
  /** Foreground color as hex or named color. */
  color?: string;
  /** Whether to apply bold formatting. */
  bold?: boolean;
  /** Whether to apply dim formatting. */
  dim?: boolean;
  /** Whether to apply italic formatting. */
  italic?: boolean;
  /** Whether to apply underline formatting. */
  underline?: boolean;
  /** Whether to apply strikethrough formatting. */
  strikethrough?: boolean;
  /** Whether to apply inverse/reverse video. */
  inverse?: boolean;
  /** Maximum width in columns. Text wraps or truncates. */
  maxWidth?: number;
  /** Whether to truncate with ellipsis instead of wrapping. */
  truncate?: boolean;
  /** Whether to render a decoration line below headings. */
  showDecoration?: boolean;
  /** Number of blank lines after this text. */
  marginBottom?: number;
}

// --------------- Component ---------------

export const TypographyText: React.FC<TypographyTextProps> = ({
  text,
  variant,
  textStyle,
  weight,
  color,
  bold,
  dim,
  italic,
  underline,
  strikethrough,
  inverse,
  maxWidth,
  truncate: shouldTruncate = false,
  showDecoration = true,
  marginBottom = 0,
}) => {
  const variantStyle = variant ? VARIANT_STYLES[variant] : null;

  const effectiveWeight = weight ?? textStyle?.weight;
  const isBold = bold ?? variantStyle?.bold ?? (effectiveWeight !== undefined && effectiveWeight >= 700);
  const isDim = dim ?? variantStyle?.dimColor ?? (effectiveWeight !== undefined && effectiveWeight <= 300);

  let displayText = text;
  if (variantStyle?.upperCase) {
    displayText = displayText.toUpperCase();
  }
  if (variantStyle?.prefix) {
    displayText = variantStyle.prefix + displayText;
  }
  if (variantStyle?.suffix) {
    displayText = displayText + variantStyle.suffix;
  }

  if (maxWidth && displayText.length > maxWidth) {
    if (shouldTruncate) {
      displayText = displayText.substring(0, maxWidth - 1) + '\u2026';
    }
  }

  const decorationChar = variantStyle?.decoration;
  const decoWidth = maxWidth || text.length;

  return (
    <Box flexDirection="column">
      <Text
        bold={isBold}
        dimColor={isDim}
        italic={italic ?? variantStyle?.italic}
        underline={underline ?? variantStyle?.underline}
        strikethrough={strikethrough ?? variantStyle?.strikethrough}
        inverse={inverse ?? variantStyle?.inverse}
        color={color}
        wrap={shouldTruncate ? 'truncate' : 'wrap'}
      >
        {displayText}
      </Text>

      {showDecoration && decorationChar && (
        <Text dimColor>{decorationChar.repeat(decoWidth)}</Text>
      )}

      {Array.from({ length: marginBottom }).map((_, i) => (
        <Text key={i}>{' '}</Text>
      ))}
    </Box>
  );
};

TypographyText.displayName = 'TypographyText';
export default TypographyText;
