// ============================================================
// Clef Surface NativeScript Widget — EmptyState
//
// Placeholder display for empty content areas.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: string;
  action?: View;
}

export function createEmptyState(props: EmptyStateProps): StackLayout {
  const { title = 'No data', description, icon, action } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-empty-state';
  container.horizontalAlignment = 'center';
  container.padding = '24';

  if (icon) {
    const iconLabel = new Label();
    iconLabel.text = icon;
    iconLabel.fontSize = 48;
    iconLabel.horizontalAlignment = 'center';
    container.addChild(iconLabel);
  }

  const titleLabel = new Label();
  titleLabel.text = title;
  titleLabel.fontWeight = 'bold';
  titleLabel.fontSize = 18;
  titleLabel.horizontalAlignment = 'center';
  container.addChild(titleLabel);

  if (description) {
    const desc = new Label();
    desc.text = description;
    desc.textWrap = true;
    desc.horizontalAlignment = 'center';
    desc.opacity = 0.6;
    desc.marginTop = 8;
    container.addChild(desc);
  }
  if (action) { action.marginTop = 16; container.addChild(action); }
  return container;
}

export default createEmptyState;
