// ============================================================
// Clef Surface GTK Widget — SignaturePad
//
// Freehand signature drawing canvas. Uses Gtk.DrawingArea with
// pointer event tracking for capturing signature strokes.
//
// Adapts the signature-pad.widget spec: anatomy (root, canvas,
// clearButton, label), states (idle, drawing, signed, empty),
// and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface SignaturePadProps {
  width?: number;
  height?: number;
  disabled?: boolean;
  label?: string | null;
  onSignatureChange?: (hasSignature: boolean) => void;
  onClear?: () => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 signature pad using Gtk.DrawingArea with
 * pointer tracking for freehand signature capture.
 */
export function createSignaturePad(props: SignaturePadProps = {}): Gtk.Widget {
  const {
    width = 400,
    height = 150,
    disabled = false,
    label = null,
    onSignatureChange,
    onClear,
  } = props;

  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 8,
  });

  if (label) {
    container.append(new Gtk.Label({ label, xalign: 0 }));
  }

  const strokes: Array<Array<{ x: number; y: number }>> = [];
  let currentStroke: Array<{ x: number; y: number }> | null = null;

  const drawingArea = new Gtk.DrawingArea({
    widthRequest: width,
    heightRequest: height,
  });

  drawingArea.set_draw_func((_area: Gtk.DrawingArea, cr: any, w: number, h: number) => {
    // Background
    cr.setSourceRGBA(1, 1, 1, 1);
    cr.rectangle(0, 0, w, h);
    cr.fill();

    // Border
    cr.setSourceRGBA(0.7, 0.7, 0.7, 1);
    cr.rectangle(0, 0, w, h);
    cr.stroke();

    // Strokes
    cr.setSourceRGBA(0, 0, 0, 1);
    cr.setLineWidth(2);

    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;
    allStrokes.forEach((stroke) => {
      if (stroke.length > 0) {
        cr.moveTo(stroke[0].x, stroke[0].y);
        stroke.slice(1).forEach((pt) => cr.lineTo(pt.x, pt.y));
        cr.stroke();
      }
    });
  });

  if (!disabled) {
    const dragGesture = new Gtk.GestureDrag();
    dragGesture.connect('drag-begin', (_gesture: Gtk.GestureDrag, x: number, y: number) => {
      currentStroke = [{ x, y }];
    });
    dragGesture.connect('drag-update', (_gesture: Gtk.GestureDrag, offsetX: number, offsetY: number) => {
      if (currentStroke) {
        const startPt = currentStroke[0];
        currentStroke.push({ x: startPt.x + offsetX, y: startPt.y + offsetY });
        drawingArea.queue_draw();
      }
    });
    dragGesture.connect('drag-end', () => {
      if (currentStroke) {
        strokes.push(currentStroke);
        currentStroke = null;
        onSignatureChange?.(strokes.length > 0);
      }
    });
    drawingArea.add_controller(dragGesture);
  }

  container.append(drawingArea);

  // Clear button
  const clearBtn = new Gtk.Button({ label: 'Clear' });
  clearBtn.get_style_context().add_class('flat');
  clearBtn.set_sensitive(!disabled);
  clearBtn.connect('clicked', () => {
    strokes.length = 0;
    drawingArea.queue_draw();
    onSignatureChange?.(false);
    onClear?.();
  });
  container.append(clearBtn);

  return container;
}
