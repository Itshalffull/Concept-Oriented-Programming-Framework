/* ---------------------------------------------------------------------------
 * AuditReport -- GTK4/GJS widget
 * Implements the audit-report concept widget for GTK4.
 * Generated from React reference implementation.
 * ------------------------------------------------------------------------- */

import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/* ---------------------------------------------------------------------------
 * State Machine
 * ------------------------------------------------------------------------- */

export type AuditReportState = 'idle' | 'filtering' | 'vulnSelected';
export type AuditReportEvent =
  | { type: 'FILTER'; severity?: Severity }
  | { type: 'SELECT_VULN'; id: string }
  | { type: 'CLEAR' }
  | { type: 'DESELECT' };

export function auditReportReducer(state: AuditReportState, event: AuditReportEvent): AuditReportState {
  switch (state) {
    case 'idle':
      if (event.type === 'FILTER') return 'filtering';
      if (event.type === 'SELECT_VULN') return 'vulnSelected';
      return state;
    case 'filtering':
      if (event.type === 'CLEAR') return 'idle';
      return state;
    case 'vulnSelected':
      if (event.type === 'DESELECT') return 'idle';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface AuditReportProps {
  [key: string]: unknown;
}

/* ---------------------------------------------------------------------------
 * Factory
 * ------------------------------------------------------------------------- */

export function createAuditReport(props: AuditReportProps): {
  widget: Gtk.Widget;
  update: (nextProps: Partial<AuditReportProps>) => void;
  dispose: () => void;
} {
  let state: AuditReportState = 'idle';
  let currentProps = { ...props };
  const handlerIds: number[] = [];
  const timeoutIds: number[] = [];

  function send(event: AuditReportEvent): void {
    state = auditReportReducer(state, event);
    render();
  }

  /* --- Root container --- */
  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });
  root.add_css_class('audit-report');
  root.set_accessible_role(Gtk.AccessibleRole.GROUP);

  /* --- Header --- */
  const headerBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
  });
  const headerLabel = new Gtk.Label({ label: 'AuditReport' });
  headerLabel.add_css_class('audit-report-header');
  headerBox.append(headerLabel);

  const stateLabel = new Gtk.Label({ label: '' });
  stateLabel.add_css_class('audit-report-state');
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
  detailBox.add_css_class('audit-report-detail');
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
    root.set_tooltip_text(`AuditReport: ${state}`);

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

    // Audit report
    const findings = (p.findings || p.issues || []) as Array<{ id?: string; severity?: string; title?: string; description?: string }>;
    const summaryLabel = new Gtk.Label({ label: `${findings.length} findings` });
    contentBox.append(summaryLabel);
    for (const finding of findings) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      if (finding.severity) {
        const sevLabel = new Gtk.Label({ label: finding.severity });
        sevLabel.add_css_class(`severity-${finding.severity}`);
        row.append(sevLabel);
      }
      const titleLabel = new Gtk.Label({ label: finding.title || finding.description || '' });
      titleLabel.set_hexpand(true);
      titleLabel.set_xalign(0);
      titleLabel.set_wrap(true);
      row.append(titleLabel);
      contentBox.append(row);
    }
  }

  /* --- Initial render --- */
  render();

  /* --- Public API --- */
  return {
    widget: root,
    update(nextProps: Partial<AuditReportProps>): void {
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

export default createAuditReport;
