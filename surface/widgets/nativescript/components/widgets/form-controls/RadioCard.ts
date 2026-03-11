// ============================================================
// Clef Surface NativeScript Widget — RadioCard
//
// Card-styled radio option with title, description, and
// selection indicator.
// ============================================================

import { StackLayout, Label, Color } from '@nativescript/core';

// --------------- Props ---------------

export interface RadioCardProps {
  value: string;
  title?: string;
  description?: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: (value: string) => void;
}

// --------------- Component ---------------

export function createRadioCard(props: RadioCardProps): StackLayout {
  const {
    value,
    title = '',
    description,
    selected = false,
    disabled = false,
    onSelect,
  } = props;

  const container = new StackLayout();
  container.className = `clef-widget-radio-card${selected ? ' clef-selected' : ''}`;
  container.padding = '12';
  container.borderWidth = selected ? 2 : 1;
  container.borderColor = new Color(selected ? '#3b82f6' : '#d1d5db');
  container.borderRadius = 8;
  container.isEnabled = !disabled;
  container.accessibilityRole = 'button';
  container.accessibilityState = { selected, disabled };
  if (disabled) container.opacity = 0.5;

  const indicator = new Label();
  indicator.text = selected ? '\u25C9' : '\u25CB';
  indicator.fontSize = 18;
  indicator.marginBottom = 4;
  container.addChild(indicator);

  if (title) {
    const titleLabel = new Label();
    titleLabel.text = title;
    titleLabel.fontWeight = 'bold';
    container.addChild(titleLabel);
  }

  if (description) {
    const desc = new Label();
    desc.text = description;
    desc.textWrap = true;
    desc.fontSize = 12;
    desc.marginTop = 2;
    desc.opacity = 0.7;
    container.addChild(desc);
  }

  if (!disabled) {
    container.on('tap', () => onSelect?.(value));
  }

  return container;
}

export default createRadioCard;
