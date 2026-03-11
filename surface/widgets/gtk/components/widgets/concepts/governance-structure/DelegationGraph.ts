/* ---------------------------------------------------------------------------
 * DelegationGraph -- GTK4/GJS widget
 * Implements the delegation-graph concept widget for GTK4.
 * Generated from React reference implementation.
 * ------------------------------------------------------------------------- */

import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/* ---------------------------------------------------------------------------
 * State Machine
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * DelegationGraph state machine
 * States: browsing (initial), searching, selected, delegating, undelegating
 * See widget spec: delegation-graph.widget
 * ------------------------------------------------------------------------- */

export type DelegationGraphState = 'browsing' | 'searching' | 'selected' | 'delegating' | 'undelegating';
export type DelegationGraphEvent =
  | { type: 'SEARCH'; query: string }
  | { type: 'SELECT_DELEGATE'; id: string }
  | { type: 'SWITCH_VIEW' }
  | { type: 'CLEAR_SEARCH' }
  | { type: 'DESELECT' }
  | { type: 'DELEGATE' }
  | { type: 'UNDELEGATE' }
  | { type: 'DELEGATE_COMPLETE' }
  | { type: 'DELEGATE_ERROR' }
  | { type: 'UNDELEGATE_COMPLETE' }
  | { type: 'UNDELEGATE_ERROR' };

export function delegationGraphReducer(state: DelegationGraphState, event: DelegationGraphEvent): DelegationGraphState {
  switch (state) {
    case 'browsing':
      if (event.type === 'SEARCH') return 'searching';
      if (event.type === 'SELECT_DELEGATE') return 'selected';
      if (event.type === 'SWITCH_VIEW') return 'browsing';
      return state;
    case 'searching':
      if (event.type === 'CLEAR_SEARCH') return 'browsing';
      if (event.type === 'SELECT_DELEGATE') return 'selected';
      return state;
    case 'selected':
      if (event.type === 'DESELECT') return 'browsing';
      if (event.type === 'DELEGATE') return 'delegating';
      if (event.type === 'UNDELEGATE') return 'undelegating';
      return state;
    case 'delegating':
      if (event.type === 'DELEGATE_COMPLETE') return 'browsing';
      if (event.type === 'DELEGATE_ERROR') return 'selected';
      return state;
    case 'undelegating':
      if (event.type === 'UNDELEGATE_COMPLETE') return 'browsing';
      if (event.type === 'UNDELEGATE_ERROR') return 'selected';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface DelegationGraphProps {
  [key: string]: unknown;
}

/* ---------------------------------------------------------------------------
 * Factory
 * ------------------------------------------------------------------------- */

export function createDelegationGraph(props: DelegationGraphProps): {
  widget: Gtk.Widget;
  update: (nextProps: Partial<DelegationGraphProps>) => void;
  dispose: () => void;
} {
  let state: DelegationGraphState = 'browsing';
  let currentProps = { ...props };
  const handlerIds: number[] = [];
  const timeoutIds: number[] = [];

  function send(event: DelegationGraphEvent): void {
    state = delegationGraphReducer(state, event);
    render();
  }

  /* --- Root container --- */
  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });
  root.add_css_class('delegation-graph');
  root.set_accessible_role(Gtk.AccessibleRole.GROUP);

  /* --- Header --- */
  const headerBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
  });
  const headerLabel = new Gtk.Label({ label: 'DelegationGraph' });
  headerLabel.add_css_class('delegation-graph-header');
  headerBox.append(headerLabel);

  const stateLabel = new Gtk.Label({ label: '' });
  stateLabel.add_css_class('delegation-graph-state');
  headerBox.append(stateLabel);
  root.append(headerBox);

  /* --- Content area --- */
  const contentScroll = new Gtk.ScrolledWindow({
    hscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
    vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
    vexpand: true,
    hexpand: true,
  });
  const contentBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 2,
  });
  contentScroll.set_child(contentBox);
  root.append(contentScroll);

  /* --- Detail panel --- */
  const detailBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });
  detailBox.add_css_class('delegation-graph-detail');
  root.append(detailBox);

  /* --- Keyboard controller --- */
  const keyCtrl = new Gtk.EventControllerKey();
  const keyHandlerId = keyCtrl.connect('key-pressed', (
    _ctrl: Gtk.EventControllerKey,
    keyval: number,
    _keycode: number,
    _modifiers: number
  ): boolean => {
    const { Gdk } = imports.gi || {};
    if (keyval === 0xff54) { /* Down */
      return true;
    }
    if (keyval === 0xff52) { /* Up */
      return true;
    }
    if (keyval === 0xff0d) { /* Enter */
      return true;
    }
    if (keyval === 0xff1b) { /* Escape */
      return true;
    }

    return false;
  });
  root.add_controller(keyCtrl);

  /* --- Render function --- */
  function render(): void {
    stateLabel.set_label(`[${state}]`);
    root.set_tooltip_text(`DelegationGraph: ${state}`);

    // Update CSS state classes
    for (const cls of ['idle', 'selected', 'active', 'hovered', 'playing', 'paused', 'running', 'error']) {
      root.remove_css_class(`state-${cls}`);
    }
    root.add_css_class(`state-${state}`);

    // Clear content
    let child = contentBox.get_first_child();
    while (child) {
      const next = child.get_next_sibling();
      contentBox.remove(child);
      child = next;
    }

    // Clear detail
    let detailChild = detailBox.get_first_child();
    while (detailChild) {
      const next = detailChild.get_next_sibling();
      detailBox.remove(detailChild);
      detailChild = next;
    }

    // Render content based on props
    const p = currentProps as Record<string, any>;

    // Graph nodes
    const nodes = (p.nodes || []) as Array<{ id: string; label: string; status?: string }>;
    const edges = (p.edges || []) as Array<{ from: string; to: string; label?: string }>;
    for (const node of nodes) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      const nodeLabel = new Gtk.Label({ label: node.label });
      nodeLabel.set_hexpand(true);
      nodeLabel.set_xalign(0);
      row.append(nodeLabel);
      if (node.status) {
        const statusLabel = new Gtk.Label({ label: node.status });
        statusLabel.add_css_class(`status-${node.status}`);
        row.append(statusLabel);
      }
      const clickCtrl = new Gtk.GestureClick();
      clickCtrl.connect('released', () => {
        send({ type: 'SELECT_NODE' || 'SELECT' } as any);
      });
      row.add_controller(clickCtrl);
      contentBox.append(row);
    }
    // Edges
    for (const edge of edges) {
      const edgeLabel = new Gtk.Label({ label: `${edge.from} \u2192 ${edge.to}${edge.label ? ' (' + edge.label + ')' : ''}` });
      edgeLabel.add_css_class('edge');
      edgeLabel.set_xalign(0);
      contentBox.append(edgeLabel);
    }
  }

  /* --- Initial render --- */
  render();

  /* --- Public API --- */
  return {
    widget: root,
    update(nextProps: Partial<DelegationGraphProps>): void {
      Object.assign(currentProps, nextProps);
      render();
    },
    dispose(): void {
      for (const id of timeoutIds) {
        GLib.source_remove(id);
      }
      timeoutIds.length = 0;
    },
  };
}

export default createDelegationGraph;
