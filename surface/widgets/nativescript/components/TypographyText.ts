// ============================================================
// Clef Surface NativeScript Widget — TypographyText
//
// Renders text using Clef Surface typography scale tokens.
// Maps token names (display, heading, body, label, caption)
// to NativeScript font sizes and weights.
// ============================================================

import { Label } from '@nativescript/core';

// --------------- Typography Scale ---------------

const FONT_SIZES: Record<string, Record<string, number>> = {
  display: { lg: 57, md: 45, sm: 36 },
  heading: { lg: 32, md: 28, sm: 24 },
  title: { lg: 22, md: 16, sm: 14 },
  body: { lg: 16, md: 14, sm: 12 },
  label: { lg: 14, md: 12, sm: 11 },
  caption: { lg: 11, md: 11, sm: 11 },
};

// --------------- Props ---------------

export interface TypographyTextProps {
  text: string;
  variant?: string;
  size?: string;
  weight?: string;
  color?: string;
  align?: 'left' | 'center' | 'right';
  maxLines?: number;
}

// --------------- Component ---------------

export function createTypographyText(props: TypographyTextProps): Label {
  const {
    text,
    variant = 'body',
    size = 'md',
    weight,
    color,
    align,
    maxLines,
  } = props;

  const label = new Label();
  label.text = text;
  label.className = `clef-typography clef-typography-${variant}-${size}`;

  const fontSize = FONT_SIZES[variant]?.[size] ?? FONT_SIZES.body.md;
  label.fontSize = fontSize;

  const fontWeight = weight ?? (variant === 'display' || variant === 'heading' ? 'bold' : 'normal');
  label.fontWeight = fontWeight as any;

  if (color) label.color = color as any;
  if (align) label.textAlignment = align;
  if (maxLines) label.maxLines = maxLines;

  return label;
}

createTypographyText.displayName = 'TypographyText';
export default createTypographyText;
