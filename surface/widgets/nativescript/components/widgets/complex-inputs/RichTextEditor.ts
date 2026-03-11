// ============================================================
// Clef Surface NativeScript Widget — RichTextEditor
//
// Rich text editing with formatting toolbar.
// ============================================================

import { StackLayout, Label, TextView, Button } from '@nativescript/core';

export interface RichTextEditorProps {
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  toolbar?: ('bold' | 'italic' | 'underline' | 'heading' | 'list' | 'link')[];
  label?: string;
  onChange?: (value: string) => void;
}

export function createRichTextEditor(props: RichTextEditorProps): StackLayout {
  const {
    value = '', placeholder = 'Start writing...',
    disabled = false, readOnly = false,
    toolbar = ['bold', 'italic', 'underline'],
    label, onChange,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-rich-text-editor';

  if (label) {
    const lbl = new Label();
    lbl.text = label;
    container.addChild(lbl);
  }

  const toolbarRow = new StackLayout();
  toolbarRow.orientation = 'horizontal';
  toolbarRow.accessibilityRole = 'toolbar';
  for (const action of toolbar) {
    const btn = new Button();
    btn.text = action.charAt(0).toUpperCase();
    btn.className = 'clef-rte-toolbar-btn';
    btn.isEnabled = !disabled && !readOnly;
    btn.accessibilityLabel = action;
    toolbarRow.addChild(btn);
  }
  container.addChild(toolbarRow);

  const editor = new TextView();
  editor.text = value;
  editor.hint = placeholder;
  editor.isEnabled = !disabled;
  editor.editable = !readOnly;
  editor.height = 200;
  editor.accessibilityLabel = label || 'Rich text editor';
  editor.on('textChange', (args) => onChange?.(args.object.text));
  container.addChild(editor);

  return container;
}

export default createRichTextEditor;
