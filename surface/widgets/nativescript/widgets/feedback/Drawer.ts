// ============================================================
// Clef Surface NativeScript Widget — Drawer
//
// Slide-out drawer panel anchored to a screen edge (left,
// right, top, or bottom). Rendered as a full-screen overlay
// with a backdrop and a content panel that occupies a portion
// of the screen. Supports custom content via a builder
// callback, a header with title, and a close control.
// ============================================================

import { GridLayout, StackLayout, ScrollView, Label, Button, Color, View } from '@nativescript/core';

// --------------- Types ---------------

export type DrawerPosition = 'left' | 'right' | 'top' | 'bottom';

// --------------- Props ---------------

export interface DrawerProps {
  title?: string;
  position?: DrawerPosition;
  width?: number;
  height?: number;
  visible?: boolean;
  backdropDismiss?: boolean;
  backdropColor?: string;
  backgroundColor?: string;
  headerColor?: string;
  contentBuilder?: (parent: StackLayout) => void;
  onClose?: () => void;
}

// --------------- Component ---------------

export function createDrawer(props: DrawerProps = {}): GridLayout {
  const {
    title,
    position = 'left',
    width = 300,
    height = 300,
    visible = true,
    backdropDismiss = true,
    backdropColor = 'rgba(0,0,0,0.4)',
    backgroundColor = '#FFFFFF',
    headerColor = '#212121',
    contentBuilder,
    onClose,
  } = props;

  const isHorizontal = position === 'left' || position === 'right';

  // --- Overlay ---
  const overlay = new GridLayout();
  overlay.className = `clef-drawer clef-drawer-${position}`;
  overlay.visibility = visible ? 'visible' : 'collapse';
  overlay.backgroundColor = backdropColor as any;

  if (isHorizontal) {
    overlay.rows = '*';
    overlay.columns = position === 'left' ? `${width}, *` : `*, ${width}`;
  } else {
    overlay.columns = '*';
    overlay.rows = position === 'top' ? `${height}, *` : `*, ${height}`;
  }

  // --- Backdrop tap zone ---
  if (backdropDismiss) {
    const backdrop = new StackLayout();
    backdrop.className = 'clef-drawer-backdrop';
    backdrop.on('tap', () => {
      overlay.visibility = 'collapse';
      if (onClose) onClose();
    });

    if (isHorizontal) {
      GridLayout.setColumn(backdrop, position === 'left' ? 1 : 0);
      GridLayout.setRow(backdrop, 0);
    } else {
      GridLayout.setRow(backdrop, position === 'top' ? 1 : 0);
      GridLayout.setColumn(backdrop, 0);
    }
    overlay.addChild(backdrop);
  }

  // --- Panel ---
  const panel = new StackLayout();
  panel.className = 'clef-drawer-panel';
  panel.backgroundColor = backgroundColor as any;

  if (isHorizontal) {
    panel.width = width;
    GridLayout.setColumn(panel, position === 'left' ? 0 : 1);
    GridLayout.setRow(panel, 0);
  } else {
    panel.height = height;
    GridLayout.setRow(panel, position === 'top' ? 0 : 1);
    GridLayout.setColumn(panel, 0);
  }

  // --- Header ---
  const header = new GridLayout();
  header.className = 'clef-drawer-header';
  header.columns = '*, auto';
  header.padding = '16 16 12 16';

  if (title) {
    const titleLabel = new Label();
    titleLabel.text = title;
    titleLabel.className = 'clef-drawer-title';
    titleLabel.fontWeight = 'bold';
    titleLabel.fontSize = 18;
    titleLabel.color = new Color(headerColor);
    titleLabel.textWrap = true;
    titleLabel.verticalAlignment = 'middle';
    GridLayout.setColumn(titleLabel, 0);
    header.addChild(titleLabel);
  }

  const closeBtn = new Button();
  closeBtn.text = '\u2715';
  closeBtn.className = 'clef-drawer-close';
  closeBtn.fontSize = 18;
  closeBtn.color = new Color('#757575');
  closeBtn.backgroundColor = 'transparent' as any;
  closeBtn.borderWidth = 0;
  closeBtn.verticalAlignment = 'middle';
  closeBtn.on('tap', () => {
    overlay.visibility = 'collapse';
    if (onClose) onClose();
  });
  GridLayout.setColumn(closeBtn, 1);
  header.addChild(closeBtn);

  panel.addChild(header);

  // --- Scrollable content ---
  const scrollView = new ScrollView();
  scrollView.className = 'clef-drawer-scroll';

  const content = new StackLayout();
  content.className = 'clef-drawer-content';
  content.padding = '0 16 16 16';

  if (contentBuilder) {
    contentBuilder(content);
  }

  scrollView.content = content;
  panel.addChild(scrollView);

  overlay.addChild(panel);

  return overlay;
}

createDrawer.displayName = 'Drawer';
export default createDrawer;
