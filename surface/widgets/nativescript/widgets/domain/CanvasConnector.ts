// ============================================================
// Clef Surface NativeScript Widget — CanvasConnector
//
// Renders a visual connector line between two canvas nodes.
// Displays directional arrows, labels, and selection state.
// Since NativeScript has no SVG, connectors are represented
// with styled line segments using dashes and arrows.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  Color,
  GestureTypes,
} from '@nativescript/core';

// --------------- Types ---------------

export interface ConnectorEndpoint {
  nodeId: string;
  port?: string;
  x: number;
  y: number;
}

export interface CanvasConnectorProps {
  id?: string;
  from: ConnectorEndpoint;
  to: ConnectorEndpoint;
  label?: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  arrowDirection?: 'forward' | 'backward' | 'both' | 'none';
  color?: string;
  thickness?: number;
  selected?: boolean;
  animated?: boolean;
  accentColor?: string;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDoubleClick?: (id: string) => void;
}

// --------------- Helpers ---------------

const LINE_CHARS: Record<string, string> = {
  solid: '\u2500', dashed: '\u2504', dotted: '\u2508',
};

const ARROW_START: Record<string, string> = {
  backward: '\u25C0', both: '\u25C0', forward: '', none: '',
};

const ARROW_END: Record<string, string> = {
  forward: '\u25B6', both: '\u25B6', backward: '', none: '',
};

// --------------- Component ---------------

export function createCanvasConnector(props: CanvasConnectorProps): StackLayout {
  const {
    id = '',
    from,
    to,
    label,
    lineStyle = 'solid',
    arrowDirection = 'forward',
    color = '#888888',
    thickness = 1,
    selected = false,
    animated = false,
    accentColor = '#06b6d4',
    onSelect,
    onDelete,
    onDoubleClick,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-canvas-connector';
  container.orientation = 'horizontal';
  container.verticalAlignment = 'middle';

  const effectiveColor = selected ? accentColor : color;

  // Source endpoint indicator
  const fromLabel = new Label();
  fromLabel.text = ARROW_START[arrowDirection] || '';
  fromLabel.color = new Color(effectiveColor);
  fromLabel.fontSize = 10 + thickness;
  container.addChild(fromLabel);

  // Source port label
  if (from.port) {
    const fromPort = new Label();
    fromPort.text = from.port;
    fromPort.fontSize = 9;
    fromPort.opacity = 0.5;
    fromPort.marginRight = 2;
    container.addChild(fromPort);
  }

  // Line segment
  const lineChar = LINE_CHARS[lineStyle] || LINE_CHARS.solid;
  const dx = Math.abs(to.x - from.x);
  const lineLength = Math.max(3, Math.min(20, Math.round(dx / 20)));

  const lineLabel = new Label();
  lineLabel.text = lineChar.repeat(lineLength);
  lineLabel.color = new Color(effectiveColor);
  lineLabel.fontSize = 10 + thickness;
  if (selected) {
    lineLabel.fontWeight = 'bold';
  }
  container.addChild(lineLabel);

  // Connector label
  if (label) {
    const connLabel = new Label();
    connLabel.text = ` ${label} `;
    connLabel.fontSize = 10;
    connLabel.color = new Color(effectiveColor);
    connLabel.backgroundColor = new Color('#1a1a2e');
    connLabel.borderRadius = 3;
    connLabel.padding = 2;
    container.addChild(connLabel);

    // Continuation line
    const lineLabel2 = new Label();
    lineLabel2.text = lineChar.repeat(Math.max(2, lineLength - 2));
    lineLabel2.color = new Color(effectiveColor);
    lineLabel2.fontSize = 10 + thickness;
    container.addChild(lineLabel2);
  }

  // Target port label
  if (to.port) {
    const toPort = new Label();
    toPort.text = to.port;
    toPort.fontSize = 9;
    toPort.opacity = 0.5;
    toPort.marginLeft = 2;
    container.addChild(toPort);
  }

  // Target endpoint indicator
  const toLabel = new Label();
  toLabel.text = ARROW_END[arrowDirection] || '';
  toLabel.color = new Color(effectiveColor);
  toLabel.fontSize = 10 + thickness;
  container.addChild(toLabel);

  // Animated indicator
  if (animated) {
    const animDot = new Label();
    animDot.text = ' \u25CF';
    animDot.color = new Color(accentColor);
    animDot.fontSize = 8;
    container.addChild(animDot);
  }

  // Metadata row
  const metaRow = new StackLayout();
  metaRow.orientation = 'horizontal';

  const metaLabel = new Label();
  metaLabel.text = `${from.nodeId} \u2192 ${to.nodeId}`;
  metaLabel.fontSize = 9;
  metaLabel.opacity = 0.3;
  metaRow.addChild(metaLabel);

  // Selection/interaction
  container.on(GestureTypes.tap as any, () => {
    if (id) onSelect?.(id);
  });

  container.on(GestureTypes.doubleTap as any, () => {
    if (id) onDoubleClick?.(id);
  });

  // Wrapper with metadata
  const wrapper = new StackLayout();
  wrapper.className = 'clef-canvas-connector-wrapper';
  if (selected) {
    wrapper.borderWidth = 1;
    wrapper.borderColor = new Color(accentColor);
    wrapper.borderRadius = 3;
    wrapper.padding = 2;
  }
  wrapper.addChild(container);
  wrapper.addChild(metaRow);

  return wrapper;
}

export default createCanvasConnector;
