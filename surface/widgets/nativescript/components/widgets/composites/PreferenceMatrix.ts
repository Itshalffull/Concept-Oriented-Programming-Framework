// ============================================================
// Clef Surface NativeScript Widget — PreferenceMatrix
//
// User preference grid with channel/category toggles.
// ============================================================

import { StackLayout, Label, Button, ScrollView } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface PreferenceMatrixProps {
  children?: View[];
  [key: string]: unknown;
}

export function createPreferenceMatrix(props: PreferenceMatrixProps): StackLayout {
  const { children = [], ...rest } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-preference-matrix';
  container.accessibilityLabel = 'Preference Matrix';

  const header = new Label();
  header.text = 'Preference Matrix';
  header.fontWeight = 'bold';
  header.fontSize = 16;
  container.addChild(header);

  for (const child of children) container.addChild(child);
  return container;
}

export default createPreferenceMatrix;
