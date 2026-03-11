import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type DependencyTreeState = 'idle' | 'nodeSelected' | 'filtering';
export type DependencyTreeEvent =
  | { type: 'SELECT' }
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'SEARCH' }
  | { type: 'FILTER_SCOPE' }
  | { type: 'DESELECT' }
  | { type: 'CLEAR' };

export function dependencyTreeReducer(state: DependencyTreeState, event: DependencyTreeEvent): DependencyTreeState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT') return 'nodeSelected';
      if (event.type === 'EXPAND') return 'idle';
      if (event.type === 'COLLAPSE') return 'idle';
      if (event.type === 'SEARCH') return 'filtering';
      if (event.type === 'FILTER_SCOPE') return 'idle';
      return state;
    case 'nodeSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT') return 'nodeSelected';
      return state;
    case 'filtering':
      if (event.type === 'CLEAR') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface DependencyTreeProps { [key: string]: unknown; class?: string; }
export interface DependencyTreeResult { element: HTMLElement; dispose: () => void; }

export function DependencyTree(props: DependencyTreeProps): DependencyTreeResult {
  const sig = surfaceCreateSignal<DependencyTreeState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(dependencyTreeReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'dependency-tree');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'group');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Search bar */
  const searchEl = document.createElement('div');
  searchEl.setAttribute('data-part', 'search');
  searchEl.setAttribute('data-state', state());
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search dependencies...';
  searchInput.setAttribute('aria-label', 'Search dependencies');
  searchInput.style.width = '100%';
  searchInput.style.padding = '6px 8px';
  searchInput.style.boxSizing = 'border-box';
  searchInput.addEventListener('input', () => {
    if (searchInput.value.trim()) {
      send('SEARCH');
    } else {
      send('CLEAR');
    }
  });
  searchEl.appendChild(searchInput);
  root.appendChild(searchEl);

  /* Scope filter chips */
  const scopeFilterEl = document.createElement('div');
  scopeFilterEl.setAttribute('data-part', 'scope-filter');
  scopeFilterEl.setAttribute('data-state', state());
  scopeFilterEl.setAttribute('role', 'radiogroup');
  scopeFilterEl.setAttribute('aria-label', 'Filter by dependency type');
  const scopes = ['all', 'prod', 'dev', 'peer', 'optional'];
  let activeScope = 'all';
  const scopeButtons: HTMLButtonElement[] = [];
  for (const scope of scopes) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', scope === activeScope ? 'true' : 'false');
    btn.setAttribute('data-part', 'scope-chip');
    btn.setAttribute('data-scope', scope);
    btn.setAttribute('data-active', scope === activeScope ? 'true' : 'false');
    btn.textContent = scope;
    btn.style.padding = '3px 10px';
    btn.style.marginRight = '4px';
    btn.style.border = '1px solid currentColor';
    btn.style.borderRadius = '12px';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '0.85em';
    btn.style.background = scope === activeScope ? 'currentColor' : 'transparent';
    btn.addEventListener('click', () => {
      activeScope = scope;
      for (const b of scopeButtons) {
        const s = b.getAttribute('data-scope') ?? '';
        b.setAttribute('aria-checked', s === activeScope ? 'true' : 'false');
        b.setAttribute('data-active', s === activeScope ? 'true' : 'false');
        b.style.background = s === activeScope ? 'currentColor' : 'transparent';
      }
      send('FILTER_SCOPE');
    });
    scopeButtons.push(btn);
    scopeFilterEl.appendChild(btn);
  }
  root.appendChild(scopeFilterEl);

  /* Summary */
  const summaryEl = document.createElement('div');
  summaryEl.setAttribute('data-part', 'summary');
  summaryEl.setAttribute('aria-live', 'polite');
  summaryEl.style.padding = '6px 0';
  summaryEl.style.fontSize = '0.9em';
  summaryEl.style.opacity = '0.8';
  summaryEl.textContent = '0 packages';
  root.appendChild(summaryEl);

  /* Tree container */
  const treeEl = document.createElement('ul');
  treeEl.setAttribute('data-part', 'tree');
  treeEl.setAttribute('data-state', state());
  treeEl.setAttribute('role', 'tree');
  treeEl.setAttribute('aria-label', 'Dependency tree');
  treeEl.style.listStyle = 'none';
  treeEl.style.margin = '0';
  treeEl.style.padding = '0';
  root.appendChild(treeEl);

  /* Tree node template */
  const treeNodeEl = document.createElement('li');
  treeNodeEl.setAttribute('data-part', 'tree-node');
  treeNodeEl.setAttribute('role', 'treeitem');
  treeNodeEl.setAttribute('tabindex', '-1');
  treeNodeEl.style.cursor = 'pointer';
  treeNodeEl.addEventListener('click', () => {
    send('SELECT');
  });
  const nodeContent = document.createElement('span');
  nodeContent.setAttribute('data-part', 'tree-node-content');
  nodeContent.style.display = 'inline-flex';
  nodeContent.style.alignItems = 'center';
  nodeContent.style.gap = '6px';

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.setAttribute('data-part', 'toggle');
  toggleBtn.setAttribute('aria-label', 'Expand');
  toggleBtn.style.background = 'none';
  toggleBtn.style.border = 'none';
  toggleBtn.style.cursor = 'pointer';
  toggleBtn.style.padding = '0';
  toggleBtn.style.fontSize = '12px';
  toggleBtn.textContent = '\u25B8';
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    send('EXPAND');
  });
  nodeContent.appendChild(toggleBtn);

  const packageNameEl = document.createElement('span');
  packageNameEl.setAttribute('data-part', 'package-name');
  packageNameEl.textContent = 'package';
  nodeContent.appendChild(packageNameEl);

  const versionBadgeEl = document.createElement('span');
  versionBadgeEl.setAttribute('data-part', 'version');
  versionBadgeEl.style.fontSize = '0.85em';
  versionBadgeEl.style.opacity = '0.8';
  versionBadgeEl.textContent = '@0.0.0';
  nodeContent.appendChild(versionBadgeEl);

  const typeBadgeEl = document.createElement('span');
  typeBadgeEl.setAttribute('data-part', 'type-badge');
  typeBadgeEl.setAttribute('data-type', 'prod');
  typeBadgeEl.style.fontSize = '0.75em';
  typeBadgeEl.style.padding = '1px 5px';
  typeBadgeEl.style.borderRadius = '3px';
  typeBadgeEl.style.border = '1px solid currentColor';
  typeBadgeEl.style.opacity = '0.7';
  typeBadgeEl.textContent = 'prod';
  nodeContent.appendChild(typeBadgeEl);

  const conflictIconEl = document.createElement('span');
  conflictIconEl.setAttribute('data-part', 'conflict');
  conflictIconEl.setAttribute('data-visible', 'false');
  conflictIconEl.setAttribute('aria-label', 'Version conflict');
  conflictIconEl.style.color = 'orange';
  conflictIconEl.style.display = 'none';
  conflictIconEl.innerHTML = '&#9888;';
  nodeContent.appendChild(conflictIconEl);

  const dupBadgeEl = document.createElement('span');
  dupBadgeEl.setAttribute('data-part', 'dup');
  dupBadgeEl.setAttribute('data-visible', 'false');
  dupBadgeEl.style.fontSize = '0.75em';
  dupBadgeEl.style.opacity = '0.7';
  dupBadgeEl.style.display = 'none';
  nodeContent.appendChild(dupBadgeEl);

  treeNodeEl.appendChild(nodeContent);
  treeEl.appendChild(treeNodeEl);

  /* Detail panel */
  const detailPanelEl = document.createElement('div');
  detailPanelEl.setAttribute('data-part', 'detail');
  detailPanelEl.setAttribute('data-visible', 'false');
  detailPanelEl.setAttribute('data-state', state());
  detailPanelEl.setAttribute('role', 'complementary');
  detailPanelEl.setAttribute('aria-label', 'Package details');
  detailPanelEl.style.display = 'none';
  detailPanelEl.style.borderLeft = '1px solid';
  detailPanelEl.style.padding = '12px';
  detailPanelEl.style.marginTop = '8px';

  const detailNameEl = document.createElement('h3');
  detailNameEl.setAttribute('data-part', 'detail-name');
  detailPanelEl.appendChild(detailNameEl);
  const detailVersionEl = document.createElement('div');
  detailVersionEl.setAttribute('data-part', 'detail-version');
  detailPanelEl.appendChild(detailVersionEl);
  const detailTypeEl = document.createElement('div');
  detailTypeEl.setAttribute('data-part', 'detail-type');
  detailPanelEl.appendChild(detailTypeEl);
  root.appendChild(detailPanelEl);

  /* Keyboard navigation */
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      send('SELECT');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      send('EXPAND');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      send('COLLAPSE');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      send('DESELECT');
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      searchInput.focus();
    }
  });

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    searchEl.setAttribute('data-state', s);
    scopeFilterEl.setAttribute('data-state', s);
    treeEl.setAttribute('data-state', s);
    detailPanelEl.setAttribute('data-state', s);
    const showDetail = s === 'nodeSelected';
    detailPanelEl.setAttribute('data-visible', showDetail ? 'true' : 'false');
    detailPanelEl.style.display = showDetail ? 'block' : 'none';
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default DependencyTree;
