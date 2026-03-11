// ============================================================
// Clef Surface NativeScript Widget — TreeSelect
//
// Hierarchical tree selection with expandable nodes.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  disabled?: boolean;
}

export interface TreeSelectProps {
  nodes: TreeNode[];
  value?: string[];
  multiple?: boolean;
  expandedIds?: string[];
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  onChange?: (values: string[]) => void;
  onExpand?: (id: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function createTreeSelect(props: TreeSelectProps): StackLayout {
  const {
    nodes, value = [], multiple = false,
    expandedIds = [], disabled = false,
    label, placeholder = 'Select...', onChange, onExpand, size = 'md',
  } = props;

  let selectedValues = [...value];
  const container = new StackLayout();
  container.className = `clef-widget-tree-select clef-size-${size}`;

  if (label) {
    const lbl = new Label();
    lbl.text = label;
    container.addChild(lbl);
  }

  function renderNode(node, depth) {
    const row = new StackLayout();
    row.orientation = 'horizontal';
    row.paddingLeft = depth * 16;
    row.padding = `4 4 4 ${depth * 16}`;

    if (node.children && node.children.length > 0) {
      const expander = new Label();
      expander.text = expandedIds.includes(node.id) ? '\u25BC' : '\u25B6';
      expander.marginRight = 4;
      expander.on('tap', () => onExpand?.(node.id));
      row.addChild(expander);
    }

    const isSelected = selectedValues.includes(node.id);
    const indicator = new Label();
    indicator.text = isSelected ? '\u2611' : '\u2610';
    indicator.marginRight = 4;
    row.addChild(indicator);

    const nodeLabel = new Label();
    nodeLabel.text = node.label;
    if (node.disabled || disabled) nodeLabel.opacity = 0.5;
    row.addChild(nodeLabel);

    if (!node.disabled && !disabled) {
      row.on('tap', () => {
        if (isSelected) {
          selectedValues = selectedValues.filter(v => v !== node.id);
        } else {
          if (!multiple) selectedValues = [node.id];
          else selectedValues = [...selectedValues, node.id];
        }
        onChange?.(selectedValues);
      });
    }

    container.addChild(row);

    if (node.children && expandedIds.includes(node.id)) {
      for (const child of node.children) {
        renderNode(child, depth + 1);
      }
    }
  }

  for (const node of nodes) renderNode(node, 0);
  return container;
}

export default createTreeSelect;
