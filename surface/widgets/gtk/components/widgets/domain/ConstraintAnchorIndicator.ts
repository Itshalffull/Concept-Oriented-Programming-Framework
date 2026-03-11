// ============================================================
// Clef Surface GTK Widget — ConstraintAnchorIndicator
//
// Visual overlay for ConstraintAnchor constraints on the
// canvas. Draws pin icons for pinned items, alignment lines
// for aligned groups, and separation arrows for gap
// constraints using Cairo on a GtkDrawingArea.
//
// Adapts the constraint-anchor-indicator.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export type AnchorType = 'pin' | 'align_h' | 'align_v' | 'separate' | 'group_bounds' | 'flow_direction';

export interface ConstraintParameters {
  x?: number;
  y?: number;
  gap?: number;
  axis?: string;
  direction?: string;
}

// --------------- Props ---------------

export interface ConstraintAnchorIndicatorProps {
  anchorId?: string;
  anchorType?: AnchorType;
  targetItems?: string[];
  targetCount?: number;
  parameters?: ConstraintParameters;
  width?: number;
  height?: number;
  onSelect?: (anchorId: string) => void;
  onDelete?: (anchorId: string) => void;
}

// --------------- Component ---------------

export function createConstraintAnchorIndicator(props: ConstraintAnchorIndicatorProps = {}): Gtk.Widget {
  const {
    anchorId = '',
    anchorType = 'pin',
    parameters,
    width = 200,
    height = 200,
    onSelect,
    onDelete,
  } = props;

  const drawingArea = new Gtk.DrawingArea({ widthRequest: width, heightRequest: height });

  let hovered = false;
  let selected = false;

  drawingArea.set_draw_func((_area: Gtk.DrawingArea, cr: any, w: number, h: number) => {
    const cx = w / 2;
    const cy = h / 2;
    const alpha = hovered || selected ? 1.0 : 0.6;

    switch (anchorType) {
      case 'pin': {
        // Pin icon: circle with a needle shape
        cr.setSourceRGBA(0.85, 0.26, 0.21, alpha);  // red
        cr.arc(cx, cy - 6, 6, 0, Math.PI * 2);
        cr.fill();
        cr.setLineWidth(2);
        cr.moveTo(cx, cy);
        cr.lineTo(cx, cy + 12);
        cr.stroke();
        break;
      }

      case 'align_h': {
        // Horizontal alignment line
        cr.setSourceRGBA(0.13, 0.59, 0.95, alpha);  // blue
        cr.setLineWidth(1.5);
        cr.setDash([4, 3], 0);
        cr.moveTo(4, cy);
        cr.lineTo(w - 4, cy);
        cr.stroke();
        cr.setDash([], 0);

        // Small diamonds on the line to mark target positions
        const spacing = w / ((props.targetCount ?? 2) + 1);
        for (let i = 1; i <= (props.targetCount ?? 2); i++) {
          const dx = spacing * i;
          cr.moveTo(dx, cy - 4);
          cr.lineTo(dx + 4, cy);
          cr.lineTo(dx, cy + 4);
          cr.lineTo(dx - 4, cy);
          cr.closePath();
          cr.fill();
        }
        break;
      }

      case 'align_v': {
        // Vertical alignment line
        cr.setSourceRGBA(0.13, 0.59, 0.95, alpha);
        cr.setLineWidth(1.5);
        cr.setDash([4, 3], 0);
        cr.moveTo(cx, 4);
        cr.lineTo(cx, h - 4);
        cr.stroke();
        cr.setDash([], 0);

        const spacing = h / ((props.targetCount ?? 2) + 1);
        for (let i = 1; i <= (props.targetCount ?? 2); i++) {
          const dy = spacing * i;
          cr.moveTo(cx - 4, dy);
          cr.lineTo(cx, dy - 4);
          cr.lineTo(cx + 4, dy);
          cr.lineTo(cx, dy + 4);
          cr.closePath();
          cr.fill();
        }
        break;
      }

      case 'separate': {
        // Double-headed arrow showing minimum gap
        const gap = parameters?.gap ?? 40;
        cr.setSourceRGBA(1.0, 0.6, 0.0, alpha);  // orange
        cr.setLineWidth(2);

        const arrowY = cy;
        const leftX = cx - gap / 2;
        const rightX = cx + gap / 2;

        // Line
        cr.moveTo(leftX, arrowY);
        cr.lineTo(rightX, arrowY);
        cr.stroke();

        // Left arrowhead
        cr.moveTo(leftX, arrowY);
        cr.lineTo(leftX + 6, arrowY - 4);
        cr.moveTo(leftX, arrowY);
        cr.lineTo(leftX + 6, arrowY + 4);
        cr.stroke();

        // Right arrowhead
        cr.moveTo(rightX, arrowY);
        cr.lineTo(rightX - 6, arrowY - 4);
        cr.moveTo(rightX, arrowY);
        cr.lineTo(rightX - 6, arrowY + 4);
        cr.stroke();

        // Gap label
        cr.setFontSize(9);
        cr.setSourceRGBA(0.3, 0.3, 0.3, 1);
        cr.moveTo(cx - 8, arrowY - 8);
        cr.showText(`${gap}px`);
        break;
      }

      case 'group_bounds': {
        // Dashed rectangle representing group bounds
        cr.setSourceRGBA(0.4, 0.7, 0.3, alpha);  // green
        cr.setLineWidth(1.5);
        cr.setDash([6, 3], 0);
        cr.rectangle(10, 10, w - 20, h - 20);
        cr.stroke();
        cr.setDash([], 0);
        break;
      }

      case 'flow_direction': {
        // Arrow indicating flow direction
        const dir = parameters?.direction ?? 'right';
        cr.setSourceRGBA(0.5, 0.3, 0.8, alpha);  // purple
        cr.setLineWidth(2);

        if (dir === 'right' || dir === 'left') {
          const startX = dir === 'right' ? 10 : w - 10;
          const endX = dir === 'right' ? w - 10 : 10;
          cr.moveTo(startX, cy);
          cr.lineTo(endX, cy);
          cr.stroke();
          cr.moveTo(endX, cy);
          cr.lineTo(endX + (dir === 'right' ? -8 : 8), cy - 5);
          cr.moveTo(endX, cy);
          cr.lineTo(endX + (dir === 'right' ? -8 : 8), cy + 5);
          cr.stroke();
        } else {
          const startY = dir === 'down' ? 10 : h - 10;
          const endY = dir === 'down' ? h - 10 : 10;
          cr.moveTo(cx, startY);
          cr.lineTo(cx, endY);
          cr.stroke();
          cr.moveTo(cx, endY);
          cr.lineTo(cx - 5, endY + (dir === 'down' ? -8 : 8));
          cr.moveTo(cx, endY);
          cr.lineTo(cx + 5, endY + (dir === 'down' ? -8 : 8));
          cr.stroke();
        }
        break;
      }
    }

    // Selection border
    if (selected) {
      cr.setSourceRGBA(0.1, 0.5, 0.9, 0.6);
      cr.setLineWidth(2);
      cr.setDash([3, 2], 0);
      cr.rectangle(1, 1, w - 2, h - 2);
      cr.stroke();
      cr.setDash([], 0);
    }
  });

  // Hover
  const motionCtrl = new Gtk.EventControllerMotion();
  motionCtrl.connect('enter', () => { hovered = true; drawingArea.queue_draw(); });
  motionCtrl.connect('leave', () => { hovered = false; drawingArea.queue_draw(); });
  drawingArea.add_controller(motionCtrl);

  // Click to select
  const gesture = new Gtk.GestureClick();
  gesture.connect('released', () => {
    selected = !selected;
    drawingArea.queue_draw();
    if (selected) onSelect?.(anchorId);
  });
  drawingArea.add_controller(gesture);

  // Key controller for Delete
  const keyCtrl = new Gtk.EventControllerKey();
  keyCtrl.connect('key-pressed', (_ctrl: any, keyval: number) => {
    if (keyval === 0xffff /* GDK_KEY_Delete */ && selected) {
      onDelete?.(anchorId);
      return true;
    }
    return false;
  });
  drawingArea.add_controller(keyCtrl);

  drawingArea.set_focusable(true);
  drawingArea.set_tooltip_text(`${anchorType} constraint`);

  return drawingArea;
}
