// ============================================================
// Clef Surface NativeScript Widget — AlertDialog
//
// Modal confirmation dialog with confirm/cancel actions.
// ============================================================

import { StackLayout, Label, Button, GridLayout } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface AlertDialogProps {
  open?: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'info' | 'danger';
  onConfirm?: () => void;
  onCancel?: () => void;
  onOpenChange?: (open: boolean) => void;
  children?: View[];
}

export function createAlertDialog(props: AlertDialogProps): StackLayout {
  const {
    open = false, title, description,
    confirmLabel = 'Confirm', cancelLabel = 'Cancel',
    variant = 'info', onConfirm, onCancel, onOpenChange,
    children = [],
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-alert-dialog';
  container.visibility = open ? 'visible' : 'collapsed';
  container.accessibilityRole = 'none';

  const backdrop = new StackLayout();
  backdrop.className = 'clef-alert-dialog-backdrop';
  backdrop.backgroundColor = '#00000080';

  const content = new StackLayout();
  content.className = 'clef-alert-dialog-content';
  content.padding = '20';
  content.horizontalAlignment = 'center';
  content.verticalAlignment = 'middle';

  if (title) {
    const titleLabel = new Label();
    titleLabel.text = title;
    titleLabel.fontWeight = 'bold';
    titleLabel.fontSize = 18;
    content.addChild(titleLabel);
  }

  if (description) {
    const desc = new Label();
    desc.text = description;
    desc.textWrap = true;
    desc.marginTop = 8;
    content.addChild(desc);
  }

  for (const child of children) content.addChild(child);

  const actions = new StackLayout();
  actions.orientation = 'horizontal';
  actions.horizontalAlignment = 'right';
  actions.marginTop = 16;

  const cancelBtn = new Button();
  cancelBtn.text = cancelLabel;
  cancelBtn.className = 'clef-alert-dialog-cancel';
  cancelBtn.on('tap', () => { onCancel?.(); onOpenChange?.(false); });
  actions.addChild(cancelBtn);

  const confirmBtn = new Button();
  confirmBtn.text = confirmLabel;
  confirmBtn.className = `clef-alert-dialog-confirm clef-variant-${variant}`;
  confirmBtn.marginLeft = 8;
  confirmBtn.on('tap', () => { onConfirm?.(); onOpenChange?.(false); });
  actions.addChild(confirmBtn);

  content.addChild(actions);
  container.addChild(backdrop);
  container.addChild(content);
  return container;
}

export default createAlertDialog;
