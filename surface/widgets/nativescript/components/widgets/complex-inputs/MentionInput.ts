// ============================================================
// Clef Surface NativeScript Widget — MentionInput
//
// Text input with @mention trigger and suggestion popup.
// ============================================================

import { StackLayout, Label, TextField } from '@nativescript/core';

export interface MentionTrigger { char: string; type: string; }
export interface MentionSuggestion { id: string; label: string; avatar?: string; }
export interface MentionChip { id: string; label: string; type: string; }

export interface MentionInputProps {
  value?: string;
  triggers?: MentionTrigger[];
  suggestions?: MentionSuggestion[];
  mentions?: MentionChip[];
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  onChange?: (value: string) => void;
  onMention?: (mention: MentionChip) => void;
}

export function createMentionInput(props: MentionInputProps): StackLayout {
  const {
    value = '', triggers = [{ char: '@', type: 'user' }],
    suggestions = [], mentions = [], placeholder = 'Type @ to mention...',
    disabled = false, label, onChange, onMention,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-mention-input';

  if (label) {
    const lbl = new Label();
    lbl.text = label;
    container.addChild(lbl);
  }

  const field = new TextField();
  field.text = value;
  field.hint = placeholder;
  field.isEnabled = !disabled;
  field.accessibilityLabel = label || 'Mention input';
  field.on('textChange', (args) => onChange?.(args.object.text));
  container.addChild(field);

  return container;
}

export default createMentionInput;
