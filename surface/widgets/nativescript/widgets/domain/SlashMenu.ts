// ============================================================
// Clef Surface NativeScript Widget — SlashMenu
//
// Slash command dropdown. Renders a filterable list of
// block type options grouped by category, triggered by
// typing "/" in an editor. Supports keyboard navigation
// and fuzzy filtering.
// ============================================================

import {
  StackLayout,
  Label,
  TextField,
  ScrollView,
  Color,
  GestureTypes,
} from '@nativescript/core';

// --------------- Types ---------------

export interface BlockTypeDef {
  type: string;
  label: string;
  description?: string;
  icon?: string;
  category?: string;
  shortcut?: string;
}

export interface SlashMenuProps {
  items?: BlockTypeDef[];
  query?: string;
  selectedIndex?: number;
  visible?: boolean;
  maxHeight?: number;
  accentColor?: string;
  onSelect?: (type: string) => void;
  onQueryChange?: (query: string) => void;
  onClose?: () => void;
}

// --------------- Helpers ---------------

function matchesQuery(item: BlockTypeDef, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    item.type.toLowerCase().includes(q) ||
    item.label.toLowerCase().includes(q) ||
    (item.description?.toLowerCase().includes(q) ?? false) ||
    (item.category?.toLowerCase().includes(q) ?? false)
  );
}

// --------------- Component ---------------

export function createSlashMenu(props: SlashMenuProps = {}): StackLayout {
  const {
    items = [],
    query = '',
    selectedIndex = 0,
    visible = true,
    maxHeight = 300,
    accentColor = '#06b6d4',
    onSelect,
    onQueryChange,
    onClose,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-slash-menu';

  if (!visible) {
    container.visibility = 'collapse';
    return container;
  }

  container.backgroundColor = new Color('#1e1e3a');
  container.borderRadius = 8;
  container.borderWidth = 1;
  container.borderColor = new Color('#444444');
  container.padding = 4;

  // Search field
  const searchField = new TextField();
  searchField.hint = 'Filter commands...';
  searchField.text = query;
  searchField.fontSize = 13;
  searchField.color = new Color('#e0e0e0');
  searchField.backgroundColor = new Color('#0d0d1a');
  searchField.borderRadius = 4;
  searchField.padding = 6;
  searchField.marginBottom = 4;
  searchField.on('textChange', (args: any) => onQueryChange?.(args.object.text));
  container.addChild(searchField);

  // Filter items
  const filtered = items.filter((item) => matchesQuery(item, query));

  // Group by category
  const groups = new Map<string, BlockTypeDef[]>();
  filtered.forEach((item) => {
    const cat = item.category || 'General';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(item);
  });

  // Item list
  const scrollView = new ScrollView();
  scrollView.height = Math.min(maxHeight, filtered.length * 44 + groups.size * 24);
  const itemList = new StackLayout();

  let globalIndex = 0;

  groups.forEach((groupItems, category) => {
    // Category header
    const catLabel = new Label();
    catLabel.text = category.toUpperCase();
    catLabel.fontSize = 9;
    catLabel.fontWeight = 'bold';
    catLabel.opacity = 0.4;
    catLabel.marginTop = 4;
    catLabel.marginBottom = 2;
    catLabel.marginLeft = 8;
    catLabel.letterSpacing = 1;
    itemList.addChild(catLabel);

    groupItems.forEach((item) => {
      const isSelected = globalIndex === selectedIndex;
      const idx = globalIndex;

      const row = new StackLayout();
      row.orientation = 'horizontal';
      row.padding = 6;
      row.marginLeft = 4;
      row.marginRight = 4;
      row.marginBottom = 1;
      row.borderRadius = 4;
      row.backgroundColor = new Color(isSelected ? '#2a2a4a' : '#00000000');

      // Icon
      const iconLabel = new Label();
      iconLabel.text = item.icon || '\u25A1';
      iconLabel.fontSize = 16;
      iconLabel.width = 28;
      iconLabel.textAlignment = 'center';
      iconLabel.verticalAlignment = 'middle';
      iconLabel.marginRight = 8;
      row.addChild(iconLabel);

      // Text content
      const textStack = new StackLayout();

      const labelRow = new StackLayout();
      labelRow.orientation = 'horizontal';

      const nameLabel = new Label();
      nameLabel.text = item.label;
      nameLabel.fontSize = 13;
      nameLabel.fontWeight = isSelected ? 'bold' : 'normal';
      nameLabel.color = new Color(isSelected ? accentColor : '#e0e0e0');
      labelRow.addChild(nameLabel);

      if (item.shortcut) {
        const shortcutLabel = new Label();
        shortcutLabel.text = ` ${item.shortcut}`;
        shortcutLabel.fontSize = 10;
        shortcutLabel.opacity = 0.3;
        shortcutLabel.verticalAlignment = 'middle';
        labelRow.addChild(shortcutLabel);
      }

      textStack.addChild(labelRow);

      if (item.description) {
        const descLabel = new Label();
        descLabel.text = item.description;
        descLabel.fontSize = 10;
        descLabel.opacity = 0.5;
        descLabel.textWrap = true;
        textStack.addChild(descLabel);
      }

      row.addChild(textStack);

      row.on(GestureTypes.tap as any, () => onSelect?.(item.type));

      itemList.addChild(row);
      globalIndex++;
    });
  });

  // Empty state
  if (filtered.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = query ? `No commands matching "${query}"` : 'No commands available';
    emptyLabel.opacity = 0.4;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 12;
    emptyLabel.marginBottom = 12;
    itemList.addChild(emptyLabel);
  }

  scrollView.content = itemList;
  container.addChild(scrollView);

  // Footer hint
  const footerLabel = new Label();
  footerLabel.text = `${filtered.length} commands \u2022 Esc to close`;
  footerLabel.fontSize = 9;
  footerLabel.opacity = 0.3;
  footerLabel.horizontalAlignment = 'center';
  footerLabel.marginTop = 4;
  container.addChild(footerLabel);

  return container;
}

export default createSlashMenu;
