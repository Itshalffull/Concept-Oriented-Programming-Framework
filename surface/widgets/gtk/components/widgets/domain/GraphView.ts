// ============================================================
// Clef Surface GTK Widget — GraphView
//
// Node-edge graph visualization using Gtk.DrawingArea for
// rendering nodes as circles and edges as lines.
//
// Adapts the graph-view.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface GraphNode { id: string; label: string; x: number; y: number; }
export interface GraphEdge { from: string; to: string; label?: string; }

// --------------- Props ---------------

export interface GraphViewProps {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  width?: number;
  height?: number;
  onNodeClick?: (id: string) => void;
}

// --------------- Component ---------------

export function createGraphView(props: GraphViewProps = {}): Gtk.Widget {
  const { nodes = [], edges = [], width = 500, height = 400, onNodeClick } = props;

  const drawingArea = new Gtk.DrawingArea({ widthRequest: width, heightRequest: height });
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  drawingArea.set_draw_func((_area: Gtk.DrawingArea, cr: any) => {
    // Edges
    cr.setSourceRGBA(0.5, 0.5, 0.5, 1);
    cr.setLineWidth(1.5);
    edges.forEach((edge) => {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);
      if (from && to) {
        cr.moveTo(from.x, from.y);
        cr.lineTo(to.x, to.y);
        cr.stroke();
      }
    });

    // Nodes
    nodes.forEach((node) => {
      cr.setSourceRGBA(0.2, 0.5, 0.9, 1);
      cr.arc(node.x, node.y, 16, 0, Math.PI * 2);
      cr.fill();

      cr.setSourceRGBA(1, 1, 1, 1);
      cr.setFontSize(10);
      const ext = cr.textExtents(node.label);
      cr.moveTo(node.x - ext.width / 2, node.y + ext.height / 2);
      cr.showText(node.label);
    });
  });

  if (onNodeClick) {
    const gesture = new Gtk.GestureClick();
    gesture.connect('released', (_g: Gtk.GestureClick, _n: number, x: number, y: number) => {
      const clicked = nodes.find((n) => Math.hypot(n.x - x, n.y - y) < 16);
      if (clicked) onNodeClick(clicked.id);
    });
    drawingArea.add_controller(gesture);
  }

  return drawingArea;
}
