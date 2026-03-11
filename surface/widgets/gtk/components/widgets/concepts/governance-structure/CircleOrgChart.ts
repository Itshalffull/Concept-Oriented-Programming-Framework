/* ---------------------------------------------------------------------------
 * CircleOrgChart -- GTK4/GJS widget
 * Implements the circle-org-chart concept widget for GTK4.
 * Generated from React reference implementation.
 * ------------------------------------------------------------------------- */

import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/* ---------------------------------------------------------------------------
 * State Machine
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * CircleOrgChart state machine
 * States: idle (initial), circleSelected (with detail panel)
 * See widget spec: repertoire/concepts/governance-structure/widgets/circle-org-chart.widget
 * ------------------------------------------------------------------------- */

export type CircleOrgChartState = 'idle' | 'circleSelected';
export type CircleOrgChartEvent =
  | { type: 'SELECT_CIRCLE'; id: string }
  | { type: 'DESELECT' }
  | { type: 'EXPAND'; id: string }
  | { type: 'COLLAPSE'; id: string };

export function circleOrgChartReducer(state: CircleOrgChartState, event: CircleOrgChartEvent): CircleOrgChartState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_CIRCLE') return 'circleSelected';
      return state;
    case 'circleSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_CIRCLE') return 'circleSelected';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface CircleOrgChartProps {
  [key: string]: unknown;
}

/* ---------------------------------------------------------------------------
 * Factory
 * ------------------------------------------------------------------------- */

export function createCircleOrgChart(props: CircleOrgChartProps): {
  widget: Gtk.Widget;
  update: (nextProps: Partial<CircleOrgChartProps>) => void;
  dispose: () => void;
} {
  let state: CircleOrgChartState = 'idle';
  let currentProps = { ...props };
  const handlerIds: number[] = [];
  const timeoutIds: number[] = [];

  function send(event: CircleOrgChartEvent): void {
    state = circleOrgChartReducer(state, event);
    render();
  }

  /* --- Root container --- */
  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });
  root.add_css_class('circle-org-chart');
  root.set_accessible_role(Gtk.AccessibleRole.GROUP);

  /* --- Header --- */
  const headerBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
  });
  const headerLabel = new Gtk.Label({ label: 'CircleOrgChart' });
  headerLabel.add_css_class('circle-org-chart-header');
  headerBox.append(headerLabel);

  const stateLabel = new Gtk.Label({ label: '' });
  stateLabel.add_css_class('circle-org-chart-state');
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
  detailBox.add_css_class('circle-org-chart-detail');
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
    root.set_tooltip_text(`CircleOrgChart: ${state}`);

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

    // Circle hierarchy
    const circles = (p.circles || []) as Array<{ id: string; name: string; purpose: string; members: any[] }>;
    for (const circle of circles) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      const nameLabel = new Gtk.Label({ label: circle.name });
      nameLabel.set_hexpand(true);
      nameLabel.set_xalign(0);
      row.append(nameLabel);
      const memberCount = new Gtk.Label({ label: `${(circle.members || []).length} members` });
      row.append(memberCount);
      const clickCtrl = new Gtk.GestureClick();
      clickCtrl.connect('released', () => {
        send({ type: 'SELECT_CIRCLE', id: circle.id } as any);
      });
      row.add_controller(clickCtrl);
      contentBox.append(row);
    }
  }

  /* --- Initial render --- */
  render();

  /* --- Public API --- */
  return {
    widget: root,
    update(nextProps: Partial<CircleOrgChartProps>): void {
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

export default createCircleOrgChart;
