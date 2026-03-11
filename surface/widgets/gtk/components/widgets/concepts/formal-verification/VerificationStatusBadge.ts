/* ---------------------------------------------------------------------------
 * VerificationStatusBadge -- GTK4/GJS widget
 * Implements the verification-status-badge concept widget for GTK4.
 * Generated from React reference implementation.
 * ------------------------------------------------------------------------- */

import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/* ---------------------------------------------------------------------------
 * State Machine
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * VerificationStatusBadge state machine
 * States: idle (initial), hovered, animating
 * ------------------------------------------------------------------------- */

export type VerificationStatusBadgeState = 'idle' | 'hovered' | 'animating';
export type VerificationStatusBadgeEvent =
  | { type: 'HOVER' }
  | { type: 'STATUS_CHANGE' }
  | { type: 'LEAVE' }
  | { type: 'ANIMATION_END' };

export function verificationStatusBadgeReducer(
  state: VerificationStatusBadgeState,
  event: VerificationStatusBadgeEvent,
): VerificationStatusBadgeState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'STATUS_CHANGE') return 'animating';
      return state;
    case 'hovered':
      if (event.type === 'LEAVE') return 'idle';
      return state;
    case 'animating':
      if (event.type === 'ANIMATION_END') return 'idle';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface VerificationStatusBadgeProps {
  [key: string]: unknown;
}

/* ---------------------------------------------------------------------------
 * Factory
 * ------------------------------------------------------------------------- */

export function createVerificationStatusBadge(props: VerificationStatusBadgeProps): {
  widget: Gtk.Widget;
  update: (nextProps: Partial<VerificationStatusBadgeProps>) => void;
  dispose: () => void;
} {
  let state: VerificationStatusBadgeState = 'idle';
  let currentProps = { ...props };
  const handlerIds: number[] = [];
  const timeoutIds: number[] = [];

  function send(event: VerificationStatusBadgeEvent): void {
    state = verificationStatusBadgeReducer(state, event);
    render();
  }

  /* --- Root container --- */
  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });
  root.add_css_class('verification-status-badge');
  root.set_accessible_role(Gtk.AccessibleRole.GROUP);

  /* --- Header --- */
  const headerBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
  });
  const headerLabel = new Gtk.Label({ label: 'VerificationStatusBadge' });
  headerLabel.add_css_class('verification-status-badge-header');
  headerBox.append(headerLabel);

  const stateLabel = new Gtk.Label({ label: '' });
  stateLabel.add_css_class('verification-status-badge-state');
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
  detailBox.add_css_class('verification-status-badge-detail');
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
    root.set_tooltip_text(`VerificationStatusBadge: ${state}`);

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

    // Verification status badge
    const status = (p.status || 'unknown') as string;
    const badgeLabel = (p.label || status) as string;
    const duration = p.duration as number | undefined;
    const solver = p.solver as string | undefined;
    const badge = new Gtk.Label({ label: `${status === 'proved' ? '\u2713' : status === 'refuted' ? '\u2717' : status === 'running' ? '\u23F3' : '?'} ${badgeLabel}` });
    badge.add_css_class(`verification-${status}`);
    badge.set_tooltip_text([solver, duration != null ? `${duration}ms` : null].filter(Boolean).join(' \u2014 '));
    contentBox.append(badge);
  }

  /* --- Initial render --- */
  render();

  /* --- Public API --- */
  return {
    widget: root,
    update(nextProps: Partial<VerificationStatusBadgeProps>): void {
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

export default createVerificationStatusBadge;
