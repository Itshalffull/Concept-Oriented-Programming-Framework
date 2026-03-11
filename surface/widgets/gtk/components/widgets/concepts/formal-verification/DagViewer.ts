/* ---------------------------------------------------------------------------
 * DagViewer -- GTK4/GJS widget
 * Implements the dag-viewer concept widget for GTK4.
 * Generated from React reference implementation.
 * ------------------------------------------------------------------------- */

import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/* ---------------------------------------------------------------------------
 * State Machine
 * ------------------------------------------------------------------------- */

export type DagViewerState = 'idle' | 'nodeSelected' | 'computing';
export type DagViewerEvent =
  | { type: 'SELECT_NODE'; id?: string }
  | { type: 'ZOOM' }
  | { type: 'PAN' }
  | { type: 'LAYOUT' }
  | { type: 'DESELECT' }
  | { type: 'LAYOUT_COMPLETE' };

export function dagViewerReducer(state: DagViewerState, event: DagViewerEvent): DagViewerState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_NODE') return 'nodeSelected';
      if (event.type === 'ZOOM') return 'idle';
      if (event.type === 'PAN') return 'idle';
      if (event.type === 'LAYOUT') return 'computing';
      return state;
    case 'nodeSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_NODE') return 'nodeSelected';
      return state;
    case 'computing':
      if (event.type === 'LAYOUT_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface DagViewerProps {
  [key: string]: unknown;
}

/* ---------------------------------------------------------------------------
 * Factory
 * ------------------------------------------------------------------------- */

export function createDagViewer(props: DagViewerProps): {
  widget: Gtk.Widget;
  update: (nextProps: Partial<DagViewerProps>) => void;
  dispose: () => void;
} {
  let state: DagViewerState = 'idle';
  let currentProps = { ...props };
  const handlerIds: number[] = [];
  const timeoutIds: number[] = [];

  function send(event: DagViewerEvent): void {
    state = dagViewerReducer(state, event);
    render();
  }

  /* --- Root container --- */
  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });
  root.add_css_class('dag-viewer');
  root.set_accessible_role(Gtk.AccessibleRole.GROUP);

  /* --- Header --- */
  const headerBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
  });
  const headerLabel = new Gtk.Label({ label: 'DagViewer' });
  headerLabel.add_css_class('dag-viewer-header');
  headerBox.append(headerLabel);

  const stateLabel = new Gtk.Label({ label: '' });
  stateLabel.add_css_class('dag-viewer-state');
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
  detailBox.add_css_class('dag-viewer-detail');
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
    if (keyval === 0xff50) { /* Home */
      return true;
    }
    if (keyval === 0xff57) { /* End */
      return true;
    }

    return false;
  });
  root.add_controller(keyCtrl);

  /* --- Render function --- */
  function render(): void {
    stateLabel.set_label(`[${state}]`);
    root.set_tooltip_text(`DagViewer: ${state}`);

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
    update(nextProps: Partial<DagViewerProps>): void {
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

export default createDagViewer;
