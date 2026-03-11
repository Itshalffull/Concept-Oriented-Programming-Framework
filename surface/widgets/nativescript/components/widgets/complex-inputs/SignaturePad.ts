// ============================================================
// Clef Surface NativeScript Widget — SignaturePad
//
// Touch-based signature capture area.
// ============================================================

import { StackLayout, Label, Button } from '@nativescript/core';

export interface SignaturePadProps {
  width?: number;
  height?: number;
  penColor?: string;
  penWidth?: number;
  disabled?: boolean;
  label?: string;
  onClear?: () => void;
  onChange?: (dataUrl: string) => void;
}

export function createSignaturePad(props: SignaturePadProps): StackLayout {
  const {
    width = 300, height = 150, penColor = '#000000',
    penWidth = 2, disabled = false, label = 'Signature',
    onClear, onChange,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-signature-pad';

  if (label) {
    const lbl = new Label();
    lbl.text = label;
    container.addChild(lbl);
  }

  const canvas = new StackLayout();
  canvas.className = 'clef-signature-canvas';
  canvas.width = width;
  canvas.height = height;
  canvas.borderColor = '#ccc';
  canvas.borderWidth = 1;
  canvas.accessibilityLabel = 'Signature area';
  container.addChild(canvas);

  const actions = new StackLayout();
  actions.orientation = 'horizontal';
  actions.marginTop = 8;

  const clearBtn = new Button();
  clearBtn.text = 'Clear';
  clearBtn.isEnabled = !disabled;
  clearBtn.on('tap', () => onClear?.());
  actions.addChild(clearBtn);

  container.addChild(actions);
  return container;
}

export default createSignaturePad;
