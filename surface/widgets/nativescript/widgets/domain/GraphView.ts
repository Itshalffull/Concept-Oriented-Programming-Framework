// ============================================================
// Clef Surface NativeScript Widget — GraphView
//
// Graph/network visualization. Renders nodes and edges as
// labelled boxes with text-based connections. Supports node
// selection, layout modes, and zoom controls.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  Button,
  ScrollView,
  Color,
  GestureTypes,
} from '@nativescript/core';

// --------------- Types ---------------

export interface GraphNode {
  id: string;
  label: string;
  type?: string;
  color?: string;
  size?: number;
  group?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  label?: string;
  weight?: number;
  directed?: boolean;
}

export interface GraphViewProps {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  selectedNodeId?: string;
  layout?: 'force' | 'hierarchical' | 'circular' | 'grid';
  showLabels?: boolean;
  showEdgeLabels?: boolean;
  zoomLevel?: number;
  accentColor?: string;
  onNodeSelect?: (id: string) => void;
  onNodeDoubleClick?: (id: string) => void;
  onEdgeSelect?: (source: string, target: string) => void;
  onZoomChange?: (zoom: number) => void;
}

// --------------- Helpers ---------------

const NODE_SHAPES: Record<string, string> = {
  default: '\u25CF', square: '\u25A0', diamond: '\u25C6',
  triangle: '\u25B2', star: '\u2605', circle: '\u25CB',
};

// --------------- Component ---------------

export function createGraphView(props: GraphViewProps = {}): StackLayout {
  const {
    nodes = [],
    edges = [],
    selectedNodeId,
    layout = 'force',
    showLabels = true,
    showEdgeLabels = false,
    zoomLevel = 1,
    accentColor = '#06b6d4',
    onNodeSelect,
    onNodeDoubleClick,
    onEdgeSelect,
    onZoomChange,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-graph-view';
  container.padding = 8;

  // Toolbar
  const toolbar = new GridLayout();
  toolbar.columns = '*, auto';
  toolbar.marginBottom = 8;

  const infoRow = new StackLayout();
  infoRow.orientation = 'horizontal';

  const titleLabel = new Label();
  titleLabel.text = '\u2B21 Graph View';
  titleLabel.fontWeight = 'bold';
  titleLabel.color = new Color(accentColor);
  titleLabel.marginRight = 12;
  infoRow.addChild(titleLabel);

  const statsLabel = new Label();
  statsLabel.text = `${nodes.length} nodes, ${edges.length} edges`;
  statsLabel.fontSize = 11;
  statsLabel.opacity = 0.5;
  infoRow.addChild(statsLabel);

  GridLayout.setColumn(infoRow, 0);
  toolbar.addChild(infoRow);

  // Zoom controls
  const zoomRow = new StackLayout();
  zoomRow.orientation = 'horizontal';

  const zoomOutBtn = new Button();
  zoomOutBtn.text = '\u2212';
  zoomOutBtn.width = 28;
  zoomOutBtn.height = 28;
  zoomOutBtn.on('tap', () => onZoomChange?.(Math.max(0.1, zoomLevel - 0.2)));
  zoomRow.addChild(zoomOutBtn);

  const zoomLabel = new Label();
  zoomLabel.text = `${Math.round(zoomLevel * 100)}%`;
  zoomLabel.fontSize = 11;
  zoomLabel.marginLeft = 4;
  zoomLabel.marginRight = 4;
  zoomLabel.verticalAlignment = 'middle';
  zoomRow.addChild(zoomLabel);

  const zoomInBtn = new Button();
  zoomInBtn.text = '+';
  zoomInBtn.width = 28;
  zoomInBtn.height = 28;
  zoomInBtn.on('tap', () => onZoomChange?.(Math.min(5, zoomLevel + 0.2)));
  zoomRow.addChild(zoomInBtn);

  GridLayout.setColumn(zoomRow, 1);
  toolbar.addChild(zoomRow);

  container.addChild(toolbar);

  // Layout mode label
  const layoutLabel = new Label();
  layoutLabel.text = `Layout: ${layout}`;
  layoutLabel.fontSize = 10;
  layoutLabel.opacity = 0.3;
  layoutLabel.marginBottom = 4;
  container.addChild(layoutLabel);

  // Graph content
  const scrollView = new ScrollView();
  const graphContent = new StackLayout();
  graphContent.padding = 4;
  graphContent.backgroundColor = new Color('#0a0a1a');
  graphContent.borderRadius = 6;
  graphContent.borderWidth = 1;
  graphContent.borderColor = new Color('#333333');

  // Build adjacency map
  const adjacency = new Map<string, Array<{ target: string; label?: string; directed: boolean }>>();
  edges.forEach((edge) => {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source)!.push({
      target: edge.target,
      label: edge.label,
      directed: edge.directed !== false,
    });
  });

  // Group nodes
  const groups = new Map<string, GraphNode[]>();
  nodes.forEach((node) => {
    const group = node.group || 'default';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(node);
  });

  // Render nodes by group
  groups.forEach((groupNodes, groupName) => {
    if (groupName !== 'default') {
      const groupLabel = new Label();
      groupLabel.text = `\u2500\u2500 ${groupName} \u2500\u2500`;
      groupLabel.fontSize = 10;
      groupLabel.opacity = 0.4;
      groupLabel.horizontalAlignment = 'center';
      groupLabel.marginTop = 8;
      groupLabel.marginBottom = 4;
      graphContent.addChild(groupLabel);
    }

    groupNodes.forEach((node) => {
      const isSelected = node.id === selectedNodeId;

      const nodeRow = new GridLayout();
      nodeRow.columns = 'auto, *, auto';
      nodeRow.padding = 6;
      nodeRow.marginBottom = 3;
      nodeRow.borderRadius = 4;
      nodeRow.borderWidth = isSelected ? 2 : 1;
      nodeRow.borderColor = new Color(isSelected ? accentColor : '#444444');
      nodeRow.backgroundColor = new Color(isSelected ? '#1a2a3a' : '#111122');

      // Node icon
      const nodeIcon = new Label();
      nodeIcon.text = NODE_SHAPES[node.type || 'default'] || NODE_SHAPES.default;
      nodeIcon.fontSize = (node.size || 12) + 2;
      nodeIcon.color = new Color(node.color || accentColor);
      nodeIcon.marginRight = 8;
      nodeIcon.verticalAlignment = 'middle';
      GridLayout.setColumn(nodeIcon, 0);
      nodeRow.addChild(nodeIcon);

      // Node label + connections
      const labelStack = new StackLayout();

      if (showLabels) {
        const label = new Label();
        label.text = node.label;
        label.color = new Color('#e0e0e0');
        label.fontWeight = isSelected ? 'bold' : 'normal';
        label.fontSize = 12;
        labelStack.addChild(label);
      }

      // Connected edges
      const nodeEdges = adjacency.get(node.id) || [];
      if (nodeEdges.length > 0) {
        const edgeText = nodeEdges.map((e) => {
          const arrow = e.directed ? '\u2192' : '\u2014';
          const label = showEdgeLabels && e.label ? ` [${e.label}]` : '';
          return `${arrow} ${e.target}${label}`;
        }).join(', ');

        const edgesLabel = new Label();
        edgesLabel.text = edgeText;
        edgesLabel.fontSize = 10;
        edgesLabel.opacity = 0.5;
        edgesLabel.textWrap = true;
        labelStack.addChild(edgesLabel);
      }

      GridLayout.setColumn(labelStack, 1);
      nodeRow.addChild(labelStack);

      // Degree badge
      const inDegree = edges.filter((e) => e.target === node.id).length;
      const outDegree = nodeEdges.length;

      const degreeLabel = new Label();
      degreeLabel.text = `${inDegree}\u2190 ${outDegree}\u2192`;
      degreeLabel.fontSize = 9;
      degreeLabel.opacity = 0.4;
      degreeLabel.verticalAlignment = 'middle';
      GridLayout.setColumn(degreeLabel, 2);
      nodeRow.addChild(degreeLabel);

      nodeRow.on(GestureTypes.tap as any, () => onNodeSelect?.(node.id));
      nodeRow.on(GestureTypes.doubleTap as any, () => onNodeDoubleClick?.(node.id));

      graphContent.addChild(nodeRow);
    });
  });

  // Empty state
  if (nodes.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No nodes in the graph.';
    emptyLabel.opacity = 0.4;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 20;
    graphContent.addChild(emptyLabel);
  }

  scrollView.content = graphContent;
  container.addChild(scrollView);

  return container;
}

export default createGraphView;
