// ============================================================
// Clef Surface NativeScript Widget — Dialog
//
// General-purpose modal dialog with title bar, scrollable body
// area, and a row of action buttons. Renders as a centered
// card over a dimming backdrop. Supports custom content via a
// builder callback so callers can inject arbitrary NativeScript
// views into the body.
// ============================================================

import { GridLayout, StackLayout, ScrollView, Label, Button, Color, View } from '@nativescript/core';

// --------------- Types ---------------

export type DialogSize = 'small' | 'medium' | 'large';

export interface DialogAction {
  label: string;
  variant?: 'primary' | 'secondary' | 'destructive';
  onTap?: () => void;
}

// --------------- Props ---------------

export interface DialogProps {
  title?: string;
  body?: string;
  size?: DialogSize;
  actions?: DialogAction[];
  visible?: boolean;
  backdropDismiss?: boolean;
  backdropColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  contentBuilder?: (parent: StackLayout) => void;
  onClose?: () => void;
}

// --------------- Helpers ---------------

const SIZE_MAP: Record<DialogSize, number> = {
  small: 280,
  medium: 360,
  large: 440,
};

const VARIANT_COLORS: Record<string, string> = {
  primary: '#1976D2',
  secondary: '#757575',
  destructive: '#D32F2F',
};

// --------------- Component ---------------

export function createDialog(props: DialogProps = {}): GridLayout {
  const {
    title,
    body,
    size = 'medium',
    actions = [],
    visible = true,
    backdropDismiss = true,
    backdropColor = 'rgba(0,0,0,0.5)',
    backgroundColor = '#FFFFFF',
    borderRadius = 16,
    contentBuilder,
    onClose,
  } = props;

  // --- Overlay root ---
  const overlay = new GridLayout();
  overlay.className = 'clef-dialog-overlay';
  overlay.rows = '*';
  overlay.columns = '*';
  overlay.backgroundColor = backdropColor as any;
  overlay.visibility = visible ? 'visible' : 'collapse';

  if (backdropDismiss) {
    overlay.on('tap', (args) => {
      if (args.object === overlay) {
        overlay.visibility = 'collapse';
        if (onClose) onClose();
      }
    });
  }

  // --- Dialog card ---
  const card = new StackLayout();
  card.className = `clef-dialog clef-dialog-${size}`;
  card.width = SIZE_MAP[size];
  card.backgroundColor = backgroundColor as any;
  card.borderRadius = borderRadius;
  card.verticalAlignment = 'middle';
  card.horizontalAlignment = 'center';

  // --- Title bar ---
  if (title) {
    const titleBar = new GridLayout();
    titleBar.className = 'clef-dialog-title-bar';
    titleBar.columns = '*, auto';
    titleBar.padding = '16 20 12 20';

    const titleLabel = new Label();
    titleLabel.text = title;
    titleLabel.className = 'clef-dialog-title';
    titleLabel.fontWeight = 'bold';
    titleLabel.fontSize = 18;
    titleLabel.color = new Color('#212121');
    titleLabel.textWrap = true;
    titleLabel.verticalAlignment = 'middle';
    GridLayout.setColumn(titleLabel, 0);
    titleBar.addChild(titleLabel);

    const closeBtn = new Button();
    closeBtn.text = '\u2715';
    closeBtn.className = 'clef-dialog-close';
    closeBtn.fontSize = 18;
    closeBtn.color = new Color('#757575');
    closeBtn.backgroundColor = 'transparent' as any;
    closeBtn.borderWidth = 0;
    closeBtn.verticalAlignment = 'middle';
    closeBtn.padding = '0 4';
    closeBtn.on('tap', () => {
      overlay.visibility = 'collapse';
      if (onClose) onClose();
    });
    GridLayout.setColumn(closeBtn, 1);
    titleBar.addChild(closeBtn);

    card.addChild(titleBar);
  }

  // --- Body area ---
  const scrollView = new ScrollView();
  scrollView.className = 'clef-dialog-body-scroll';

  const bodyStack = new StackLayout();
  bodyStack.className = 'clef-dialog-body';
  bodyStack.padding = '4 20 16 20';

  if (body) {
    const bodyLabel = new Label();
    bodyLabel.text = body;
    bodyLabel.className = 'clef-dialog-body-text';
    bodyLabel.fontSize = 14;
    bodyLabel.color = new Color('#424242');
    bodyLabel.textWrap = true;
    bodyLabel.lineHeight = 1.5;
    bodyStack.addChild(bodyLabel);
  }

  if (contentBuilder) {
    contentBuilder(bodyStack);
  }

  scrollView.content = bodyStack;
  card.addChild(scrollView);

  // --- Actions row ---
  if (actions.length > 0) {
    const actionsRow = new GridLayout();
    actionsRow.className = 'clef-dialog-actions';
    actionsRow.columns = actions.map(() => 'auto').join(', ');
    actionsRow.horizontalAlignment = 'right';
    actionsRow.padding = '8 16 16 16';

    actions.forEach((action, idx) => {
      const btn = new Button();
      btn.text = action.label;
      btn.className = `clef-dialog-action clef-dialog-action-${action.variant ?? 'secondary'}`;
      btn.fontSize = 14;
      btn.fontWeight = 'bold';
      btn.color = new Color(VARIANT_COLORS[action.variant ?? 'secondary']);
      btn.backgroundColor = 'transparent' as any;
      btn.borderWidth = 0;
      btn.padding = '8 12';
      btn.borderRadius = 4;
      if (action.onTap) {
        const handler = action.onTap;
        btn.on('tap', () => {
          handler();
          overlay.visibility = 'collapse';
        });
      }
      GridLayout.setColumn(btn, idx);
      actionsRow.addChild(btn);
    });

    card.addChild(actionsRow);
  }

  overlay.addChild(card);

  return overlay;
}

createDialog.displayName = 'Dialog';
export default createDialog;
