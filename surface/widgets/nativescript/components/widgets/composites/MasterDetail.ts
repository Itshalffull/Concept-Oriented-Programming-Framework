// ============================================================
// Clef Surface NativeScript Widget — MasterDetail
//
// Master-detail layout with list and detail pane.
// ============================================================

import { StackLayout, Label, Button, ScrollView } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface MasterDetailProps {
  children?: View[];
  [key: string]: unknown;
}

export function createMasterDetail(props: MasterDetailProps): StackLayout {
  const { children = [], ...rest } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-master-detail';
  container.accessibilityLabel = 'Master Detail';

  const header = new Label();
  header.text = 'Master Detail';
  header.fontWeight = 'bold';
  header.fontSize = 16;
  container.addChild(header);

  for (const child of children) container.addChild(child);
  return container;
}

export default createMasterDetail;
