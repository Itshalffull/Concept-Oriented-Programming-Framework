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

/* --- Types --- */

export interface DependencyNode {
  name: string;
  version: string;
  resolved?: string;
  type?: 'prod' | 'dev' | 'peer' | 'optional';
  dependencies?: DependencyNode[];
}

export interface DependencyTreeProps {
  [key: string]: unknown;
  class?: string;
  root: { name: string; version: string; dependencies?: DependencyNode[] };
  expandDepth?: number;
  showDevDeps?: boolean;
  selectedPackage?: string;
}
export interface DependencyTreeResult { element: HTMLElement; dispose: () => void; }

/* --- Helpers --- */

type ScopeFilter = 'all' | 'prod' | 'dev' | 'peer' | 'optional';
const SCOPE_OPTIONS: ScopeFilter[] = ['all', 'prod', 'dev', 'peer', 'optional'];

function collectPackages(nodes: DependencyNode[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  function walk(deps: DependencyNode[]) {
    for (const dep of deps) {
      const versions = map.get(dep.name) ?? [];
      versions.push(dep.version);
      map.set(dep.name, versions);
      if (dep.dependencies) walk(dep.dependencies);
    }
  }
  walk(nodes);
  return map;
}

function countByType(nodes: DependencyNode[]): Record<string, number> {
  const counts: Record<string, number> = { prod: 0, dev: 0, peer: 0, optional: 0 };
  let total = 0;
  function walk(deps: DependencyNode[]) {
    for (const dep of deps) {
      const t = dep.type ?? 'prod';
      counts[t] = (counts[t] ?? 0) + 1;
      total++;
      if (dep.dependencies) walk(dep.dependencies);
    }
  }
  walk(nodes);
  return { ...counts, total };
}

function matchesSearch(node: DependencyNode, query: string): boolean {
  const q = query.toLowerCase();
  if (node.name.toLowerCase().includes(q)) return true;
  if (node.version.toLowerCase().includes(q)) return true;
  if (node.dependencies) return node.dependencies.some((child) => matchesSearch(child, q));
  return false;
}

function matchesScope(node: DependencyNode, scope: ScopeFilter): boolean {
  if (scope === 'all') return true;
  return (node.type ?? 'prod') === scope;
}

/* --- Tree node builder --- */

function buildTreeNode(
  node: DependencyNode,
  depth: number,
  expandDepth: number,
  packageMap: Map<string, string[]>,
  selectedSig: { get: () => string | null },
  scopeSig: { get: () => ScopeFilter },
  querySig: { get: () => string },
  onSelect: (name: string) => void,
): HTMLLIElement | null {
  const scope = scopeSig.get();
  const query = querySig.get();
  if (!matchesScope(node, scope)) return null;
  if (query && !matchesSearch(node, query)) return null;

  const li = document.createElement('li');
  li.setAttribute('role', 'treeitem');
  li.setAttribute('aria-label', `${node.name}@${node.version}`);
  li.setAttribute('data-part', 'tree-node');
  li.setAttribute('data-scope', node.type ?? 'prod');
  li.setAttribute('tabindex', '-1');
  li.style.paddingLeft = `${depth * 20}px`;

  const hasChildren = !!(node.dependencies && node.dependencies.length > 0);
  let expanded = depth < expandDepth;

  const versions = packageMap.get(node.name) ?? [];
  const isDuplicate = versions.length > 1;
  const hasConflict = isDuplicate && new Set(versions).size > 1;

  li.setAttribute('data-conflict', hasConflict ? 'true' : 'false');
  li.setAttribute('data-duplicate', isDuplicate ? 'true' : 'false');

  const contentSpan = document.createElement('span');
  contentSpan.setAttribute('data-part', 'tree-node-content');
  contentSpan.style.display = 'inline-flex';
  contentSpan.style.alignItems = 'center';
  contentSpan.style.gap = '6px';
  contentSpan.style.cursor = 'pointer';

  // Toggle button
  let toggleBtn: HTMLButtonElement | null = null;
  if (hasChildren) {
    toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.setAttribute('data-part', 'toggle');
    toggleBtn.setAttribute('aria-label', expanded ? 'Collapse' : 'Expand');
    toggleBtn.textContent = expanded ? '\u25BE' : '\u25B8';
    Object.assign(toggleBtn.style, { background: 'none', border: 'none', cursor: 'pointer', padding: '0', fontSize: '12px' });
    contentSpan.appendChild(toggleBtn);
  } else {
    const spacer = document.createElement('span');
    spacer.style.display = 'inline-block';
    spacer.style.width = '12px';
    contentSpan.appendChild(spacer);
  }

  // Package name
  const nameSpan = document.createElement('span');
  nameSpan.setAttribute('data-part', 'package-name');
  nameSpan.textContent = node.name;
  contentSpan.appendChild(nameSpan);

  // Version badge
  const versionSpan = document.createElement('span');
  versionSpan.setAttribute('data-part', 'version');
  versionSpan.textContent = `@${node.version}`;
  Object.assign(versionSpan.style, { fontSize: '0.85em', opacity: '0.8' });
  contentSpan.appendChild(versionSpan);

  // Type badge
  const typeBadge = document.createElement('span');
  typeBadge.setAttribute('data-part', 'type-badge');
  typeBadge.setAttribute('data-type', node.type ?? 'prod');
  typeBadge.textContent = node.type ?? 'prod';
  Object.assign(typeBadge.style, { fontSize: '0.75em', padding: '1px 5px', borderRadius: '3px', border: '1px solid currentColor', opacity: '0.7' });
  contentSpan.appendChild(typeBadge);

  // Conflict icon
  if (hasConflict) {
    const conflictSpan = document.createElement('span');
    conflictSpan.setAttribute('data-part', 'conflict');
    conflictSpan.setAttribute('data-visible', 'true');
    conflictSpan.setAttribute('aria-label', 'Version conflict');
    conflictSpan.title = `Conflicting versions: ${[...new Set(versions)].join(', ')}`;
    conflictSpan.style.color = 'orange';
    conflictSpan.innerHTML = '&#9888;';
    contentSpan.appendChild(conflictSpan);
  }

  // Duplicate badge
  if (isDuplicate) {
    const dupSpan = document.createElement('span');
    dupSpan.setAttribute('data-part', 'dup');
    dupSpan.setAttribute('data-visible', 'true');
    dupSpan.setAttribute('aria-label', `Duplicate: appears ${versions.length} times`);
    dupSpan.title = `Appears ${versions.length} times`;
    Object.assign(dupSpan.style, { fontSize: '0.75em', opacity: '0.7' });
    dupSpan.textContent = `x${versions.length}`;
    contentSpan.appendChild(dupSpan);
  }

  li.appendChild(contentSpan);

  // Children container
  let childUl: HTMLUListElement | null = null;
  function renderChildren() {
    if (childUl) { childUl.remove(); childUl = null; }
    if (!hasChildren || !expanded || !node.dependencies) return;
    const filteredChildren = node.dependencies.filter(
      (child) => matchesScope(child, scopeSig.get()) && (!querySig.get() || matchesSearch(child, querySig.get()))
    );
    if (filteredChildren.length === 0) return;
    childUl = document.createElement('ul');
    childUl.setAttribute('role', 'group');
    Object.assign(childUl.style, { listStyle: 'none', margin: '0', padding: '0' });
    for (const child of filteredChildren) {
      const childLi = buildTreeNode(child, depth + 1, expandDepth, packageMap, selectedSig, scopeSig, querySig, onSelect);
      if (childLi) childUl.appendChild(childLi);
    }
    li.appendChild(childUl);
  }

  if (hasChildren) {
    li.setAttribute('aria-expanded', String(expanded));
    renderChildren();
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      expanded = !expanded;
      li.setAttribute('aria-expanded', String(expanded));
      toggleBtn!.textContent = expanded ? '\u25BE' : '\u25B8';
      toggleBtn!.setAttribute('aria-label', expanded ? 'Collapse' : 'Expand');
      renderChildren();
    });
  }

  li.addEventListener('click', (e) => {
    e.stopPropagation();
    onSelect(node.name);
  });

  return li;
}

/* --- Main Component --- */

export function DependencyTree(props: DependencyTreeProps): DependencyTreeResult {
  const sig = surfaceCreateSignal<DependencyTreeState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(dependencyTreeReducer(sig.get(), { type } as any));

  const rootData = props.root ?? { name: '', version: '', dependencies: [] };
  const expandDepth = (props.expandDepth as number) ?? 2;
  const showDevDeps = props.showDevDeps !== false;

  let selectedName: string | null = (props.selectedPackage as string) ?? null;
  let searchQuery = '';
  let scopeFilter: ScopeFilter = 'all';
  const selectedSig = { get: () => selectedName };
  const scopeSig = { get: () => scopeFilter };
  const querySig = { get: () => searchQuery };

  const deps = rootData.dependencies ?? [];
  const visibleDeps = showDevDeps ? deps : deps.filter((d) => (d.type ?? 'prod') !== 'dev');
  const packageMap = collectPackages(visibleDeps);
  const counts = countByType(visibleDeps);

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'dependency-tree');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', state());
  root.setAttribute('aria-label', `Dependencies for ${rootData.name}`);
  root.setAttribute('role', 'group');
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Search bar
  const searchDiv = document.createElement('div');
  searchDiv.setAttribute('data-part', 'search');
  searchDiv.setAttribute('data-state', state());
  root.appendChild(searchDiv);

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search dependencies...';
  searchInput.setAttribute('aria-label', 'Search dependencies');
  Object.assign(searchInput.style, { width: '100%', padding: '6px 8px', boxSizing: 'border-box' });
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    if (searchQuery) {
      send('SEARCH');
    } else {
      send('CLEAR');
    }
    rebuildTree();
  });
  searchDiv.appendChild(searchInput);

  // Scope filter chips
  const scopeDiv = document.createElement('div');
  scopeDiv.setAttribute('data-part', 'scope-filter');
  scopeDiv.setAttribute('data-state', state());
  scopeDiv.setAttribute('role', 'radiogroup');
  scopeDiv.setAttribute('aria-label', 'Filter by dependency type');
  root.appendChild(scopeDiv);

  const scopeButtons: HTMLButtonElement[] = [];
  for (const scope of SCOPE_OPTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', scopeFilter === scope ? 'true' : 'false');
    btn.setAttribute('data-part', 'scope-chip');
    btn.setAttribute('data-scope', scope);
    btn.setAttribute('data-active', scopeFilter === scope ? 'true' : 'false');
    btn.textContent = scope;
    Object.assign(btn.style, {
      padding: '3px 10px', marginRight: '4px', border: '1px solid currentColor',
      borderRadius: '12px', background: scopeFilter === scope ? 'currentColor' : 'transparent',
      cursor: 'pointer', fontSize: '0.85em',
    });
    btn.addEventListener('click', () => {
      scopeFilter = scope;
      send('FILTER_SCOPE');
      updateScopeButtons();
      rebuildTree();
    });
    scopeDiv.appendChild(btn);
    scopeButtons.push(btn);
  }

  function updateScopeButtons() {
    for (const btn of scopeButtons) {
      const s = btn.getAttribute('data-scope') as ScopeFilter;
      const active = scopeFilter === s;
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
      btn.setAttribute('data-active', active ? 'true' : 'false');
      btn.style.background = active ? 'currentColor' : 'transparent';
    }
  }

  // Summary
  const summaryDiv = document.createElement('div');
  summaryDiv.setAttribute('data-part', 'summary');
  summaryDiv.setAttribute('aria-live', 'polite');
  Object.assign(summaryDiv.style, { padding: '6px 0', fontSize: '0.9em', opacity: '0.8' });
  const summaryParts: string[] = [];
  if (counts.prod > 0) summaryParts.push(`${counts.prod} prod`);
  if (counts.dev > 0) summaryParts.push(`${counts.dev} dev`);
  if (counts.peer > 0) summaryParts.push(`${counts.peer} peer`);
  if (counts.optional > 0) summaryParts.push(`${counts.optional} optional`);
  summaryDiv.textContent = `${counts.total} packages${summaryParts.length > 0 ? ` (${summaryParts.join(', ')})` : ''}`;
  root.appendChild(summaryDiv);

  // Tree
  const treeUl = document.createElement('ul');
  treeUl.setAttribute('data-part', 'tree');
  treeUl.setAttribute('data-state', state());
  treeUl.setAttribute('role', 'tree');
  treeUl.setAttribute('aria-label', 'Dependency tree');
  Object.assign(treeUl.style, { listStyle: 'none', margin: '0', padding: '0' });
  root.appendChild(treeUl);

  function rebuildTree() {
    treeUl.innerHTML = '';
    const rendered = visibleDeps.filter(
      (d) => matchesScope(d, scopeFilter) && (!searchQuery || matchesSearch(d, searchQuery))
    );
    for (const dep of rendered) {
      const li = buildTreeNode(dep, 0, expandDepth, packageMap, selectedSig, scopeSig, querySig, handleSelect);
      if (li) treeUl.appendChild(li);
    }
  }

  // Detail panel
  const detailDiv = document.createElement('div');
  detailDiv.setAttribute('data-part', 'detail');
  detailDiv.setAttribute('data-visible', 'false');
  detailDiv.setAttribute('role', 'complementary');
  detailDiv.setAttribute('aria-label', 'Package details');
  detailDiv.style.display = 'none';
  Object.assign(detailDiv.style, { borderLeft: '1px solid', padding: '12px', marginTop: '8px' });
  root.appendChild(detailDiv);

  function findNode(nodes: DependencyNode[], name: string): DependencyNode | null {
    for (const n of nodes) {
      if (n.name === name) return n;
      if (n.dependencies) {
        const found = findNode(n.dependencies, name);
        if (found) return found;
      }
    }
    return null;
  }

  function updateDetail() {
    detailDiv.innerHTML = '';
    if (!selectedName) {
      detailDiv.style.display = 'none';
      detailDiv.setAttribute('data-visible', 'false');
      return;
    }
    const node = findNode(visibleDeps, selectedName);
    if (!node) {
      detailDiv.style.display = 'none';
      detailDiv.setAttribute('data-visible', 'false');
      return;
    }
    detailDiv.style.display = 'block';
    detailDiv.setAttribute('data-visible', 'true');

    const h3 = document.createElement('h3');
    h3.setAttribute('data-part', 'detail-name');
    h3.textContent = node.name;
    detailDiv.appendChild(h3);

    const verDiv = document.createElement('div');
    verDiv.setAttribute('data-part', 'detail-version');
    verDiv.innerHTML = `<strong>Version:</strong> ${node.version}`;
    detailDiv.appendChild(verDiv);

    if (node.resolved) {
      const resDiv = document.createElement('div');
      resDiv.setAttribute('data-part', 'detail-resolved');
      resDiv.innerHTML = `<strong>Resolved:</strong> ${node.resolved}`;
      detailDiv.appendChild(resDiv);
    }

    const typeDiv = document.createElement('div');
    typeDiv.setAttribute('data-part', 'detail-type');
    typeDiv.innerHTML = `<strong>Type:</strong> ${node.type ?? 'prod'}`;
    detailDiv.appendChild(typeDiv);

    if (node.dependencies && node.dependencies.length > 0) {
      const depsDiv = document.createElement('div');
      depsDiv.setAttribute('data-part', 'detail-deps');
      depsDiv.innerHTML = `<strong>Direct dependencies:</strong> ${node.dependencies.length}`;
      detailDiv.appendChild(depsDiv);
    }

    const vers = packageMap.get(node.name) ?? [];
    const uniqueVers = [...new Set(vers)];
    if (uniqueVers.length > 1) {
      const conflictDiv = document.createElement('div');
      conflictDiv.setAttribute('data-part', 'detail-conflict');
      conflictDiv.style.color = 'orange';
      conflictDiv.innerHTML = `<strong>Version conflict:</strong> ${uniqueVers.join(', ')}`;
      detailDiv.appendChild(conflictDiv);
    }
  }

  function handleSelect(name: string) {
    if (selectedName === name) {
      selectedName = null;
      send('DESELECT');
    } else {
      selectedName = name;
      send('SELECT');
    }
    updateDetail();
  }

  // Keyboard
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      const s = sig.get();
      if (s === 'nodeSelected') { selectedName = null; send('DESELECT'); updateDetail(); }
      if (s === 'filtering') { searchQuery = ''; searchInput.value = ''; send('CLEAR'); rebuildTree(); }
    }
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      searchInput.focus();
    }
  });

  rebuildTree();

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    searchDiv.setAttribute('data-state', s);
    treeUl.setAttribute('data-state', s);
    detailDiv.setAttribute('data-state', s);
    scopeDiv.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default DependencyTree;
