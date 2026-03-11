// ============================================================
// Clef Surface NativeScript Widget — PermissionMatrix
//
// Role-based permission grid editor.
// ============================================================

import { StackLayout, Label, Button, ScrollView } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface PermissionMatrixProps {
  children?: View[];
  [key: string]: unknown;
}

export function createPermissionMatrix(props: PermissionMatrixProps): StackLayout {
  const { children = [], ...rest } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-permission-matrix';
  container.accessibilityLabel = 'Permission Matrix';

  const header = new Label();
  header.text = 'Permission Matrix';
  header.fontWeight = 'bold';
  header.fontSize = 16;
  container.addChild(header);

  for (const child of children) container.addChild(child);
  return container;
}

export default createPermissionMatrix;
