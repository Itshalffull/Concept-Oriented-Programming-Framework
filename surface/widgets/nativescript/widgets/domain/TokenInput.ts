// ============================================================
// Clef Surface NativeScript Widget — TokenInput
//
// Token/tag input field. Renders a horizontal list of
// removable tokens with an input field for adding new ones.
// Supports token types, colours, disabled state, and
// selection.
// ============================================================

import {
  StackLayout,
  WrapLayout,
  GridLayout,
  Label,
  TextField,
  Button,
  Color,
  GestureTypes,
} from '@nativescript/core';

// --------------- Types ---------------

export interface TokenDef {
  label: string;
  value?: string;
  type?: string;
  color?: string;
}

export interface TokenInputProps {
  tokens?: TokenDef[];
  placeholder?: string;
  removable?: boolean;
  disabled?: boolean;
  maxTokens?: number;
  selectedIndex?: number;
  allowDuplicates?: boolean;
  inputValue?: string;
  accentColor?: string;
  onTokenAdd?: (label: string) => void;
  onTokenRemove?: (index: number) => void;
  onTokenSelect?: (index: number) => void;
  onInputChange?: (value: string) => void;
}

// --------------- Helpers ---------------

const TYPE_ICONS: Record<string, string> = {
  user: '\uD83D\uDC64', tag: '\uD83C\uDFF7', email: '\u2709',
  role: '\uD83D\uDD11', status: '\u25CF', label: '\u25A0',
};

// --------------- Component ---------------

export function createTokenInput(props: TokenInputProps = {}): StackLayout {
  const {
    tokens = [],
    placeholder = 'Add token...',
    removable = true,
    disabled = false,
    maxTokens = 50,
    selectedIndex,
    allowDuplicates = false,
    inputValue = '',
    accentColor = '#06b6d4',
    onTokenAdd,
    onTokenRemove,
    onTokenSelect,
    onInputChange,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-token-input';
  container.padding = 4;
  container.borderWidth = 1;
  container.borderColor = new Color(disabled ? '#333333' : '#444444');
  container.borderRadius = 6;
  container.backgroundColor = new Color('#0d0d1a');
  container.opacity = disabled ? 0.6 : 1;

  // Token chips area
  const tokenArea = new WrapLayout();
  tokenArea.orientation = 'horizontal';
  tokenArea.padding = 2;

  tokens.forEach((token, index) => {
    const isSelected = index === selectedIndex;
    const chipColor = token.color || accentColor;

    const chip = new StackLayout();
    chip.orientation = 'horizontal';
    chip.padding = 4;
    chip.paddingLeft = 6;
    chip.paddingRight = removable ? 2 : 6;
    chip.marginRight = 4;
    chip.marginBottom = 4;
    chip.borderRadius = 12;
    chip.backgroundColor = new Color(isSelected ? chipColor : `${chipColor}30`);
    chip.borderWidth = isSelected ? 2 : 1;
    chip.borderColor = new Color(chipColor);

    // Type icon
    if (token.type && TYPE_ICONS[token.type]) {
      const typeIcon = new Label();
      typeIcon.text = TYPE_ICONS[token.type];
      typeIcon.fontSize = 10;
      typeIcon.marginRight = 3;
      typeIcon.verticalAlignment = 'middle';
      chip.addChild(typeIcon);
    }

    // Label
    const labelView = new Label();
    labelView.text = token.label;
    labelView.fontSize = 12;
    labelView.color = new Color(isSelected ? '#000000' : '#e0e0e0');
    labelView.verticalAlignment = 'middle';
    chip.addChild(labelView);

    // Type badge
    if (token.type) {
      const typeBadge = new Label();
      typeBadge.text = ` (${token.type})`;
      typeBadge.fontSize = 9;
      typeBadge.opacity = 0.5;
      typeBadge.verticalAlignment = 'middle';
      chip.addChild(typeBadge);
    }

    // Remove button
    if (removable && !disabled) {
      const removeBtn = new Label();
      removeBtn.text = ' \u2715';
      removeBtn.fontSize = 11;
      removeBtn.color = new Color(isSelected ? '#000000' : '#888888');
      removeBtn.marginLeft = 4;
      removeBtn.verticalAlignment = 'middle';
      removeBtn.on(GestureTypes.tap as any, () => onTokenRemove?.(index));
      chip.addChild(removeBtn);
    }

    if (!disabled) {
      chip.on(GestureTypes.tap as any, () => onTokenSelect?.(index));
    }

    tokenArea.addChild(chip);
  });

  // Input field (if not at max)
  if (!disabled && tokens.length < maxTokens) {
    const inputField = new TextField();
    inputField.text = inputValue;
    inputField.hint = tokens.length === 0 ? placeholder : '+';
    inputField.fontSize = 12;
    inputField.color = new Color('#e0e0e0');
    inputField.backgroundColor = new Color('#00000000');
    inputField.borderBottomWidth = 0;
    inputField.width = 120;
    inputField.marginBottom = 4;
    inputField.on('textChange', (args: any) => onInputChange?.(args.object.text));
    inputField.on('returnPress', (args: any) => {
      const text = args.object.text?.trim();
      if (text) {
        if (allowDuplicates || !tokens.some((t) => t.label === text)) {
          onTokenAdd?.(text);
          args.object.text = '';
        }
      }
    });
    tokenArea.addChild(inputField);
  }

  container.addChild(tokenArea);

  // Token count and max
  if (maxTokens < 100) {
    const countLabel = new Label();
    countLabel.text = `${tokens.length}/${maxTokens}`;
    countLabel.fontSize = 9;
    countLabel.opacity = 0.3;
    countLabel.horizontalAlignment = 'right';
    countLabel.marginTop = 2;
    container.addChild(countLabel);
  }

  return container;
}

export default createTokenInput;
