/* ---------------------------------------------------------------------------
 * ToolInvocation -- GTK4/GJS widget
 * Implements the tool-invocation concept widget for GTK4.
 * Generated from React reference implementation.
 * ------------------------------------------------------------------------- */

import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/* ---------------------------------------------------------------------------
 * State Machine
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * ToolInvocation state machine
 * Parallel states: collapsed/hoveredCollapsed/expanded AND pending/running/succeeded/failed
 * See widget spec: repertoire/concepts/llm-agent/widgets/tool-invocation.widget
 * ------------------------------------------------------------------------- */

export type ToolInvocationViewState = 'collapsed' | 'hoveredCollapsed' | 'expanded';
export type ToolInvocationExecState = 'pending' | 'running' | 'succeeded' | 'failed';

export type ToolInvocationViewEvent =
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'HOVER' }
  | { type: 'LEAVE' };

export type ToolInvocationExecEvent =
  | { type: 'INVOKE' }
  | { type: 'SUCCESS' }
  | { type: 'FAILURE' }
  | { type: 'RETRY' }
  | { type: 'RESET' };

export function viewReducer(state: ToolInvocationViewState, event: ToolInvocationViewEvent): ToolInvocationViewState {
  switch (state) {
    case 'collapsed':
      if (event.type === 'EXPAND') return 'expanded';
      if (event.type === 'HOVER') return 'hoveredCollapsed';
      return state;
    case 'hoveredCollapsed':
      if (event.type === 'LEAVE') return 'collapsed';
      if (event.type === 'EXPAND') return 'expanded';
      return state;
    case 'expanded':
      if (event.type === 'COLLAPSE') return 'collapsed';
      return state;
    default:
      return state;
  }
}

export function execReducer(state: ToolInvocationExecState, event: ToolInvocationExecEvent): ToolInvocationExecState {
  switch (state) {
    case 'pending':
      if (event.type === 'INVOKE') return 'running';
      return state;
    case 'running':
      if (event.type === 'SUCCESS') return 'succeeded';
      if (event.type === 'FAILURE') return 'failed';
      return state;
    case 'succeeded':
      if (event.type === 'RESET') return 'pending';
      return state;
    case 'failed':
      if (event.type === 'RETRY') return 'running';
      if (event.type === 'RESET') return 'pending';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ToolInvocationProps {
  [key: string]: unknown;
}

/* ---------------------------------------------------------------------------
 * Factory
 * ------------------------------------------------------------------------- */

export function createToolInvocation(props: ToolInvocationProps): {
  widget: Gtk.Widget;
  update: (nextProps: Partial<ToolInvocationProps>) => void;
  dispose: () => void;
} {
  let state: ToolInvocationState = 'idle';
  let currentProps = { ...props };
  const handlerIds: number[] = [];
  const timeoutIds: number[] = [];

  function send(event: ToolInvocationEvent): void {
    state = toolInvocationReducer(state, event);
    render();
  }

  /* --- Root container --- */
  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });
  root.add_css_class('tool-invocation');
  root.set_accessible_role(Gtk.AccessibleRole.GROUP);

  /* --- Header --- */
  const headerBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
  });
  const headerLabel = new Gtk.Label({ label: 'ToolInvocation' });
  headerLabel.add_css_class('tool-invocation-header');
  headerBox.append(headerLabel);

  const stateLabel = new Gtk.Label({ label: '' });
  stateLabel.add_css_class('tool-invocation-state');
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
  detailBox.add_css_class('tool-invocation-detail');
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
    if (keyval === 0x20) { /* Space */
      return true;
    }

    return false;
  });
  root.add_controller(keyCtrl);

  /* --- Render function --- */
  function render(): void {
    stateLabel.set_label(`[${state}]`);
    root.set_tooltip_text(`ToolInvocation: ${state}`);

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

    // Tool invocation/detail
    const toolName = (p.name || p.toolName || '') as string;
    const input2 = (p.input || p.args || '{}') as string;
    const output2 = (p.output || p.result || '') as string;
    const toolStatus = (p.status || 'pending') as string;
    const nameLabel = new Gtk.Label({ label: `Tool: ${toolName}` });
    nameLabel.set_xalign(0);
    contentBox.append(nameLabel);
    const statusLabel5 = new Gtk.Label({ label: `Status: ${toolStatus}` });
    statusLabel5.add_css_class(`tool-${toolStatus}`);
    contentBox.append(statusLabel5);
    if (input2) {
      const inputLabel = new Gtk.Label({ label: 'Input:' });
      contentBox.append(inputLabel);
      const inputView = new Gtk.TextView({ editable: false, monospace: true });
      inputView.get_buffer().set_text(typeof input2 === 'string' ? input2 : JSON.stringify(input2, null, 2), -1);
      contentBox.append(inputView);
    }
    if (output2) {
      const outputLabel = new Gtk.Label({ label: 'Output:' });
      contentBox.append(outputLabel);
      const outputView = new Gtk.TextView({ editable: false, monospace: true });
      outputView.get_buffer().set_text(typeof output2 === 'string' ? output2 : JSON.stringify(output2, null, 2), -1);
      contentBox.append(outputView);
    }
  }

  /* --- Initial render --- */
  render();

  /* --- Public API --- */
  return {
    widget: root,
    update(nextProps: Partial<ToolInvocationProps>): void {
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

export default createToolInvocation;
