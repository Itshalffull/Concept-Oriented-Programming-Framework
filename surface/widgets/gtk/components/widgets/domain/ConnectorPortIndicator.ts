// ============================================================
// Clef Surface GTK Widget — ConnectorPortIndicator
//
// Visual indicator for a ConnectorPort on a canvas item.
// Renders as a GtkDrawingArea circle colored by direction:
// blue for "in", orange for "out", green for "bidirectional".
// Shows optional label and connection count badge on hover.
//
// Adapts the connector-port-indicator.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Constants ---------------

const DIRECTION_COLORS: Record<string, [number, number, number]> = {
  in:            [0.13, 0.59, 0.95],  // #2196F3 blue
  out:           [1.00, 0.60, 0.00],  // #FF9800 orange
  bidirectional: [0.30, 0.69, 0.31],  // #4CAF50 green
};

const PORT_RADIUS = 6;
const PORT_RADIUS_HOVERED = 9;

// --------------- Props ---------------

export interface ConnectorPortIndicatorProps {
  portId?: string;
  direction?: 'in' | 'out' | 'bidirectional';
  portType?: string;
  label?: string;
  side?: 'top' | 'right' | 'bottom' | 'left' | 'center';
  offset?: number;
  connectionCount?: number;
  maxConnections?: number;
  onConnectStart?: (portId: string) => void;
}

// --------------- Component ---------------

export function createConnectorPortIndicator(props: ConnectorPortIndicatorProps = {}): Gtk.Widget {
  const {
    portId = '',
    direction = 'in',
    label,
    connectionCount = 0,
    maxConnections,
    onConnectStart,
  } = props;

  const size = PORT_RADIUS_HOVERED * 2 + 20;
  const drawingArea = new Gtk.DrawingArea({ widthRequest: size, heightRequest: size });

  let hovered = false;

  drawingArea.set_draw_func((_area: Gtk.DrawingArea, cr: any, w: number, h: number) => {
    const cx = w / 2;
    const cy = h / 2;
    const [r, g, b] = DIRECTION_COLORS[direction] || DIRECTION_COLORS.in;
    const radius = hovered ? PORT_RADIUS_HOVERED : PORT_RADIUS;

    // Port dot
    cr.setSourceRGBA(r, g, b, 1);
    cr.arc(cx, cy, radius, 0, Math.PI * 2);
    cr.fill();

    // Border
    cr.setSourceRGBA(r * 0.7, g * 0.7, b * 0.7, 1);
    cr.setLineWidth(1.5);
    cr.arc(cx, cy, radius, 0, Math.PI * 2);
    cr.stroke();

    // Label (shown on hover)
    if (hovered && label) {
      cr.setSourceRGBA(0.2, 0.2, 0.2, 1);
      cr.setFontSize(9);
      cr.moveTo(cx + radius + 4, cy + 3);
      cr.showText(label);
    }

    // Connection count badge
    if (connectionCount > 0) {
      const badgeText = maxConnections != null
        ? `${connectionCount}/${maxConnections}`
        : `${connectionCount}`;
      cr.setSourceRGBA(0.3, 0.3, 0.3, 1);
      cr.setFontSize(8);
      cr.moveTo(cx + radius + 4, cy + (hovered && label ? 14 : 3));
      cr.showText(badgeText);
    }
  });

  // Hover via motion controller
  const motionCtrl = new Gtk.EventControllerMotion();
  motionCtrl.connect('enter', () => {
    hovered = true;
    drawingArea.queue_draw();
  });
  motionCtrl.connect('leave', () => {
    hovered = false;
    drawingArea.queue_draw();
  });
  drawingArea.add_controller(motionCtrl);

  // Click to initiate connection
  const gesture = new Gtk.GestureClick();
  gesture.connect('released', () => {
    onConnectStart?.(portId);
  });
  drawingArea.add_controller(gesture);

  drawingArea.set_tooltip_text(`${direction} port${label ? `: ${label}` : ''}`);

  return drawingArea;
}
