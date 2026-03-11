// ============================================================
// Clef Surface NativeScript Widget — CronEditor
//
// Visual cron expression editor with human-readable preview.
// ============================================================

import { StackLayout, Label, TextField } from '@nativescript/core';

export interface CronEditorProps {
  value?: string;
  disabled?: boolean;
  label?: string;
  onChange?: (value: string) => void;
}

export function createCronEditor(props: CronEditorProps): StackLayout {
  const { value = '* * * * *', disabled = false, label = 'Schedule', onChange } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-cron-editor';

  const lbl = new Label();
  lbl.text = label;
  lbl.fontWeight = 'bold';
  container.addChild(lbl);

  const field = new TextField();
  field.text = value;
  field.hint = '* * * * *';
  field.isEnabled = !disabled;
  field.fontFamily = 'monospace';
  field.accessibilityLabel = 'Cron expression';
  field.on('textChange', (args) => onChange?.(args.object.text));
  container.addChild(field);

  const preview = new Label();
  preview.text = 'Every minute';
  preview.opacity = 0.6;
  preview.fontSize = 12;
  container.addChild(preview);

  return container;
}

export default createCronEditor;
