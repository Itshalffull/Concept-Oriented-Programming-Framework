/* ---------------------------------------------------------------------------
 * TimelockCountdown -- GTK4/GJS widget
 * Implements the timelock-countdown concept widget for GTK4.
 * Generated from React reference implementation.
 * ------------------------------------------------------------------------- */

import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/* ---------------------------------------------------------------------------
 * State Machine
 * ------------------------------------------------------------------------- */

export type TimelockCountdownState = 'running' | 'warning' | 'critical' | 'expired' | 'executing' | 'completed' | 'paused';
export type TimelockCountdownEvent =
  | { type: 'TICK' }
  | { type: 'WARNING_THRESHOLD' }
  | { type: 'EXPIRE' }
  | { type: 'PAUSE' }
  | { type: 'CRITICAL_THRESHOLD' }
  | { type: 'EXECUTE' }
  | { type: 'RESET' }
  | { type: 'EXECUTE_COMPLETE' }
  | { type: 'EXECUTE_ERROR' }
  | { type: 'RESUME' }
  | { type: 'CHALLENGE' };

export function timelockCountdownReducer(state: TimelockCountdownState, event: TimelockCountdownEvent): TimelockCountdownState {
  switch (state) {
    case 'running':
      if (event.type === 'TICK') return 'running';
      if (event.type === 'WARNING_THRESHOLD') return 'warning';
      if (event.type === 'EXPIRE') return 'expired';
      if (event.type === 'PAUSE') return 'paused';
      return state;
    case 'warning':
      if (event.type === 'TICK') return 'warning';
      if (event.type === 'CRITICAL_THRESHOLD') return 'critical';
      if (event.type === 'EXPIRE') return 'expired';
      return state;
    case 'critical':
      if (event.type === 'TICK') return 'critical';
      if (event.type === 'EXPIRE') return 'expired';
      return state;
    case 'expired':
      if (event.type === 'EXECUTE') return 'executing';
      if (event.type === 'RESET') return 'running';
      return state;
    case 'executing':
      if (event.type === 'EXECUTE_COMPLETE') return 'completed';
      if (event.type === 'EXECUTE_ERROR') return 'expired';
      return state;
    case 'completed':
      return state;
    case 'paused':
      if (event.type === 'RESUME') return 'running';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface TimelockCountdownProps {
  [key: string]: unknown;
}

/* ---------------------------------------------------------------------------
 * Factory
 * ------------------------------------------------------------------------- */

export function createTimelockCountdown(props: TimelockCountdownProps): {
  widget: Gtk.Widget;
  update: (nextProps: Partial<TimelockCountdownProps>) => void;
  dispose: () => void;
} {
  let state: TimelockCountdownState = 'running';
  let currentProps = { ...props };
  const handlerIds: number[] = [];
  const timeoutIds: number[] = [];

  function send(event: TimelockCountdownEvent): void {
    state = timelockCountdownReducer(state, event);
    render();
  }

  /* --- Root container --- */
  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });
  root.add_css_class('timelock-countdown');
  root.set_accessible_role(Gtk.AccessibleRole.GROUP);

  /* --- Header --- */
  const headerBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
  });
  const headerLabel = new Gtk.Label({ label: 'TimelockCountdown' });
  headerLabel.add_css_class('timelock-countdown-header');
  headerBox.append(headerLabel);

  const stateLabel = new Gtk.Label({ label: '' });
  stateLabel.add_css_class('timelock-countdown-state');
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
  detailBox.add_css_class('timelock-countdown-detail');
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
    if (keyval === 0xff0d) { /* Enter */
      return true;
    }
    if (keyval === 0x20) { /* Space */
      return true;
    }

    return false;
  });
  root.add_controller(keyCtrl);

  /* --- Render function --- */
  function render(): void {
    stateLabel.set_label(`[${state}]`);
    root.set_tooltip_text(`TimelockCountdown: ${state}`);

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

    // Timelock countdown
    const phase = (p.phase || '') as string;
    const deadline = (p.deadline || '') as string;
    const elapsed = (p.elapsed || 0) as number;
    const total = (p.total || 1) as number;
    const phaseLabel = new Gtk.Label({ label: phase });
    phaseLabel.add_css_class('phase-label');
    contentBox.append(phaseLabel);

    const progress = Math.min(1, Math.max(0, elapsed / total));
    const progressBar = new Gtk.ProgressBar();
    progressBar.set_fraction(progress);
    contentBox.append(progressBar);

    const countdownLabel = new Gtk.Label({ label: deadline });
    contentBox.append(countdownLabel);

    const executeBtn = new Gtk.Button({ label: 'Execute' });
    executeBtn.set_sensitive(state === 'expired');
    executeBtn.connect('clicked', () => {
      send({ type: 'EXECUTE' } as any);
      if (p.onExecute) (p.onExecute as Function)();
    });
    contentBox.append(executeBtn);
  }

  /* --- Initial render --- */
  render();

  /* --- Public API --- */
  return {
    widget: root,
    update(nextProps: Partial<TimelockCountdownProps>): void {
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

export default createTimelockCountdown;
