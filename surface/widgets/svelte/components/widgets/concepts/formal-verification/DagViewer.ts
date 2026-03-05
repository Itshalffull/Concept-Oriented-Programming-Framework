import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

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

function computeLevels(nodes: DagNode[], edges: DagEdge[]): Map<string, number> {
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    children.set(n.id, []);
  }

  for (const e of edges) {
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
    children.get(e.from)?.push(e.to);
  }

  const levels = new Map<string, number>();
  const queue: string[] = [];

  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      queue.push(id);
      levels.set(id, 0);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = levels.get(current)!;
    for (const child of children.get(current) ?? []) {
      const existing = levels.get(child);
      const nextLevel = currentLevel + 1;
      if (existing === undefined || nextLevel > existing) {
        levels.set(child, nextLevel);
      }
      const newDeg = (inDegree.get(child) ?? 1) - 1;
      inDegree.set(child, newDeg);
      if (newDeg === 0) {
        queue.push(child);
      }
    }
  }

  for (const n of nodes) {
    if (!levels.has(n.id)) levels.set(n.id, 0);
  }

  return levels;
}

function groupByLevel(nodes: DagNode[], levels: Map<string, number>): DagNode[][] {
  const maxLevel = Math.max(0, ...levels.values());
  const groups: DagNode[][] = Array.from({ length: maxLevel + 1 }, () => []);
  for (const n of nodes) {
    groups[levels.get(n.id) ?? 0].push(n);
  }
  return groups;
}

function getUpstream(nodeId: string, edges: DagEdge[]): Set<string> {
  const ids = new Set<string>();
  for (const e of edges) { if (e.to === nodeId) ids.add(e.from); }
  return ids;
}

function getDownstream(nodeId: string, edges: DagEdge[]): Set<string> {
  const ids = new Set<string>();
  for (const e of edges) { if (e.from === nodeId) ids.add(e.to); }
  return ids;
}

function getConnectedEdges(nodeId: string, edges: DagEdge[]): DagEdge[] {
  return edges.filter((e) => e.from === nodeId || e.to === nodeId);
}

export interface DagViewerProps { [key: string]: unknown; class?: string; }
export interface DagViewerResult { element: HTMLElement; dispose: () => void; }

export function DagViewer(props: DagViewerProps): DagViewerResult {
  const sig = surfaceCreateSignal<DagViewerState>('idle');
  const send = (type: string) => sig.set(dagViewerReducer(sig.get(), { type } as any));

  const nodes = (props.nodes ?? []) as DagNode[];
  const edges = (props.edges ?? []) as DagEdge[];
  const layout = String(props.layout ?? 'dagre');
  const zoom = typeof props.zoom === 'number' ? props.zoom : 1.0;
  const panX = typeof props.panX === 'number' ? props.panX : 0.0;
  const panY = typeof props.panY === 'number' ? props.panY : 0.0;
  const onSelectNode = props.onSelectNode as ((id: string | undefined) => void) | undefined;

  let selectedId: string | undefined = props.selectedNodeId as string | undefined;
  let focusedIndex = 0;

  const nodeMap = new Map<string, DagNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  const levels = computeLevels(nodes, edges);
  const levelGroups = groupByLevel(nodes, levels);
  const flatNodes = levelGroups.flat();

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'dag-viewer');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'application');
  root.setAttribute('aria-label', 'Dependency graph');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('data-layout', layout);
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Canvas */
  const canvasEl = document.createElement('div');
  canvasEl.setAttribute('data-part', 'canvas');
  canvasEl.setAttribute('data-state', sig.get());
  canvasEl.setAttribute('data-zoom', String(zoom));
  canvasEl.setAttribute('data-pan-x', String(panX));
  canvasEl.setAttribute('data-pan-y', String(panY));
  canvasEl.setAttribute('role', 'list');
  canvasEl.setAttribute('aria-label', `DAG with ${nodes.length} nodes`);
  root.appendChild(canvasEl);

  /* Edges section */
  const edgesEl = document.createElement('div');
  edgesEl.setAttribute('data-part', 'edges');
  edgesEl.setAttribute('data-state', sig.get());
  edgesEl.setAttribute('role', 'list');
  edgesEl.setAttribute('aria-label', 'Graph edges');
  root.appendChild(edgesEl);

  /* Controls toolbar */
  const controlsEl = document.createElement('div');
  controlsEl.setAttribute('data-part', 'controls');
  controlsEl.setAttribute('data-state', sig.get());
  controlsEl.setAttribute('role', 'toolbar');
  controlsEl.setAttribute('aria-label', 'Graph controls');
  root.appendChild(controlsEl);

  /* Detail panel */
  const detailPanelEl = document.createElement('div');
  detailPanelEl.setAttribute('data-part', 'detail-panel');
  detailPanelEl.setAttribute('data-state', sig.get());
  detailPanelEl.setAttribute('data-visible', 'false');
  detailPanelEl.setAttribute('role', 'complementary');
  detailPanelEl.setAttribute('aria-label', 'Node details');
  root.appendChild(detailPanelEl);

  const nodeElMap = new Map<string, HTMLDivElement>();

  function selectNode(id: string | undefined): void {
    selectedId = id;
    onSelectNode?.(id);
    if (id !== undefined) {
      send('SELECT_NODE');
    } else {
      send('DESELECT');
    }
    rebuildCanvas();
    rebuildEdges();
    updateDetailPanel();
  }

  function isHighlighted(id: string): boolean {
    if (!selectedId) return false;
    return id === selectedId || getUpstream(selectedId, edges).has(id) || getDownstream(selectedId, edges).has(id);
  }

  function isEdgeHighlighted(edge: DagEdge): boolean {
    return selectedId !== undefined && (edge.from === selectedId || edge.to === selectedId);
  }

  function rebuildCanvas(): void {
    canvasEl.innerHTML = '';
    nodeElMap.clear();

    for (let levelIdx = 0; levelIdx < levelGroups.length; levelIdx++) {
      const group = levelGroups[levelIdx];
      const levelEl = document.createElement('div');
      levelEl.setAttribute('data-part', 'level');
      levelEl.setAttribute('data-level', String(levelIdx));
      levelEl.setAttribute('role', 'group');
      levelEl.setAttribute('aria-label', `Level ${levelIdx}`);

      for (const node of group) {
        const globalIdx = flatNodes.indexOf(node);
        const isFocused = globalIdx === focusedIndex;
        const isSelected = node.id === selectedId;
        const highlighted = isHighlighted(node.id);

        const nodeEl = document.createElement('div');
        nodeEl.setAttribute('data-part', 'node');
        nodeEl.setAttribute('data-state', sig.get());
        nodeEl.setAttribute('data-status', node.status ?? 'unknown');
        nodeEl.setAttribute('data-selected', isSelected ? 'true' : 'false');
        nodeEl.setAttribute('data-highlighted', highlighted ? 'true' : 'false');
        nodeEl.setAttribute('role', 'button');
        nodeEl.setAttribute('aria-label', `${node.label} \u2014 ${node.status ?? 'unknown'}`);
        nodeEl.setAttribute('aria-pressed', String(isSelected));
        nodeEl.setAttribute('tabindex', isFocused ? '0' : '-1');
        nodeEl.addEventListener('click', () => selectNode(isSelected ? undefined : node.id));
        nodeElMap.set(node.id, nodeEl);

        if (isFocused) setTimeout(() => nodeEl.focus(), 0);

        const labelSpan = document.createElement('span');
        labelSpan.setAttribute('data-part', 'node-label');
        labelSpan.setAttribute('data-state', sig.get());
        labelSpan.textContent = node.label;
        nodeEl.appendChild(labelSpan);

        if (node.type) {
          const typeBadge = document.createElement('span');
          typeBadge.setAttribute('data-part', 'node-badge');
          typeBadge.setAttribute('data-state', sig.get());
          typeBadge.setAttribute('data-type', node.type);
          typeBadge.textContent = node.type;
          nodeEl.appendChild(typeBadge);
        }

        const statusBadge = document.createElement('span');
        statusBadge.setAttribute('data-part', 'node-badge');
        statusBadge.setAttribute('data-state', sig.get());
        statusBadge.setAttribute('data-status', node.status ?? 'unknown');
        statusBadge.setAttribute('aria-label', `Status: ${node.status ?? 'unknown'}`);
        statusBadge.textContent = node.status ?? 'unknown';
        nodeEl.appendChild(statusBadge);

        levelEl.appendChild(nodeEl);
      }

      canvasEl.appendChild(levelEl);
    }
  }

  function rebuildEdges(): void {
    edgesEl.innerHTML = '';
    for (let idx = 0; idx < edges.length; idx++) {
      const edge = edges[idx];
      const fromLabel = nodeMap.get(edge.from)?.label ?? edge.from;
      const toLabel = nodeMap.get(edge.to)?.label ?? edge.to;
      const highlighted = isEdgeHighlighted(edge);

      const edgeEl = document.createElement('div');
      edgeEl.setAttribute('data-part', 'edge');
      edgeEl.setAttribute('data-state', sig.get());
      edgeEl.setAttribute('data-from', edge.from);
      edgeEl.setAttribute('data-to', edge.to);
      edgeEl.setAttribute('data-highlighted', highlighted ? 'true' : 'false');
      edgeEl.setAttribute('role', 'listitem');

      const textSpan = document.createElement('span');
      textSpan.textContent = `${fromLabel} \u2192 ${toLabel}`;
      edgeEl.appendChild(textSpan);

      if (edge.label) {
        const edgeLabelSpan = document.createElement('span');
        edgeLabelSpan.setAttribute('data-part', 'edge-label');
        edgeLabelSpan.setAttribute('data-state', sig.get());
        edgeLabelSpan.textContent = edge.label;
        edgeEl.appendChild(edgeLabelSpan);
      }

      edgesEl.appendChild(edgeEl);
    }
  }

  function updateDetailPanel(): void {
    detailPanelEl.innerHTML = '';
    const visible = selectedId !== undefined;
    detailPanelEl.setAttribute('data-visible', visible ? 'true' : 'false');

    if (!selectedId) return;
    const selected = nodeMap.get(selectedId);
    if (!selected) return;

    const upstream = getUpstream(selectedId, edges);
    const downstream = getDownstream(selectedId, edges);
    const connectedEdges = getConnectedEdges(selectedId, edges);

    const h3 = document.createElement('h3');
    h3.setAttribute('data-part', 'detail-title');
    h3.textContent = selected.label;
    detailPanelEl.appendChild(h3);

    if (selected.type) {
      const typeDiv = document.createElement('div');
      typeDiv.setAttribute('data-part', 'detail-type');
      const strong = document.createElement('strong');
      strong.textContent = 'Type: ';
      typeDiv.appendChild(strong);
      typeDiv.appendChild(document.createTextNode(selected.type));
      detailPanelEl.appendChild(typeDiv);
    }

    const statusDiv = document.createElement('div');
    statusDiv.setAttribute('data-part', 'detail-status');
    const statusStrong = document.createElement('strong');
    statusStrong.textContent = 'Status: ';
    statusDiv.appendChild(statusStrong);
    statusDiv.appendChild(document.createTextNode(selected.status ?? 'unknown'));
    detailPanelEl.appendChild(statusDiv);

    /* Upstream */
    const upDiv = document.createElement('div');
    upDiv.setAttribute('data-part', 'detail-upstream');
    upDiv.setAttribute('aria-label', 'Upstream dependencies');
    const upStrong = document.createElement('strong');
    upStrong.textContent = `Upstream (${upstream.size}):`;
    upDiv.appendChild(upStrong);
    if (upstream.size > 0) {
      const ul = document.createElement('ul');
      for (const id of upstream) {
        const li = document.createElement('li');
        li.textContent = nodeMap.get(id)?.label ?? id;
        ul.appendChild(li);
      }
      upDiv.appendChild(ul);
    } else {
      upDiv.appendChild(document.createTextNode(' None'));
    }
    detailPanelEl.appendChild(upDiv);

    /* Downstream */
    const downDiv = document.createElement('div');
    downDiv.setAttribute('data-part', 'detail-downstream');
    downDiv.setAttribute('aria-label', 'Downstream dependents');
    const downStrong = document.createElement('strong');
    downStrong.textContent = `Downstream (${downstream.size}):`;
    downDiv.appendChild(downStrong);
    if (downstream.size > 0) {
      const ul = document.createElement('ul');
      for (const id of downstream) {
        const li = document.createElement('li');
        li.textContent = nodeMap.get(id)?.label ?? id;
        ul.appendChild(li);
      }
      downDiv.appendChild(ul);
    } else {
      downDiv.appendChild(document.createTextNode(' None'));
    }
    detailPanelEl.appendChild(downDiv);

    /* Connected edges */
    const ceDiv = document.createElement('div');
    ceDiv.setAttribute('data-part', 'detail-edges');
    ceDiv.setAttribute('aria-label', 'Connected edges');
    const ceStrong = document.createElement('strong');
    ceStrong.textContent = `Connected edges (${connectedEdges.length}):`;
    ceDiv.appendChild(ceStrong);
    if (connectedEdges.length > 0) {
      const ul = document.createElement('ul');
      for (const ce of connectedEdges) {
        const fl = nodeMap.get(ce.from)?.label ?? ce.from;
        const tl = nodeMap.get(ce.to)?.label ?? ce.to;
        const li = document.createElement('li');
        li.textContent = `${fl} \u2192 ${tl}${ce.label ? ` (${ce.label})` : ''}`;
        ul.appendChild(li);
      }
      ceDiv.appendChild(ul);
    } else {
      ceDiv.appendChild(document.createTextNode(' None'));
    }
    detailPanelEl.appendChild(ceDiv);
  }

  root.addEventListener('keydown', (e) => {
    const count = flatNodes.length;
    if (count === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusedIndex = Math.min(focusedIndex + 1, count - 1);
        rebuildCanvas();
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusedIndex = Math.max(focusedIndex - 1, 0);
        rebuildCanvas();
        break;
      case 'Home':
        e.preventDefault();
        focusedIndex = 0;
        rebuildCanvas();
        break;
      case 'End':
        e.preventDefault();
        focusedIndex = count - 1;
        rebuildCanvas();
        break;
      case 'Enter': {
        e.preventDefault();
        const node = flatNodes[focusedIndex];
        if (node) selectNode(node.id === selectedId ? undefined : node.id);
        break;
      }
      case 'Escape':
        e.preventDefault();
        selectNode(undefined);
        break;
    }
  });

  rebuildCanvas();
  rebuildEdges();
  updateDetailPanel();

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    canvasEl.setAttribute('data-state', s);
    edgesEl.setAttribute('data-state', s);
    controlsEl.setAttribute('data-state', s);
    detailPanelEl.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default DagViewer;
