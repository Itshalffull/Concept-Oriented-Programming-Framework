/* ---------------------------------------------------------------------------
 * SlaTimer -- GTK4/GJS widget
 * Implements the sla-timer concept widget for GTK4.
 * Generated from React reference implementation.
 * ------------------------------------------------------------------------- */

import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/* ---------------------------------------------------------------------------
 * State Machine
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * SlaTimer — Five-state countdown timer for SLA tracking
 *
 * Displays remaining time with color-coded urgency phases: on-track (green),
 * warning (yellow), critical (orange), breached (red), and paused (gray).
 * Shows a progress bar, phase label, and elapsed time.
 * ------------------------------------------------------------------------- */

export type SlaTimerState = 'onTrack' | 'warning' | 'critical' | 'breached' | 'paused';
export type SlaTimerEvent =
  | { type: 'TICK' }
  | { type: 'WARNING_THRESHOLD' }
  | { type: 'PAUSE' }
  | { type: 'CRITICAL_THRESHOLD' }
  | { type: 'BREACH' }
  | { type: 'RESUME' };

export function slaTimerReducer(state: SlaTimerState, event: SlaTimerEvent): SlaTimerState {
  switch (state) {
    case 'onTrack':
      if (event.type === 'TICK') return 'onTrack';
      if (event.type === 'WARNING_THRESHOLD') return 'warning';
      if (event.type === 'PAUSE') return 'paused';
      return state;
    case 'warning':
      if (event.type === 'TICK') return 'warning';
      if (event.type === 'CRITICAL_THRESHOLD') return 'critical';
      if (event.type === 'PAUSE') return 'paused';
      return state;
    case 'critical':
      if (event.type === 'TICK') return 'critical';
      if (event.type === 'BREACH') return 'breached';
      if (event.type === 'PAUSE') return 'paused';
      return state;
    case 'breached':
      if (event.type === 'TICK') return 'breached';
      return state;
    case 'paused':
      if (event.type === 'RESUME') return 'onTrack';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface SlaTimerProps {
  [key: string]: unknown;
}

/* ---------------------------------------------------------------------------
 * Factory
 * ------------------------------------------------------------------------- */

export function createSlaTimer(props: SlaTimerProps): {
  widget: Gtk.Widget;
  update: (nextProps: Partial<SlaTimerProps>) => void;
  dispose: () => void;
} {
  let state: SlaTimerState = 'onTrack';
  let currentProps = { ...props };
  const handlerIds: number[] = [];
  const timeoutIds: number[] = [];

  function send(event: SlaTimerEvent): void {
    state = slaTimerReducer(state, event);
    render();
  }

  /* --- Root container --- */
  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });
  root.add_css_class('sla-timer');
  root.set_accessible_role(Gtk.AccessibleRole.GROUP);

  /* --- Header --- */
  const headerBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
  });
  const headerLabel = new Gtk.Label({ label: 'SlaTimer' });
  headerLabel.add_css_class('sla-timer-header');
  headerBox.append(headerLabel);

  const stateLabel = new Gtk.Label({ label: '' });
  stateLabel.add_css_class('sla-timer-state');
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
  detailBox.add_css_class('sla-timer-detail');
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

    return false;
  });
  root.add_controller(keyCtrl);

  /* --- Render function --- */
  function render(): void {
    stateLabel.set_label(`[${state}]`);
    root.set_tooltip_text(`SlaTimer: ${state}`);

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

    // SLA Timer
    const slaDeadline = (p.deadline || p.target || '') as string;
    const slaStatus = (p.status || 'running') as string;
    const slaLabel = new Gtk.Label({ label: `SLA: ${slaStatus}` });
    slaLabel.add_css_class(`sla-${slaStatus}`);
    contentBox.append(slaLabel);
    const deadlineLabel = new Gtk.Label({ label: `Deadline: ${slaDeadline}` });
    contentBox.append(deadlineLabel);
    const progressBar2 = new Gtk.ProgressBar();
    progressBar2.set_fraction((p.progress || 0) as number);
    contentBox.append(progressBar2);
  }

  /* --- Initial render --- */
  render();

  /* --- Public API --- */
  return {
    widget: root,
    update(nextProps: Partial<SlaTimerProps>): void {
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

export default createSlaTimer;
