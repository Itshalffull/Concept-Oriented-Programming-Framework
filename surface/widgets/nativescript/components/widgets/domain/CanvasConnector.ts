// ============================================================
// Clef Surface NativeScript Widget — CanvasConnector
//
// SVG-style connector line between canvas nodes.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';

export interface CanvasConnectorProps {
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  color?: string;
  strokeWidth?: number;
  label?: string;
  animated?: boolean;
}

export function createCanvasConnector(props: CanvasConnectorProps): StackLayout {
  const { fromX = 0, fromY = 0, toX = 100, toY = 100, color = '#666', strokeWidth = 2, label: connLabel, animated = false } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-canvas-connector';
  container.accessibilityLabel = connLabel || 'Connection';
  if (connLabel) {
    const lbl = new Label();
    lbl.text = connLabel;
    lbl.fontSize = 10;
    container.addChild(lbl);
  }
  return container;
}

export default createCanvasConnector;
