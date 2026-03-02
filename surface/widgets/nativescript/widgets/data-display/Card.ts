// ============================================================
// Clef Surface NativeScript Widget — Card
//
// Content card with configurable header, body, and footer
// sections. Supports elevation, border, and action buttons
// using NativeScript StackLayout and GridLayout.
// ============================================================

import { StackLayout, GridLayout, Label, Button, Color } from '@nativescript/core';

// --------------- Types ---------------

export type CardVariant = 'elevated' | 'outlined' | 'filled';

export interface CardAction {
  label: string;
  onTap?: () => void;
}

// --------------- Props ---------------

export interface CardProps {
  title?: string;
  subtitle?: string;
  body?: string;
  variant?: CardVariant;
  headerColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  padding?: number;
  elevation?: number;
  actions?: CardAction[];
  onTap?: () => void;
}

// --------------- Component ---------------

export function createCard(props: CardProps = {}): StackLayout {
  const {
    title,
    subtitle,
    body,
    variant = 'elevated',
    headerColor = '#212121',
    backgroundColor = '#FFFFFF',
    borderColor = '#E0E0E0',
    borderRadius = 12,
    padding = 16,
    elevation = 2,
    actions = [],
    onTap,
  } = props;

  const container = new StackLayout();
  container.className = `clef-card clef-card-${variant}`;
  container.borderRadius = borderRadius;
  container.backgroundColor = backgroundColor as any;
  container.padding = padding;

  if (variant === 'outlined') {
    container.borderWidth = 1;
    container.borderColor = borderColor;
  }

  if (variant === 'elevated') {
    container.androidElevation = elevation * 2;
  }

  if (onTap) {
    container.on('tap', onTap);
  }

  // --- Header ---
  if (title || subtitle) {
    const header = new StackLayout();
    header.className = 'clef-card-header';
    header.marginBottom = body ? 12 : 0;

    if (title) {
      const titleLabel = new Label();
      titleLabel.text = title;
      titleLabel.className = 'clef-card-title';
      titleLabel.fontWeight = 'bold';
      titleLabel.fontSize = 18;
      titleLabel.color = new Color(headerColor);
      titleLabel.textWrap = true;
      header.addChild(titleLabel);
    }

    if (subtitle) {
      const subtitleLabel = new Label();
      subtitleLabel.text = subtitle;
      subtitleLabel.className = 'clef-card-subtitle';
      subtitleLabel.fontSize = 13;
      subtitleLabel.opacity = 0.6;
      subtitleLabel.marginTop = 2;
      subtitleLabel.textWrap = true;
      header.addChild(subtitleLabel);
    }

    container.addChild(header);
  }

  // --- Body ---
  if (body) {
    const bodyLabel = new Label();
    bodyLabel.text = body;
    bodyLabel.className = 'clef-card-body';
    bodyLabel.fontSize = 14;
    bodyLabel.textWrap = true;
    bodyLabel.lineHeight = 1.4;
    bodyLabel.marginBottom = actions.length > 0 ? 12 : 0;
    container.addChild(bodyLabel);
  }

  // --- Footer / Actions ---
  if (actions.length > 0) {
    const footer = new GridLayout();
    footer.className = 'clef-card-footer';
    const colDef = actions.map(() => 'auto').join(', ');
    footer.columns = colDef;
    footer.horizontalAlignment = 'right';

    actions.forEach((action, index) => {
      const btn = new Button();
      btn.text = action.label;
      btn.className = 'clef-card-action';
      btn.fontSize = 13;
      btn.fontWeight = 'bold';
      btn.backgroundColor = 'transparent' as any;
      btn.color = new Color('#1976D2');
      btn.padding = '4 8';
      btn.borderRadius = 4;
      if (action.onTap) {
        btn.on('tap', action.onTap);
      }
      GridLayout.setColumn(btn, index);
      footer.addChild(btn);
    });

    container.addChild(footer);
  }

  return container;
}

createCard.displayName = 'Card';
export default createCard;
