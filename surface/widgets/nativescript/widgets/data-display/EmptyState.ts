// ============================================================
// Clef Surface NativeScript Widget — EmptyState
//
// Placeholder view shown when content is empty. Displays an
// icon, title, description, and optional action button in a
// vertically-centered NativeScript layout.
// ============================================================

import { StackLayout, Label, Button, Color } from '@nativescript/core';

// --------------- Props ---------------

export interface EmptyStateProps {
  icon?: string;
  title?: string;
  description?: string;
  actionLabel?: string;
  iconSize?: number;
  iconColor?: string;
  titleColor?: string;
  descriptionColor?: string;
  actionColor?: string;
  compact?: boolean;
  onAction?: () => void;
}

// --------------- Component ---------------

export function createEmptyState(props: EmptyStateProps = {}): StackLayout {
  const {
    icon = '\uD83D\uDCE6',
    title = 'Nothing here yet',
    description,
    actionLabel,
    iconSize = 48,
    iconColor = '#9E9E9E',
    titleColor = '#424242',
    descriptionColor = '#757575',
    actionColor = '#1976D2',
    compact = false,
    onAction,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-empty-state';
  container.horizontalAlignment = 'center';
  container.verticalAlignment = 'middle';
  container.padding = compact ? 16 : 32;

  // --- Icon ---
  const iconLabel = new Label();
  iconLabel.text = icon;
  iconLabel.className = 'clef-empty-state-icon';
  iconLabel.fontSize = iconSize;
  iconLabel.color = new Color(iconColor);
  iconLabel.horizontalAlignment = 'center';
  iconLabel.marginBottom = compact ? 8 : 16;
  container.addChild(iconLabel);

  // --- Title ---
  if (title) {
    const titleLabel = new Label();
    titleLabel.text = title;
    titleLabel.className = 'clef-empty-state-title';
    titleLabel.fontWeight = 'bold';
    titleLabel.fontSize = compact ? 16 : 20;
    titleLabel.color = new Color(titleColor);
    titleLabel.horizontalAlignment = 'center';
    titleLabel.textWrap = true;
    titleLabel.marginBottom = description ? (compact ? 4 : 8) : 0;
    container.addChild(titleLabel);
  }

  // --- Description ---
  if (description) {
    const descLabel = new Label();
    descLabel.text = description;
    descLabel.className = 'clef-empty-state-description';
    descLabel.fontSize = compact ? 13 : 14;
    descLabel.color = new Color(descriptionColor);
    descLabel.horizontalAlignment = 'center';
    descLabel.textWrap = true;
    descLabel.lineHeight = 1.4;
    descLabel.marginBottom = actionLabel ? (compact ? 12 : 20) : 0;
    container.addChild(descLabel);
  }

  // --- Action Button ---
  if (actionLabel) {
    const actionBtn = new Button();
    actionBtn.text = actionLabel;
    actionBtn.className = 'clef-empty-state-action';
    actionBtn.fontSize = 14;
    actionBtn.fontWeight = 'bold';
    actionBtn.color = new Color('#FFFFFF');
    actionBtn.backgroundColor = actionColor as any;
    actionBtn.borderRadius = 8;
    actionBtn.padding = '10 24';
    actionBtn.horizontalAlignment = 'center';
    if (onAction) {
      actionBtn.on('tap', onAction);
    }
    container.addChild(actionBtn);
  }

  return container;
}

createEmptyState.displayName = 'EmptyState';
export default createEmptyState;
