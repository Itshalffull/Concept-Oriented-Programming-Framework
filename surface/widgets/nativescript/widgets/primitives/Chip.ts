// ============================================================
// Clef Surface NativeScript Widget — Chip
//
// NativeScript small labeled chip/tag component. Supports
// optional dismiss action and configurable color scheme.
// ============================================================

import { GridLayout, Label as NsLabel, Color } from '@nativescript/core';

// --------------- Props ---------------

export interface ChipProps {
  text?: string;
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: number;
  dismissible?: boolean;
  onDismiss?: () => void;
  onTap?: () => void;
}

// --------------- Component ---------------

export function createChip(props: ChipProps = {}): GridLayout {
  const {
    text = 'Chip',
    backgroundColor = '#E0E0E0',
    textColor = '#333333',
    borderRadius = 16,
    dismissible = false,
    onDismiss,
    onTap,
  } = props;

  const container = new GridLayout();
  container.className = 'clef-chip';
  container.columns = dismissible ? '*,auto' : '*';
  container.backgroundColor = new Color(backgroundColor);
  container.borderRadius = borderRadius;
  container.padding = '4 12';
  container.height = 32;
  container.verticalAlignment = 'middle';

  // Label
  const label = new NsLabel();
  label.text = text;
  label.color = new Color(textColor);
  label.fontSize = 13;
  label.verticalAlignment = 'middle';
  label.col = 0;
  label.className = 'clef-chip__label';
  container.addChild(label);

  // Dismiss button
  if (dismissible) {
    const dismiss = new NsLabel();
    dismiss.text = '\u2715';
    dismiss.color = new Color(textColor);
    dismiss.fontSize = 12;
    dismiss.verticalAlignment = 'middle';
    dismiss.horizontalAlignment = 'center';
    dismiss.marginLeft = 6;
    dismiss.width = 18;
    dismiss.height = 18;
    dismiss.col = 1;
    dismiss.className = 'clef-chip__dismiss';
    if (onDismiss) {
      dismiss.on('tap', (args) => {
        args.object.parent?.visibility = 'collapse' as any;
        onDismiss();
      });
    }
    container.addChild(dismiss);
  }

  if (onTap) {
    container.on('tap', onTap);
  }

  return container;
}

createChip.displayName = 'Chip';
export default createChip;
