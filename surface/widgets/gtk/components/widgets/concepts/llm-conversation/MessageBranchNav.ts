/* ---------------------------------------------------------------------------
 * MessageBranchNav -- GTK4/GJS widget
 * Implements the message-branch-nav concept widget for GTK4.
 * Generated from React reference implementation.
 * ------------------------------------------------------------------------- */

import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/* ---------------------------------------------------------------------------
 * State Machine
 * ------------------------------------------------------------------------- */

export type MessageBranchNavState = 'viewing' | 'editing';
export type MessageBranchNavEvent =
  | { type: 'PREV' }
  | { type: 'NEXT' }
  | { type: 'EDIT' }
  | { type: 'SAVE' }
  | { type: 'CANCEL' };

export function messageBranchNavReducer(state: MessageBranchNavState, event: MessageBranchNavEvent): MessageBranchNavState {
  switch (state) {
    case 'viewing':
      if (event.type === 'PREV') return 'viewing';
      if (event.type === 'NEXT') return 'viewing';
      if (event.type === 'EDIT') return 'editing';
      return state;
    case 'editing':
      if (event.type === 'SAVE') return 'viewing';
      if (event.type === 'CANCEL') return 'viewing';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface MessageBranchNavProps {
  [key: string]: unknown;
}

/* ---------------------------------------------------------------------------
 * Factory
 * ------------------------------------------------------------------------- */

export function createMessageBranchNav(props: MessageBranchNavProps): {
  widget: Gtk.Widget;
  update: (nextProps: Partial<MessageBranchNavProps>) => void;
  dispose: () => void;
} {
  let state: MessageBranchNavState = 'viewing';
  let currentProps = { ...props };
  const handlerIds: number[] = [];
  const timeoutIds: number[] = [];

  function send(event: MessageBranchNavEvent): void {
    state = messageBranchNavReducer(state, event);
    render();
  }

  /* --- Root container --- */
  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });
  root.add_css_class('message-branch-nav');
  root.set_accessible_role(Gtk.AccessibleRole.GROUP);

  /* --- Header --- */
  const headerBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
  });
  const headerLabel = new Gtk.Label({ label: 'MessageBranchNav' });
  headerLabel.add_css_class('message-branch-nav-header');
  headerBox.append(headerLabel);

  const stateLabel = new Gtk.Label({ label: '' });
  stateLabel.add_css_class('message-branch-nav-state');
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
  detailBox.add_css_class('message-branch-nav-detail');
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
    if (keyval === 0xff53) { /* Right */
      return true;
    }
    if (keyval === 0xff51) { /* Left */
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
    root.set_tooltip_text(`MessageBranchNav: ${state}`);

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

    // Chat message
    const role = (p.role || 'user') as string;
    const content = (p.content || '') as string;
    const roleLabel = new Gtk.Label({ label: role });
    roleLabel.add_css_class(`role-${role}`);
    contentBox.append(roleLabel);
    const contentLabel = new Gtk.Label({ label: content });
    contentLabel.set_wrap(true);
    contentLabel.set_xalign(0);
    contentBox.append(contentLabel);
  }

  /* --- Initial render --- */
  render();

  /* --- Public API --- */
  return {
    widget: root,
    update(nextProps: Partial<MessageBranchNavProps>): void {
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

export default createMessageBranchNav;
