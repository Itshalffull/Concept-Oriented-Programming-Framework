// ============================================================
// Clef Surface NativeScript Widget — RadioCard
//
// Radio option rendered as a selectable card. Each option
// displays a title, optional description, and optional icon.
// Only one card can be selected at a time.
// ============================================================

import { StackLayout, GridLayout, Label, Color } from '@nativescript/core';

// --------------- Types ---------------

export interface RadioCardOption {
  label: string;
  value: string;
  description?: string;
  icon?: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface RadioCardProps {
  options?: RadioCardOption[];
  value?: string;
  label?: string;
  columns?: number;
  disabled?: boolean;
  accentColor?: string;
  onChange?: (value: string) => void;
}

// --------------- Component ---------------

export function createRadioCard(props: RadioCardProps = {}): StackLayout {
  const {
    options = [],
    value: initialValue = '',
    label,
    columns = 1,
    disabled = false,
    accentColor = '#2196F3',
    onChange,
  } = props;

  let currentValue = initialValue;
  const cardViews: { option: RadioCardOption; card: StackLayout; indicator: Label }[] = [];

  const container = new StackLayout();
  container.className = 'clef-radio-card';

  if (label) {
    const titleLabel = new Label();
    titleLabel.text = label;
    titleLabel.className = 'clef-radio-card-label';
    titleLabel.fontWeight = 'bold';
    titleLabel.marginBottom = 8;
    container.addChild(titleLabel);
  }

  function updateSelection(): void {
    cardViews.forEach(({ option, card, indicator }) => {
      const isSelected = option.value === currentValue;
      card.borderColor = new Color(isSelected ? accentColor : '#e5e7eb');
      card.borderWidth = isSelected ? 2 : 1;
      indicator.text = isSelected ? '◉' : '○';
      indicator.color = isSelected ? new Color(accentColor) : new Color('#9ca3af');
    });
  }

  const cardsContainer = new StackLayout();
  cardsContainer.className = 'clef-radio-card-list';

  options.forEach((option) => {
    const card = new StackLayout();
    card.className = 'clef-radio-card-item';
    card.borderRadius = 8;
    card.borderWidth = option.value === currentValue ? 2 : 1;
    card.borderColor = new Color(option.value === currentValue ? accentColor : '#e5e7eb');
    card.padding = 12;
    card.marginBottom = 8;
    card.opacity = disabled || option.disabled ? 0.5 : 1;

    const header = new GridLayout();
    header.columns = 'auto, *, auto';

    // Icon
    if (option.icon) {
      const iconLabel = new Label();
      iconLabel.col = 0;
      iconLabel.text = option.icon;
      iconLabel.fontSize = 20;
      iconLabel.marginRight = 8;
      iconLabel.verticalAlignment = 'middle';
      header.addChild(iconLabel);
    }

    // Label
    const nameLabel = new Label();
    nameLabel.col = 1;
    nameLabel.text = option.label;
    nameLabel.fontWeight = 'bold';
    nameLabel.verticalAlignment = 'middle';
    header.addChild(nameLabel);

    // Radio indicator
    const indicator = new Label();
    indicator.col = 2;
    indicator.text = option.value === currentValue ? '◉' : '○';
    indicator.fontSize = 18;
    indicator.color = option.value === currentValue ? new Color(accentColor) : new Color('#9ca3af');
    indicator.verticalAlignment = 'middle';
    header.addChild(indicator);

    card.addChild(header);

    // Description
    if (option.description) {
      const descLabel = new Label();
      descLabel.text = option.description;
      descLabel.className = 'clef-radio-card-desc';
      descLabel.fontSize = 12;
      descLabel.opacity = 0.7;
      descLabel.marginTop = 4;
      descLabel.textWrap = true;
      card.addChild(descLabel);
    }

    cardViews.push({ option, card, indicator });

    if (!disabled && !option.disabled) {
      card.on('tap', () => {
        currentValue = option.value;
        updateSelection();
        onChange?.(option.value);
      });
    }

    cardsContainer.addChild(card);
  });

  container.addChild(cardsContainer);
  return container;
}

createRadioCard.displayName = 'RadioCard';
export default createRadioCard;
