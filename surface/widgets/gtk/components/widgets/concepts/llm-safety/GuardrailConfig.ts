/* ---------------------------------------------------------------------------
 * GuardrailConfig -- GTK4/GJS widget
 * Implements the guardrail-config concept widget for GTK4.
 * Generated from React reference implementation.
 * ------------------------------------------------------------------------- */

import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/* ---------------------------------------------------------------------------
 * State Machine
 * ------------------------------------------------------------------------- */

export type GuardrailConfigState = 'viewing' | 'ruleSelected' | 'testing' | 'adding';
export type GuardrailConfigEvent =
  | { type: 'SELECT_RULE'; id?: string }
  | { type: 'TEST' }
  | { type: 'ADD_RULE' }
  | { type: 'DESELECT' }
  | { type: 'TEST_COMPLETE' }
  | { type: 'SAVE' }
  | { type: 'CANCEL' };

export function guardrailConfigReducer(state: GuardrailConfigState, event: GuardrailConfigEvent): GuardrailConfigState {
  switch (state) {
    case 'viewing':
      if (event.type === 'SELECT_RULE') return 'ruleSelected';
      if (event.type === 'TEST') return 'testing';
      if (event.type === 'ADD_RULE') return 'adding';
      return state;
    case 'ruleSelected':
      if (event.type === 'DESELECT') return 'viewing';
      return state;
    case 'testing':
      if (event.type === 'TEST_COMPLETE') return 'viewing';
      return state;
    case 'adding':
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

export interface GuardrailConfigProps {
  [key: string]: unknown;
}

/* ---------------------------------------------------------------------------
 * Factory
 * ------------------------------------------------------------------------- */

export function createGuardrailConfig(props: GuardrailConfigProps): {
  widget: Gtk.Widget;
  update: (nextProps: Partial<GuardrailConfigProps>) => void;
  dispose: () => void;
} {
  let state: GuardrailConfigState = 'viewing';
  let currentProps = { ...props };
  const handlerIds: number[] = [];
  const timeoutIds: number[] = [];

  function send(event: GuardrailConfigEvent): void {
    state = guardrailConfigReducer(state, event);
    render();
  }

  /* --- Root container --- */
  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });
  root.add_css_class('guardrail-config');
  root.set_accessible_role(Gtk.AccessibleRole.GROUP);

  /* --- Header --- */
  const headerBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
  });
  const headerLabel = new Gtk.Label({ label: 'GuardrailConfig' });
  headerLabel.add_css_class('guardrail-config-header');
  headerBox.append(headerLabel);

  const stateLabel = new Gtk.Label({ label: '' });
  stateLabel.add_css_class('guardrail-config-state');
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
  detailBox.add_css_class('guardrail-config-detail');
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
    root.set_tooltip_text(`GuardrailConfig: ${state}`);

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

    // Guardrail config
    const guardrails = (p.guardrails || p.rules || []) as Array<{ id?: string; name: string; enabled: boolean; description?: string }>;
    for (const gr of guardrails) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      const toggle = new Gtk.Switch();
      toggle.set_active(gr.enabled);
      toggle.connect('state-set', (_w: Gtk.Switch, active: boolean) => {
        send({ type: active ? 'ENABLE_RULE' : 'DISABLE_RULE' } as any);
        return false;
      });
      row.append(toggle);
      const grLabel = new Gtk.Label({ label: gr.name });
      grLabel.set_hexpand(true);
      grLabel.set_xalign(0);
      row.append(grLabel);
      contentBox.append(row);
    }
  }

  /* --- Initial render --- */
  render();

  /* --- Public API --- */
  return {
    widget: root,
    update(nextProps: Partial<GuardrailConfigProps>): void {
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

export default createGuardrailConfig;
