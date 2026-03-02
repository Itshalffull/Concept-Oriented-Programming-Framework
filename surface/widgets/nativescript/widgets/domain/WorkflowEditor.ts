// ============================================================
// Clef Surface NativeScript Widget — WorkflowEditor
//
// Visual workflow builder. Renders a canvas with draggable
// workflow nodes connected by edges. Provides a node palette,
// execution controls, and configuration panels.
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

export interface WorkflowNodeDef {
  id: string;
  type: string;
  title: string;
  position?: { x: number; y: number };
  config?: Record<string, unknown>;
  executionStatus?: 'pending' | 'running' | 'success' | 'error';
}

export interface WorkflowEdgeDef {
  id: string;
  sourceId: string;
  sourcePort?: string;
  targetId: string;
  targetPort?: string;
  label?: string;
}

export interface WorkflowEditorProps {
  nodes?: WorkflowNodeDef[];
  edges?: WorkflowEdgeDef[];
  selectedNodeId?: string;
  selectedEdgeId?: string;
  executing?: boolean;
  readOnly?: boolean;
  paletteNodeTypes?: Array<{ type: string; label: string; icon?: string }>;
  showPalette?: boolean;
  showMinimap?: boolean;
  workflowName?: string;
  accentColor?: string;
  onNodeSelect?: (id: string) => void;
  onNodeAdd?: (type: string, position: { x: number; y: number }) => void;
  onNodeDelete?: (id: string) => void;
  onNodeConfigure?: (id: string) => void;
  onEdgeSelect?: (id: string) => void;
  onEdgeDelete?: (id: string) => void;
  onExecute?: () => void;
  onExecuteStop?: () => void;
}

// --------------- Helpers ---------------

const STATUS_ICONS: Record<string, string> = {
  pending: '\u25CB', running: '\u25D4', success: '\u2714', error: '\u2716',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#888888', running: '#eab308', success: '#22c55e', error: '#ef4444',
};

const NODE_TYPE_ICONS: Record<string, string> = {
  trigger: '\u26A1', action: '\u25B6', condition: '\u2753',
  delay: '\u23F1', webhook: '\uD83C\uDF10', transform: '\u2699',
  loop: '\u21BB', parallel: '\u2551', merge: '\u2A1F',
};

// --------------- Component ---------------

export function createWorkflowEditor(props: WorkflowEditorProps = {}): StackLayout {
  const {
    nodes = [],
    edges = [],
    selectedNodeId,
    selectedEdgeId,
    executing = false,
    readOnly = false,
    paletteNodeTypes = [],
    showPalette = true,
    showMinimap = false,
    workflowName = 'Workflow',
    accentColor = '#06b6d4',
    onNodeSelect,
    onNodeAdd,
    onNodeDelete,
    onNodeConfigure,
    onEdgeSelect,
    onEdgeDelete,
    onExecute,
    onExecuteStop,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-workflow-editor';

  // Top bar
  const topBar = new GridLayout();
  topBar.columns = '*, auto, auto';
  topBar.padding = 8;
  topBar.backgroundColor = new Color('#1a1a2e');
  topBar.marginBottom = 2;

  const titleStack = new StackLayout();
  const titleLabel = new Label();
  titleLabel.text = workflowName;
  titleLabel.fontWeight = 'bold';
  titleLabel.fontSize = 14;
  titleLabel.color = new Color(accentColor);
  titleStack.addChild(titleLabel);

  const statsLabel = new Label();
  statsLabel.text = `${nodes.length} nodes, ${edges.length} edges`;
  statsLabel.fontSize = 10;
  statsLabel.opacity = 0.5;
  titleStack.addChild(statsLabel);

  GridLayout.setColumn(titleStack, 0);
  topBar.addChild(titleStack);

  // Execution status
  if (executing) {
    const execLabel = new Label();
    execLabel.text = '\u25D4 Executing...';
    execLabel.color = new Color('#eab308');
    execLabel.fontSize = 12;
    execLabel.verticalAlignment = 'middle';
    execLabel.marginRight = 8;
    GridLayout.setColumn(execLabel, 1);
    topBar.addChild(execLabel);
  }

  // Execute / Stop button
  if (!readOnly) {
    const execBtn = new Button();
    execBtn.text = executing ? '\u25A0 Stop' : '\u25B6 Execute';
    execBtn.fontSize = 12;
    execBtn.borderRadius = 4;
    if (!executing) {
      execBtn.backgroundColor = new Color('#22c55e');
      execBtn.color = new Color('#000000');
    }
    execBtn.on('tap', () => (executing ? onExecuteStop?.() : onExecute?.()));
    GridLayout.setColumn(execBtn, 2);
    topBar.addChild(execBtn);
  }

  container.addChild(topBar);

  // Main area
  const mainArea = new GridLayout();
  mainArea.columns = showPalette ? '140, *' : '*';

  // Node palette
  if (showPalette && !readOnly) {
    const palette = new StackLayout();
    palette.padding = 8;
    palette.backgroundColor = new Color('#111122');
    palette.borderRightWidth = 1;
    palette.borderRightColor = new Color('#333333');

    const paletteTitle = new Label();
    paletteTitle.text = 'Nodes';
    paletteTitle.fontWeight = 'bold';
    paletteTitle.fontSize = 11;
    paletteTitle.marginBottom = 8;
    paletteTitle.opacity = 0.5;
    palette.addChild(paletteTitle);

    paletteNodeTypes.forEach((pn) => {
      const paletteItem = new StackLayout();
      paletteItem.orientation = 'horizontal';
      paletteItem.padding = 6;
      paletteItem.marginBottom = 2;
      paletteItem.borderRadius = 4;
      paletteItem.backgroundColor = new Color('#1a1a2e');

      const pIcon = new Label();
      pIcon.text = pn.icon || NODE_TYPE_ICONS[pn.type] || '\u25A0';
      pIcon.fontSize = 14;
      pIcon.marginRight = 6;
      paletteItem.addChild(pIcon);

      const pLabel = new Label();
      pLabel.text = pn.label;
      pLabel.fontSize = 11;
      pLabel.color = new Color('#e0e0e0');
      paletteItem.addChild(pLabel);

      paletteItem.on(GestureTypes.tap as any, () =>
        onNodeAdd?.(pn.type, { x: 100, y: 100 })
      );

      palette.addChild(paletteItem);
    });

    GridLayout.setColumn(palette, 0);
    mainArea.addChild(palette);
  }

  // Canvas area
  const canvasScroll = new ScrollView();
  const canvas = new StackLayout();
  canvas.padding = 8;
  canvas.backgroundColor = new Color('#0a0a1a');

  // Render nodes
  nodes.forEach((node) => {
    const isSelected = node.id === selectedNodeId;
    const status = node.executionStatus || 'pending';

    const nodeCard = new GridLayout();
    nodeCard.columns = 'auto, *, auto';
    nodeCard.padding = 8;
    nodeCard.marginBottom = 4;
    nodeCard.borderRadius = 6;
    nodeCard.borderWidth = isSelected ? 2 : 1;
    nodeCard.borderColor = new Color(isSelected ? accentColor : '#444444');
    nodeCard.backgroundColor = new Color(isSelected ? '#1a2a3a' : '#111122');

    // Status icon
    const statusIcon = new Label();
    statusIcon.text = STATUS_ICONS[status] || STATUS_ICONS.pending;
    statusIcon.color = new Color(STATUS_COLORS[status] || '#888888');
    statusIcon.fontSize = 14;
    statusIcon.marginRight = 8;
    statusIcon.verticalAlignment = 'middle';
    GridLayout.setColumn(statusIcon, 0);
    nodeCard.addChild(statusIcon);

    // Node info
    const nodeInfo = new StackLayout();

    const nodeTitle = new Label();
    nodeTitle.text = node.title;
    nodeTitle.fontWeight = 'bold';
    nodeTitle.fontSize = 12;
    nodeTitle.color = new Color('#e0e0e0');
    nodeInfo.addChild(nodeTitle);

    const nodeType = new Label();
    nodeType.text = `${NODE_TYPE_ICONS[node.type] || ''} ${node.type}`;
    nodeType.fontSize = 10;
    nodeType.opacity = 0.5;
    nodeInfo.addChild(nodeType);

    // Config summary
    if (node.config && Object.keys(node.config).length > 0) {
      const configLabel = new Label();
      configLabel.text = Object.entries(node.config).map(([k, v]) =>
        `${k}: ${JSON.stringify(v)}`
      ).join(', ');
      configLabel.fontSize = 9;
      configLabel.opacity = 0.4;
      configLabel.textWrap = true;
      nodeInfo.addChild(configLabel);
    }

    // Connected edges
    const incoming = edges.filter((e) => e.targetId === node.id);
    const outgoing = edges.filter((e) => e.sourceId === node.id);
    if (incoming.length > 0 || outgoing.length > 0) {
      const connLabel = new Label();
      connLabel.text = `${incoming.length}\u2190 ${outgoing.length}\u2192`;
      connLabel.fontSize = 9;
      connLabel.opacity = 0.3;
      nodeInfo.addChild(connLabel);
    }

    GridLayout.setColumn(nodeInfo, 1);
    nodeCard.addChild(nodeInfo);

    // Actions
    if (!readOnly && isSelected) {
      const actionsStack = new StackLayout();
      actionsStack.verticalAlignment = 'middle';

      const configBtn = new Button();
      configBtn.text = '\u2699';
      configBtn.fontSize = 12;
      configBtn.width = 28;
      configBtn.height = 28;
      configBtn.on('tap', () => onNodeConfigure?.(node.id));
      actionsStack.addChild(configBtn);

      const delBtn = new Button();
      delBtn.text = '\u2716';
      delBtn.fontSize = 12;
      delBtn.width = 28;
      delBtn.height = 28;
      delBtn.on('tap', () => onNodeDelete?.(node.id));
      actionsStack.addChild(delBtn);

      GridLayout.setColumn(actionsStack, 2);
      nodeCard.addChild(actionsStack);
    }

    nodeCard.on(GestureTypes.tap as any, () => onNodeSelect?.(node.id));
    nodeCard.on(GestureTypes.doubleTap as any, () => onNodeConfigure?.(node.id));

    canvas.addChild(nodeCard);
  });

  // Render edges
  if (edges.length > 0) {
    const edgeHeader = new Label();
    edgeHeader.text = 'Connections';
    edgeHeader.fontSize = 10;
    edgeHeader.opacity = 0.4;
    edgeHeader.marginTop = 8;
    edgeHeader.marginBottom = 4;
    canvas.addChild(edgeHeader);

    edges.forEach((edge) => {
      const isEdgeSelected = edge.id === selectedEdgeId;
      const srcNode = nodes.find((n) => n.id === edge.sourceId);
      const tgtNode = nodes.find((n) => n.id === edge.targetId);

      const edgeRow = new GridLayout();
      edgeRow.columns = '*, auto';
      edgeRow.padding = 4;
      edgeRow.marginBottom = 2;
      edgeRow.borderRadius = 3;
      if (isEdgeSelected) {
        edgeRow.backgroundColor = new Color('#1a2a3a');
        edgeRow.borderWidth = 1;
        edgeRow.borderColor = new Color(accentColor);
      }

      const edgeLabel = new Label();
      const srcName = srcNode?.title || edge.sourceId;
      const tgtName = tgtNode?.title || edge.targetId;
      const portInfo = edge.sourcePort || edge.targetPort
        ? ` (${edge.sourcePort || '*'} \u2192 ${edge.targetPort || '*'})`
        : '';
      edgeLabel.text = `${srcName} \u2192 ${tgtName}${portInfo}${edge.label ? ` [${edge.label}]` : ''}`;
      edgeLabel.fontSize = 11;
      edgeLabel.color = new Color(isEdgeSelected ? accentColor : '#888888');
      GridLayout.setColumn(edgeLabel, 0);
      edgeRow.addChild(edgeLabel);

      if (!readOnly && isEdgeSelected) {
        const edgeDelBtn = new Button();
        edgeDelBtn.text = '\u2716';
        edgeDelBtn.fontSize = 9;
        edgeDelBtn.width = 20;
        edgeDelBtn.height = 20;
        edgeDelBtn.on('tap', () => onEdgeDelete?.(edge.id));
        GridLayout.setColumn(edgeDelBtn, 1);
        edgeRow.addChild(edgeDelBtn);
      }

      edgeRow.on(GestureTypes.tap as any, () => onEdgeSelect?.(edge.id));
      canvas.addChild(edgeRow);
    });
  }

  // Empty state
  if (nodes.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'Drag nodes from the palette to build a workflow.';
    emptyLabel.opacity = 0.4;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 40;
    canvas.addChild(emptyLabel);
  }

  canvasScroll.content = canvas;
  GridLayout.setColumn(canvasScroll, showPalette ? 1 : 0);
  mainArea.addChild(canvasScroll);

  container.addChild(mainArea);

  return container;
}

export default createWorkflowEditor;
