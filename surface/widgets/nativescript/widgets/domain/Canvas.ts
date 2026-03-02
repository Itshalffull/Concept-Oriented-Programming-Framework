// ============================================================
// Clef Surface NativeScript Widget — Canvas
//
// Drawing and diagramming canvas. Provides a zoomable,
// pannable surface with tool selection, grid overlay, and
// viewport tracking. Child nodes are positioned absolutely
// within the canvas area.
// ============================================================

import {
  StackLayout,
  GridLayout,
  AbsoluteLayout,
  Label,
  Button,
  Color,
  GestureTypes,
} from '@nativescript/core';

// --------------- Types ---------------

export type CanvasTool = 'select' | 'hand' | 'draw' | 'erase' | 'text' | 'shape' | 'connector' | 'frame';

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasProps {
  width?: number;
  height?: number;
  viewport?: CanvasViewport;
  activeTool?: CanvasTool;
  showGrid?: boolean;
  gridSize?: number;
  snapToGrid?: boolean;
  showToolbar?: boolean;
  showMinimap?: boolean;
  backgroundColor?: string;
  accentColor?: string;
  children?: import('@nativescript/core').View[];
  onViewportChange?: (viewport: CanvasViewport) => void;
  onToolChange?: (tool: CanvasTool) => void;
  onCanvasTap?: (x: number, y: number) => void;
}

// --------------- Helpers ---------------

const TOOL_ICONS: Record<CanvasTool, string> = {
  select: '\u2B9C', hand: '\u270B', draw: '\u270E', erase: '\u2B1B',
  text: 'T', shape: '\u25A1', connector: '\u2192', frame: '\u25A2',
};

// --------------- Component ---------------

export function createCanvas(props: CanvasProps = {}): StackLayout {
  const {
    width = 600,
    height = 400,
    viewport = { x: 0, y: 0, zoom: 1 },
    activeTool = 'select',
    showGrid = true,
    gridSize = 20,
    snapToGrid = false,
    showToolbar = true,
    showMinimap = false,
    backgroundColor = '#0a0a1a',
    accentColor = '#06b6d4',
    children = [],
    onViewportChange,
    onToolChange,
    onCanvasTap,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-canvas';

  // Toolbar
  if (showToolbar) {
    const toolbar = new StackLayout();
    toolbar.orientation = 'horizontal';
    toolbar.padding = 4;
    toolbar.marginBottom = 2;
    toolbar.backgroundColor = new Color('#1a1a2e');
    toolbar.borderRadius = 4;

    const tools: CanvasTool[] = ['select', 'hand', 'draw', 'erase', 'text', 'shape', 'connector', 'frame'];

    tools.forEach((tool) => {
      const btn = new Button();
      btn.text = TOOL_ICONS[tool];
      btn.width = 32;
      btn.height = 32;
      btn.marginRight = 2;
      btn.fontSize = 14;
      btn.borderRadius = 4;
      if (tool === activeTool) {
        btn.backgroundColor = new Color(accentColor);
        btn.color = new Color('#000000');
      }
      btn.on('tap', () => onToolChange?.(tool));
      toolbar.addChild(btn);
    });

    // Zoom controls
    const separator = new Label();
    separator.text = '|';
    separator.opacity = 0.3;
    separator.marginLeft = 8;
    separator.marginRight = 8;
    toolbar.addChild(separator);

    const zoomOutBtn = new Button();
    zoomOutBtn.text = '\u2212';
    zoomOutBtn.width = 28;
    zoomOutBtn.height = 28;
    zoomOutBtn.on('tap', () => {
      const newZoom = Math.max(0.1, viewport.zoom - 0.1);
      onViewportChange?.({ ...viewport, zoom: newZoom });
    });
    toolbar.addChild(zoomOutBtn);

    const zoomLabel = new Label();
    zoomLabel.text = `${Math.round(viewport.zoom * 100)}%`;
    zoomLabel.fontSize = 11;
    zoomLabel.marginLeft = 4;
    zoomLabel.marginRight = 4;
    zoomLabel.verticalAlignment = 'middle';
    toolbar.addChild(zoomLabel);

    const zoomInBtn = new Button();
    zoomInBtn.text = '+';
    zoomInBtn.width = 28;
    zoomInBtn.height = 28;
    zoomInBtn.on('tap', () => {
      const newZoom = Math.min(5, viewport.zoom + 0.1);
      onViewportChange?.({ ...viewport, zoom: newZoom });
    });
    toolbar.addChild(zoomInBtn);

    // Snap toggle
    const snapLabel = new Label();
    snapLabel.text = snapToGrid ? '\u25A3 Snap' : '\u25A1 Snap';
    snapLabel.fontSize = 11;
    snapLabel.marginLeft = 8;
    snapLabel.opacity = snapToGrid ? 1 : 0.5;
    snapLabel.verticalAlignment = 'middle';
    toolbar.addChild(snapLabel);

    container.addChild(toolbar);
  }

  // Canvas area
  const canvasArea = new AbsoluteLayout();
  canvasArea.width = width;
  canvasArea.height = height;
  canvasArea.backgroundColor = new Color(backgroundColor);
  canvasArea.clipToBounds = true;

  // Grid overlay
  if (showGrid) {
    const gridLabel = new Label();
    const dots: string[] = [];
    const cols = Math.ceil(width / gridSize);
    const rows = Math.ceil(height / gridSize);
    for (let r = 0; r < Math.min(rows, 10); r++) {
      const line = Array(Math.min(cols, 20)).fill('\u00B7').join(' ');
      dots.push(line);
    }
    gridLabel.text = dots.join('\n');
    gridLabel.opacity = 0.15;
    gridLabel.fontSize = 8;
    gridLabel.color = new Color('#ffffff');
    AbsoluteLayout.setTop(gridLabel, 0);
    AbsoluteLayout.setLeft(gridLabel, 0);
    canvasArea.addChild(gridLabel);
  }

  // Viewport info
  const vpLabel = new Label();
  vpLabel.text = `x:${viewport.x} y:${viewport.y} z:${viewport.zoom.toFixed(1)}`;
  vpLabel.fontSize = 9;
  vpLabel.opacity = 0.3;
  vpLabel.color = new Color('#ffffff');
  AbsoluteLayout.setTop(vpLabel, 2);
  AbsoluteLayout.setLeft(vpLabel, 4);
  canvasArea.addChild(vpLabel);

  // Add children (canvas nodes)
  children.forEach((child) => {
    canvasArea.addChild(child);
  });

  // Tap handler
  canvasArea.on(GestureTypes.tap as any, (args: any) => {
    if (onCanvasTap) {
      const x = args.getX?.() ?? 0;
      const y = args.getY?.() ?? 0;
      onCanvasTap(x, y);
    }
  });

  container.addChild(canvasArea);

  // Minimap
  if (showMinimap) {
    const minimap = new StackLayout();
    minimap.width = 120;
    minimap.height = 80;
    minimap.backgroundColor = new Color('#111122');
    minimap.borderWidth = 1;
    minimap.borderColor = new Color('#333333');
    minimap.borderRadius = 4;
    minimap.marginTop = 4;
    minimap.horizontalAlignment = 'right';

    const mmLabel = new Label();
    mmLabel.text = 'Minimap';
    mmLabel.fontSize = 9;
    mmLabel.opacity = 0.4;
    mmLabel.horizontalAlignment = 'center';
    minimap.addChild(mmLabel);

    // Viewport indicator
    const vpIndicator = new Label();
    vpIndicator.text = '\u25A1';
    vpIndicator.fontSize = 16;
    vpIndicator.color = new Color(accentColor);
    vpIndicator.horizontalAlignment = 'center';
    minimap.addChild(vpIndicator);

    container.addChild(minimap);
  }

  return container;
}

export default createCanvas;
