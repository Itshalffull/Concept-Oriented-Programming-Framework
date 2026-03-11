// ============================================================
// Clef Surface GTK Widget — WorkflowNode
//
// Individual node within a workflow graph. Displays node type,
// label, input/output ports, and selection state.
//
// Adapts the workflow-node.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface WorkflowNodeProps {
  id?: string;
  type?: string;
  label?: string;
  inputs?: string[];
  outputs?: string[];
  selected?: boolean;
  onSelect?: (id: string) => void;
}

// --------------- Component ---------------

export function createWorkflowNode(props: WorkflowNodeProps = {}): Gtk.Widget {
  const { id = '', type = '', label = '', inputs = [], outputs = [], selected = false, onSelect } = props;

  const card = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4, widthRequest: 150 });
  card.get_style_context().add_class('card');
  if (selected) card.get_style_context().add_class('accent');

  // Type header
  const typeLabel = new Gtk.Label({ label: `[${type}]`, xalign: 0 });
  typeLabel.get_style_context().add_class('dim-label');
  card.append(typeLabel);

  // Label
  card.append(new Gtk.Label({ label, xalign: 0 }));

  // Ports
  if (inputs.length > 0) {
    const inputLabel = new Gtk.Label({ label: `In: ${inputs.join(', ')}`, xalign: 0 });
    inputLabel.get_style_context().add_class('dim-label');
    card.append(inputLabel);
  }
  if (outputs.length > 0) {
    const outputLabel = new Gtk.Label({ label: `Out: ${outputs.join(', ')}`, xalign: 0 });
    outputLabel.get_style_context().add_class('dim-label');
    card.append(outputLabel);
  }

  const gesture = new Gtk.GestureClick();
  gesture.connect('released', () => onSelect?.(id));
  card.add_controller(gesture);

  return card;
}
