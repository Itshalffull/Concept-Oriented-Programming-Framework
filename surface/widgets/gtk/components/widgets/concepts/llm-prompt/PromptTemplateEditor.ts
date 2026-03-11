/* ---------------------------------------------------------------------------
 * PromptTemplateEditor -- GTK4/GJS widget
 * Implements the prompt-template-editor concept widget for GTK4.
 * Generated from React reference implementation.
 * ------------------------------------------------------------------------- */

import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/* ---------------------------------------------------------------------------
 * State Machine
 * ------------------------------------------------------------------------- */

export type PromptTemplateEditorState = 'editing' | 'messageSelected' | 'compiling';
export type PromptTemplateEditorEvent =
  | { type: 'ADD_MESSAGE' }
  | { type: 'REMOVE_MESSAGE'; index?: number }
  | { type: 'REORDER'; from?: number; to?: number }
  | { type: 'COMPILE' }
  | { type: 'SELECT_MESSAGE'; index?: number }
  | { type: 'DESELECT' }
  | { type: 'COMPILE_COMPLETE' }
  | { type: 'COMPILE_ERROR' };

export function promptTemplateEditorReducer(state: PromptTemplateEditorState, event: PromptTemplateEditorEvent): PromptTemplateEditorState {
  switch (state) {
    case 'editing':
      if (event.type === 'ADD_MESSAGE') return 'editing';
      if (event.type === 'REMOVE_MESSAGE') return 'editing';
      if (event.type === 'REORDER') return 'editing';
      if (event.type === 'COMPILE') return 'compiling';
      if (event.type === 'SELECT_MESSAGE') return 'messageSelected';
      return state;
    case 'messageSelected':
      if (event.type === 'DESELECT') return 'editing';
      if (event.type === 'SELECT_MESSAGE') return 'messageSelected';
      return state;
    case 'compiling':
      if (event.type === 'COMPILE_COMPLETE') return 'editing';
      if (event.type === 'COMPILE_ERROR') return 'editing';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface PromptTemplateEditorProps {
  [key: string]: unknown;
}

/* ---------------------------------------------------------------------------
 * Factory
 * ------------------------------------------------------------------------- */

export function createPromptTemplateEditor(props: PromptTemplateEditorProps): {
  widget: Gtk.Widget;
  update: (nextProps: Partial<PromptTemplateEditorProps>) => void;
  dispose: () => void;
} {
  let state: PromptTemplateEditorState = 'editing';
  let currentProps = { ...props };
  const handlerIds: number[] = [];
  const timeoutIds: number[] = [];

  function send(event: PromptTemplateEditorEvent): void {
    state = promptTemplateEditorReducer(state, event);
    render();
  }

  /* --- Root container --- */
  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });
  root.add_css_class('prompt-template-editor');
  root.set_accessible_role(Gtk.AccessibleRole.GROUP);

  /* --- Header --- */
  const headerBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
  });
  const headerLabel = new Gtk.Label({ label: 'PromptTemplateEditor' });
  headerLabel.add_css_class('prompt-template-editor-header');
  headerBox.append(headerLabel);

  const stateLabel = new Gtk.Label({ label: '' });
  stateLabel.add_css_class('prompt-template-editor-state');
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
  detailBox.add_css_class('prompt-template-editor-detail');
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
    root.set_tooltip_text(`PromptTemplateEditor: ${state}`);

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

    // Generation indicator
    const genStatus = (p.status || 'idle') as string;
    const model = (p.model || '') as string;
    const tokenCount = (p.tokenCount || 0) as number;
    const spinner = new Gtk.Spinner();
    spinner.set_spinning(genStatus === 'generating');
    contentBox.append(spinner);
    const statusLabel2 = new Gtk.Label({ label: genStatus === 'generating' ? `Generating... ${tokenCount} tokens` : genStatus === 'complete' ? 'Complete' : genStatus === 'error' ? 'Error' : 'Ready' });
    contentBox.append(statusLabel2);
    if (model) {
      const modelLabel = new Gtk.Label({ label: `Model: ${model}` });
      contentBox.append(modelLabel);
    }
  }

  /* --- Initial render --- */
  render();

  /* --- Public API --- */
  return {
    widget: root,
    update(nextProps: Partial<PromptTemplateEditorProps>): void {
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

export default createPromptTemplateEditor;
