/* ---------------------------------------------------------------------------
 * TraceTree -- GTK4/GJS widget
 * Implements the trace-tree concept widget for GTK4.
 * Generated from React reference implementation.
 * ------------------------------------------------------------------------- */

import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/* ---------------------------------------------------------------------------
 * State Machine
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * TraceTree state machine
 * States: idle (initial), spanSelected (with detail panel)
 * See widget spec: repertoire/concepts/llm-agent/widgets/trace-tree.widget
 * ------------------------------------------------------------------------- */

export type TraceTreeState = 'idle' | 'spanSelected';
export type TraceTreeEvent =
  | { type: 'SELECT_SPAN'; id: string }
  | { type: 'DESELECT' }
  | { type: 'EXPAND'; id: string }
  | { type: 'COLLAPSE'; id: string }
  | { type: 'FILTER'; spanType: string };

export function traceTreeReducer(state: TraceTreeState, event: TraceTreeEvent): TraceTreeState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_SPAN') return 'spanSelected';
      return state;
    case 'spanSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_SPAN') return 'spanSelected';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface TraceTreeProps {
  [key: string]: unknown;
}

/* ---------------------------------------------------------------------------
 * Factory
 * ------------------------------------------------------------------------- */

export function createTraceTree(props: TraceTreeProps): {
  widget: Gtk.Widget;
  update: (nextProps: Partial<TraceTreeProps>) => void;
  dispose: () => void;
} {
  let state: TraceTreeState = 'idle';
  let currentProps = { ...props };
  const handlerIds: number[] = [];
  const timeoutIds: number[] = [];

  function send(event: TraceTreeEvent): void {
    state = traceTreeReducer(state, event);
    render();
  }

  /* --- Root container --- */
  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });
  root.add_css_class('trace-tree');
  root.set_accessible_role(Gtk.AccessibleRole.GROUP);

  /* --- Header --- */
  const headerBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
  });
  const headerLabel = new Gtk.Label({ label: 'TraceTree' });
  headerLabel.add_css_class('trace-tree-header');
  headerBox.append(headerLabel);

  const stateLabel = new Gtk.Label({ label: '' });
  stateLabel.add_css_class('trace-tree-state');
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
  detailBox.add_css_class('trace-tree-detail');
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
    if (keyval === 0xff53) { /* Right */
      return true;
    }
    if (keyval === 0xff51) { /* Left */
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
    root.set_tooltip_text(`TraceTree: ${state}`);

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

    // Trace tree
    const spans = (p.spans || p.nodes || []) as Array<{ id: string; name?: string; label?: string; children?: any[]; duration?: number; status?: string }>;
    function renderSpans(spanList: any[], depth: number) {
      for (const span of spanList) {
        const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
        row.set_margin_start(depth * 16);
        const spanLabel = new Gtk.Label({ label: span.name || span.label || span.id });
        spanLabel.set_hexpand(true);
        spanLabel.set_xalign(0);
        row.append(spanLabel);
        if (span.duration != null) {
          const durLabel = new Gtk.Label({ label: `${span.duration}ms` });
          durLabel.add_css_class('duration');
          row.append(durLabel);
        }
        if (span.status) {
          const statusLabel6 = new Gtk.Label({ label: span.status });
          row.append(statusLabel6);
        }
        contentBox.append(row);
        if (span.children) renderSpans(span.children, depth + 1);
      }
    }
    renderSpans(spans, 0);
  }

  /* --- Initial render --- */
  render();

  /* --- Public API --- */
  return {
    widget: root,
    update(nextProps: Partial<TraceTreeProps>): void {
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

export default createTraceTree;
