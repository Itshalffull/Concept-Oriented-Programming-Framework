// ============================================================
// Clef Surface GTK Widget — DiffViewer
//
// Side-by-side or unified diff viewer for comparing two text
// versions. Displays added, removed, and unchanged lines with
// line numbers using monospaced Gtk.Label rows.
//
// Adapts the diff-viewer.widget spec to GTK4 rendering.
// See Architecture doc Section 16.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  oldNum: number | null;
  newNum: number | null;
  content: string;
}

export type DiffMode = 'unified' | 'split';

// --------------- Helpers ---------------

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: DiffLine[] = [];
  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLine = oldLines[oldIdx] ?? null;
    const newLine = newLines[newIdx] ?? null;

    if (oldLine !== null && newLine !== null && oldLine === newLine) {
      result.push({ type: 'unchanged', oldNum: oldIdx + 1, newNum: newIdx + 1, content: oldLine });
      oldIdx++; newIdx++;
    } else if (oldLine !== null && (newLine === null || oldLine !== newLine)) {
      result.push({ type: 'removed', oldNum: oldIdx + 1, newNum: null, content: oldLine });
      oldIdx++;
    } else if (newLine !== null) {
      result.push({ type: 'added', oldNum: null, newNum: newIdx + 1, content: newLine });
      newIdx++;
    }
  }
  return result;
}

// --------------- Props ---------------

export interface DiffViewerProps {
  oldText?: string;
  newText?: string;
  mode?: DiffMode;
}

// --------------- Component ---------------

export function createDiffViewer(props: DiffViewerProps = {}): Gtk.Widget {
  const { oldText = '', newText = '', mode = 'unified' } = props;

  const diffLines = computeDiff(oldText, newText);
  const additions = diffLines.filter((l) => l.type === 'added').length;
  const deletions = diffLines.filter((l) => l.type === 'removed').length;

  const container = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
  container.get_style_context().add_class('card');

  // Header
  const header = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
  header.append(new Gtk.Label({ label: 'Diff' }));
  const addLabel = new Gtk.Label({ label: `+${additions}` });
  addLabel.get_style_context().add_class('success');
  header.append(addLabel);
  const delLabel = new Gtk.Label({ label: `-${deletions}` });
  delLabel.get_style_context().add_class('error');
  header.append(delLabel);
  header.append(new Gtk.Label({ label: `[${mode}]` }));
  container.append(header);

  // Diff content
  const scrolled = new Gtk.ScrolledWindow({
    hscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
    vscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
    minContentHeight: 200,
  });

  const grid = new Gtk.Grid({ columnSpacing: 8, rowSpacing: 0 });

  diffLines.forEach((line, idx) => {
    const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
    const oldNum = line.oldNum?.toString().padStart(4) ?? '    ';
    const newNum = line.newNum?.toString().padStart(4) ?? '    ';

    const numLabel = new Gtk.Label({ label: `${oldNum} ${newNum}` });
    numLabel.get_style_context().add_class('dim-label');
    numLabel.get_style_context().add_class('monospace');
    grid.attach(numLabel, 0, idx, 1, 1);

    const contentLabel = new Gtk.Label({ label: `${prefix} ${line.content}`, xalign: 0 });
    contentLabel.get_style_context().add_class('monospace');
    if (line.type === 'added') contentLabel.get_style_context().add_class('success');
    else if (line.type === 'removed') contentLabel.get_style_context().add_class('error');
    else contentLabel.get_style_context().add_class('dim-label');
    grid.attach(contentLabel, 1, idx, 1, 1);
  });

  scrolled.set_child(grid);
  container.append(scrolled);

  return container;
}
