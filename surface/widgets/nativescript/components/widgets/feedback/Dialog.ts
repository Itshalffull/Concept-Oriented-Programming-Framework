// ============================================================
// Clef Surface NativeScript Widget — Dialog
//
// Modal dialog overlay with title, description, and close.
// ============================================================

import { StackLayout, Label, Button } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface DialogProps {
  open?: boolean;
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  dialogRole?: 'dialog' | 'alertdialog';
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  children?: View[];
}

export function createDialog(props: DialogProps): StackLayout {
  const {
    open = false, closeOnOutsideClick = true,
    closeOnEscape = true, dialogRole = 'dialog',
    onOpenChange, title, description, children = [],
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-dialog';
  container.visibility = open ? 'visible' : 'collapsed';

  const backdrop = new StackLayout();
  backdrop.className = 'clef-dialog-backdrop';
  if (closeOnOutsideClick) {
    backdrop.on('tap', () => onOpenChange?.(false));
  }
  container.addChild(backdrop);

  const content = new StackLayout();
  content.className = 'clef-dialog-content';
  content.padding = '20';
  content.accessibilityRole = 'none';

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

  const closeBtn = new Button();
  closeBtn.text = '\u2715';
  closeBtn.className = 'clef-dialog-close';
  closeBtn.accessibilityLabel = 'Close';
  closeBtn.on('tap', () => onOpenChange?.(false));
  content.addChild(closeBtn);

  container.addChild(content);
  return container;
}

export default createDialog;
