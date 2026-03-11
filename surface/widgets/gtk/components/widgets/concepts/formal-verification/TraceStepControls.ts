/* ---------------------------------------------------------------------------
 * TraceStepControls -- GTK4/GJS widget
 * Implements the trace-step-controls concept widget for GTK4.
 * Generated from React reference implementation.
 * ------------------------------------------------------------------------- */

import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/* ---------------------------------------------------------------------------
 * State Machine
 * ------------------------------------------------------------------------- */

export type TraceStepControlsState = 'paused' | 'playing';
export type TraceStepControlsEvent =
  | { type: 'PLAY' }
  | { type: 'STEP_FWD' }
  | { type: 'STEP_BACK' }
  | { type: 'JUMP_START' }
  | { type: 'JUMP_END' }
  | { type: 'PAUSE' }
  | { type: 'REACH_END' };

export function traceStepControlsReducer(state: TraceStepControlsState, event: TraceStepControlsEvent): TraceStepControlsState {
  switch (state) {
    case 'paused':
      if (event.type === 'PLAY') return 'playing';
      if (event.type === 'STEP_FWD') return 'paused';
      if (event.type === 'STEP_BACK') return 'paused';
      if (event.type === 'JUMP_START') return 'paused';
      if (event.type === 'JUMP_END') return 'paused';
      return state;
    case 'playing':
      if (event.type === 'PAUSE') return 'paused';
      if (event.type === 'REACH_END') return 'paused';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface TraceStepControlsProps {
  [key: string]: unknown;
}

/* ---------------------------------------------------------------------------
 * Factory
 * ------------------------------------------------------------------------- */

export function createTraceStepControls(props: TraceStepControlsProps): {
  widget: Gtk.Widget;
  update: (nextProps: Partial<TraceStepControlsProps>) => void;
  dispose: () => void;
} {
  let state: TraceStepControlsState = 'paused';
  let currentProps = { ...props };
  const handlerIds: number[] = [];
  const timeoutIds: number[] = [];

  function send(event: TraceStepControlsEvent): void {
    state = traceStepControlsReducer(state, event);
    render();
  }

  /* --- Root container --- */
  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });
  root.add_css_class('trace-step-controls');
  root.set_accessible_role(Gtk.AccessibleRole.GROUP);

  /* --- Header --- */
  const headerBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
  });
  const headerLabel = new Gtk.Label({ label: 'TraceStepControls' });
  headerLabel.add_css_class('trace-step-controls-header');
  headerBox.append(headerLabel);

  const stateLabel = new Gtk.Label({ label: '' });
  stateLabel.add_css_class('trace-step-controls-state');
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
  detailBox.add_css_class('trace-step-controls-detail');
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
    if (keyval === 0x20) { /* Space */
      return true;
    }
    if (keyval === 0xff50) { /* Home */
      return true;
    }
    if (keyval === 0xff57) { /* End */
      return true;
    }

    return false;
  });
  root.add_controller(keyCtrl);

  /* --- Render function --- */
  function render(): void {
    stateLabel.set_label(`[${state}]`);
    root.set_tooltip_text(`TraceStepControls: ${state}`);

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

    // Trace step controls
    const currentStep = (p.currentStep || 0) as number;
    const totalSteps = (p.totalSteps || 0) as number;
    const controlBar = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });

    const jumpStartBtn = new Gtk.Button({ label: '\u25C4|' });
    jumpStartBtn.connect('clicked', () => { send({ type: 'JUMP_START' } as any); if (p.onFirst) (p.onFirst as Function)(); });
    controlBar.append(jumpStartBtn);

    const stepBackBtn = new Gtk.Button({ label: '\u25C4' });
    stepBackBtn.connect('clicked', () => { send({ type: 'STEP_BACK' } as any); if (p.onStepBack) (p.onStepBack as Function)(); });
    controlBar.append(stepBackBtn);

    const playPauseBtn = new Gtk.Button({ label: state === 'playing' ? '\u23F8' : '\u25B6' });
    playPauseBtn.connect('clicked', () => {
      if (state === 'playing') { send({ type: 'PAUSE' } as any); if (p.onPause) (p.onPause as Function)(); }
      else { send({ type: 'PLAY' } as any); if (p.onPlay) (p.onPlay as Function)(); }
    });
    controlBar.append(playPauseBtn);

    const stepFwdBtn = new Gtk.Button({ label: '\u25BA' });
    stepFwdBtn.connect('clicked', () => { send({ type: 'STEP_FWD' } as any); if (p.onStepForward) (p.onStepForward as Function)(); });
    controlBar.append(stepFwdBtn);

    const jumpEndBtn = new Gtk.Button({ label: '|\u25BA' });
    jumpEndBtn.connect('clicked', () => { send({ type: 'JUMP_END' } as any); if (p.onLast) (p.onLast as Function)(); });
    controlBar.append(jumpEndBtn);

    contentBox.append(controlBar);

    const counterLabel = new Gtk.Label({ label: `Step ${currentStep + 1} of ${totalSteps}` });
    contentBox.append(counterLabel);

    const progressBar = new Gtk.ProgressBar();
    progressBar.set_fraction(totalSteps > 0 ? (currentStep + 1) / totalSteps : 0);
    contentBox.append(progressBar);
  }

  /* --- Initial render --- */
  render();

  /* --- Public API --- */
  return {
    widget: root,
    update(nextProps: Partial<TraceStepControlsProps>): void {
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

export default createTraceStepControls;
