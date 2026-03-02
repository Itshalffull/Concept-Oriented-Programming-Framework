// ============================================================
// Clef Surface NativeScript Widget — BacklinkPanel
//
// Incoming reference panel displaying pages or blocks linking
// to the current document. Shows linked references with source
// breadcrumb and context snippet, with tap-to-select support.
// Maps backlink-panel.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

import { StackLayout, Label, GridLayout, ScrollView } from '@nativescript/core';

// --------------- Types ---------------

export interface Backlink {
  title: string;
  source: string;
  excerpt: string;
}

// --------------- Props ---------------

export interface BacklinkPanelProps {
  /** Array of backlink references. */
  backlinks?: Backlink[];
  /** Title displayed at the top of the panel. */
  title?: string;
  /** Callback when a backlink is tapped. */
  onSelect?: (backlink: Backlink) => void;
}

// --------------- Component ---------------

export function createBacklinkPanel(props: BacklinkPanelProps = {}): StackLayout {
  const {
    backlinks = [],
    title = 'Backlinks',
    onSelect,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-backlink-panel';
  container.padding = 12;

  // Header row
  const header = new GridLayout();
  header.columns = '*, auto';
  header.marginBottom = 8;

  const titleLabel = new Label();
  titleLabel.text = title;
  titleLabel.fontWeight = 'bold';
  titleLabel.fontSize = 16;
  GridLayout.setColumn(titleLabel, 0);
  header.addChild(titleLabel);

  const countLabel = new Label();
  countLabel.text = `(${backlinks.length})`;
  countLabel.opacity = 0.6;
  countLabel.fontSize = 14;
  countLabel.horizontalAlignment = 'right';
  GridLayout.setColumn(countLabel, 1);
  header.addChild(countLabel);

  container.addChild(header);

  // Empty state
  if (backlinks.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No backlinks found.';
    emptyLabel.opacity = 0.5;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 16;
    container.addChild(emptyLabel);
    return container;
  }

  // Scrollable list
  const scrollView = new ScrollView();
  const list = new StackLayout();

  backlinks.forEach((bl) => {
    const row = new StackLayout();
    row.className = 'clef-backlink-row';
    row.padding = 8;
    row.marginBottom = 4;
    row.borderRadius = 4;
    row.backgroundColor = '#F5F5F5' as any;

    const titleRow = new GridLayout();
    titleRow.columns = 'auto, *';

    const arrow = new Label();
    arrow.text = '\u2192 ';
    arrow.opacity = 0.5;
    arrow.fontSize = 13;
    GridLayout.setColumn(arrow, 0);
    titleRow.addChild(arrow);

    const linkTitle = new Label();
    linkTitle.text = bl.title;
    linkTitle.fontWeight = 'bold';
    linkTitle.fontSize = 13;
    GridLayout.setColumn(linkTitle, 1);
    titleRow.addChild(linkTitle);

    row.addChild(titleRow);

    const sourceLabel = new Label();
    sourceLabel.text = bl.source;
    sourceLabel.opacity = 0.5;
    sourceLabel.fontSize = 11;
    sourceLabel.marginLeft = 16;
    row.addChild(sourceLabel);

    const excerptLabel = new Label();
    excerptLabel.text = bl.excerpt;
    excerptLabel.textWrap = true;
    excerptLabel.opacity = 0.6;
    excerptLabel.fontSize = 12;
    excerptLabel.marginLeft = 16;
    excerptLabel.marginTop = 2;
    row.addChild(excerptLabel);

    if (onSelect) {
      row.on('tap', () => onSelect(bl));
    }

    list.addChild(row);
  });

  scrollView.content = list;
  container.addChild(scrollView);
  return container;
}

createBacklinkPanel.displayName = 'BacklinkPanel';
export default createBacklinkPanel;
