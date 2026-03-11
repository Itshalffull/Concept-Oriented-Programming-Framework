// ============================================================
// Clef Surface GTK Widget — StateMachineDiagram
//
// Visual state machine diagram showing states as nodes and
// transitions as labeled arrows.
//
// Adapts the state-machine-diagram.widget spec to GTK4
// rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface MachineState { id: string; label: string; initial?: boolean; final?: boolean; }
export interface MachineTransition { from: string; to: string; label: string; }

// --------------- Props ---------------

export interface StateMachineDiagramProps {
  states?: MachineState[];
  transitions?: MachineTransition[];
  currentState?: string | null;
  onStateClick?: (id: string) => void;
}

// --------------- Component ---------------

export function createStateMachineDiagram(props: StateMachineDiagramProps = {}): Gtk.Widget {
  const { states = [], transitions = [], currentState = null, onStateClick } = props;

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
  const header = new Gtk.Label({ label: `States: ${states.length} | Transitions: ${transitions.length}`, xalign: 0 });
  header.get_style_context().add_class('heading');
  box.append(header);

  states.forEach((state) => {
    const card = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 });
    card.get_style_context().add_class('card');
    if (state.id === currentState) card.get_style_context().add_class('accent');

    const stateLabel = new Gtk.Label({ label: state.label, xalign: 0 });
    if (state.initial) stateLabel.set_label(`\u25B6 ${state.label}`);
    if (state.final) stateLabel.set_label(`${state.label} \u25A0`);
    card.append(stateLabel);

    // Show outgoing transitions
    const outgoing = transitions.filter((t) => t.from === state.id);
    outgoing.forEach((t) => {
      const target = states.find((s) => s.id === t.to);
      const transLabel = new Gtk.Label({ label: `  \u2192 ${target?.label ?? t.to} [${t.label}]`, xalign: 0 });
      transLabel.get_style_context().add_class('dim-label');
      card.append(transLabel);
    });

    const gesture = new Gtk.GestureClick();
    gesture.connect('released', () => onStateClick?.(state.id));
    card.add_controller(gesture);

    box.append(card);
  });

  return box;
}
