// ============================================================
// Clef Surface NativeScript Widget — SurfaceRoot
//
// Root application shell for NativeScript. Manages the top-level
// rendering context: action bar, status bar, navigation, and
// provider initialization. Wraps content in a page-level
// container with lifecycle management.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  ActionBar,
  ActionItem,
  Frame,
  Page,
  Color,
  Screen,
  View,
} from '@nativescript/core';

// --------------- Types ---------------

export type SurfaceState = 'idle' | 'active' | 'suspended' | 'destroyed';

export interface SurfaceStatus {
  state: SurfaceState;
  width: number;
  height: number;
  surfaceKind: string;
}

// --------------- Context ---------------

let _surfaceContext: SurfaceContextValue | null = null;

export interface SurfaceContextValue {
  status: SurfaceStatus;
  title?: string;
  navigate: (route: string) => void;
}

export function getSurface(): SurfaceContextValue {
  if (!_surfaceContext) {
    throw new Error('getSurface must be called within a SurfaceRoot scope.');
  }
  return _surfaceContext;
}

export function getSurfaceSize(): { width: number; height: number } {
  const ctx = getSurface();
  return { width: ctx.status.width, height: ctx.status.height };
}

// --------------- Props ---------------

export interface SurfaceRootProps {
  title?: string;
  children?: View[];
  showStatusBar?: boolean;
  statusBarContent?: string;
  showActionBar?: boolean;
  actionBarItems?: Array<{ text: string; icon?: string; onTap: () => void }>;
  backgroundColor?: string;
  foregroundColor?: string;
  accentColor?: string;
  width?: number;
  height?: number;
  onNavigate?: (route: string) => void;
}

// --------------- Component ---------------

export function createSurfaceRoot(props: SurfaceRootProps): StackLayout {
  const {
    title = 'Clef Surface',
    children = [],
    showStatusBar = false,
    statusBarContent,
    showActionBar = true,
    actionBarItems = [],
    backgroundColor = '#ffffff',
    foregroundColor = '#000000',
    accentColor = '#06b6d4',
    width: overrideWidth,
    height: overrideHeight,
    onNavigate,
  } = props;

  const screenWidth = overrideWidth || Screen.mainScreen.widthDIPs;
  const screenHeight = overrideHeight || Screen.mainScreen.heightDIPs;

  // Initialize context
  _surfaceContext = {
    status: {
      state: 'active',
      width: screenWidth,
      height: screenHeight,
      surfaceKind: 'mobile',
    },
    title,
    navigate: (route: string) => {
      onNavigate?.(route);
    },
  };

  const root = new StackLayout();
  root.className = 'clef-surface-root';
  root.backgroundColor = new Color(backgroundColor);
  if (overrideWidth) root.width = overrideWidth;
  if (overrideHeight) root.height = overrideHeight;

  // Action bar simulation
  if (showActionBar) {
    const actionBar = new StackLayout();
    actionBar.orientation = 'horizontal';
    actionBar.padding = 8;
    actionBar.backgroundColor = new Color(accentColor);
    actionBar.height = 48;

    const titleLabel = new Label();
    titleLabel.text = title;
    titleLabel.fontWeight = 'bold';
    titleLabel.fontSize = 18;
    titleLabel.color = new Color('#ffffff');
    titleLabel.verticalAlignment = 'middle';
    actionBar.addChild(titleLabel);

    // Action items
    actionBarItems.forEach((item) => {
      const btn = new Label();
      btn.text = item.icon || item.text;
      btn.color = new Color('#ffffff');
      btn.marginLeft = 16;
      btn.verticalAlignment = 'middle';
      btn.on('tap', item.onTap);
      actionBar.addChild(btn);
    });

    root.addChild(actionBar);
  }

  // Content area
  const contentArea = new StackLayout();
  contentArea.className = 'clef-surface-content';
  contentArea.padding = 8;

  for (const child of children) {
    contentArea.addChild(child);
  }

  root.addChild(contentArea);

  // Status bar
  if (showStatusBar) {
    const statusBar = new StackLayout();
    statusBar.orientation = 'horizontal';
    statusBar.padding = 4;
    statusBar.backgroundColor = new Color('#1a1a2e');

    // Surface kind
    const kindLabel = new Label();
    kindLabel.text = '\u25A0 mobile';
    kindLabel.color = new Color(accentColor);
    kindLabel.fontSize = 11;
    statusBar.addChild(kindLabel);

    // Dimensions
    const dimLabel = new Label();
    dimLabel.text = ` ${screenWidth}\u00D7${screenHeight}`;
    dimLabel.opacity = 0.5;
    dimLabel.fontSize = 11;
    dimLabel.marginLeft = 8;
    statusBar.addChild(dimLabel);

    // Custom status content
    if (statusBarContent) {
      const customLabel = new Label();
      customLabel.text = ` | ${statusBarContent}`;
      customLabel.opacity = 0.5;
      customLabel.fontSize = 11;
      statusBar.addChild(customLabel);
    }

    root.addChild(statusBar);
  }

  return root;
}

export default createSurfaceRoot;
