// ============================================================
// Clef Surface NativeScript Widget — InlineEdit
//
// Click-to-edit inline text with save/cancel.
// ============================================================

import { StackLayout, Label, TextField, Button } from '@nativescript/core';

export interface InlineEditProps {
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  onSave?: (value: string) => void;
  onCancel?: () => void;
}

export function createInlineEdit(props: InlineEditProps): StackLayout {
  const { value = '', placeholder = 'Click to edit', disabled = false, onSave, onCancel } = props;
  let isEditing = false;
  let editValue = value;
  const container = new StackLayout();
  container.className = 'clef-widget-inline-edit';

  const display = new Label();
  display.text = value || placeholder;
  if (!value) display.opacity = 0.5;
  display.accessibilityLabel = 'Click to edit';
  if (!disabled) {
    display.on('tap', () => {
      isEditing = true;
      display.visibility = 'collapsed';
      editContainer.visibility = 'visible';
    });
  }
  container.addChild(display);

  const editContainer = new StackLayout();
  editContainer.orientation = 'horizontal';
  editContainer.visibility = 'collapsed';
  const field = new TextField();
  field.text = value;
  field.on('textChange', (args) => { editValue = args.object.text; });
  editContainer.addChild(field);
  const saveBtn = new Button();
  saveBtn.text = '\u2713';
  saveBtn.on('tap', () => { onSave?.(editValue); display.text = editValue; isEditing = false; display.visibility = 'visible'; editContainer.visibility = 'collapsed'; });
  editContainer.addChild(saveBtn);
  const cancelBtn = new Button();
  cancelBtn.text = '\u2715';
  cancelBtn.on('tap', () => { onCancel?.(); isEditing = false; display.visibility = 'visible'; editContainer.visibility = 'collapsed'; });
  editContainer.addChild(cancelBtn);
  container.addChild(editContainer);

  return container;
}

export default createInlineEdit;
