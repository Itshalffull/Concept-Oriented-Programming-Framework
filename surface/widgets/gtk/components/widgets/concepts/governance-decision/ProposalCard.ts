/* ---------------------------------------------------------------------------
 * ProposalCard -- GTK4/GJS widget
 * Implements the proposal-card concept widget for GTK4.
 * Generated from React reference implementation.
 * ------------------------------------------------------------------------- */

import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/* ---------------------------------------------------------------------------
 * State Machine
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * ProposalCard state machine
 * States: idle (initial), hovered, focused, navigating
 * ------------------------------------------------------------------------- */

export type ProposalCardState = 'idle' | 'hovered' | 'focused' | 'navigating';
export type ProposalCardEvent =
  | { type: 'HOVER' }
  | { type: 'UNHOVER' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'CLICK' }
  | { type: 'ENTER' }
  | { type: 'NAVIGATE_COMPLETE' };

export function proposalCardReducer(state: ProposalCardState, event: ProposalCardEvent): ProposalCardState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'FOCUS') return 'focused';
      if (event.type === 'CLICK') return 'navigating';
      return state;
    case 'hovered':
      if (event.type === 'UNHOVER') return 'idle';
      return state;
    case 'focused':
      if (event.type === 'BLUR') return 'idle';
      if (event.type === 'CLICK') return 'navigating';
      if (event.type === 'ENTER') return 'navigating';
      return state;
    case 'navigating':
      if (event.type === 'NAVIGATE_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ProposalCardProps {
  [key: string]: unknown;
}

/* ---------------------------------------------------------------------------
 * Factory
 * ------------------------------------------------------------------------- */

export function createProposalCard(props: ProposalCardProps): {
  widget: Gtk.Widget;
  update: (nextProps: Partial<ProposalCardProps>) => void;
  dispose: () => void;
} {
  let state: ProposalCardState = 'idle';
  let currentProps = { ...props };
  const handlerIds: number[] = [];
  const timeoutIds: number[] = [];

  function send(event: ProposalCardEvent): void {
    state = proposalCardReducer(state, event);
    render();
  }

  /* --- Root container --- */
  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });
  root.add_css_class('proposal-card');
  root.set_accessible_role(Gtk.AccessibleRole.GROUP);

  /* --- Header --- */
  const headerBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
  });
  const headerLabel = new Gtk.Label({ label: 'ProposalCard' });
  headerLabel.add_css_class('proposal-card-header');
  headerBox.append(headerLabel);

  const stateLabel = new Gtk.Label({ label: '' });
  stateLabel.add_css_class('proposal-card-state');
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
  detailBox.add_css_class('proposal-card-detail');
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
    root.set_tooltip_text(`ProposalCard: ${state}`);

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

    // Generic content render
    const displayLabel = new Gtk.Label({ label: `${state}` });
    displayLabel.set_wrap(true);
    displayLabel.set_xalign(0);
    contentBox.append(displayLabel);
    // Render all string/number props as labels
    for (const [key, value] of Object.entries(p)) {
      if (typeof value === 'string' || typeof value === 'number') {
        const propRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
        const keyLabel = new Gtk.Label({ label: key + ':' });
        keyLabel.add_css_class('prop-key');
        propRow.append(keyLabel);
        const valLabel = new Gtk.Label({ label: String(value) });
        valLabel.set_hexpand(true);
        valLabel.set_xalign(0);
        valLabel.set_wrap(true);
        propRow.append(valLabel);
        contentBox.append(propRow);
      }
    }
  }

  /* --- Initial render --- */
  render();

  /* --- Public API --- */
  return {
    widget: root,
    update(nextProps: Partial<ProposalCardProps>): void {
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

export default createProposalCard;
