// ============================================================
// Clef Surface NativeScript Widget — Popover
//
// Positioned popover overlay that appears relative to a
// trigger element. Renders a floating content panel with an
// optional arrow, configurable placement, and a backdrop that
// dismisses the popover on tap. Supports arbitrary content
// through a builder callback.
// ============================================================

import { GridLayout, StackLayout, Label, Button, Color, ContentView } from '@nativescript/core';

// --------------- Types ---------------

export type PopoverPlacement = 'top' | 'bottom' | 'left' | 'right';

// --------------- Props ---------------

export interface PopoverProps {
  title?: string;
  body?: string;
  placement?: PopoverPlacement;
  visible?: boolean;
  width?: number;
  showArrow?: boolean;
  showCloseButton?: boolean;
  backdropDismiss?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  elevation?: number;
  padding?: number;
  contentBuilder?: (parent: StackLayout) => void;
  onClose?: () => void;
}

// --------------- Component ---------------

export function createPopover(props: PopoverProps = {}): GridLayout {
  const {
    title,
    body,
    placement = 'bottom',
    visible = true,
    width = 260,
    showArrow = true,
    showCloseButton = true,
    backdropDismiss = true,
    backgroundColor = '#FFFFFF',
    borderColor = '#E0E0E0',
    borderRadius = 12,
    elevation = 8,
    padding = 14,
    contentBuilder,
    onClose,
  } = props;

  // --- Full-screen overlay ---
  const overlay = new GridLayout();
  overlay.className = `clef-popover clef-popover-${placement}`;
  overlay.rows = '*';
  overlay.columns = '*';
  overlay.visibility = visible ? 'visible' : 'collapse';

  if (backdropDismiss) {
    overlay.on('tap', (args) => {
      if (args.object === overlay) {
        overlay.visibility = 'collapse';
        if (onClose) onClose();
      }
    });
  }

  // --- Content wrapper (arrow + card) ---
  const wrapper = new StackLayout();
  wrapper.className = 'clef-popover-wrapper';
  wrapper.horizontalAlignment = 'center';
  wrapper.verticalAlignment = 'middle';

  // --- Arrow (before card for top/left placements) ---
  if (showArrow && (placement === 'bottom' || placement === 'right')) {
    const arrow = new ContentView();
    arrow.className = 'clef-popover-arrow';
    arrow.width = 14;
    arrow.height = 14;
    arrow.backgroundColor = backgroundColor as any;
    arrow.borderWidth = 1;
    arrow.borderColor = borderColor;
    arrow.rotate = 45;
    arrow.horizontalAlignment = 'center';
    if (placement === 'bottom') {
      arrow.marginBottom = -7;
    }
    wrapper.addChild(arrow);
  }

  // --- Popover card ---
  const card = new StackLayout();
  card.className = 'clef-popover-card';
  card.width = width;
  card.backgroundColor = backgroundColor as any;
  card.borderRadius = borderRadius;
  card.borderWidth = 1;
  card.borderColor = borderColor;
  card.padding = padding;
  card.androidElevation = elevation;

  // --- Header ---
  if (title || showCloseButton) {
    const header = new GridLayout();
    header.className = 'clef-popover-header';
    header.columns = '*, auto';
    header.marginBottom = (body || contentBuilder) ? 8 : 0;

    if (title) {
      const titleLabel = new Label();
      titleLabel.text = title;
      titleLabel.className = 'clef-popover-title';
      titleLabel.fontWeight = 'bold';
      titleLabel.fontSize = 15;
      titleLabel.color = new Color('#212121');
      titleLabel.textWrap = true;
      titleLabel.verticalAlignment = 'middle';
      GridLayout.setColumn(titleLabel, 0);
      header.addChild(titleLabel);
    }

    if (showCloseButton) {
      const closeBtn = new Button();
      closeBtn.text = '\u2715';
      closeBtn.className = 'clef-popover-close';
      closeBtn.fontSize = 14;
      closeBtn.color = new Color('#9E9E9E');
      closeBtn.backgroundColor = 'transparent' as any;
      closeBtn.borderWidth = 0;
      closeBtn.padding = '0 2';
      closeBtn.verticalAlignment = 'middle';
      closeBtn.on('tap', () => {
        overlay.visibility = 'collapse';
        if (onClose) onClose();
      });
      GridLayout.setColumn(closeBtn, 1);
      header.addChild(closeBtn);
    }

    card.addChild(header);
  }

  // --- Body text ---
  if (body) {
    const bodyLabel = new Label();
    bodyLabel.text = body;
    bodyLabel.className = 'clef-popover-body';
    bodyLabel.fontSize = 13;
    bodyLabel.color = new Color('#424242');
    bodyLabel.textWrap = true;
    bodyLabel.lineHeight = 1.4;
    bodyLabel.marginBottom = contentBuilder ? 8 : 0;
    card.addChild(bodyLabel);
  }

  // --- Custom content ---
  if (contentBuilder) {
    const customArea = new StackLayout();
    customArea.className = 'clef-popover-custom';
    contentBuilder(customArea);
    card.addChild(customArea);
  }

  wrapper.addChild(card);

  // --- Arrow (after card for bottom/right placements) ---
  if (showArrow && (placement === 'top' || placement === 'left')) {
    const arrow = new ContentView();
    arrow.className = 'clef-popover-arrow';
    arrow.width = 14;
    arrow.height = 14;
    arrow.backgroundColor = backgroundColor as any;
    arrow.borderWidth = 1;
    arrow.borderColor = borderColor;
    arrow.rotate = 45;
    arrow.horizontalAlignment = 'center';
    if (placement === 'top') {
      arrow.marginTop = -7;
    }
    wrapper.addChild(arrow);
  }

  overlay.addChild(wrapper);

  return overlay;
}

createPopover.displayName = 'Popover';
export default createPopover;
