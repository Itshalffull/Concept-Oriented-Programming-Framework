/* ---------------------------------------------------------------------------
 * PromptInput -- GTK4/GJS widget
 * Implements the prompt-input concept widget for GTK4.
 * Generated from React reference implementation.
 * ------------------------------------------------------------------------- */

import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/* ---------------------------------------------------------------------------
 * State Machine
 * ------------------------------------------------------------------------- */

export type PromptInputState = 'empty' | 'composing' | 'submitting';
export type PromptInputEvent =
  | { type: 'INPUT'; value?: string }
  | { type: 'PASTE' }
  | { type: 'ATTACH' }
  | { type: 'CLEAR' }
  | { type: 'SUBMIT' }
  | { type: 'SUBMIT_COMPLETE' }
  | { type: 'SUBMIT_ERROR' };

export function promptInputReducer(state: PromptInputState, event: PromptInputEvent): PromptInputState {
  switch (state) {
    case 'empty':
      if (event.type === 'INPUT') return 'composing';
      if (event.type === 'PASTE') return 'composing';
      if (event.type === 'ATTACH') return 'composing';
      return state;
    case 'composing':
      if (event.type === 'CLEAR') return 'empty';
      if (event.type === 'SUBMIT') return 'submitting';
      return state;
    case 'submitting':
      if (event.type === 'SUBMIT_COMPLETE') return 'empty';
      if (event.type === 'SUBMIT_ERROR') return 'composing';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface PromptInputProps {
  [key: string]: unknown;
}

/* ---------------------------------------------------------------------------
 * Factory
 * ------------------------------------------------------------------------- */

export function createPromptInput(props: PromptInputProps): {
  widget: Gtk.Widget;
  update: (nextProps: Partial<PromptInputProps>) => void;
  dispose: () => void;
} {
  let state: PromptInputState = 'empty';
  let currentProps = { ...props };
  const handlerIds: number[] = [];
  const timeoutIds: number[] = [];

  function send(event: PromptInputEvent): void {
    state = promptInputReducer(state, event);
    render();
  }

  /* --- Root container --- */
  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });
  root.add_css_class('prompt-input');
  root.set_accessible_role(Gtk.AccessibleRole.GROUP);

  /* --- Header --- */
  const headerBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
  });
  const headerLabel = new Gtk.Label({ label: 'PromptInput' });
  headerLabel.add_css_class('prompt-input-header');
  headerBox.append(headerLabel);

  const stateLabel = new Gtk.Label({ label: '' });
  stateLabel.add_css_class('prompt-input-state');
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
  detailBox.add_css_class('prompt-input-detail');
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
    if (keyval === 0xff1b) { /* Escape */
      return true;
    }

    return false;
  });
  root.add_controller(keyCtrl);

  /* --- Render function --- */
  function render(): void {
    stateLabel.set_label(`[${state}]`);
    root.set_tooltip_text(`PromptInput: ${state}`);

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
    update(nextProps: Partial<PromptInputProps>): void {
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

export default createPromptInput;
