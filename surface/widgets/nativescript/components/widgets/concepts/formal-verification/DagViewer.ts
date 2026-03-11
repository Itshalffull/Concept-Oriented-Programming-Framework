import {
  StackLayout,
  GridLayout,
  Label,
  Button,
  ScrollView,
  Color,
  View,
} from '@nativescript/core';

export type DagViewerState = 'idle' | 'nodeSelected' | 'computing';
export type DagViewerEvent =
  | { type: 'SELECT_NODE'; id?: string }
  | { type: 'ZOOM' }
  | { type: 'PAN' }
  | { type: 'LAYOUT' }
  | { type: 'DESELECT' }
  | { type: 'LAYOUT_COMPLETE' };

export function dagViewerReducer(state: DagViewerState, event: DagViewerEvent): DagViewerState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_NODE') return 'nodeSelected';
      if (event.type === 'ZOOM') return 'idle';
      if (event.type === 'PAN') return 'idle';
      if (event.type === 'LAYOUT') return 'computing';
      return state;
    case 'nodeSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_NODE') return 'nodeSelected';
      return state;
    case 'computing':
      if (event.type === 'LAYOUT_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface DagNode {
  id: string;
  label: string;
  type?: string;
  status?: string;
}

export interface DagEdge {
  from: string;
  to: string;
  label?: string;
}

export interface DagViewerProps {
  nodes: DagNode[];
  edges: DagEdge[];
  layout?: 'dagre' | 'elk' | 'layered';
  selectedNodeId?: string;
  onSelectNode?: (id: string | undefined) => void;
}

function computeLevels(nodes: DagNode[], edges: DagEdge[]): Map<string, number> {
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const n of nodes) { inDegree.set(n.id, 0); children.set(n.id, []); }
  for (const e of edges) {
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
    children.get(e.from)?.push(e.to);
  }
  const levels = new Map<string, number>();
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) { queue.push(id); levels.set(id, 0); }
  }
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = levels.get(current)!;
    for (const child of children.get(current) ?? []) {
      const nextLevel = currentLevel + 1;
      const existing = levels.get(child);
      if (existing === undefined || nextLevel > existing) levels.set(child, nextLevel);
      const newDeg = (inDegree.get(child) ?? 1) - 1;
      inDegree.set(child, newDeg);
      if (newDeg === 0) queue.push(child);
    }
  }
  for (const n of nodes) { if (!levels.has(n.id)) levels.set(n.id, 0); }
  return levels;
}

function groupByLevel(nodes: DagNode[], levels: Map<string, number>): DagNode[][] {
  const maxLevel = Math.max(0, ...levels.values());
  const groups: DagNode[][] = Array.from({ length: maxLevel + 1 }, () => []);
  for (const n of nodes) groups[levels.get(n.id) ?? 0].push(n);
  return groups;
}

function getUpstream(nodeId: string, edges: DagEdge[]): Set<string> {
  const ids = new Set<string>();
  for (const e of edges) if (e.to === nodeId) ids.add(e.from);
  return ids;
}

function getDownstream(nodeId: string, edges: DagEdge[]): Set<string> {
  const ids = new Set<string>();
  for (const e of edges) if (e.from === nodeId) ids.add(e.to);
  return ids;
}

function getConnectedEdges(nodeId: string, edges: DagEdge[]): DagEdge[] {
  return edges.filter((e) => e.from === nodeId || e.to === nodeId);
}

export function createDagViewer(props: DagViewerProps): { view: View; dispose: () => void } {
  let state: DagViewerState = 'idle';
  let selectedId: string | undefined = props.selectedNodeId;
  const disposers: (() => void)[] = [];

  const container = new StackLayout();
  container.className = 'clef-dag-viewer';

  const nodeMap = new Map<string, DagNode>();
  for (const n of props.nodes) nodeMap.set(n.id, n);

  function sm(ev: DagViewerEvent): void { state = dagViewerReducer(state, ev); }

  function selectNode(id: string | undefined): void {
    selectedId = id;
    props.onSelectNode?.(id);
    if (id !== undefined) sm({ type: 'SELECT_NODE', id });
    else sm({ type: 'DESELECT' });
    render();
  }

  function render(): void {
    container.removeChildren();
    const levels = computeLevels(props.nodes, props.edges);
    const levelGroups = groupByLevel(props.nodes, levels);

    const scrollView = new ScrollView();
    const canvas = new StackLayout();
    canvas.automationText = `DAG with ${props.nodes.length} nodes`;

    levelGroups.forEach((group, levelIdx) => {
      const levelLabel = new Label();
      levelLabel.text = `Level ${levelIdx}`;
      levelLabel.fontSize = 11;
      levelLabel.color = new Color('#9ca3af');
      levelLabel.marginTop = levelIdx > 0 ? 8 : 0;
      canvas.addChild(levelLabel);

      group.forEach((node) => {
        const isSelected = node.id === selectedId;
        const upstream = selectedId ? getUpstream(selectedId, props.edges) : new Set<string>();
        const downstream = selectedId ? getDownstream(selectedId, props.edges) : new Set<string>();
        const highlighted = isSelected || upstream.has(node.id) || downstream.has(node.id);

        const nodeRow = new StackLayout();
        nodeRow.orientation = 'horizontal';
        nodeRow.padding = '6 12';
        nodeRow.marginLeft = 8;
        nodeRow.borderRadius = 4;
        nodeRow.borderWidth = isSelected ? 2 : 1;
        nodeRow.borderColor = isSelected ? new Color('#6366f1') : highlighted ? new Color('#a5b4fc') : new Color('#e5e7eb');
        nodeRow.backgroundColor = isSelected ? new Color('#eef2ff') : new Color('transparent');

        const nodeLabel = new Label();
        nodeLabel.text = node.label;
        nodeLabel.fontWeight = isSelected ? 'bold' : 'normal';
        nodeRow.addChild(nodeLabel);

        if (node.type) {
          const typeBadge = new Label();
          typeBadge.text = ` [${node.type}]`;
          typeBadge.fontSize = 11;
          typeBadge.color = new Color('#6b7280');
          nodeRow.addChild(typeBadge);
        }

        const statusBadge = new Label();
        statusBadge.text = ` ${node.status ?? 'unknown'}`;
        statusBadge.fontSize = 11;
        statusBadge.color = new Color(node.status === 'passed' ? '#22c55e' : node.status === 'failed' ? '#ef4444' : '#9ca3af');
        nodeRow.addChild(statusBadge);

        nodeRow.automationText = `${node.label} - ${node.status ?? 'unknown'}`;
        const tapHandler = () => selectNode(isSelected ? undefined : node.id);
        nodeRow.on('tap', tapHandler);
        disposers.push(() => nodeRow.off('tap', tapHandler));
        canvas.addChild(nodeRow);
      });
    });

    // Edges
    const edgesHeader = new Label();
    edgesHeader.text = 'Edges:';
    edgesHeader.fontWeight = 'bold';
    edgesHeader.fontSize = 12;
    edgesHeader.marginTop = 8;
    canvas.addChild(edgesHeader);

    props.edges.forEach((edge) => {
      const fromLabel = nodeMap.get(edge.from)?.label ?? edge.from;
      const toLabel = nodeMap.get(edge.to)?.label ?? edge.to;
      const highlighted = selectedId !== undefined && (edge.from === selectedId || edge.to === selectedId);
      const edgeRow = new Label();
      let edgeText = `  ${fromLabel} \u2192 ${toLabel}`;
      if (edge.label) edgeText += ` (${edge.label})`;
      edgeRow.text = edgeText;
      edgeRow.fontSize = 12;
      edgeRow.color = highlighted ? new Color('#6366f1') : new Color('#6b7280');
      canvas.addChild(edgeRow);
    });

    scrollView.content = canvas;
    container.addChild(scrollView);

    // Detail panel
    if (selectedId !== undefined) {
      const selected = nodeMap.get(selectedId);
      if (selected) {
        const upstream = getUpstream(selectedId, props.edges);
        const downstream = getDownstream(selectedId, props.edges);
        const connectedEdges = getConnectedEdges(selectedId, props.edges);

        const detail = new StackLayout();
        detail.padding = '12';
        detail.borderTopWidth = 1;
        detail.borderTopColor = new Color('#e5e7eb');

        const titleLabel = new Label();
        titleLabel.text = selected.label;
        titleLabel.fontWeight = 'bold';
        titleLabel.fontSize = 16;
        detail.addChild(titleLabel);

        if (selected.type) {
          const typeLabel = new Label();
          typeLabel.text = `Type: ${selected.type}`;
          typeLabel.fontSize = 13;
          detail.addChild(typeLabel);
        }

        const statusLabel = new Label();
        statusLabel.text = `Status: ${selected.status ?? 'unknown'}`;
        statusLabel.fontSize = 13;
        detail.addChild(statusLabel);

        const upLabel = new Label();
        upLabel.text = `Upstream (${upstream.size}): ${upstream.size > 0 ? [...upstream].map((id) => nodeMap.get(id)?.label ?? id).join(', ') : 'None'}`;
        upLabel.fontSize = 13;
        upLabel.textWrap = true;
        detail.addChild(upLabel);

        const downLabel = new Label();
        downLabel.text = `Downstream (${downstream.size}): ${downstream.size > 0 ? [...downstream].map((id) => nodeMap.get(id)?.label ?? id).join(', ') : 'None'}`;
        downLabel.fontSize = 13;
        downLabel.textWrap = true;
        detail.addChild(downLabel);

        const edgesLabel = new Label();
        edgesLabel.text = `Connected edges (${connectedEdges.length}): ${connectedEdges.length > 0 ? connectedEdges.map((ce) => { const fl = nodeMap.get(ce.from)?.label ?? ce.from; const tl = nodeMap.get(ce.to)?.label ?? ce.to; return `${fl} \u2192 ${tl}${ce.label ? ` (${ce.label})` : ''}`; }).join(', ') : 'None'}`;
        edgesLabel.fontSize = 13;
        edgesLabel.textWrap = true;
        detail.addChild(edgesLabel);

        container.addChild(detail);
      }
    }
  }

  render();
  return { view: container, dispose() { disposers.forEach((d) => d()); } };
}

export default createDagViewer;
