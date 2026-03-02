// ============================================================
// Clef Surface NativeScript Widget — LayoutContainer
//
// NativeScript layout component that implements Clef Surface
// layout kinds (stack, grid, split, overlay, flow, sidebar,
// center) using NativeScript's StackLayout, GridLayout,
// FlexboxLayout, AbsoluteLayout, and WrapLayout.
// ============================================================

import {
  StackLayout,
  GridLayout,
  FlexboxLayout,
  WrapLayout,
  AbsoluteLayout,
  DockLayout,
  View,
} from '@nativescript/core';

// --------------- Layout Kinds ---------------

export type LayoutKind = 'stack' | 'row' | 'grid' | 'split' | 'overlay' | 'flow' | 'sidebar' | 'center';

// --------------- Props ---------------

export interface LayoutContainerProps {
  kind?: LayoutKind;
  gap?: number;
  padding?: number;
  gridColumns?: number;
  splitRatio?: number;
  sidebarWidth?: number;
  sidebarPosition?: 'start' | 'end';
}

// --------------- Component ---------------

export function createLayoutContainer(props: LayoutContainerProps = {}): View {
  const {
    kind = 'stack',
    gap = 8,
    padding = 0,
    gridColumns = 2,
    splitRatio = 0.5,
    sidebarWidth = 240,
    sidebarPosition = 'start',
  } = props;

  switch (kind) {
    case 'stack': {
      const layout = new StackLayout();
      layout.className = 'clef-layout clef-layout-stack';
      layout.padding = padding;
      return layout;
    }
    case 'row': {
      const layout = new FlexboxLayout();
      layout.className = 'clef-layout clef-layout-row';
      layout.flexDirection = 'row';
      layout.padding = padding;
      return layout;
    }
    case 'grid': {
      const layout = new GridLayout();
      layout.className = 'clef-layout clef-layout-grid';
      const cols = Array(gridColumns).fill('*').join(', ');
      layout.columns = cols;
      layout.padding = padding;
      return layout;
    }
    case 'split': {
      const layout = new GridLayout();
      layout.className = 'clef-layout clef-layout-split';
      const leftStar = Math.round(splitRatio * 10);
      const rightStar = 10 - leftStar;
      layout.columns = `${leftStar}*, ${rightStar}*`;
      layout.padding = padding;
      return layout;
    }
    case 'overlay': {
      const layout = new AbsoluteLayout();
      layout.className = 'clef-layout clef-layout-overlay';
      layout.padding = padding;
      return layout;
    }
    case 'flow': {
      const layout = new WrapLayout();
      layout.className = 'clef-layout clef-layout-flow';
      layout.orientation = 'horizontal';
      layout.padding = padding;
      return layout;
    }
    case 'sidebar': {
      const layout = new GridLayout();
      layout.className = 'clef-layout clef-layout-sidebar';
      if (sidebarPosition === 'start') {
        layout.columns = `${sidebarWidth}, *`;
      } else {
        layout.columns = `*, ${sidebarWidth}`;
      }
      layout.padding = padding;
      return layout;
    }
    case 'center': {
      const layout = new FlexboxLayout();
      layout.className = 'clef-layout clef-layout-center';
      layout.justifyContent = 'center';
      layout.alignItems = 'center';
      layout.padding = padding;
      return layout;
    }
    default: {
      const layout = new StackLayout();
      layout.className = 'clef-layout';
      layout.padding = padding;
      return layout;
    }
  }
}

createLayoutContainer.displayName = 'LayoutContainer';
export default createLayoutContainer;
