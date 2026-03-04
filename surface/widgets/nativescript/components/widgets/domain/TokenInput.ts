// ============================================================
// Clef Surface NativeScript Widget — TokenInput
//
// Token/tag input with validation and autocomplete.
// ============================================================

import { StackLayout, Label, TextField, Button, FlexboxLayout } from '@nativescript/core';

export interface TokenInputProps {
  tokens?: string[];
  placeholder?: string;
  disabled?: boolean;
  maxTokens?: number;
  label?: string;
  onChange?: (tokens: string[]) => void;
}

export function createTokenInput(props: TokenInputProps): StackLayout {
  const { tokens: tokensProp = [], placeholder = 'Add token...', disabled = false, maxTokens, label, onChange } = props;
  let currentTokens = [...tokensProp];
  const container = new StackLayout();
  container.className = 'clef-widget-token-input';

  if (label) { const lbl = new Label(); lbl.text = label; container.addChild(lbl); }

  const tokensContainer = new FlexboxLayout();
  tokensContainer.flexWrap = 'wrap';
  container.addChild(tokensContainer);

  const rebuildTokens = () => {
    tokensContainer.removeChildren();
    currentTokens.forEach((token, idx) => {
      const chip = new StackLayout();
      chip.orientation = 'horizontal';
      chip.padding = '2 6';
      const chipLabel = new Label();
      chipLabel.text = token;
      chip.addChild(chipLabel);
      if (!disabled) {
        const removeBtn = new Button();
        removeBtn.text = '\u00D7';
        removeBtn.on('tap', () => { currentTokens = currentTokens.filter((_, i) => i !== idx); onChange?.(currentTokens); rebuildTokens(); });
        chip.addChild(removeBtn);
      }
      tokensContainer.addChild(chip);
    });
  };
  rebuildTokens();

  const field = new TextField();
  field.hint = placeholder;
  field.isEnabled = !disabled;
  field.on('returnPress', () => {
    const text = field.text?.trim();
    if (!text || currentTokens.includes(text)) return;
    if (maxTokens !== undefined && currentTokens.length >= maxTokens) return;
    currentTokens = [...currentTokens, text];
    field.text = '';
    onChange?.(currentTokens);
    rebuildTokens();
  });
  container.addChild(field);
  return container;
}

export default createTokenInput;
