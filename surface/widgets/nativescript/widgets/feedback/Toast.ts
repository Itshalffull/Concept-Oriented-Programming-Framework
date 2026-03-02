// ============================================================
// Clef Surface NativeScript Widget — Toast
//
// Brief notification toast displayed as a small, elevated bar
// at the bottom of the screen. Supports an icon, message text,
// and an optional action button. Auto-dismisses after a
// configurable duration.
// ============================================================

import { GridLayout, StackLayout, Label, Button, Color } from '@nativescript/core';

// --------------- Types ---------------

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top' | 'bottom';

// --------------- Props ---------------

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
  position?: ToastPosition;
  duration?: number;
  icon?: string;
  actionLabel?: string;
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: number;
  onAction?: () => void;
  onDismiss?: () => void;
}

// --------------- Helpers ---------------

const VARIANT_STYLES: Record<ToastVariant, { bg: string; fg: string }> = {
  default: { bg: '#323232', fg: '#FFFFFF' },
  success: { bg: '#2E7D32', fg: '#FFFFFF' },
  error:   { bg: '#C62828', fg: '#FFFFFF' },
  warning: { bg: '#EF6C00', fg: '#FFFFFF' },
  info:    { bg: '#1565C0', fg: '#FFFFFF' },
};

// --------------- Component ---------------

export function createToast(props: ToastProps = { message: '' }): GridLayout {
  const {
    message,
    variant = 'default',
    position = 'bottom',
    duration = 3000,
    icon,
    actionLabel,
    backgroundColor,
    textColor,
    borderRadius = 8,
    onAction,
    onDismiss,
  } = props;

  const style = VARIANT_STYLES[variant];
  const bg = backgroundColor ?? style.bg;
  const fg = textColor ?? style.fg;

  // --- Outer positioning container ---
  const positioner = new GridLayout();
  positioner.className = `clef-toast-positioner clef-toast-${position}`;
  positioner.rows = position === 'top' ? 'auto, *' : '*, auto';
  positioner.columns = '*';

  // --- Toast bar ---
  const bar = new GridLayout();
  bar.className = `clef-toast clef-toast-${variant}`;
  const hasIcon = !!icon;
  const hasAction = !!actionLabel;
  bar.columns = [
    hasIcon ? 'auto' : '',
    '*',
    hasAction ? 'auto' : '',
  ].filter(Boolean).join(', ');
  bar.backgroundColor = bg as any;
  bar.borderRadius = borderRadius;
  bar.padding = '12 16';
  bar.margin = '8 16';
  bar.androidElevation = 6;
  bar.horizontalAlignment = 'center';
  bar.verticalAlignment = position === 'top' ? 'top' : 'bottom';

  let colIndex = 0;

  // --- Icon ---
  if (icon) {
    const iconLabel = new Label();
    iconLabel.text = icon;
    iconLabel.className = 'clef-toast-icon';
    iconLabel.fontSize = 16;
    iconLabel.color = new Color(fg);
    iconLabel.verticalAlignment = 'middle';
    iconLabel.marginRight = 10;
    GridLayout.setColumn(iconLabel, colIndex);
    bar.addChild(iconLabel);
    colIndex++;
  }

  // --- Message ---
  const messageLabel = new Label();
  messageLabel.text = message;
  messageLabel.className = 'clef-toast-message';
  messageLabel.fontSize = 14;
  messageLabel.color = new Color(fg);
  messageLabel.textWrap = true;
  messageLabel.verticalAlignment = 'middle';
  GridLayout.setColumn(messageLabel, colIndex);
  bar.addChild(messageLabel);
  colIndex++;

  // --- Action button ---
  if (actionLabel) {
    const actionBtn = new Button();
    actionBtn.text = actionLabel;
    actionBtn.className = 'clef-toast-action';
    actionBtn.fontSize = 13;
    actionBtn.fontWeight = 'bold';
    actionBtn.color = new Color('#BBDEFB');
    actionBtn.backgroundColor = 'transparent' as any;
    actionBtn.borderWidth = 0;
    actionBtn.verticalAlignment = 'middle';
    actionBtn.marginLeft = 12;
    actionBtn.padding = '4 8';
    if (onAction) {
      actionBtn.on('tap', () => {
        onAction();
        positioner.visibility = 'collapse';
      });
    }
    GridLayout.setColumn(actionBtn, colIndex);
    bar.addChild(actionBtn);
  }

  GridLayout.setRow(bar, position === 'top' ? 0 : 1);
  positioner.addChild(bar);

  // --- Auto-dismiss timer ---
  if (duration > 0) {
    setTimeout(() => {
      positioner.visibility = 'collapse';
      if (onDismiss) onDismiss();
    }, duration);
  }

  return positioner;
}

createToast.displayName = 'Toast';
export default createToast;
