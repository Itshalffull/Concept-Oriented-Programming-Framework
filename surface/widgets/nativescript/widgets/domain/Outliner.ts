// ============================================================
// Clef Surface NativeScript Widget — Outliner
//
// Hierarchical outline editor. Renders a tree of outline items
// with collapsible nesting, indent/outdent controls, drag
// reordering, and inline text editing.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  TextField,
  Button,
  ScrollView,
  Color,
  GestureTypes,
} from '@nativescript/core';

// --------------- Types ---------------

export interface OutlineItem {
  id: string;
  text: string;
  children?: OutlineItem[];
  collapsed?: boolean;
  completed?: boolean;
  level?: number;
}

export interface OutlinerProps {
  items?: OutlineItem[];
  selectedItemId?: string;
  editingItemId?: string;
  readOnly?: boolean;
  showCheckboxes?: boolean;
  showBullets?: boolean;
  indentSize?: number;
  maxDepth?: number;
  accentColor?: string;
  onItemSelect?: (id: string) => void;
  onItemEdit?: (id: string, text: string) => void;
  onItemToggleCollapse?: (id: string) => void;
  onItemToggleComplete?: (id: string) => void;
  onItemIndent?: (id: string) => void;
  onItemOutdent?: (id: string) => void;
  onItemAdd?: (afterId: string) => void;
  onItemDelete?: (id: string) => void;
}

// --------------- Helpers ---------------

function flattenItems(items: OutlineItem[], level: number = 0): Array<OutlineItem & { level: number; hasChildren: boolean }> {
  const result: Array<OutlineItem & { level: number; hasChildren: boolean }> = [];
  items.forEach((item) => {
    const hasChildren = (item.children?.length ?? 0) > 0;
    result.push({ ...item, level: item.level ?? level, hasChildren });
    if (hasChildren && !item.collapsed) {
      result.push(...flattenItems(item.children!, level + 1));
    }
  });
  return result;
}

// --------------- Component ---------------

export function createOutliner(props: OutlinerProps = {}): StackLayout {
  const {
    items = [],
    selectedItemId,
    editingItemId,
    readOnly = false,
    showCheckboxes = false,
    showBullets = true,
    indentSize = 20,
    maxDepth = 6,
    accentColor = '#06b6d4',
    onItemSelect,
    onItemEdit,
    onItemToggleCollapse,
    onItemToggleComplete,
    onItemIndent,
    onItemOutdent,
    onItemAdd,
    onItemDelete,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-outliner';
  container.padding = 4;

  // Header
  const header = new StackLayout();
  header.orientation = 'horizontal';
  header.marginBottom = 4;
  header.padding = 4;

  const titleLabel = new Label();
  titleLabel.text = '\u2261 Outline';
  titleLabel.fontWeight = 'bold';
  titleLabel.color = new Color(accentColor);
  titleLabel.marginRight = 8;
  header.addChild(titleLabel);

  const countLabel = new Label();
  const flat = flattenItems(items);
  countLabel.text = `${flat.length} items`;
  countLabel.fontSize = 11;
  countLabel.opacity = 0.5;
  header.addChild(countLabel);

  container.addChild(header);

  // Item list
  const scrollView = new ScrollView();
  const itemList = new StackLayout();
  itemList.className = 'clef-outliner-items';

  flat.forEach((item) => {
    const isSelected = item.id === selectedItemId;
    const isEditing = item.id === editingItemId;

    const row = new GridLayout();
    row.columns = 'auto, auto, *, auto';
    row.padding = 4;
    row.paddingLeft = 4 + item.level * indentSize;
    row.marginBottom = 1;
    row.borderRadius = 3;
    if (isSelected) {
      row.backgroundColor = new Color('#1a2a3a');
      row.borderWidth = 1;
      row.borderColor = new Color(accentColor);
    }

    // Collapse toggle
    if (item.hasChildren) {
      const collapseBtn = new Label();
      collapseBtn.text = item.collapsed ? '\u25B6' : '\u25BC';
      collapseBtn.fontSize = 10;
      collapseBtn.width = 16;
      collapseBtn.color = new Color('#888888');
      collapseBtn.verticalAlignment = 'middle';
      collapseBtn.on(GestureTypes.tap as any, () => onItemToggleCollapse?.(item.id));
      GridLayout.setColumn(collapseBtn, 0);
      row.addChild(collapseBtn);
    } else {
      const spacer = new Label();
      spacer.text = ' ';
      spacer.width = 16;
      GridLayout.setColumn(spacer, 0);
      row.addChild(spacer);
    }

    // Checkbox or bullet
    if (showCheckboxes) {
      const checkbox = new Label();
      checkbox.text = item.completed ? '\u2611' : '\u2610';
      checkbox.fontSize = 14;
      checkbox.color = new Color(item.completed ? '#22c55e' : '#888888');
      checkbox.marginRight = 6;
      checkbox.verticalAlignment = 'middle';
      if (!readOnly) {
        checkbox.on(GestureTypes.tap as any, () => onItemToggleComplete?.(item.id));
      }
      GridLayout.setColumn(checkbox, 1);
      row.addChild(checkbox);
    } else if (showBullets) {
      const bullet = new Label();
      const bullets = ['\u2022', '\u25E6', '\u25AA', '\u25AB', '\u2023', '\u2043'];
      bullet.text = bullets[Math.min(item.level, bullets.length - 1)];
      bullet.fontSize = 12;
      bullet.color = new Color(accentColor);
      bullet.marginRight = 6;
      bullet.verticalAlignment = 'middle';
      GridLayout.setColumn(bullet, 1);
      row.addChild(bullet);
    }

    // Text content
    if (isEditing && !readOnly) {
      const textField = new TextField();
      textField.text = item.text;
      textField.fontSize = 13;
      textField.color = new Color('#e0e0e0');
      textField.backgroundColor = new Color('#0d0d1a');
      textField.borderBottomWidth = 1;
      textField.borderBottomColor = new Color(accentColor);
      textField.on('textChange', (args: any) => {
        onItemEdit?.(item.id, args.object.text);
      });
      GridLayout.setColumn(textField, 2);
      row.addChild(textField);
    } else {
      const textLabel = new Label();
      textLabel.text = item.text;
      textLabel.fontSize = 13;
      textLabel.color = new Color(item.completed ? '#888888' : '#e0e0e0');
      textLabel.textDecoration = item.completed ? 'line-through' : 'none';
      textLabel.textWrap = true;
      textLabel.verticalAlignment = 'middle';
      GridLayout.setColumn(textLabel, 2);
      row.addChild(textLabel);
    }

    // Actions
    if (!readOnly && isSelected) {
      const actionsRow = new StackLayout();
      actionsRow.orientation = 'horizontal';
      actionsRow.verticalAlignment = 'middle';

      if (item.level > 0) {
        const outdentBtn = new Button();
        outdentBtn.text = '\u21E4';
        outdentBtn.fontSize = 10;
        outdentBtn.width = 24;
        outdentBtn.height = 24;
        outdentBtn.on('tap', () => onItemOutdent?.(item.id));
        actionsRow.addChild(outdentBtn);
      }

      if (item.level < maxDepth) {
        const indentBtn = new Button();
        indentBtn.text = '\u21E5';
        indentBtn.fontSize = 10;
        indentBtn.width = 24;
        indentBtn.height = 24;
        indentBtn.on('tap', () => onItemIndent?.(item.id));
        actionsRow.addChild(indentBtn);
      }

      const addBtn = new Button();
      addBtn.text = '+';
      addBtn.fontSize = 10;
      addBtn.width = 24;
      addBtn.height = 24;
      addBtn.on('tap', () => onItemAdd?.(item.id));
      actionsRow.addChild(addBtn);

      const deleteBtn = new Button();
      deleteBtn.text = '\u2716';
      deleteBtn.fontSize = 10;
      deleteBtn.width = 24;
      deleteBtn.height = 24;
      deleteBtn.on('tap', () => onItemDelete?.(item.id));
      actionsRow.addChild(deleteBtn);

      GridLayout.setColumn(actionsRow, 3);
      row.addChild(actionsRow);
    }

    row.on(GestureTypes.tap as any, () => onItemSelect?.(item.id));
    itemList.addChild(row);
  });

  // Empty state
  if (items.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'Empty outline. Add an item to begin.';
    emptyLabel.opacity = 0.4;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 20;
    itemList.addChild(emptyLabel);

    if (!readOnly) {
      const addBtn = new Button();
      addBtn.text = '+ Add Item';
      addBtn.horizontalAlignment = 'center';
      addBtn.marginTop = 8;
      addBtn.on('tap', () => onItemAdd?.(''));
      itemList.addChild(addBtn);
    }
  }

  scrollView.content = itemList;
  container.addChild(scrollView);

  return container;
}

export default createOutliner;
