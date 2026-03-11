// ============================================================
// Clef Surface NativeScript Widget — PolicyEditor
//
// Policy rule editor with validation and service targeting.
// ============================================================

import { StackLayout, Label, TextField, Button } from '@nativescript/core';

export interface ServiceDef { id: string; name: string; }
export interface ValidationError { field: string; message: string; }

export interface PolicyEditorProps {
  value?: string;
  services?: ServiceDef[];
  errors?: ValidationError[];
  readOnly?: boolean;
  label?: string;
  onChange?: (value: string) => void;
  onValidate?: () => void;
}

export function createPolicyEditor(props: PolicyEditorProps): StackLayout {
  const { value = '', services = [], errors = [], readOnly = false, label = 'Policy', onChange, onValidate } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-policy-editor';

  const lbl = new Label();
  lbl.text = label;
  lbl.fontWeight = 'bold';
  container.addChild(lbl);

  const field = new TextField();
  field.text = value;
  field.isEnabled = !readOnly;
  field.fontFamily = 'monospace';
  field.accessibilityLabel = label;
  field.on('textChange', (args) => onChange?.(args.object.text));
  container.addChild(field);

  if (errors.length > 0) {
    for (const err of errors) {
      const errLabel = new Label();
      errLabel.text = `\u2716 ${err.field}: ${err.message}`;
      errLabel.color = '#ef4444';
      errLabel.fontSize = 12;
      container.addChild(errLabel);
    }
  }

  if (onValidate && !readOnly) {
    const validateBtn = new Button();
    validateBtn.text = 'Validate';
    validateBtn.on('tap', () => onValidate());
    container.addChild(validateBtn);
  }
  return container;
}

export default createPolicyEditor;
