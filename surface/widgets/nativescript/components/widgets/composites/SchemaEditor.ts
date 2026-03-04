// ============================================================
// Clef Surface NativeScript Widget — SchemaEditor
//
// Visual schema definition editor with field management.
// ============================================================

import { StackLayout, Label, Button, ScrollView } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface SchemaEditorProps {
  children?: View[];
  [key: string]: unknown;
}

export function createSchemaEditor(props: SchemaEditorProps): StackLayout {
  const { children = [], ...rest } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-schema-editor';
  container.accessibilityLabel = 'Schema Editor';

  const header = new Label();
  header.text = 'Schema Editor';
  header.fontWeight = 'bold';
  header.fontSize = 16;
  container.addChild(header);

  for (const child of children) container.addChild(child);
  return container;
}

export default createSchemaEditor;
