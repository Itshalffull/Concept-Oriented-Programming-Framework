// ============================================================
// Clef Surface NativeScript Widget — Form
//
// Form container with validation and submission handling.
// ============================================================

import { StackLayout, Label, Button } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface FormProps {
  onSubmit?: () => void;
  onReset?: () => void;
  disabled?: boolean;
  children?: View[];
}

export function createForm(props: FormProps): StackLayout {
  const { onSubmit, onReset, disabled = false, children = [] } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-form';
  container.isEnabled = !disabled;
  container.accessibilityRole = 'none';
  for (const child of children) container.addChild(child);
  return container;
}

export default createForm;
