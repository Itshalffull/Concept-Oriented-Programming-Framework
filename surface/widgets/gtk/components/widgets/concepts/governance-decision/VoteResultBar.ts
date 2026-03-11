/* ---------------------------------------------------------------------------
 * VoteResultBar -- GTK4/GJS widget
 * Implements the vote-result-bar concept widget for GTK4.
 * Generated from React reference implementation.
 * ------------------------------------------------------------------------- */

import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/* ---------------------------------------------------------------------------
 * State Machine
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * VoteResultBar state machine
 * States: idle (initial), animating, segmentHovered
 * See widget spec: repertoire/concepts/governance-decision/widgets/vote-result-bar.widget
 * ------------------------------------------------------------------------- */

export type VoteResultBarState = 'idle' | 'animating' | 'segmentHovered';
export type VoteResultBarEvent =
  | { type: 'HOVER_SEGMENT'; index: number }
  | { type: 'ANIMATE_IN' }
  | { type: 'ANIMATION_END' }
  | { type: 'UNHOVER' }
  | { type: 'FOCUS_NEXT_SEGMENT' }
  | { type: 'FOCUS_PREV_SEGMENT' };

export function voteResultBarReducer(state: VoteResultBarState, event: VoteResultBarEvent): VoteResultBarState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER_SEGMENT') return 'segmentHovered';
      if (event.type === 'ANIMATE_IN') return 'animating';
      return state;
    case 'animating':
      if (event.type === 'ANIMATION_END') return 'idle';
      return state;
    case 'segmentHovered':
      if (event.type === 'UNHOVER') return 'idle';
      if (event.type === 'HOVER_SEGMENT') return 'segmentHovered';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface VoteResultBarProps {
  [key: string]: unknown;
}

/* ---------------------------------------------------------------------------
 * Factory
 * ------------------------------------------------------------------------- */

export function createVoteResultBar(props: VoteResultBarProps): {
  widget: Gtk.Widget;
  update: (nextProps: Partial<VoteResultBarProps>) => void;
  dispose: () => void;
} {
  let state: VoteResultBarState = 'idle';
  let currentProps = { ...props };
  const handlerIds: number[] = [];
  const timeoutIds: number[] = [];

  function send(event: VoteResultBarEvent): void {
    state = voteResultBarReducer(state, event);
    render();
  }

  /* --- Root container --- */
  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });
  root.add_css_class('vote-result-bar');
  root.set_accessible_role(Gtk.AccessibleRole.GROUP);

  /* --- Header --- */
  const headerBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
  });
  const headerLabel = new Gtk.Label({ label: 'VoteResultBar' });
  headerLabel.add_css_class('vote-result-bar-header');
  headerBox.append(headerLabel);

  const stateLabel = new Gtk.Label({ label: '' });
  stateLabel.add_css_class('vote-result-bar-state');
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
  detailBox.add_css_class('vote-result-bar-detail');
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
    root.set_tooltip_text(`VoteResultBar: ${state}`);

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

    // Vote/progress segments
    const segments = (p.segments || []) as Array<{ label: string; count: number; color?: string }>;
    const total = segments.reduce((s: number, seg: any) => s + (seg.count || 0), 0) || 1;
    const barBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 0 });
    barBox.add_css_class('segment-bar');
    for (const seg of segments) {
      const pct = Math.round((seg.count / total) * 100);
      const segLabel = new Gtk.Label({ label: `${seg.label}: ${pct}%` });
      segLabel.set_hexpand(pct > 0);
      segLabel.add_css_class('segment');
      segLabel.set_tooltip_text(`${seg.label}: ${seg.count} (${pct}%)`);
      barBox.append(segLabel);
    }
    contentBox.append(barBox);
    // Legend
    for (const seg of segments) {
      const legendRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      const dot = new Gtk.Label({ label: '\u25CF' });
      legendRow.append(dot);
      const legendLabel = new Gtk.Label({ label: `${seg.label}: ${seg.count}` });
      legendRow.append(legendLabel);
      contentBox.append(legendRow);
    }
  }

  /* --- Initial render --- */
  render();

  /* --- Public API --- */
  return {
    widget: root,
    update(nextProps: Partial<VoteResultBarProps>): void {
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

export default createVoteResultBar;
