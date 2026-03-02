// ============================================================
// Clef Surface NativeScript Widget — DiffViewer
//
// Displays a side-by-side or inline diff of two text blocks.
// Each line is color-coded: additions (green), removals (red),
// and unchanged (default). Supports unified and split modes.
// See Architecture doc Section 16.
// ============================================================

import { StackLayout, GridLayout, Label, ScrollView, Button } from '@nativescript/core';

// --------------- Types ---------------

export type DiffMode = 'inline' | 'split';

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber?: number;
  oldLineNumber?: number;
  newLineNumber?: number;
}

// --------------- Props ---------------

export interface DiffViewerProps {
  /** Array of diff lines to display. */
  lines?: DiffLine[];
  /** Display mode: inline or split. */
  mode?: DiffMode;
  /** Title for the left/old side. */
  oldTitle?: string;
  /** Title for the right/new side. */
  newTitle?: string;
  /** Whether to show line numbers. */
  showLineNumbers?: boolean;
  /** Called when mode is toggled. */
  onModeChange?: (mode: DiffMode) => void;
}

// --------------- Component ---------------

export function createDiffViewer(props: DiffViewerProps = {}): StackLayout {
  const {
    lines = [],
    mode = 'inline',
    oldTitle = 'Original',
    newTitle = 'Modified',
    showLineNumbers = true,
    onModeChange,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-diff-viewer';
  container.padding = 12;

  // Header
  const header = new GridLayout();
  header.columns = '*, auto';
  header.marginBottom = 8;

  const titleLabel = new Label();
  titleLabel.text = 'Diff Viewer';
  titleLabel.fontWeight = 'bold';
  titleLabel.fontSize = 16;
  GridLayout.setColumn(titleLabel, 0);
  header.addChild(titleLabel);

  const modeBtn = new Button();
  modeBtn.text = mode === 'inline' ? 'Split' : 'Inline';
  modeBtn.fontSize = 11;
  modeBtn.padding = 4;
  GridLayout.setColumn(modeBtn, 1);
  if (onModeChange) {
    modeBtn.on('tap', () => onModeChange(mode === 'inline' ? 'split' : 'inline'));
  }
  header.addChild(modeBtn);
  container.addChild(header);

  // Stats summary
  const added = lines.filter((l) => l.type === 'added').length;
  const removed = lines.filter((l) => l.type === 'removed').length;
  const statsLabel = new Label();
  statsLabel.text = `+${added} / -${removed} lines`;
  statsLabel.opacity = 0.6;
  statsLabel.fontSize = 12;
  statsLabel.marginBottom = 8;
  container.addChild(statsLabel);

  if (lines.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No differences.';
    emptyLabel.opacity = 0.5;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 16;
    container.addChild(emptyLabel);
    return container;
  }

  if (mode === 'split') {
    // Split mode: column titles
    const colHeaders = new GridLayout();
    colHeaders.columns = '*, *';
    colHeaders.marginBottom = 4;

    const oldTitleLabel = new Label();
    oldTitleLabel.text = oldTitle;
    oldTitleLabel.fontWeight = 'bold';
    oldTitleLabel.fontSize = 12;
    oldTitleLabel.opacity = 0.7;
    GridLayout.setColumn(oldTitleLabel, 0);
    colHeaders.addChild(oldTitleLabel);

    const newTitleLabel = new Label();
    newTitleLabel.text = newTitle;
    newTitleLabel.fontWeight = 'bold';
    newTitleLabel.fontSize = 12;
    newTitleLabel.opacity = 0.7;
    GridLayout.setColumn(newTitleLabel, 1);
    colHeaders.addChild(newTitleLabel);

    container.addChild(colHeaders);
  }

  // Diff lines
  const scrollView = new ScrollView();
  const list = new StackLayout();

  if (mode === 'inline') {
    lines.forEach((line) => {
      const row = new GridLayout();
      row.columns = showLineNumbers ? 'auto, *' : '*';
      row.padding = 2;

      if (line.type === 'added') {
        row.backgroundColor = '#E6FFE6' as any;
      } else if (line.type === 'removed') {
        row.backgroundColor = '#FFE6E6' as any;
      }

      if (showLineNumbers) {
        const numLabel = new Label();
        numLabel.text = `${line.lineNumber ?? ''}`;
        numLabel.width = 32;
        numLabel.opacity = 0.4;
        numLabel.fontSize = 10;
        numLabel.textAlignment = 'right';
        numLabel.marginRight = 8;
        GridLayout.setColumn(numLabel, 0);
        row.addChild(numLabel);
      }

      const prefix = line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  ';
      const contentLabel = new Label();
      contentLabel.text = `${prefix}${line.content}`;
      contentLabel.fontSize = 12;
      contentLabel.fontFamily = 'monospace';
      GridLayout.setColumn(contentLabel, showLineNumbers ? 1 : 0);
      row.addChild(contentLabel);

      list.addChild(row);
    });
  } else {
    // Split mode
    lines.forEach((line) => {
      const row = new GridLayout();
      row.columns = '*, *';
      row.padding = 2;

      const leftLabel = new Label();
      leftLabel.fontSize = 12;
      leftLabel.fontFamily = 'monospace';
      GridLayout.setColumn(leftLabel, 0);

      const rightLabel = new Label();
      rightLabel.fontSize = 12;
      rightLabel.fontFamily = 'monospace';
      GridLayout.setColumn(rightLabel, 1);

      if (line.type === 'removed') {
        leftLabel.text = `- ${line.content}`;
        leftLabel.backgroundColor = '#FFE6E6' as any;
        rightLabel.text = '';
      } else if (line.type === 'added') {
        leftLabel.text = '';
        rightLabel.text = `+ ${line.content}`;
        rightLabel.backgroundColor = '#E6FFE6' as any;
      } else {
        leftLabel.text = `  ${line.content}`;
        rightLabel.text = `  ${line.content}`;
      }

      row.addChild(leftLabel);
      row.addChild(rightLabel);
      list.addChild(row);
    });
  }

  scrollView.content = list;
  container.addChild(scrollView);
  return container;
}

createDiffViewer.displayName = 'DiffViewer';
export default createDiffViewer;
