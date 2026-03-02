// ============================================================
// Clef Surface NativeScript Widget — Splitter
//
// Resizable split panel for NativeScript. Renders two panes
// separated by a draggable divider. The divider can be
// oriented horizontally or vertically and supports a minimum
// size constraint for each pane.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  Color,
  GestureTypes,
  PanGestureEventData,
} from '@nativescript/core';

// --------------- Types ---------------

export type SplitterOrientation = 'horizontal' | 'vertical';

// --------------- Props ---------------

export interface SplitterProps {
  orientation?: SplitterOrientation;
  initialRatio?: number;
  minPaneSize?: number;
  dividerSize?: number;
  dividerColor?: string;
  dividerActiveColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  showGrip?: boolean;
  gripColor?: string;
}

// --------------- Component ---------------

export function createSplitter(props: SplitterProps = {}): GridLayout {
  const {
    orientation = 'horizontal',
    initialRatio = 0.5,
    minPaneSize = 50,
    dividerSize = 8,
    dividerColor = '#E5E7EB',
    dividerActiveColor = '#93C5FD',
    backgroundColor = '#FFFFFF',
    borderColor = '#E5E7EB',
    showGrip = true,
    gripColor = '#9CA3AF',
  } = props;

  const container = new GridLayout();
  container.className = `clef-splitter clef-splitter-${orientation}`;
  container.backgroundColor = new Color(backgroundColor);
  container.borderWidth = 1;
  container.borderColor = new Color(borderColor);

  const leftStar = Math.round(initialRatio * 100);
  const rightStar = 100 - leftStar;

  if (orientation === 'horizontal') {
    container.columns = `${leftStar}*, ${dividerSize}, ${rightStar}*`;
    container.rows = '*';
  } else {
    container.rows = `${leftStar}*, ${dividerSize}, ${rightStar}*`;
    container.columns = '*';
  }

  // First pane
  const pane1 = new StackLayout();
  pane1.className = 'clef-splitter-pane clef-splitter-pane-1';
  if (orientation === 'horizontal') {
    GridLayout.setColumn(pane1, 0);
    GridLayout.setRow(pane1, 0);
  } else {
    GridLayout.setRow(pane1, 0);
    GridLayout.setColumn(pane1, 0);
  }
  container.addChild(pane1);

  // Divider
  const divider = new StackLayout();
  divider.className = 'clef-splitter-divider';
  divider.backgroundColor = new Color(dividerColor);
  divider.verticalAlignment = 'stretch';
  divider.horizontalAlignment = 'stretch';

  if (orientation === 'horizontal') {
    GridLayout.setColumn(divider, 1);
    GridLayout.setRow(divider, 0);
  } else {
    GridLayout.setRow(divider, 1);
    GridLayout.setColumn(divider, 0);
  }

  // Grip indicator
  if (showGrip) {
    const grip = new Label();
    grip.text = orientation === 'horizontal' ? '\u22EE' : '\u22EF';
    grip.className = 'clef-splitter-grip';
    grip.color = new Color(gripColor);
    grip.fontSize = 14;
    grip.horizontalAlignment = 'center';
    grip.verticalAlignment = 'middle';
    divider.addChild(grip);
  }

  // Drag interaction for resizing
  let isDragging = false;

  divider.on(GestureTypes.pan, (args: PanGestureEventData) => {
    if (args.state === 1) {
      // Began
      isDragging = true;
      divider.backgroundColor = new Color(dividerActiveColor);
    } else if (args.state === 3) {
      // Ended
      isDragging = false;
      divider.backgroundColor = new Color(dividerColor);
    } else if (args.state === 2 && isDragging) {
      // Changed — adjust columns/rows
      const containerSize = orientation === 'horizontal'
        ? container.getMeasuredWidth()
        : container.getMeasuredHeight();

      if (containerSize > 0) {
        const delta = orientation === 'horizontal' ? args.deltaX : args.deltaY;
        const currentLeft = leftStar;
        const newLeft = Math.max(
          (minPaneSize / containerSize) * 100,
          Math.min(100 - (minPaneSize / containerSize) * 100, currentLeft + (delta / containerSize) * 100)
        );
        const newRight = 100 - newLeft;

        if (orientation === 'horizontal') {
          container.columns = `${Math.round(newLeft)}*, ${dividerSize}, ${Math.round(newRight)}*`;
        } else {
          container.rows = `${Math.round(newLeft)}*, ${dividerSize}, ${Math.round(newRight)}*`;
        }
      }
    }
  });

  container.addChild(divider);

  // Second pane
  const pane2 = new StackLayout();
  pane2.className = 'clef-splitter-pane clef-splitter-pane-2';
  if (orientation === 'horizontal') {
    GridLayout.setColumn(pane2, 2);
    GridLayout.setRow(pane2, 0);
  } else {
    GridLayout.setRow(pane2, 2);
    GridLayout.setColumn(pane2, 0);
  }
  container.addChild(pane2);

  return container;
}

createSplitter.displayName = 'Splitter';
export default createSplitter;
