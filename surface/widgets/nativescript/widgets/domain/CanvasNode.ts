// ============================================================
// Clef Surface NativeScript Widget — CanvasNode
//
// Draggable node on a canvas surface. Supports multiple shape
// types, inline label editing, resize handles, and selection.
// Positioned absolutely within a parent canvas layout.
// ============================================================

import {
  StackLayout,
  GridLayout,
  AbsoluteLayout,
  Label,
  TextField,
  Button,
  Color,
  GestureTypes,
} from '@nativescript/core';

// --------------- Types ---------------

export type CanvasNodeType = 'sticky' | 'rectangle' | 'ellipse' | 'diamond' | 'text' | 'frame';

export interface CanvasNodeProps {
  id: string;
  type?: CanvasNodeType;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  label?: string;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  rotation?: number;
  locked?: boolean;
  visible?: boolean;
  opacity?: number;
  selected?: boolean;
  editing?: boolean;
  accentColor?: string;
  children?: import('@nativescript/core').View[];
  onSelect?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onLabelChange?: (id: string, value: string) => void;
  onDragStart?: (id: string) => void;
  onResizeStart?: (id: string, handle: string) => void;
}

// --------------- Helpers ---------------

const SHAPE_BORDERS: Record<CanvasNodeType, number> = {
  sticky: 0, rectangle: 1, ellipse: 1, diamond: 2, text: 0, frame: 2,
};

const SHAPE_BG: Record<CanvasNodeType, string> = {
  sticky: '#fef08a', rectangle: '#ffffff', ellipse: '#ffffff',
  diamond: '#e0f2fe', text: '#00000000', frame: '#00000010',
};

const HANDLE_POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;

// --------------- Component ---------------

export function createCanvasNode(props: CanvasNodeProps): StackLayout {
  const {
    id,
    type = 'rectangle',
    position = { x: 0, y: 0 },
    size = { width: 200, height: 100 },
    label,
    color,
    borderColor = '#000000',
    borderWidth = SHAPE_BORDERS[type] ?? 1,
    locked = false,
    visible = true,
    opacity = 1,
    selected = false,
    editing = false,
    accentColor = '#06b6d4',
    children = [],
    onSelect,
    onEdit,
    onDelete,
    onLabelChange,
    onDragStart,
    onResizeStart,
  } = props;

  if (!visible) {
    const hidden = new StackLayout();
    hidden.visibility = 'collapse';
    return hidden;
  }

  const container = new StackLayout();
  container.className = `clef-canvas-node clef-canvas-node-${type}`;
  container.width = size.width;
  container.height = size.height;
  container.opacity = opacity;
  container.backgroundColor = new Color(color || SHAPE_BG[type] || '#ffffff');
  container.borderWidth = selected ? 2 : borderWidth;
  container.borderColor = new Color(selected ? accentColor : borderColor);

  // Shape-specific styling
  if (type === 'ellipse') {
    container.borderRadius = Math.min(size.width, size.height) / 2;
  } else if (type === 'sticky') {
    container.borderRadius = 2;
    container.backgroundColor = new Color(color || '#fef08a');
  } else if (type === 'diamond') {
    container.borderRadius = 4;
  } else if (type === 'frame') {
    container.borderRadius = 0;
    container.borderWidth = 2;
    container.borderColor = new Color(selected ? accentColor : '#888888');
    container.backgroundColor = new Color('#00000008');
  } else {
    container.borderRadius = 4;
  }

  container.padding = 8;

  // Type indicator
  const typeIndicator = new Label();
  typeIndicator.text = type;
  typeIndicator.fontSize = 9;
  typeIndicator.opacity = 0.3;
  typeIndicator.marginBottom = 2;
  container.addChild(typeIndicator);

  // Label
  if (label !== undefined) {
    if (editing && !locked) {
      const labelField = new TextField();
      labelField.text = label;
      labelField.color = new Color(type === 'sticky' ? '#000000' : '#333333');
      labelField.fontSize = 13;
      labelField.backgroundColor = new Color('#00000000');
      labelField.borderBottomWidth = 1;
      labelField.borderBottomColor = new Color(accentColor);
      labelField.on('textChange', (args: any) => {
        onLabelChange?.(id, args.object.text);
      });
      container.addChild(labelField);
    } else {
      const labelView = new Label();
      labelView.text = label;
      labelView.textWrap = true;
      labelView.color = new Color(type === 'sticky' ? '#000000' : '#333333');
      labelView.fontSize = 13;
      container.addChild(labelView);
    }
  }

  // Children
  children.forEach((child) => {
    container.addChild(child);
  });

  // Resize handles (shown when selected)
  if (selected && !locked) {
    const handlesRow = new StackLayout();
    handlesRow.orientation = 'horizontal';
    handlesRow.horizontalAlignment = 'right';
    handlesRow.marginTop = 4;

    HANDLE_POSITIONS.forEach((pos) => {
      const handle = new Label();
      handle.text = '\u25AA';
      handle.fontSize = 8;
      handle.color = new Color(accentColor);
      handle.marginRight = 2;
      handle.on(GestureTypes.tap as any, () => onResizeStart?.(id, pos));
      handlesRow.addChild(handle);
    });

    container.addChild(handlesRow);
  }

  // Lock indicator
  if (locked) {
    const lockLabel = new Label();
    lockLabel.text = '\uD83D\uDD12';
    lockLabel.fontSize = 10;
    lockLabel.horizontalAlignment = 'right';
    lockLabel.opacity = 0.5;
    container.addChild(lockLabel);
  }

  // Interactions
  container.on(GestureTypes.tap as any, () => onSelect?.(id));
  container.on(GestureTypes.doubleTap as any, () => {
    if (!locked) onEdit?.(id);
  });

  if (!locked) {
    container.on(GestureTypes.pan as any, () => onDragStart?.(id));
  }

  return container;
}

export default createCanvasNode;
