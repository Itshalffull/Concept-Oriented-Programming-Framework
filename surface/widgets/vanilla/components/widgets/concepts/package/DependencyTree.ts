/* ---------------------------------------------------------------------------
 * DependencyTree — Vanilla implementation
 *
 * Hierarchical dependency tree with search, scope filter, expand/collapse,
 * conflict/vulnerability indicators, and detail panel.
 * ------------------------------------------------------------------------- */

export type DependencyTreeState = 'idle' | 'nodeSelected' | 'filtering';
export type DependencyTreeEvent = | { type: 'SELECT' } | { type: 'EXPAND' } | { type: 'COLLAPSE' } | { type: 'SEARCH' } | { type: 'FILTER_SCOPE' } | { type: 'DESELECT' } | { type: 'CLEAR' };

export function dependencyTreeReducer(state: DependencyTreeState, event: DependencyTreeEvent): DependencyTreeState {
  switch (state) {
    case 'idle': if (event.type === 'SELECT') return 'nodeSelected'; if (event.type === 'SEARCH') return 'filtering'; return state;
    case 'nodeSelected': if (event.type === 'DESELECT') return 'idle'; if (event.type === 'SELECT') return 'nodeSelected'; return state;
    case 'filtering': if (event.type === 'CLEAR') return 'idle'; return state;
    default: return state;
  }
}

export interface DepNode { name: string; version: string; scope?: string; children?: DepNode[]; conflict?: boolean; vulnerable?: boolean; duplicate?: boolean; }

export interface DependencyTreeProps {
  [key: string]: unknown; className?: string;
  nodes?: DepNode[]; onSelect?: (name: string) => void;
}
export interface DependencyTreeOptions { target: HTMLElement; props: DependencyTreeProps; }

let _dependencyTreeUid = 0;

export class DependencyTree {
  private el: HTMLElement;
  private props: DependencyTreeProps;
  private state: DependencyTreeState = 'idle';
  private disposers: Array<() => void> = [];
  private expandedNames = new Set<string>();
  private selectedName: string | null = null;
  private searchQuery = '';

  constructor(options: DependencyTreeOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'dependency-tree');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'tree');
    this.el.setAttribute('aria-label', 'Dependency tree');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'dependency-tree-' + (++_dependencyTreeUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  send(type: string): void { this.state = dependencyTreeReducer(this.state, { type } as any); this.el.setAttribute('data-state', this.state); }
  update(props: Partial<DependencyTreeProps>): void { Object.assign(this.props, props); this.cleanup(); this.el.innerHTML = ''; this.render(); }
  destroy(): void { this.cleanup(); this.el.remove(); }
  private cleanup(): void { for (const d of this.disposers) d(); this.disposers = []; }
  private rerender(): void { this.cleanup(); this.el.innerHTML = ''; this.render(); }

  private render(): void {
    const nodes = (this.props.nodes ?? []) as DepNode[];
    this.el.setAttribute('data-state', this.state);
    if (this.props.className) this.el.className = this.props.className;

    // Search bar
    const searchBar = document.createElement('div');
    searchBar.setAttribute('data-part', 'search-bar');
    const input = document.createElement('input');
    input.setAttribute('type', 'search');
    input.setAttribute('placeholder', 'Search packages...');
    input.setAttribute('aria-label', 'Search dependencies');
    input.value = this.searchQuery;
    const onSearch = () => { this.searchQuery = input.value; this.send(this.searchQuery ? 'SEARCH' : 'CLEAR'); this.rebuildTree(); };
    input.addEventListener('input', onSearch);
    this.disposers.push(() => input.removeEventListener('input', onSearch));
    searchBar.appendChild(input);
    this.el.appendChild(searchBar);

    // Tree
    const tree = document.createElement('div');
    tree.setAttribute('data-part', 'tree');
    tree.setAttribute('role', 'group');
    this.renderNodes(tree, nodes, 0);
    this.el.appendChild(tree);

    // Detail panel
    if (this.selectedName) {
      const node = this.findNode(nodes, this.selectedName);
      if (node) {
        const detail = document.createElement('div');
        detail.setAttribute('data-part', 'detail-panel');
        detail.setAttribute('data-visible', 'true');
        detail.innerHTML = `<strong>${node.name}</strong> v${node.version}${node.scope ? ` (${node.scope})` : ''}${node.conflict ? ' \u26A0 Conflict' : ''}${node.vulnerable ? ' \u{1F6E1} Vulnerable' : ''}`;
        this.el.appendChild(detail);
      }
    }
  }

  private renderNodes(container: HTMLElement, nodes: DepNode[], depth: number): void {
    const q = this.searchQuery.toLowerCase();
    for (const node of nodes) {
      if (q && !node.name.toLowerCase().includes(q)) continue;
      const isExpanded = this.expandedNames.has(node.name);
      const hasChildren = !!node.children?.length;
      const el = document.createElement('div');
      el.setAttribute('data-part', 'tree-node');
      el.setAttribute('role', 'treeitem');
      el.setAttribute('aria-expanded', hasChildren ? (isExpanded ? 'true' : 'false') : '');
      el.style.paddingLeft = `${depth * 16}px`;

      const name = document.createElement('span');
      name.setAttribute('data-part', 'package-name');
      name.textContent = node.name;
      el.appendChild(name);

      const version = document.createElement('span');
      version.setAttribute('data-part', 'version-badge');
      version.textContent = `v${node.version}`;
      el.appendChild(version);

      if (node.conflict) { const ic = document.createElement('span'); ic.setAttribute('data-part', 'conflict-icon'); ic.textContent = '\u26A0'; el.appendChild(ic); }
      if (node.vulnerable) { const ic = document.createElement('span'); ic.setAttribute('data-part', 'vuln-icon'); ic.textContent = '\u{1F6E1}'; el.appendChild(ic); }
      if (node.duplicate) { const ic = document.createElement('span'); ic.setAttribute('data-part', 'dup-badge'); ic.textContent = 'DUP'; el.appendChild(ic); }

      const onClick = () => {
        if (hasChildren) { if (isExpanded) this.expandedNames.delete(node.name); else this.expandedNames.add(node.name); }
        this.selectedName = node.name;
        this.send('SELECT');
        this.props.onSelect?.(node.name);
        this.rerender();
      };
      el.addEventListener('click', onClick);
      this.disposers.push(() => el.removeEventListener('click', onClick));
      container.appendChild(el);

      if (isExpanded && node.children) this.renderNodes(container, node.children, depth + 1);
    }
  }

  private findNode(nodes: DepNode[], name: string): DepNode | undefined {
    for (const n of nodes) { if (n.name === name) return n; if (n.children) { const f = this.findNode(n.children, name); if (f) return f; } }
    return undefined;
  }

  private rebuildTree(): void {
    const tree = this.el.querySelector('[data-part="tree"]') as HTMLElement;
    if (tree) { tree.innerHTML = ''; this.renderNodes(tree, (this.props.nodes ?? []) as DepNode[], 0); }
  }
}

export default DependencyTree;
