// ============================================================
// Clef Surface NativeScript Widget — DiffViewer
//
// Side-by-side or unified diff viewer for file changes.
// ============================================================

import { StackLayout, Label, Button, ScrollView } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface DiffViewerProps {
  children?: View[];
  [key: string]: unknown;
}

export function createDiffViewer(props: DiffViewerProps): StackLayout {
  const { children = [], ...rest } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-diff-viewer';
  container.accessibilityLabel = 'Diff Viewer';

  const header = new Label();
  header.text = 'Diff Viewer';
  header.fontWeight = 'bold';
  header.fontSize = 16;
  container.addChild(header);

  for (const child of children) container.addChild(child);
  return container;
}

export default createDiffViewer;
