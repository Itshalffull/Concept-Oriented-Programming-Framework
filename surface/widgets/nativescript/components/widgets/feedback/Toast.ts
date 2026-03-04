// ============================================================
// Clef Surface NativeScript Widget — Toast
//
// Temporary notification message with auto-dismiss.
// ============================================================

import { StackLayout, Label, Button } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface ToastProps {
  title?: string;
  description?: string;
  variant?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  closable?: boolean;
  icon?: string;
  action?: View;
  onDismiss?: () => void;
  onAction?: () => void;
}

export function createToast(props: ToastProps): StackLayout {
  const {
    title, description, variant = 'info', duration = 5000,
    closable = true, icon, action, onDismiss, onAction,
  } = props;

  const container = new StackLayout();
  container.className = `clef-widget-toast clef-variant-${variant}`;
  container.orientation = 'horizontal';
  container.padding = '12';
  container.accessibilityRole = 'alert';

  if (icon) {
    const iconLabel = new Label();
    iconLabel.text = icon;
    iconLabel.marginRight = 8;
    container.addChild(iconLabel);
  }

  const textContainer = new StackLayout();
  if (title) {
    const titleLabel = new Label();
    titleLabel.text = title;
    titleLabel.fontWeight = 'bold';
    textContainer.addChild(titleLabel);
  }
  if (description) {
    const desc = new Label();
    desc.text = description;
    desc.textWrap = true;
    textContainer.addChild(desc);
  }
  container.addChild(textContainer);

  if (action) {
    const actionContainer = new StackLayout();
    actionContainer.marginLeft = 8;
    actionContainer.on('tap', () => onAction?.());
    actionContainer.addChild(action);
    container.addChild(actionContainer);
  }

  if (closable) {
    const closeBtn = new Button();
    closeBtn.text = '\u2715';
    closeBtn.accessibilityLabel = 'Dismiss notification';
    closeBtn.marginLeft = 8;
    closeBtn.on('tap', () => onDismiss?.());
    container.addChild(closeBtn);
  }

  if (duration > 0) {
    setTimeout(() => onDismiss?.(), duration);
  }
  return container;
}

export default createToast;
