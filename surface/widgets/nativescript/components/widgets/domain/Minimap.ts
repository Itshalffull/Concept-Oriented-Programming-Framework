// ============================================================
// Clef Surface NativeScript Widget — Minimap
//
// Miniature overview of larger canvas or document content.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';

export interface MinimapProps {
  width?: number;
  height?: number;
  viewportRect?: { x: number; y: number; width: number; height: number };
  onViewportChange?: (rect: { x: number; y: number }) => void;
}

export function createMinimap(props: MinimapProps): StackLayout {
  const { width = 150, height = 100, viewportRect, onViewportChange } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-minimap';
  container.width = width;
  container.height = height;
  container.accessibilityRole = 'image';
  container.accessibilityLabel = 'Minimap';
  return container;
}

export default createMinimap;
