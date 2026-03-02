// ============================================================
// Clef Surface NativeScript Widget — ClefLabel
//
// NativeScript text label widget. Wraps the core NativeScript
// Label (imported as NsLabel) to avoid naming conflicts while
// providing Clef design token integration.
// ============================================================

import { Label as NsLabel, Color } from '@nativescript/core';

// --------------- Props ---------------

export type ClefLabelVariant = 'body' | 'caption' | 'heading' | 'overline' | 'subtitle';

const VARIANT_STYLES: Record<ClefLabelVariant, { fontSize: number; fontWeight: string; letterSpacing?: number }> = {
  body: { fontSize: 14, fontWeight: 'normal' },
  caption: { fontSize: 12, fontWeight: 'normal', letterSpacing: 0.4 },
  heading: { fontSize: 20, fontWeight: 'bold' },
  overline: { fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5 },
  subtitle: { fontSize: 16, fontWeight: '500' },
};

export interface ClefLabelProps {
  text?: string;
  variant?: ClefLabelVariant;
  color?: string;
  fontSize?: number;
  fontWeight?: string;
  textWrap?: boolean;
  textAlignment?: 'left' | 'center' | 'right';
  maxLines?: number;
}

// --------------- Component ---------------

export function createClefLabel(props: ClefLabelProps = {}): NsLabel {
  const {
    text = '',
    variant = 'body',
    color = '#212121',
    fontSize,
    fontWeight,
    textWrap = false,
    textAlignment = 'left',
    maxLines = 0,
  } = props;

  const label = new NsLabel();
  label.text = text;
  label.textWrap = textWrap;
  label.textAlignment = textAlignment;
  label.color = new Color(color);
  label.className = `clef-label clef-label--${variant}`;

  const variantStyle = VARIANT_STYLES[variant];
  label.fontSize = fontSize ?? variantStyle.fontSize;
  label.fontWeight = (fontWeight ?? variantStyle.fontWeight) as any;

  if (variantStyle.letterSpacing !== undefined) {
    label.letterSpacing = variantStyle.letterSpacing;
  }

  if (maxLines > 0) {
    label.maxLines = maxLines;
  }

  return label;
}

createClefLabel.displayName = 'ClefLabel';
export default createClefLabel;
