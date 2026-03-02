// ============================================================
// Clef Surface NativeScript Widget — BlockEditor
//
// Block-based content editor. Renders a vertical list of typed
// content blocks with drag handles, slash-command support, and
// per-block type labels. Each block is selectable and editable.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  TextField,
  Button,
  Color,
  ScrollView,
  GestureTypes,
} from '@nativescript/core';

// --------------- Types ---------------

export interface BlockDef {
  id: string;
  type: string;
  content?: string;
  children?: BlockDef[];
}

export interface BlockEditorProps {
  blocks?: BlockDef[];
  readOnly?: boolean;
  placeholder?: string;
  blockTypes?: string[];
  showSlashMenu?: boolean;
  selectedBlockId?: string;
  accentColor?: string;
  onBlocksChange?: (blocks: BlockDef[]) => void;
  onBlockSelect?: (id: string) => void;
  onBlockTypeSelect?: (type: string) => void;
  onBlockDelete?: (id: string) => void;
  onBlockAdd?: (afterId: string, type: string) => void;
}

// --------------- Helpers ---------------

const BLOCK_ICONS: Record<string, string> = {
  paragraph: '\u00B6', heading: 'H', image: '\uD83D\uDDBC',
  code: '</>', quote: '\u201C', list: '\u2022', divider: '\u2500',
  table: '\u2637', callout: '\u2139', toggle: '\u25B6',
};

// --------------- Component ---------------

export function createBlockEditor(props: BlockEditorProps = {}): StackLayout {
  const {
    blocks = [],
    readOnly = false,
    placeholder = "Type '/' for commands...",
    blockTypes = ['paragraph', 'heading', 'code', 'quote', 'list', 'image', 'divider'],
    showSlashMenu = false,
    selectedBlockId,
    accentColor = '#06b6d4',
    onBlocksChange,
    onBlockSelect,
    onBlockTypeSelect,
    onBlockDelete,
    onBlockAdd,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-block-editor';
  container.padding = 4;

  // Toolbar
  const toolbar = new StackLayout();
  toolbar.orientation = 'horizontal';
  toolbar.padding = 4;
  toolbar.marginBottom = 4;
  toolbar.backgroundColor = new Color('#1a1a2e');
  toolbar.borderRadius = 4;

  const titleLabel = new Label();
  titleLabel.text = '\u270E Block Editor';
  titleLabel.fontWeight = 'bold';
  titleLabel.color = new Color(accentColor);
  titleLabel.marginRight = 12;
  toolbar.addChild(titleLabel);

  const blockCountLabel = new Label();
  blockCountLabel.text = `${blocks.length} blocks`;
  blockCountLabel.fontSize = 11;
  blockCountLabel.opacity = 0.5;
  toolbar.addChild(blockCountLabel);

  container.addChild(toolbar);

  // Block list
  const scrollView = new ScrollView();
  const blockList = new StackLayout();
  blockList.className = 'clef-block-editor-blocks';

  blocks.forEach((block, index) => {
    const isSelected = block.id === selectedBlockId;

    const row = new GridLayout();
    row.columns = 'auto, *, auto';
    row.padding = 6;
    row.marginBottom = 2;
    row.borderRadius = 4;
    row.borderWidth = isSelected ? 2 : 1;
    row.borderColor = new Color(isSelected ? accentColor : '#333333');
    row.backgroundColor = new Color(isSelected ? '#1a2a3a' : '#0d0d1a');

    // Drag handle
    if (!readOnly) {
      const handle = new Label();
      handle.text = '\u2630';
      handle.fontSize = 14;
      handle.opacity = 0.4;
      handle.verticalAlignment = 'middle';
      handle.marginRight = 6;
      GridLayout.setColumn(handle, 0);
      row.addChild(handle);
    }

    // Block content area
    const contentStack = new StackLayout();

    // Type badge
    const typeBadge = new StackLayout();
    typeBadge.orientation = 'horizontal';
    typeBadge.marginBottom = 2;

    const typeIcon = new Label();
    typeIcon.text = BLOCK_ICONS[block.type] || '\u25A1';
    typeIcon.fontSize = 10;
    typeIcon.marginRight = 4;
    typeIcon.opacity = 0.5;
    typeBadge.addChild(typeIcon);

    const typeLabel = new Label();
    typeLabel.text = block.type;
    typeLabel.fontSize = 10;
    typeLabel.opacity = 0.5;
    typeBadge.addChild(typeLabel);

    contentStack.addChild(typeBadge);

    // Content
    if (readOnly) {
      const contentLabel = new Label();
      contentLabel.text = block.content || '';
      contentLabel.textWrap = true;
      contentLabel.color = new Color('#e0e0e0');
      contentStack.addChild(contentLabel);
    } else {
      const contentField = new TextField();
      contentField.text = block.content || '';
      contentField.hint = placeholder;
      contentField.color = new Color('#e0e0e0');
      contentField.backgroundColor = new Color('#00000000');
      contentField.borderBottomWidth = 0;
      contentStack.addChild(contentField);
    }

    // Children blocks (nested)
    if (block.children && block.children.length > 0) {
      const childContainer = new StackLayout();
      childContainer.marginLeft = 16;
      childContainer.marginTop = 4;
      childContainer.borderLeftWidth = 2;
      childContainer.borderLeftColor = new Color('#444444');
      childContainer.paddingLeft = 8;

      block.children.forEach((child) => {
        const childLabel = new Label();
        childLabel.text = `${BLOCK_ICONS[child.type] || '\u25A1'} ${child.content || '(empty)'}`;
        childLabel.fontSize = 12;
        childLabel.opacity = 0.7;
        childContainer.addChild(childLabel);
      });

      contentStack.addChild(childContainer);
    }

    GridLayout.setColumn(contentStack, 1);
    row.addChild(contentStack);

    // Delete button
    if (!readOnly) {
      const deleteBtn = new Button();
      deleteBtn.text = '\u2716';
      deleteBtn.fontSize = 10;
      deleteBtn.width = 24;
      deleteBtn.height = 24;
      deleteBtn.verticalAlignment = 'top';
      deleteBtn.on('tap', () => onBlockDelete?.(block.id));
      GridLayout.setColumn(deleteBtn, 2);
      row.addChild(deleteBtn);
    }

    row.on(GestureTypes.tap as any, () => onBlockSelect?.(block.id));
    blockList.addChild(row);
  });

  // Empty state
  if (blocks.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = placeholder;
    emptyLabel.opacity = 0.4;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 20;
    blockList.addChild(emptyLabel);
  }

  // Slash menu overlay
  if (showSlashMenu) {
    const menuContainer = new StackLayout();
    menuContainer.backgroundColor = new Color('#1e1e3a');
    menuContainer.borderRadius = 6;
    menuContainer.padding = 8;
    menuContainer.marginTop = 4;
    menuContainer.borderWidth = 1;
    menuContainer.borderColor = new Color('#444444');

    const menuTitle = new Label();
    menuTitle.text = 'Insert Block';
    menuTitle.fontWeight = 'bold';
    menuTitle.fontSize = 12;
    menuTitle.marginBottom = 4;
    menuContainer.addChild(menuTitle);

    blockTypes.forEach((bt) => {
      const itemBtn = new Button();
      itemBtn.text = `${BLOCK_ICONS[bt] || '\u25A1'} ${bt}`;
      itemBtn.horizontalAlignment = 'left';
      itemBtn.fontSize = 13;
      itemBtn.on('tap', () => onBlockTypeSelect?.(bt));
      menuContainer.addChild(itemBtn);
    });

    blockList.addChild(menuContainer);
  }

  // Add block button
  if (!readOnly) {
    const addBtn = new Button();
    addBtn.text = '+ Add Block';
    addBtn.horizontalAlignment = 'center';
    addBtn.marginTop = 8;
    addBtn.on('tap', () => {
      const lastId = blocks.length > 0 ? blocks[blocks.length - 1].id : '';
      onBlockAdd?.(lastId, 'paragraph');
    });
    blockList.addChild(addBtn);
  }

  scrollView.content = blockList;
  container.addChild(scrollView);

  return container;
}

export default createBlockEditor;
