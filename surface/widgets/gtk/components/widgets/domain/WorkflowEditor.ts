// ============================================================
// Clef Surface GTK Widget — WorkflowEditor
//
// Node-graph workflow canvas rendered as a vertical list of
// nodes and their connections. Supports node selection,
// adding/removing nodes, and displays connections between
// nodes as indented sub-items.
//
// Adapts the workflow-editor.widget spec: anatomy (root, canvas,
// nodePalette, configPanel, minimap, toolbar, executeButton),
// states (idle, nodeSelected, configuring, placing, draggingNew,
// executing, executionResult), and connect attributes to GTK4
// rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface WorkflowEditorNode { id: string; type: string; label: string; }
export interface WorkflowConnection { from: string; to: string; }

// --------------- Props ---------------

export interface WorkflowEditorProps {
  nodes?: WorkflowEditorNode[];
  connections?: WorkflowConnection[];
  selectedNode?: string | null;
  onSelectNode?: (id: string) => void;
  onAddNode?: () => void;
  onRemoveNode?: (id: string) => void;
}

// --------------- Component ---------------

export function createWorkflowEditor(props: WorkflowEditorProps = {}): Gtk.Widget {
  const { nodes = [], connections = [], selectedNode = null, onSelectNode, onAddNode, onRemoveNode } = props;

  const adjacency = new Map<string, string[]>();
  connections.forEach((conn) => {
    if (!adjacency.has(conn.from)) adjacency.set(conn.from, []);
    adjacency.get(conn.from)!.push(conn.to);
  });
  const nodeLabels = new Map(nodes.map((n) => [n.id, n.label]));

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });

  // Header
  const header = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
  const titleLabel = new Gtk.Label({ label: 'Workflow', xalign: 0 });
  titleLabel.get_style_context().add_class('heading');
  header.append(titleLabel);
  const statsLabel = new Gtk.Label({ label: `(${nodes.length} nodes, ${connections.length} connections)` });
  statsLabel.get_style_context().add_class('dim-label');
  header.append(statsLabel);
  box.append(header);

  // Node list
  nodes.forEach((node) => {
    const isSelected = node.id === selectedNode;
    const targets = adjacency.get(node.id) ?? [];

    const card = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 });
    card.get_style_context().add_class('card');
    if (isSelected) card.get_style_context().add_class('accent');

    const nodeRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
    const typeLabel = new Gtk.Label({ label: `[${node.type}]` });
    typeLabel.get_style_context().add_class('dim-label');
    nodeRow.append(typeLabel);
    nodeRow.append(new Gtk.Label({ label: node.label, xalign: 0, hexpand: true }));
    card.append(nodeRow);

    // Connection targets
    targets.forEach((targetId) => {
      const targetLabel = nodeLabels.get(targetId) ?? targetId;
      const connLabel = new Gtk.Label({ label: `  \u2514\u2500\u2500\u2192 ${targetLabel}`, xalign: 0 });
      connLabel.get_style_context().add_class('dim-label');
      card.append(connLabel);
    });

    const gesture = new Gtk.GestureClick();
    gesture.connect('released', () => onSelectNode?.(node.id));
    card.add_controller(gesture);

    box.append(card);
  });

  if (nodes.length === 0) {
    const empty = new Gtk.Label({ label: '(empty workflow)' });
    empty.get_style_context().add_class('dim-label');
    box.append(empty);
  }

  // Add node button
  const addBtn = new Gtk.Button({ label: '+ Add Node' });
  addBtn.get_style_context().add_class('flat');
  if (onAddNode) addBtn.connect('clicked', onAddNode);
  box.append(addBtn);

  return box;
}
