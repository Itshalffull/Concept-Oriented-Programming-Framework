import { uid } from '../shared/uid.js';

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  label: string;
  type?: string;
  [k: string]: unknown;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  [k: string]: unknown;
}

export interface GraphViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  ariaLabel?: string;
  nodeCount?: number;
  edgeCount?: number;
  zoom?: number;
  panX?: number;
  panY?: number;
  selectedNodeId?: string;
  searchQuery?: string;
  visibleTypes?: string[];
  nodeSize?: number;
  linkThickness?: number;
  chargeStrength?: number;
  linkDistance?: number;
  viewMode?: 'global' | 'local';
  simulationRunning?: boolean;
  filterPanelOpen?: boolean;
  onNodeSelect?: (id: string) => void;
  onSearch?: (query: string) => void;
  onViewModeChange?: (mode: 'global' | 'local') => void;
  canvas?: string | HTMLElement;
  filterPanel?: string | HTMLElement;
  detailPanel?: string | HTMLElement;
  minimap?: string | HTMLElement;
  children?: string | HTMLElement;
}

export interface GraphViewInstance {
  element: HTMLElement;
  update(props: Partial<GraphViewProps>): void;
  destroy(): void;
}

export function createGraphView(options: {
  target: HTMLElement;
  props: GraphViewProps;
}): GraphViewInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'graph-view');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'application');
  root.setAttribute('aria-roledescription', 'graph visualization');
  root.id = id;

  const toolbarEl = document.createElement('div');
  toolbarEl.setAttribute('data-part', 'toolbar');
  toolbarEl.setAttribute('role', 'toolbar');
  root.appendChild(toolbarEl);

  const searchInput = document.createElement('input');
  searchInput.setAttribute('data-part', 'search-input');
  searchInput.setAttribute('type', 'search');
  searchInput.setAttribute('aria-label', 'Search nodes');
  toolbarEl.appendChild(searchInput);

  const modeToggle = document.createElement('button');
  modeToggle.setAttribute('data-part', 'mode-toggle');
  modeToggle.setAttribute('type', 'button');
  modeToggle.setAttribute('aria-label', 'Toggle view mode');
  toolbarEl.appendChild(modeToggle);

  const canvasEl = document.createElement('div');
  canvasEl.setAttribute('data-part', 'canvas');
  canvasEl.setAttribute('role', 'img');
  canvasEl.setAttribute('aria-label', 'Graph canvas');
  root.appendChild(canvasEl);

  const filterPanelEl = document.createElement('div');
  filterPanelEl.setAttribute('data-part', 'filter-panel');
  filterPanelEl.setAttribute('role', 'complementary');
  filterPanelEl.setAttribute('aria-label', 'Graph filters');
  root.appendChild(filterPanelEl);

  const detailPanelEl = document.createElement('div');
  detailPanelEl.setAttribute('data-part', 'detail-panel');
  detailPanelEl.setAttribute('role', 'complementary');
  detailPanelEl.setAttribute('aria-label', 'Node details');
  root.appendChild(detailPanelEl);

  const minimapEl = document.createElement('div');
  minimapEl.setAttribute('data-part', 'minimap');
  minimapEl.setAttribute('role', 'img');
  minimapEl.setAttribute('aria-label', 'Graph minimap');
  root.appendChild(minimapEl);

  searchInput.addEventListener('input', () => currentProps.onSearch?.(searchInput.value));
  cleanups.push(() => {});
  modeToggle.addEventListener('click', () => {
    const next = currentProps.viewMode === 'global' ? 'local' : 'global';
    currentProps.onViewModeChange?.(next);
  });

  function sync() {
    root.setAttribute('data-state', currentProps.simulationRunning ? 'running' : 'idle');
    root.setAttribute('data-view', currentProps.viewMode ?? 'global');
    if (currentProps.ariaLabel) root.setAttribute('aria-label', currentProps.ariaLabel);
    searchInput.value = currentProps.searchQuery ?? '';
    modeToggle.textContent = (currentProps.viewMode ?? 'global') === 'global' ? 'Local' : 'Global';
    filterPanelEl.style.display = currentProps.filterPanelOpen ? '' : 'none';
    const selected = currentProps.nodes.find(n => n.id === currentProps.selectedNodeId);
    detailPanelEl.style.display = selected ? '' : 'none';
    if (selected) {
      detailPanelEl.innerHTML = '';
      const h = document.createElement('h3');
      h.textContent = selected.label;
      detailPanelEl.appendChild(h);
    }
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createGraphView;
