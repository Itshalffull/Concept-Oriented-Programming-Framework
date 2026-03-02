// ============================================================
// Clef Surface NativeScript Widget — TreeSelect
//
// Hierarchical tree selection control that renders a collapsible
// tree structure with checkboxes, expand/collapse toggles, a
// search filter field, and breadcrumb display of the current
// selection path. Supports single and multi-select modes.
//
// Adapts the tree-select.widget spec: anatomy (root, node,
// expandToggle, checkbox, searchInput, breadcrumb), states
// (expanded, collapsed, selected, indeterminate, disabled),
// and connect attributes to NativeScript nested StackLayouts.
// ============================================================

import {
  StackLayout,
  GridLayout,
  ScrollView,
  Label,
  TextField,
  Button,
} from '@nativescript/core';

// --------------- Props ---------------

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  disabled?: boolean;
}

export interface TreeSelectProps {
  nodes?: TreeNode[];
  selected?: string[];
  multiSelect?: boolean;
  searchable?: boolean;
  placeholder?: string;
  enabled?: boolean;
  onSelectionChange?: (selected: string[]) => void;
}

// --------------- Component ---------------

/**
 * Creates a NativeScript tree select with collapsible node
 * hierarchy, checkbox selection, search filtering, and
 * breadcrumb selection display.
 */
export function createTreeSelect(props: TreeSelectProps = {}): StackLayout {
  const {
    nodes = [],
    selected: initialSelected = [],
    multiSelect = true,
    searchable = true,
    placeholder = 'Search tree...',
    enabled = true,
    onSelectionChange,
  } = props;

  const selectedIds = new Set<string>(initialSelected);
  const expandedIds = new Set<string>();
  let searchQuery = '';

  const container = new StackLayout();
  container.className = 'clef-widget-tree-select';
  container.padding = 8;

  // -- Selection breadcrumb --
  const breadcrumb = new StackLayout();
  breadcrumb.orientation = 'horizontal';
  breadcrumb.marginBottom = 8;

  function findNodeLabel(id: string, nodeList: TreeNode[]): string {
    for (const node of nodeList) {
      if (node.id === id) return node.label;
      if (node.children) {
        const found = findNodeLabel(id, node.children);
        if (found) return found;
      }
    }
    return '';
  }

  function renderBreadcrumb(): void {
    breadcrumb.removeChildren();
    if (selectedIds.size === 0) {
      const emptyLabel = new Label();
      emptyLabel.text = 'No selection';
      emptyLabel.opacity = 0.5;
      emptyLabel.fontSize = 12;
      breadcrumb.addChild(emptyLabel);
      return;
    }

    const ids = Array.from(selectedIds);
    ids.forEach((id, index) => {
      const label = findNodeLabel(id, nodes);
      if (!label) return;

      const chip = new Label();
      chip.text = label;
      chip.fontSize = 11;
      chip.backgroundColor = '#E3F2FD' as any;
      chip.color = '#1565C0' as any;
      chip.borderRadius = 10;
      chip.padding = 4;
      chip.marginRight = 4;

      if (enabled) {
        chip.on('tap', () => {
          selectedIds.delete(id);
          renderBreadcrumb();
          renderTree();
          if (onSelectionChange) onSelectionChange(Array.from(selectedIds));
        });
      }

      breadcrumb.addChild(chip);
    });
  }

  container.addChild(breadcrumb);

  // -- Search field --
  let searchField: TextField | null = null;
  if (searchable) {
    searchField = new TextField();
    searchField.hint = placeholder;
    searchField.isEnabled = enabled;
    searchField.borderWidth = 1;
    searchField.borderColor = '#CCCCCC';
    searchField.borderRadius = 4;
    searchField.padding = 8;
    searchField.fontSize = 13;
    searchField.marginBottom = 8;

    searchField.on('textChange', () => {
      searchQuery = (searchField as TextField).text.toLowerCase();
      renderTree();
    });

    container.addChild(searchField);
  }

  // -- Tree container --
  const treeScroll = new ScrollView();
  treeScroll.height = 280;

  const treeContainer = new StackLayout();
  treeScroll.content = treeContainer;
  container.addChild(treeScroll);

  function nodeMatchesSearch(node: TreeNode): boolean {
    if (!searchQuery) return true;
    if (node.label.toLowerCase().includes(searchQuery)) return true;
    if (node.children) {
      return node.children.some(child => nodeMatchesSearch(child));
    }
    return false;
  }

  function renderNodeList(nodeList: TreeNode[], depth: number, parentContainer: StackLayout): void {
    nodeList.forEach((node) => {
      if (!nodeMatchesSearch(node)) return;

      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedIds.has(node.id);
      const isSelected = selectedIds.has(node.id);
      const isDisabled = node.disabled || !enabled;

      // Node row
      const row = new GridLayout();
      row.columns = 'auto, auto, *';
      row.rows = 'auto';
      row.paddingLeft = depth * 20;
      row.paddingTop = 4;
      row.paddingBottom = 4;
      row.paddingRight = 4;

      // Expand/collapse toggle
      const toggle = new Label();
      if (hasChildren) {
        toggle.text = isExpanded ? '\u25BC' : '\u25B6';
        toggle.fontSize = 10;
        toggle.opacity = 0.6;
        toggle.width = 20;
        toggle.verticalAlignment = 'middle';
        if (!isDisabled) {
          toggle.on('tap', () => {
            if (isExpanded) {
              expandedIds.delete(node.id);
            } else {
              expandedIds.add(node.id);
            }
            renderTree();
          });
        }
      } else {
        toggle.text = '';
        toggle.width = 20;
      }
      toggle.col = 0;
      row.addChild(toggle);

      // Checkbox
      const checkbox = new Label();
      checkbox.text = isSelected ? '\u2611' : '\u2610';
      checkbox.fontSize = 18;
      checkbox.marginRight = 6;
      checkbox.verticalAlignment = 'middle';
      checkbox.col = 1;
      checkbox.color = (isSelected ? '#2196F3' : '#757575') as any;

      if (!isDisabled) {
        checkbox.on('tap', () => {
          if (isSelected) {
            selectedIds.delete(node.id);
          } else {
            if (!multiSelect) selectedIds.clear();
            selectedIds.add(node.id);
          }
          renderBreadcrumb();
          renderTree();
          if (onSelectionChange) onSelectionChange(Array.from(selectedIds));
        });
      }
      row.addChild(checkbox);

      // Label
      const nodeLabel = new Label();
      nodeLabel.text = node.label;
      nodeLabel.fontSize = 14;
      nodeLabel.verticalAlignment = 'middle';
      nodeLabel.col = 2;
      if (isDisabled) nodeLabel.opacity = 0.4;
      if (isSelected) {
        nodeLabel.fontWeight = 'bold';
        nodeLabel.color = '#1565C0' as any;
      }

      if (!isDisabled) {
        nodeLabel.on('tap', () => {
          if (hasChildren) {
            if (isExpanded) {
              expandedIds.delete(node.id);
            } else {
              expandedIds.add(node.id);
            }
          }
          if (isSelected) {
            selectedIds.delete(node.id);
          } else {
            if (!multiSelect) selectedIds.clear();
            selectedIds.add(node.id);
          }
          renderBreadcrumb();
          renderTree();
          if (onSelectionChange) onSelectionChange(Array.from(selectedIds));
        });
      }
      row.addChild(nodeLabel);

      parentContainer.addChild(row);

      // Render children if expanded
      if (hasChildren && isExpanded) {
        renderNodeList(node.children!, depth + 1, parentContainer);
      }
    });
  }

  function renderTree(): void {
    treeContainer.removeChildren();

    if (nodes.length === 0) {
      const emptyLabel = new Label();
      emptyLabel.text = 'No items';
      emptyLabel.opacity = 0.5;
      emptyLabel.horizontalAlignment = 'center';
      emptyLabel.padding = 20;
      treeContainer.addChild(emptyLabel);
      return;
    }

    renderNodeList(nodes, 0, treeContainer);
  }

  // -- Action row --
  const actionRow = new GridLayout();
  actionRow.columns = '*, *';
  actionRow.rows = 'auto';
  actionRow.marginTop = 8;

  const expandAllBtn = new Button();
  expandAllBtn.text = 'Expand All';
  expandAllBtn.fontSize = 12;
  expandAllBtn.col = 0;
  expandAllBtn.on('tap', () => {
    function collectIds(list: TreeNode[]): void {
      list.forEach((n) => {
        if (n.children && n.children.length > 0) {
          expandedIds.add(n.id);
          collectIds(n.children);
        }
      });
    }
    collectIds(nodes);
    renderTree();
  });
  actionRow.addChild(expandAllBtn);

  const collapseAllBtn = new Button();
  collapseAllBtn.text = 'Collapse All';
  collapseAllBtn.fontSize = 12;
  collapseAllBtn.col = 1;
  collapseAllBtn.on('tap', () => {
    expandedIds.clear();
    renderTree();
  });
  actionRow.addChild(collapseAllBtn);

  container.addChild(actionRow);

  renderBreadcrumb();
  renderTree();

  if (!enabled) {
    container.opacity = 0.38;
  }

  return container;
}

createTreeSelect.displayName = 'TreeSelect';
export default createTreeSelect;
