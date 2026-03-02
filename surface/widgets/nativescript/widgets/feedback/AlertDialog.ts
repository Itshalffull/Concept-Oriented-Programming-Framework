// ============================================================
// Clef Surface NativeScript Widget — AlertDialog
//
// Modal alert dialog rendered as a full-screen overlay with a
// centered card. Supports a title, descriptive message, and
// up to two action buttons (confirm and optional cancel).
// The backdrop dims the screen and can optionally dismiss the
// dialog on tap.
// ============================================================

import { GridLayout, StackLayout, Label, Button, Color, AbsoluteLayout } from '@nativescript/core';

// --------------- Types ---------------

export type AlertDialogVariant = 'info' | 'warning' | 'error' | 'confirm';

// --------------- Props ---------------

export interface AlertDialogProps {
  title?: string;
  message: string;
  variant?: AlertDialogVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  backdropDismiss?: boolean;
  backdropColor?: string;
  cardBackgroundColor?: string;
  borderRadius?: number;
  onConfirm?: () => void;
  onCancel?: () => void;
  onDismiss?: () => void;
}

// --------------- Helpers ---------------

const VARIANT_COLORS: Record<AlertDialogVariant, string> = {
  info: '#1976D2',
  warning: '#F57C00',
  error: '#D32F2F',
  confirm: '#388E3C',
};

// --------------- Component ---------------

export function createAlertDialog(props: AlertDialogProps = { message: '' }): GridLayout {
  const {
    title,
    message,
    variant = 'info',
    confirmLabel = 'OK',
    cancelLabel = 'Cancel',
    showCancel = false,
    backdropDismiss = false,
    backdropColor = 'rgba(0,0,0,0.5)',
    cardBackgroundColor = '#FFFFFF',
    borderRadius = 16,
    onConfirm,
    onCancel,
    onDismiss,
  } = props;

  const accentColor = VARIANT_COLORS[variant];

  // --- Overlay root (full screen) ---
  const overlay = new GridLayout();
  overlay.className = `clef-alert-dialog clef-alert-dialog-${variant}`;
  overlay.rows = '*, auto, *';
  overlay.columns = '*, auto, *';
  overlay.backgroundColor = backdropColor as any;

  if (backdropDismiss) {
    overlay.on('tap', (args) => {
      if (args.object === overlay) {
        overlay.visibility = 'collapse';
        if (onDismiss) onDismiss();
      }
    });
  }

  // --- Dialog card ---
  const card = new StackLayout();
  card.className = 'clef-alert-dialog-card';
  card.backgroundColor = cardBackgroundColor as any;
  card.borderRadius = borderRadius;
  card.padding = 24;
  card.margin = 32;
  card.width = 300;
  card.verticalAlignment = 'middle';
  card.horizontalAlignment = 'center';

  // --- Title ---
  if (title) {
    const titleLabel = new Label();
    titleLabel.text = title;
    titleLabel.className = 'clef-alert-dialog-title';
    titleLabel.fontWeight = 'bold';
    titleLabel.fontSize = 20;
    titleLabel.color = new Color('#212121');
    titleLabel.textWrap = true;
    titleLabel.marginBottom = 8;
    card.addChild(titleLabel);
  }

  // --- Message ---
  const messageLabel = new Label();
  messageLabel.text = message;
  messageLabel.className = 'clef-alert-dialog-message';
  messageLabel.fontSize = 14;
  messageLabel.color = new Color('#424242');
  messageLabel.textWrap = true;
  messageLabel.lineHeight = 1.4;
  messageLabel.marginBottom = 20;
  card.addChild(messageLabel);

  // --- Actions ---
  const actions = new GridLayout();
  actions.className = 'clef-alert-dialog-actions';
  actions.columns = showCancel ? '*, *' : '*';
  actions.horizontalAlignment = 'right';

  if (showCancel) {
    const cancelBtn = new Button();
    cancelBtn.text = cancelLabel;
    cancelBtn.className = 'clef-alert-dialog-cancel';
    cancelBtn.fontSize = 14;
    cancelBtn.fontWeight = 'bold';
    cancelBtn.color = new Color('#757575');
    cancelBtn.backgroundColor = 'transparent' as any;
    cancelBtn.borderWidth = 0;
    cancelBtn.padding = '8 16';
    cancelBtn.on('tap', () => {
      overlay.visibility = 'collapse';
      if (onCancel) onCancel();
    });
    GridLayout.setColumn(cancelBtn, 0);
    actions.addChild(cancelBtn);
  }

  const confirmBtn = new Button();
  confirmBtn.text = confirmLabel;
  confirmBtn.className = 'clef-alert-dialog-confirm';
  confirmBtn.fontSize = 14;
  confirmBtn.fontWeight = 'bold';
  confirmBtn.color = new Color(accentColor);
  confirmBtn.backgroundColor = 'transparent' as any;
  confirmBtn.borderWidth = 0;
  confirmBtn.padding = '8 16';
  confirmBtn.on('tap', () => {
    overlay.visibility = 'collapse';
    if (onConfirm) onConfirm();
  });
  GridLayout.setColumn(confirmBtn, showCancel ? 1 : 0);
  actions.addChild(confirmBtn);

  card.addChild(actions);

  GridLayout.setRow(card, 1);
  GridLayout.setColumn(card, 1);
  overlay.addChild(card);

  return overlay;
}

createAlertDialog.displayName = 'AlertDialog';
export default createAlertDialog;
