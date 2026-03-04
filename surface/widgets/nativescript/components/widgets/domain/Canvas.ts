// ============================================================
// Clef Surface NativeScript Widget — Canvas
//
// Pannable, zoomable canvas for node-based editing.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface CanvasViewport { x: number; y: number; zoom: number; }

export interface CanvasProps {
  viewport?: CanvasViewport;
  width?: number;
  height?: number;
  grid?: boolean;
  gridSize?: number;
  onViewportChange?: (viewport: CanvasViewport) => void;
  children?: View[];
}

export function createCanvas(props: CanvasProps): StackLayout {
  const { viewport = { x: 0, y: 0, zoom: 1 }, width = 800, height = 600, grid = true, gridSize = 20, onViewportChange, children = [] } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-canvas';
  container.width = width;
  container.height = height;
  container.accessibilityLabel = 'Canvas';
  for (const child of children) container.addChild(child);
  return container;
}

export default createCanvas;
