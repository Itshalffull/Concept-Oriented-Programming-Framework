// ============================================================
// Clef Surface NativeScript Widget — FormulaEditor
//
// Formula/expression editor with syntax highlighting and functions.
// ============================================================

import { StackLayout, Label, TextField } from '@nativescript/core';

export interface FormulaFunction { name: string; description: string; syntax: string; }
export interface FormulaSuggestion { label: string; type: string; }

export interface FormulaEditorProps {
  value?: string;
  functions?: FormulaFunction[];
  suggestions?: FormulaSuggestion[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  label?: string;
  onChange?: (value: string) => void;
  onValidate?: (value: string) => boolean;
}

export function createFormulaEditor(props: FormulaEditorProps): StackLayout {
  const {
    value = '', functions = [], suggestions = [],
    placeholder = 'Enter formula...', disabled = false,
    error, label, onChange, onValidate,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-formula-editor';

  if (label) {
    const lbl = new Label();
    lbl.text = label;
    container.addChild(lbl);
  }

  const field = new TextField();
  field.text = value;
  field.hint = placeholder;
  field.isEnabled = !disabled;
  field.accessibilityLabel = label || 'Formula editor';
  field.on('textChange', (args) => onChange?.(args.object.text));
  container.addChild(field);

  if (error) {
    const errLabel = new Label();
    errLabel.text = error;
    errLabel.color = '#ef4444';
    errLabel.fontSize = 12;
    container.addChild(errLabel);
  }
  return container;
}

export default createFormulaEditor;
