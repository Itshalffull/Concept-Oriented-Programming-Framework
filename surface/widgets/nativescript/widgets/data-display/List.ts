// ============================================================
// Clef Surface NativeScript Widget — List
//
// Simple list widget with configurable items, dividers, and
// optional icons/accessories. Renders a NativeScript StackLayout
// with individual row views.
// ============================================================

import { StackLayout, GridLayout, ScrollView, Label, ContentView, Color } from '@nativescript/core';

// --------------- Types ---------------

export type ListAccessory = 'none' | 'disclosure' | 'checkmark' | 'detail';

export interface ListItem {
  title: string;
  subtitle?: string;
  icon?: string;
  accessory?: ListAccessory;
  disabled?: boolean;
  onTap?: () => void;
}

export interface ListSection {
  header?: string;
  items: ListItem[];
}

// --------------- Props ---------------

export interface ListProps {
  items?: ListItem[];
  sections?: ListSection[];
  showDividers?: boolean;
  dividerColor?: string;
  rowHeight?: number;
  iconSize?: number;
  maxHeight?: number;
  backgroundColor?: string;
  selectedIndex?: number;
  selectedColor?: string;
  onItemTap?: (item: ListItem, index: number) => void;
}

// --------------- Helpers ---------------

const ACCESSORY_SYMBOLS: Record<ListAccessory, string> = {
  none: '',
  disclosure: '\u203A',
  checkmark: '\u2713',
  detail: '\u24D8',
};

// --------------- Component ---------------

export function createList(props: ListProps = {}): StackLayout {
  const {
    items,
    sections,
    showDividers = true,
    dividerColor = '#E0E0E0',
    rowHeight = 48,
    iconSize = 24,
    maxHeight = 500,
    backgroundColor = '#FFFFFF',
    selectedIndex = -1,
    selectedColor = '#E3F2FD',
    onItemTap,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-list';
  container.backgroundColor = backgroundColor as any;

  const scrollView = new ScrollView();
  scrollView.className = 'clef-list-scroll';
  scrollView.height = maxHeight;

  const listStack = new StackLayout();

  // Resolve items from flat list or sections
  const resolvedSections: ListSection[] = sections
    ? sections
    : [{ items: items || [] }];

  let globalIndex = 0;

  resolvedSections.forEach((section, sectionIndex) => {
    // Section header
    if (section.header) {
      const headerLabel = new Label();
      headerLabel.text = section.header.toUpperCase();
      headerLabel.className = 'clef-list-section-header';
      headerLabel.fontSize = 11;
      headerLabel.fontWeight = 'bold';
      headerLabel.opacity = 0.5;
      headerLabel.padding = '12 16 4 16';
      headerLabel.letterSpacing = 1;

      if (sectionIndex > 0) {
        headerLabel.marginTop = 8;
      }

      listStack.addChild(headerLabel);
    }

    section.items.forEach((item, itemIndex) => {
      const currentIndex = globalIndex;

      const row = new GridLayout();
      row.className = 'clef-list-item';
      row.columns = item.icon ? 'auto, *, auto' : '*, auto';
      row.height = rowHeight;
      row.padding = '0 16';

      if (currentIndex === selectedIndex) {
        row.backgroundColor = selectedColor as any;
      }

      if (item.disabled) {
        row.opacity = 0.4;
      }

      let colOffset = 0;

      // Icon
      if (item.icon) {
        const iconLabel = new Label();
        iconLabel.text = item.icon;
        iconLabel.fontSize = iconSize;
        iconLabel.verticalAlignment = 'middle';
        iconLabel.marginRight = 12;
        GridLayout.setColumn(iconLabel, 0);
        row.addChild(iconLabel);
        colOffset = 1;
      }

      // Title + Subtitle
      const textStack = new StackLayout();
      textStack.verticalAlignment = 'middle';

      const titleLabel = new Label();
      titleLabel.text = item.title;
      titleLabel.fontSize = 15;
      titleLabel.textWrap = false;
      textStack.addChild(titleLabel);

      if (item.subtitle) {
        const subtitleLabel = new Label();
        subtitleLabel.text = item.subtitle;
        subtitleLabel.fontSize = 12;
        subtitleLabel.opacity = 0.6;
        subtitleLabel.textWrap = false;
        subtitleLabel.marginTop = 1;
        textStack.addChild(subtitleLabel);
      }

      GridLayout.setColumn(textStack, colOffset);
      row.addChild(textStack);

      // Accessory
      const accessory = item.accessory || 'none';
      if (accessory !== 'none') {
        const accessoryLabel = new Label();
        accessoryLabel.text = ACCESSORY_SYMBOLS[accessory];
        accessoryLabel.fontSize = accessory === 'disclosure' ? 22 : 16;
        accessoryLabel.opacity = 0.4;
        accessoryLabel.verticalAlignment = 'middle';
        GridLayout.setColumn(accessoryLabel, colOffset + 1);
        row.addChild(accessoryLabel);
      }

      // Tap handler
      if (!item.disabled) {
        row.on('tap', () => {
          item.onTap?.();
          onItemTap?.(item, currentIndex);
        });
      }

      listStack.addChild(row);

      // Divider
      if (showDividers && itemIndex < section.items.length - 1) {
        const divider = new ContentView();
        divider.height = 1;
        divider.backgroundColor = dividerColor as any;
        divider.marginLeft = item.icon ? 52 : 16;
        listStack.addChild(divider);
      }

      globalIndex++;
    });
  });

  if (globalIndex === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No items';
    emptyLabel.opacity = 0.5;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 24;
    listStack.addChild(emptyLabel);
  }

  scrollView.content = listStack;
  container.addChild(scrollView);

  return container;
}

createList.displayName = 'List';
export default createList;
