// ============================================================
// Clef Surface NativeScript Widget — SignaturePad
//
// Signature capture control with a drawable canvas area,
// stroke color and width controls, undo/clear action buttons,
// and a status indicator showing whether a signature has been
// captured. Uses NativeScript gesture tracking to record
// stroke points for rendering.
//
// Adapts the signature-pad.widget spec: anatomy (root, canvas,
// toolbar, clearButton, undoButton, statusLabel), states (empty,
// drawing, captured, disabled), and connect attributes to
// NativeScript views and gesture handlers.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  Button,
  Slider,
  ContentView,
} from '@nativescript/core';

// --------------- Props ---------------

export interface SignaturePadProps {
  strokeColor?: string;
  strokeWidth?: number;
  backgroundColor?: string;
  height?: number;
  enabled?: boolean;
  onSignatureChange?: (hasSignature: boolean) => void;
  onClear?: () => void;
}

// --------------- Types ---------------

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

// --------------- Component ---------------

/**
 * Creates a NativeScript signature pad with a drawable canvas,
 * stroke color/width controls, undo/clear buttons, and
 * capture status indicator.
 */
export function createSignaturePad(props: SignaturePadProps = {}): StackLayout {
  const {
    strokeColor: initColor = '#000000',
    strokeWidth: initWidth = 3,
    backgroundColor = '#FFFFFF',
    height = 200,
    enabled = true,
    onSignatureChange,
    onClear,
  } = props;

  let currentColor = initColor;
  let currentWidth = initWidth;
  const strokes: Stroke[] = [];
  let currentStroke: Stroke | null = null;

  const container = new StackLayout();
  container.className = 'clef-widget-signature-pad';
  container.padding = 8;

  // -- Title --
  const title = new Label();
  title.text = 'Signature';
  title.fontWeight = 'bold';
  title.fontSize = 16;
  title.marginBottom = 8;
  container.addChild(title);

  // -- Canvas area --
  const canvasContainer = new ContentView();
  canvasContainer.height = height;
  canvasContainer.borderWidth = 2;
  canvasContainer.borderColor = '#CCCCCC';
  canvasContainer.borderRadius = 8;
  canvasContainer.backgroundColor = backgroundColor as any;

  const canvasContent = new StackLayout();
  canvasContent.height = height;

  // Signature line guide
  const signatureLine = new ContentView();
  signatureLine.height = 1;
  signatureLine.backgroundColor = '#E0E0E0' as any;
  signatureLine.marginTop = height * 0.7;
  signatureLine.marginLeft = 20;
  signatureLine.marginRight = 20;
  canvasContent.addChild(signatureLine);

  // Instruction text (visible when empty)
  const instructionLabel = new Label();
  instructionLabel.text = 'Sign here';
  instructionLabel.fontSize = 14;
  instructionLabel.opacity = 0.3;
  instructionLabel.horizontalAlignment = 'center';
  instructionLabel.verticalAlignment = 'middle';
  canvasContent.addChild(instructionLabel);

  canvasContainer.content = canvasContent;

  // Gesture tracking for drawing
  if (enabled) {
    canvasContainer.on('touch', (args: any) => {
      const action = args.action;
      const x = args.getX ? args.getX() : 0;
      const y = args.getY ? args.getY() : 0;

      if (action === 'down') {
        currentStroke = { points: [{ x, y }], color: currentColor, width: currentWidth };
        instructionLabel.visibility = 'collapse';
      } else if (action === 'move' && currentStroke) {
        currentStroke.points.push({ x, y });
      } else if (action === 'up' && currentStroke) {
        strokes.push(currentStroke);
        currentStroke = null;
        updateStatus();
        if (onSignatureChange) onSignatureChange(strokes.length > 0);
      }
    });
  }

  container.addChild(canvasContainer);

  // -- Status indicator --
  const statusLabel = new Label();
  statusLabel.fontSize = 12;
  statusLabel.horizontalAlignment = 'center';
  statusLabel.marginTop = 4;
  statusLabel.marginBottom = 8;

  function updateStatus(): void {
    if (strokes.length > 0) {
      statusLabel.text = `\u2713 Signature captured (${strokes.length} stroke${strokes.length > 1 ? 's' : ''})`;
      statusLabel.color = '#4CAF50' as any;
    } else {
      statusLabel.text = 'No signature';
      statusLabel.color = '#757575' as any;
    }
  }

  updateStatus();
  container.addChild(statusLabel);

  // -- Stroke controls --
  const controlsRow = new GridLayout();
  controlsRow.columns = 'auto, *, auto, *';
  controlsRow.rows = 'auto';
  controlsRow.marginBottom = 8;

  const colorLabel = new Label();
  colorLabel.text = 'Color';
  colorLabel.fontSize = 11;
  colorLabel.opacity = 0.7;
  colorLabel.verticalAlignment = 'middle';
  colorLabel.col = 0;
  controlsRow.addChild(colorLabel);

  // Color swatches
  const colorRow = new StackLayout();
  colorRow.orientation = 'horizontal';
  colorRow.col = 1;
  colorRow.marginLeft = 8;

  const penColors = ['#000000', '#1565C0', '#D32F2F', '#2E7D32', '#6A1B9A'];
  penColors.forEach((c) => {
    const swatch = new ContentView();
    swatch.width = 24;
    swatch.height = 24;
    swatch.borderRadius = 12;
    swatch.backgroundColor = c as any;
    swatch.borderWidth = currentColor === c ? 2 : 1;
    swatch.borderColor = currentColor === c ? '#FFC107' : '#CCCCCC';
    swatch.marginRight = 4;
    if (enabled) {
      swatch.on('tap', () => {
        currentColor = c;
        // Update swatch borders
        const parent = swatch.parent as StackLayout;
        if (parent) {
          parent.eachChild((child: any) => {
            child.borderWidth = 1;
            child.borderColor = '#CCCCCC';
            return true;
          });
        }
        swatch.borderWidth = 2;
        swatch.borderColor = '#FFC107';
      });
    }
    colorRow.addChild(swatch);
  });
  controlsRow.addChild(colorRow);

  const widthLabel = new Label();
  widthLabel.text = 'Width';
  widthLabel.fontSize = 11;
  widthLabel.opacity = 0.7;
  widthLabel.verticalAlignment = 'middle';
  widthLabel.col = 2;
  widthLabel.marginLeft = 12;
  controlsRow.addChild(widthLabel);

  const widthSlider = new Slider();
  widthSlider.minValue = 1;
  widthSlider.maxValue = 10;
  widthSlider.value = currentWidth;
  widthSlider.isEnabled = enabled;
  widthSlider.col = 3;
  widthSlider.marginLeft = 8;
  widthSlider.on('valueChange', () => {
    currentWidth = Math.round(widthSlider.value);
  });
  controlsRow.addChild(widthSlider);

  container.addChild(controlsRow);

  // -- Action buttons --
  const actionRow = new GridLayout();
  actionRow.columns = '*, *';
  actionRow.rows = 'auto';

  const undoBtn = new Button();
  undoBtn.text = 'Undo';
  undoBtn.fontSize = 13;
  undoBtn.col = 0;
  undoBtn.isEnabled = enabled;
  undoBtn.on('tap', () => {
    if (strokes.length > 0) {
      strokes.pop();
      updateStatus();
      if (strokes.length === 0) {
        instructionLabel.visibility = 'visible';
      }
      if (onSignatureChange) onSignatureChange(strokes.length > 0);
    }
  });
  actionRow.addChild(undoBtn);

  const clearBtn = new Button();
  clearBtn.text = 'Clear';
  clearBtn.fontSize = 13;
  clearBtn.col = 1;
  clearBtn.isEnabled = enabled;
  clearBtn.on('tap', () => {
    strokes.length = 0;
    instructionLabel.visibility = 'visible';
    updateStatus();
    if (onClear) onClear();
    if (onSignatureChange) onSignatureChange(false);
  });
  actionRow.addChild(clearBtn);

  container.addChild(actionRow);

  if (!enabled) {
    container.opacity = 0.38;
  }

  return container;
}

createSignaturePad.displayName = 'SignaturePad';
export default createSignaturePad;
