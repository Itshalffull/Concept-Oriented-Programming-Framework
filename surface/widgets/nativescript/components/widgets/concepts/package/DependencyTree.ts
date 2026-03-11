import {
  StackLayout,
  Label,
  Button,
  ScrollView,
  TextField,
} from '@nativescript/core';

export type DependencyTreeState = 'idle' | 'nodeSelected' | 'filtering';
export type DependencyTreeEvent =
  | { type: 'SELECT'; name?: string }
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

export interface DependencyNode {
  name: string;
  version: string;
  resolved?: string;
  type?: 'prod' | 'dev' | 'peer' | 'optional';
  dependencies?: DependencyNode[];
}

export interface DependencyTreeProps {
  root: { name: string; version: string; dependencies?: DependencyNode[] };
  expandDepth?: number;
  showDevDeps?: boolean;
  showVulnerabilities?: boolean;
  selectedPackage?: string;
}

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
  const counts: Record<string, number> = { prod: 0, dev: 0, peer: 0, optional: 0, total: 0 };
  function walk(deps: DependencyNode[]) {
    for (const dep of deps) {
      const t = dep.type ?? 'prod';
      counts[t] = (counts[t] ?? 0) + 1;
      counts.total++;
      if (dep.dependencies) walk(dep.dependencies);
    }
  }
  walk(nodes);
  return counts;
}

function matchesSearch(node: DependencyNode, query: string): boolean {
  const q = query.toLowerCase();
  if (node.name.toLowerCase().includes(q)) return true;
  if (node.version.toLowerCase().includes(q)) return true;
  if (node.dependencies) return node.dependencies.some((c) => matchesSearch(c, q));
  return false;
}

function matchesScope(node: DependencyNode, scope: ScopeFilter): boolean {
  if (scope === 'all') return true;
  return (node.type ?? 'prod') === scope;
}

export function createDependencyTree(props: DependencyTreeProps): {
  view: StackLayout;
  dispose: () => void;
} {
  let state: DependencyTreeState = 'idle';
  let searchQuery = '';
  let scopeFilter: ScopeFilter = 'all';
  let selectedName: string | null = props.selectedPackage ?? null;
  const expandDepth = props.expandDepth ?? 2;
  const expandedState = new Map<string, boolean>();
  const disposers: (() => void)[] = [];

  function send(event: DependencyTreeEvent) {
    state = dependencyTreeReducer(state, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'dependency-tree';
  root.automationText = `Dependencies for ${props.root.name}`;

  const searchInput = new TextField();
  searchInput.hint = 'Search dependencies...';
  const searchCb = () => {
    searchQuery = searchInput.text;
    if (searchQuery) {
      send({ type: 'SEARCH' });
    } else {
      send({ type: 'CLEAR' });
    }
  };
  searchInput.on('textChange', searchCb);
  disposers.push(() => searchInput.off('textChange', searchCb));
  root.addChild(searchInput);

  const scopeRow = new StackLayout();
  scopeRow.orientation = 'horizontal';
  root.addChild(scopeRow);

  const summaryLbl = new Label();
  summaryLbl.marginTop = 4;
  summaryLbl.marginBottom = 4;
  summaryLbl.fontSize = 13;
  root.addChild(summaryLbl);

  const treeScroll = new ScrollView();
  const treeContainer = new StackLayout();
  treeScroll.content = treeContainer;
  root.addChild(treeScroll);

  const detailPanel = new StackLayout();
  detailPanel.marginTop = 8;
  detailPanel.paddingLeft = 12;
  detailPanel.borderLeftWidth = 1;
  detailPanel.borderLeftColor = '#e5e7eb';
  root.addChild(detailPanel);

  function nodeKey(node: DependencyNode, depth: number, idx: number): string {
    return `${depth}-${idx}-${node.name}`;
  }

  function renderNode(node: DependencyNode, depth: number, idx: number, parent: StackLayout, packageMap: Map<string, string[]>) {
    if (!matchesScope(node, scopeFilter)) return;
    if (searchQuery && !matchesSearch(node, searchQuery)) return;

    const key = nodeKey(node, depth, idx);
    const hasChildren = !!(node.dependencies && node.dependencies.length > 0);
    if (!expandedState.has(key)) {
      expandedState.set(key, depth < expandDepth);
    }
    const expanded = expandedState.get(key)!;

    const row = new StackLayout();
    row.orientation = 'horizontal';
    row.paddingLeft = depth * 20;
    row.marginBottom = 2;

    if (hasChildren) {
      const toggleBtn = new Button();
      toggleBtn.text = expanded ? '\u25BE' : '\u25B8';
      toggleBtn.width = 24;
      toggleBtn.padding = 0;
      toggleBtn.on('tap', () => {
        expandedState.set(key, !expandedState.get(key));
        update();
      });
      row.addChild(toggleBtn);
    } else {
      const sp = new Label();
      sp.width = 24;
      sp.text = '';
      row.addChild(sp);
    }

    const nameLbl = new Label();
    nameLbl.text = node.name;
    nameLbl.fontWeight = selectedName === node.name ? 'bold' : 'normal';
    row.addChild(nameLbl);

    const verLbl = new Label();
    verLbl.text = `@${node.version}`;
    verLbl.fontSize = 12;
    verLbl.marginLeft = 4;
    row.addChild(verLbl);

    const typeLbl = new Label();
    typeLbl.text = node.type ?? 'prod';
    typeLbl.fontSize = 11;
    typeLbl.marginLeft = 4;
    row.addChild(typeLbl);

    const versions = packageMap.get(node.name) ?? [];
    if (new Set(versions).size > 1) {
      const warn = new Label();
      warn.text = '\u26A0';
      warn.color = 'orange' as any;
      warn.marginLeft = 4;
      row.addChild(warn);
    }
    if (versions.length > 1) {
      const dup = new Label();
      dup.text = `x${versions.length}`;
      dup.fontSize = 11;
      dup.marginLeft = 4;
      row.addChild(dup);
    }

    row.on('tap', () => {
      if (selectedName === node.name) {
        selectedName = null;
        send({ type: 'DESELECT' });
      } else {
        selectedName = node.name;
        send({ type: 'SELECT', name: node.name });
      }
    });

    parent.addChild(row);

    if (hasChildren && expanded && node.dependencies) {
      node.dependencies.forEach((child, ci) => {
        renderNode(child, depth + 1, ci, parent, packageMap);
      });
    }
  }

  function update() {
    const deps: DependencyNode[] = props.root.dependencies ?? [];
    const visibleDeps = props.showDevDeps !== false ? deps : deps.filter((d) => (d.type ?? 'prod') !== 'dev');
    const packageMap = collectPackages(visibleDeps);
    const counts = countByType(visibleDeps);

    scopeRow.removeChildren();
    for (const scope of SCOPE_OPTIONS) {
      const btn = new Button();
      btn.text = scope;
      btn.className = scopeFilter === scope ? 'scope-active' : 'scope-chip';
      btn.on('tap', () => {
        scopeFilter = scope;
        send({ type: 'FILTER_SCOPE' });
      });
      scopeRow.addChild(btn);
    }

    const parts: string[] = [];
    if (counts.prod > 0) parts.push(`${counts.prod} prod`);
    if (counts.dev > 0) parts.push(`${counts.dev} dev`);
    if (counts.peer > 0) parts.push(`${counts.peer} peer`);
    if (counts.optional > 0) parts.push(`${counts.optional} optional`);
    summaryLbl.text = `${counts.total} packages${parts.length > 0 ? ` (${parts.join(', ')})` : ''}`;

    treeContainer.removeChildren();
    visibleDeps.forEach((dep, i) => {
      renderNode(dep, 0, i, treeContainer, packageMap);
    });

    detailPanel.removeChildren();
    if (state === 'nodeSelected' && selectedName) {
      function findNode(nodes: DependencyNode[]): DependencyNode | null {
        for (const n of nodes) {
          if (n.name === selectedName) return n;
          if (n.dependencies) {
            const f = findNode(n.dependencies);
            if (f) return f;
          }
        }
        return null;
      }
      const sel = findNode(visibleDeps);
      if (sel) {
        detailPanel.visibility = 'visible';
        const dName = new Label();
        dName.text = sel.name;
        dName.fontWeight = 'bold';
        dName.fontSize = 16;
        detailPanel.addChild(dName);

        const dVer = new Label();
        dVer.text = `Version: ${sel.version}`;
        detailPanel.addChild(dVer);

        if (sel.resolved) {
          const dRes = new Label();
          dRes.text = `Resolved: ${sel.resolved}`;
          detailPanel.addChild(dRes);
        }

        const dType = new Label();
        dType.text = `Type: ${sel.type ?? 'prod'}`;
        detailPanel.addChild(dType);

        if (sel.dependencies && sel.dependencies.length > 0) {
          const dDeps = new Label();
          dDeps.text = `Direct dependencies: ${sel.dependencies.length}`;
          detailPanel.addChild(dDeps);
        }

        const uv = [...new Set(packageMap.get(sel.name) ?? [])];
        if (uv.length > 1) {
          const cLbl = new Label();
          cLbl.text = `Version conflict: ${uv.join(', ')}`;
          cLbl.color = 'orange' as any;
          detailPanel.addChild(cLbl);
        }
      }
    } else {
      detailPanel.visibility = 'collapsed';
    }
  }

  update();

  return {
    view: root,
    dispose() {
      disposers.forEach((d) => d());
    },
  };
}

export default createDependencyTree;
