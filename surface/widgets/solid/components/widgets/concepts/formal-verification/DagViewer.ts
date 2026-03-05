import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type DagViewerState = 'idle' | 'nodeSelected' | 'computing';
export type DagViewerEvent =
  | { type: 'SELECT_NODE' }
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

export interface DagViewerProps { [key: string]: unknown; class?: string; }
export interface DagViewerResult { element: HTMLElement; dispose: () => void; }

export function DagViewer(props: DagViewerProps): DagViewerResult {
  const sig = surfaceCreateSignal<DagViewerState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(dagViewerReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'dag-viewer');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'application');
  root.setAttribute('aria-label', 'Dependency graph');
  root.setAttribute('data-state', state());
  root.setAttribute('data-layout', 'dagre');
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Canvas */
  const canvasEl = document.createElement('div');
  canvasEl.setAttribute('data-part', 'canvas');
  canvasEl.setAttribute('data-state', state());
  canvasEl.setAttribute('role', 'list');

  /* Level group template */
  const levelEl = document.createElement('div');
  levelEl.setAttribute('data-part', 'level');
  levelEl.setAttribute('data-level', '0');
  levelEl.setAttribute('role', 'group');
  levelEl.setAttribute('aria-label', 'Level 0');

  /* Node template */
  const nodeEl = document.createElement('div');
  nodeEl.setAttribute('data-part', 'node');
  nodeEl.setAttribute('data-state', state());
  nodeEl.setAttribute('data-status', 'unknown');
  nodeEl.setAttribute('data-selected', 'false');
  nodeEl.setAttribute('data-highlighted', 'false');
  nodeEl.setAttribute('role', 'button');
  nodeEl.setAttribute('aria-pressed', 'false');
  nodeEl.setAttribute('tabindex', '0');
  nodeEl.addEventListener('click', () => {
    if (state() === 'nodeSelected') send('DESELECT');
    else send('SELECT_NODE');
  });

  const nodeLabelEl = document.createElement('span');
  nodeLabelEl.setAttribute('data-part', 'node-label');
  nodeLabelEl.setAttribute('data-state', state());
  nodeEl.appendChild(nodeLabelEl);

  const nodeBadgeEl = document.createElement('span');
  nodeBadgeEl.setAttribute('data-part', 'node-badge');
  nodeBadgeEl.setAttribute('data-state', state());
  nodeEl.appendChild(nodeBadgeEl);

  levelEl.appendChild(nodeEl);
  canvasEl.appendChild(levelEl);
  root.appendChild(canvasEl);

  /* Edges */
  const edgesEl = document.createElement('div');
  edgesEl.setAttribute('data-part', 'edges');
  edgesEl.setAttribute('data-state', state());
  edgesEl.setAttribute('role', 'list');
  edgesEl.setAttribute('aria-label', 'Graph edges');

  const edgeEl = document.createElement('div');
  edgeEl.setAttribute('data-part', 'edge');
  edgeEl.setAttribute('data-state', state());
  edgeEl.setAttribute('data-highlighted', 'false');
  edgeEl.setAttribute('role', 'listitem');

  const edgeLabelEl = document.createElement('span');
  edgeLabelEl.setAttribute('data-part', 'edge-label');
  edgeLabelEl.setAttribute('data-state', state());
  edgeEl.appendChild(edgeLabelEl);
  edgesEl.appendChild(edgeEl);
  root.appendChild(edgesEl);

  /* Controls toolbar */
  const controlsEl = document.createElement('div');
  controlsEl.setAttribute('data-part', 'controls');
  controlsEl.setAttribute('data-state', state());
  controlsEl.setAttribute('role', 'toolbar');
  controlsEl.setAttribute('aria-label', 'Graph controls');
  root.appendChild(controlsEl);

  /* Detail panel */
  const detailPanelEl = document.createElement('div');
  detailPanelEl.setAttribute('data-part', 'detail-panel');
  detailPanelEl.setAttribute('data-state', state());
  detailPanelEl.setAttribute('data-visible', 'false');
  detailPanelEl.setAttribute('role', 'complementary');
  detailPanelEl.setAttribute('aria-label', 'Node details');
  detailPanelEl.style.display = 'none';

  const detailTitleEl = document.createElement('h3');
  detailTitleEl.setAttribute('data-part', 'detail-title');
  detailPanelEl.appendChild(detailTitleEl);

  const detailTypeEl = document.createElement('div');
  detailTypeEl.setAttribute('data-part', 'detail-type');
  detailPanelEl.appendChild(detailTypeEl);

  const detailStatusEl = document.createElement('div');
  detailStatusEl.setAttribute('data-part', 'detail-status');
  detailPanelEl.appendChild(detailStatusEl);

  const detailUpstreamEl = document.createElement('div');
  detailUpstreamEl.setAttribute('data-part', 'detail-upstream');
  detailUpstreamEl.setAttribute('aria-label', 'Upstream dependencies');
  detailPanelEl.appendChild(detailUpstreamEl);

  const detailDownstreamEl = document.createElement('div');
  detailDownstreamEl.setAttribute('data-part', 'detail-downstream');
  detailDownstreamEl.setAttribute('aria-label', 'Downstream dependents');
  detailPanelEl.appendChild(detailDownstreamEl);

  const detailEdgesEl = document.createElement('div');
  detailEdgesEl.setAttribute('data-part', 'detail-edges');
  detailEdgesEl.setAttribute('aria-label', 'Connected edges');
  detailPanelEl.appendChild(detailEdgesEl);

  root.appendChild(detailPanelEl);

  /* Keyboard navigation */
  root.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Home':
      case 'End':
        e.preventDefault();
        break;
      case 'Enter':
        e.preventDefault();
        if (state() === 'nodeSelected') send('DESELECT');
        else send('SELECT_NODE');
        break;
      case 'Escape':
        e.preventDefault();
        send('DESELECT');
        break;
    }
  });

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    canvasEl.setAttribute('data-state', s);
    nodeEl.setAttribute('data-state', s);
    nodeLabelEl.setAttribute('data-state', s);
    nodeBadgeEl.setAttribute('data-state', s);
    edgesEl.setAttribute('data-state', s);
    edgeEl.setAttribute('data-state', s);
    edgeLabelEl.setAttribute('data-state', s);
    controlsEl.setAttribute('data-state', s);
    detailPanelEl.setAttribute('data-state', s);
    const isSelected = s === 'nodeSelected';
    detailPanelEl.setAttribute('data-visible', isSelected ? 'true' : 'false');
    detailPanelEl.style.display = isSelected ? 'block' : 'none';
    nodeEl.setAttribute('data-selected', isSelected ? 'true' : 'false');
    nodeEl.setAttribute('aria-pressed', String(isSelected));
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default DagViewer;
