// ============================================================
// Clef Surface NativeScript Widget — Label
//
// Text label with size, weight, and color variants. Wraps
// NativeScript Label with Clef styling conventions.
// ============================================================

import { StackLayout, Label as NSLabel, Color } from '@nativescript/core';

// --------------- Props ---------------

export interface LabelProps {
  text?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  weight?: 'normal' | 'medium' | 'bold';
  color?: string;
  textWrap?: boolean;
  htmlFor?: string;
}

const FONT_SIZE_MAP: Record<string, number> = { xs: 10, sm: 12, md: 14, lg: 18, xl: 24 };

// --------------- Component ---------------

export function createLabel(props: LabelProps): StackLayout {
  const {
    text = '',
    size = 'md',
    weight = 'normal',
    color,
    textWrap = false,
    htmlFor,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-label';

  const lbl = new NSLabel();
  lbl.text = text;
  lbl.fontSize = FONT_SIZE_MAP[size] ?? 14;
  lbl.fontWeight = weight === 'medium' ? '500' : weight;
  lbl.textWrap = textWrap;
  if (color) lbl.color = new Color(color);
  if (htmlFor) lbl.accessibilityLabel = `Label for ${htmlFor}`;

  container.addChild(lbl);
  return container;
}

export default createLabel;
