// ============================================================
// Clef Surface NativeScript Widget — Fieldset
//
// Form field grouping container with legend.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface FieldsetProps {
  legend?: string;
  disabled?: boolean;
  children?: View[];
}

export function createFieldset(props: FieldsetProps): StackLayout {
  const { legend, disabled = false, children = [] } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-fieldset';
  container.isEnabled = !disabled;
  container.accessibilityRole = 'none';

  if (legend) {
    const lbl = new Label();
    lbl.text = legend;
    lbl.fontWeight = 'bold';
    lbl.marginBottom = 8;
    container.addChild(lbl);
  }
  for (const child of children) container.addChild(child);
  return container;
}

export default createFieldset;
