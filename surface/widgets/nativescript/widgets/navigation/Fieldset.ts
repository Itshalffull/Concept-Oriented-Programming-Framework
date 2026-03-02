// ============================================================
// Clef Surface NativeScript Widget — Fieldset
//
// Grouped form section with a legend label for NativeScript.
// Wraps child fields in a bordered container with an optional
// legend positioned at the top edge, description text, and
// configurable layout direction.
// ============================================================

import { StackLayout, GridLayout, Label, Color } from '@nativescript/core';

// --------------- Props ---------------

export interface FieldsetProps {
  legend?: string;
  description?: string;
  direction?: 'vertical' | 'horizontal';
  backgroundColor?: string;
  legendColor?: string;
  legendBackgroundColor?: string;
  descriptionColor?: string;
  borderColor?: string;
  borderRadius?: number;
  padding?: number;
  gap?: number;
  disabled?: boolean;
}

// --------------- Component ---------------

export function createFieldset(props: FieldsetProps = {}): StackLayout {
  const {
    legend = '',
    description = '',
    direction = 'vertical',
    backgroundColor = '#FFFFFF',
    legendColor = '#111827',
    legendBackgroundColor = '#FFFFFF',
    descriptionColor = '#6B7280',
    borderColor = '#D1D5DB',
    borderRadius = 8,
    padding = 16,
    gap = 8,
    disabled = false,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-fieldset';
  container.borderRadius = borderRadius;
  container.borderWidth = 1;
  container.borderColor = new Color(borderColor);
  container.backgroundColor = new Color(backgroundColor);
  container.padding = padding;
  container.opacity = disabled ? 0.5 : 1;
  container.isUserInteractionEnabled = !disabled;

  // Legend label (positioned at top)
  if (legend) {
    const legendLabel = new Label();
    legendLabel.text = legend;
    legendLabel.className = 'clef-fieldset-legend';
    legendLabel.color = new Color(legendColor);
    legendLabel.backgroundColor = new Color(legendBackgroundColor);
    legendLabel.fontWeight = 'bold';
    legendLabel.fontSize = 13;
    legendLabel.marginTop = -24;
    legendLabel.marginBottom = 4;
    legendLabel.paddingLeft = 4;
    legendLabel.paddingRight = 4;
    container.addChild(legendLabel);
  }

  // Description
  if (description) {
    const descLabel = new Label();
    descLabel.text = description;
    descLabel.className = 'clef-fieldset-description';
    descLabel.color = new Color(descriptionColor);
    descLabel.fontSize = 12;
    descLabel.textWrap = true;
    descLabel.marginBottom = gap;
    container.addChild(descLabel);
  }

  // Content area — vertical stack or horizontal grid
  if (direction === 'horizontal') {
    const row = new GridLayout();
    row.className = 'clef-fieldset-content clef-fieldset-horizontal';
    row.columns = '*, *';
    container.addChild(row);
  } else {
    const col = new StackLayout();
    col.className = 'clef-fieldset-content clef-fieldset-vertical';
    container.addChild(col);
  }

  return container;
}

createFieldset.displayName = 'Fieldset';
export default createFieldset;
