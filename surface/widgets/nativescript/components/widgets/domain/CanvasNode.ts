// ============================================================
// Clef Surface NativeScript Widget — CanvasNode
//
// Draggable node on a canvas with ports and content.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface CanvasNodeProps {
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  title?: string;
  selected?: boolean;
  onMove?: (x: number, y: number) => void;
  onSelect?: () => void;
  children?: View[];
}

export function createCanvasNode(props: CanvasNodeProps): StackLayout {
  const { id, x = 0, y = 0, width = 200, height, title = 'Node', selected = false, onMove, onSelect, children = [] } = props;
  const container = new StackLayout();
  container.className = `clef-widget-canvas-node${selected ? ' clef-selected' : ''}`;
  container.width = width;
  if (height) container.height = height;
  const titleLabel = new Label();
  titleLabel.text = title;
  titleLabel.fontWeight = 'bold';
  titleLabel.padding = '4 8';
  container.addChild(titleLabel);
  for (const child of children) container.addChild(child);
  container.on('tap', () => onSelect?.());
  return container;
}

export default createCanvasNode;
