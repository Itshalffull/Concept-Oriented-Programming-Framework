// ============================================================
// Clef Surface NativeScript Widget — BacklinkPanel
//
// Panel showing linked and unlinked references.
// ============================================================

import { StackLayout, Label, ScrollView } from '@nativescript/core';

export interface LinkedRef { id: string; title: string; excerpt?: string; }
export interface UnlinkedRef { id: string; title: string; excerpt?: string; }

export interface BacklinkPanelProps {
  linkedRefs?: LinkedRef[];
  unlinkedRefs?: UnlinkedRef[];
  title?: string;
  onRefClick?: (id: string) => void;
  onLink?: (id: string) => void;
}

export function createBacklinkPanel(props: BacklinkPanelProps): StackLayout {
  const { linkedRefs = [], unlinkedRefs = [], title = 'Backlinks', onRefClick, onLink } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-backlink-panel';

  const titleLabel = new Label();
  titleLabel.text = title;
  titleLabel.fontWeight = 'bold';
  container.addChild(titleLabel);

  if (linkedRefs.length > 0) {
    const linkedHeader = new Label();
    linkedHeader.text = `Linked (${linkedRefs.length})`;
    linkedHeader.opacity = 0.6;
    linkedHeader.marginTop = 8;
    container.addChild(linkedHeader);
    for (const ref of linkedRefs) {
      const row = new Label();
      row.text = ref.title;
      row.padding = '4 0';
      row.on('tap', () => onRefClick?.(ref.id));
      container.addChild(row);
    }
  }
  if (unlinkedRefs.length > 0) {
    const unlinkedHeader = new Label();
    unlinkedHeader.text = `Unlinked (${unlinkedRefs.length})`;
    unlinkedHeader.opacity = 0.6;
    unlinkedHeader.marginTop = 8;
    container.addChild(unlinkedHeader);
    for (const ref of unlinkedRefs) {
      const row = new Label();
      row.text = ref.title;
      row.padding = '4 0';
      row.on('tap', () => onLink?.(ref.id));
      container.addChild(row);
    }
  }
  return container;
}

export default createBacklinkPanel;
