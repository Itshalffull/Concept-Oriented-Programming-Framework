// ============================================================
// Clef Surface NativeScript Widget — MasterDetail
//
// Master-detail layout with a scrollable master list on the
// left and a detail panel on the right. Tapping a master item
// selects it and shows its detail content.
// See Architecture doc Section 16.
// ============================================================

import { StackLayout, GridLayout, Label, ScrollView } from '@nativescript/core';

// --------------- Types ---------------

export interface MasterItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
}

// --------------- Props ---------------

export interface MasterDetailProps {
  /** Items to display in the master list. */
  items?: MasterItem[];
  /** Currently selected item id. */
  selectedId?: string;
  /** Width of the master panel. */
  masterWidth?: number;
  /** Title for the master list header. */
  masterTitle?: string;
  /** Called when an item is selected. */
  onSelect?: (item: MasterItem) => void;
  /** Factory to build detail content for the selected item. */
  renderDetail?: (item: MasterItem) => StackLayout | null;
}

// --------------- Component ---------------

export function createMasterDetail(props: MasterDetailProps = {}): GridLayout {
  const {
    items = [],
    selectedId,
    masterWidth = 240,
    masterTitle = 'Items',
    onSelect,
    renderDetail,
  } = props;

  const container = new GridLayout();
  container.className = 'clef-widget-master-detail';
  container.columns = `${masterWidth}, *`;
  container.rows = '*';

  // Master panel
  const masterPanel = new StackLayout();
  masterPanel.className = 'clef-master-panel';
  masterPanel.padding = 8;
  masterPanel.borderRightWidth = 1;
  masterPanel.borderColor = '#E0E0E0';
  GridLayout.setColumn(masterPanel, 0);

  const masterHeader = new Label();
  masterHeader.text = masterTitle;
  masterHeader.fontWeight = 'bold';
  masterHeader.fontSize = 14;
  masterHeader.marginBottom = 8;
  masterPanel.addChild(masterHeader);

  const masterScroll = new ScrollView();
  const masterList = new StackLayout();

  if (items.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No items.';
    emptyLabel.opacity = 0.5;
    masterList.addChild(emptyLabel);
  }

  items.forEach((item) => {
    const isSelected = item.id === selectedId;

    const row = new GridLayout();
    row.columns = '*, auto';
    row.padding = 8;
    row.marginBottom = 2;
    row.borderRadius = 4;
    row.backgroundColor = isSelected ? ('#DDEEFF' as any) : ('#FAFAFA' as any);

    const textStack = new StackLayout();
    GridLayout.setColumn(textStack, 0);

    const titleLabel = new Label();
    titleLabel.text = item.title;
    titleLabel.fontWeight = isSelected ? 'bold' : 'normal';
    titleLabel.fontSize = 13;
    textStack.addChild(titleLabel);

    if (item.subtitle) {
      const subtitleLabel = new Label();
      subtitleLabel.text = item.subtitle;
      subtitleLabel.opacity = 0.6;
      subtitleLabel.fontSize = 11;
      textStack.addChild(subtitleLabel);
    }

    row.addChild(textStack);

    if (item.badge) {
      const badgeLabel = new Label();
      badgeLabel.text = item.badge;
      badgeLabel.fontSize = 10;
      badgeLabel.opacity = 0.5;
      badgeLabel.verticalAlignment = 'middle';
      GridLayout.setColumn(badgeLabel, 1);
      row.addChild(badgeLabel);
    }

    if (onSelect) {
      row.on('tap', () => onSelect(item));
    }

    masterList.addChild(row);
  });

  masterScroll.content = masterList;
  masterPanel.addChild(masterScroll);
  container.addChild(masterPanel);

  // Detail panel
  const detailPanel = new StackLayout();
  detailPanel.className = 'clef-detail-panel';
  detailPanel.padding = 12;
  GridLayout.setColumn(detailPanel, 1);

  const selectedItem = items.find((i) => i.id === selectedId);

  if (!selectedItem) {
    const placeholder = new Label();
    placeholder.text = 'Select an item to view details.';
    placeholder.opacity = 0.5;
    placeholder.horizontalAlignment = 'center';
    placeholder.verticalAlignment = 'middle';
    detailPanel.addChild(placeholder);
  } else if (renderDetail) {
    const detailContent = renderDetail(selectedItem);
    if (detailContent) {
      detailPanel.addChild(detailContent);
    }
  } else {
    // Default detail rendering
    const detailTitle = new Label();
    detailTitle.text = selectedItem.title;
    detailTitle.fontWeight = 'bold';
    detailTitle.fontSize = 18;
    detailTitle.marginBottom = 8;
    detailPanel.addChild(detailTitle);

    if (selectedItem.subtitle) {
      const detailSubtitle = new Label();
      detailSubtitle.text = selectedItem.subtitle;
      detailSubtitle.opacity = 0.6;
      detailSubtitle.fontSize = 14;
      detailPanel.addChild(detailSubtitle);
    }

    const idLabel = new Label();
    idLabel.text = `ID: ${selectedItem.id}`;
    idLabel.opacity = 0.4;
    idLabel.fontSize = 11;
    idLabel.marginTop = 12;
    detailPanel.addChild(idLabel);
  }

  container.addChild(detailPanel);
  return container;
}

createMasterDetail.displayName = 'MasterDetail';
export default createMasterDetail;
