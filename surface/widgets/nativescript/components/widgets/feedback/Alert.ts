// ============================================================
// Clef Surface NativeScript Widget — Alert
//
// Dismissible alert banner with status variants.
// ============================================================

import { StackLayout, Label, Button, Color } from '@nativescript/core';

export interface AlertProps {
  title?: string;
  description?: string;
  variant?: 'info' | 'success' | 'warning' | 'error';
  closable?: boolean;
  icon?: string;
  onClose?: () => void;
}

const VARIANT_COLORS: Record<string, string> = {
  info: '#3b82f6', success: '#22c55e', warning: '#eab308', error: '#ef4444',
};

export function createAlert(props: AlertProps): StackLayout {
  const { title, description, variant = 'info', closable = true, icon, onClose } = props;
  const container = new StackLayout();
  container.className = `clef-widget-alert clef-variant-${variant}`;
  container.padding = '12';
  container.accessibilityRole = 'alert';

  const headerRow = new StackLayout();
  headerRow.orientation = 'horizontal';

  if (icon) {
    const iconLabel = new Label();
    iconLabel.text = icon;
    iconLabel.marginRight = 8;
    headerRow.addChild(iconLabel);
  }

  if (title) {
    const titleLabel = new Label();
    titleLabel.text = title;
    titleLabel.fontWeight = 'bold';
    headerRow.addChild(titleLabel);
  }

  if (closable) {
    const closeBtn = new Button();
    closeBtn.text = '\u2715';
    closeBtn.className = 'clef-alert-close';
    closeBtn.horizontalAlignment = 'right';
    closeBtn.accessibilityLabel = 'Close alert';
    closeBtn.on('tap', () => onClose?.());
    headerRow.addChild(closeBtn);
  }

  container.addChild(headerRow);

  if (description) {
    const desc = new Label();
    desc.text = description;
    desc.textWrap = true;
    desc.marginTop = 4;
    container.addChild(desc);
  }
  return container;
}

export default createAlert;
