/* ---------------------------------------------------------------------------
 * DeliberationThread -- GTK4/GJS widget
 * Implements the deliberation-thread concept widget for GTK4.
 * Generated from React reference implementation.
 * ------------------------------------------------------------------------- */

import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/* ---------------------------------------------------------------------------
 * State Machine
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * DeliberationThread state machine
 * States: viewing (initial), composing, entrySelected
 * See widget spec: deliberation-thread.widget
 * ------------------------------------------------------------------------- */

export type DeliberationThreadState = 'viewing' | 'composing' | 'entrySelected';
export type DeliberationThreadEvent =
  | { type: 'REPLY_TO'; entryId: string }
  | { type: 'SELECT_ENTRY'; entryId: string }
  | { type: 'SEND' }
  | { type: 'CANCEL' }
  | { type: 'DESELECT' };

export interface DeliberationThreadMachineContext {
  state: DeliberationThreadState;
  /** ID of the entry being replied to (composing state). */
  replyTargetId: string | null;
  /** ID of the currently selected entry (entrySelected state). */
  selectedEntryId: string | null;
}

export function deliberationThreadReducer(
  ctx: DeliberationThreadMachineContext,
  event: DeliberationThreadEvent,
): DeliberationThreadMachineContext {
  switch (ctx.state) {
    case 'viewing':
      if (event.type === 'REPLY_TO')
        return { state: 'composing', replyTargetId: event.entryId, selectedEntryId: null };
      if (event.type === 'SELECT_ENTRY')
        return { state: 'entrySelected', replyTargetId: null, selectedEntryId: event.entryId };
      return ctx;
    case 'composing':
      if (event.type === 'SEND')
        return { state: 'viewing', replyTargetId: null, selectedEntryId: null };
      if (event.type === 'CANCEL')
        return { state: 'viewing', replyTargetId: null, selectedEntryId: null };
      return ctx;
    case 'entrySelected':
      if (event.type === 'DESELECT')
        return { state: 'viewing', replyTargetId: null, selectedEntryId: null };
      if (event.type === 'REPLY_TO')
        return { state: 'composing', replyTargetId: event.entryId, selectedEntryId: null };
      return ctx;
    default:
      return ctx;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface DeliberationThreadProps {
  [key: string]: unknown;
}

/* ---------------------------------------------------------------------------
 * Factory
 * ------------------------------------------------------------------------- */

export function createDeliberationThread(props: DeliberationThreadProps): {
  widget: Gtk.Widget;
  update: (nextProps: Partial<DeliberationThreadProps>) => void;
  dispose: () => void;
} {
  let state: DeliberationThreadState = 'viewing';
  let currentProps = { ...props };
  const handlerIds: number[] = [];
  const timeoutIds: number[] = [];

  let replyTargetId: string | null = null;
  let selectedEntryId: string | null = null;

  function send(event: DeliberationThreadEvent): void {
    const ctx = deliberationThreadReducer({ state, replyTargetId, selectedEntryId }, event);
    state = ctx.state;
    replyTargetId = ctx.replyTargetId;
    selectedEntryId = ctx.selectedEntryId;
    render();
  }

  /* --- Root container --- */
  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });
  root.add_css_class('deliberation-thread');
  root.set_accessible_role(Gtk.AccessibleRole.GROUP);

  /* --- Header --- */
  const headerBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
  });
  const headerLabel = new Gtk.Label({ label: 'DeliberationThread' });
  headerLabel.add_css_class('deliberation-thread-header');
  headerBox.append(headerLabel);

  const stateLabel = new Gtk.Label({ label: '' });
  stateLabel.add_css_class('deliberation-thread-state');
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
  detailBox.add_css_class('deliberation-thread-detail');
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
    root.set_tooltip_text(`DeliberationThread: ${state}`);

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

    // List items
    const items = (p.entries || []) as Array<{ id?: string; name?: string; label?: string; status?: string; author?: string; content?: string }>;
    for (const item of items) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      const label = new Gtk.Label({ label: item.name || item.label || item.content || item.id || '' });
      label.set_hexpand(true);
      label.set_xalign(0);
      label.set_wrap(true);
      row.append(label);
      if (item.status) {
        const statusLabel = new Gtk.Label({ label: item.status });
        statusLabel.add_css_class(`status-${item.status}`);
        row.append(statusLabel);
      }
      if (item.author) {
        const authorLabel = new Gtk.Label({ label: item.author });
        authorLabel.add_css_class('author');
        row.append(authorLabel);
      }
      const clickCtrl = new Gtk.GestureClick();
      clickCtrl.connect('released', () => {
        send({ type: 'SELECT_ENTRY' || 'SELECT' || 'CLICK_CELL' } as any);
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
    update(nextProps: Partial<DeliberationThreadProps>): void {
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

export default createDeliberationThread;
