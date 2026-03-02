// ============================================================
// Clef Surface NativeScript Widget — DragHandle
//
// Drag handle indicator for reorderable items. Renders a grip
// icon that responds to pan gestures and provides visual
// feedback for idle, hover, grabbed, and dragging states.
// ============================================================

import {
  StackLayout,
  Label,
  Color,
  GestureTypes,
} from '@nativescript/core';

// --------------- Types ---------------

export type DragHandleState = 'idle' | 'hover' | 'grabbed' | 'dragging';

export interface DragHandleProps {
  orientation?: 'horizontal' | 'vertical';
  disabled?: boolean;
  icon?: string;
  size?: number;
  itemIndex?: number;
  accentColor?: string;
  onDragBegin?: () => void;
  onDragFinish?: () => void;
  onMove?: (direction: string) => void;
}

// --------------- Component ---------------

export function createDragHandle(props: DragHandleProps = {}): StackLayout {
  const {
    orientation = 'vertical',
    disabled = false,
    icon,
    size = 32,
    itemIndex,
    accentColor = '#06b6d4',
    onDragBegin,
    onDragFinish,
    onMove,
  } = props;

  let state: DragHandleState = 'idle';

  const container = new StackLayout();
  container.className = 'clef-drag-handle';
  container.width = size;
  container.height = size;
  container.horizontalAlignment = 'center';
  container.verticalAlignment = 'middle';
  container.borderRadius = 4;
  container.isUserInteractionEnabled = !disabled;

  const gripIcon = new Label();
  gripIcon.horizontalAlignment = 'center';
  gripIcon.verticalAlignment = 'middle';
  gripIcon.fontSize = size * 0.5;

  const updateVisuals = () => {
    const defaultIcon = orientation === 'vertical' ? '\u2630' : '\u2261';
    gripIcon.text = icon || defaultIcon;

    switch (state) {
      case 'idle':
        gripIcon.color = new Color(disabled ? '#444444' : '#888888');
        container.backgroundColor = new Color('#00000000');
        container.opacity = disabled ? 0.4 : 0.7;
        break;
      case 'hover':
        gripIcon.color = new Color(accentColor);
        container.backgroundColor = new Color('#ffffff10');
        container.opacity = 1;
        break;
      case 'grabbed':
        gripIcon.color = new Color(accentColor);
        container.backgroundColor = new Color('#ffffff20');
        container.opacity = 1;
        container.borderWidth = 1;
        container.borderColor = new Color(accentColor);
        break;
      case 'dragging':
        gripIcon.color = new Color('#ffffff');
        container.backgroundColor = new Color(accentColor);
        container.opacity = 1;
        break;
    }
  };

  updateVisuals();
  container.addChild(gripIcon);

  // Index label
  if (itemIndex !== undefined) {
    const indexLabel = new Label();
    indexLabel.text = String(itemIndex);
    indexLabel.fontSize = 8;
    indexLabel.opacity = 0.3;
    indexLabel.horizontalAlignment = 'center';
    container.addChild(indexLabel);
  }

  if (!disabled) {
    // Touch/pan interactions
    container.on(GestureTypes.tap as any, () => {
      if (state === 'idle' || state === 'hover') {
        state = 'grabbed';
        onDragBegin?.();
      } else {
        state = 'idle';
        onDragFinish?.();
      }
      updateVisuals();
    });

    container.on(GestureTypes.pan as any, (args: any) => {
      if (state === 'grabbed') {
        state = 'dragging';
        updateVisuals();
      }
      if (state === 'dragging') {
        const deltaX = args.deltaX ?? 0;
        const deltaY = args.deltaY ?? 0;
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          onMove?.(deltaY < 0 ? 'up' : 'down');
        } else {
          onMove?.(deltaX < 0 ? 'left' : 'right');
        }
        if (args.state === 3) { // GestureStateTypes.ended
          state = 'idle';
          onDragFinish?.();
          updateVisuals();
        }
      }
    });

    container.on(GestureTypes.touch as any, (args: any) => {
      if (args.action === 'down' && state === 'idle') {
        state = 'hover';
        updateVisuals();
      } else if (args.action === 'up' || args.action === 'cancel') {
        if (state === 'dragging') {
          onDragFinish?.();
        }
        state = 'idle';
        updateVisuals();
      }
    });
  }

  return container;
}

export default createDragHandle;
