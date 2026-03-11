import { defineComponent, h, ref, computed, type PropType } from 'vue';

export type DependencyTreeState = 'idle' | 'nodeSelected' | 'filtering';
export type DependencyTreeEvent =
  | { type: 'SELECT'; name?: string }
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'SEARCH'; query?: string }
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

interface DepNode {
  name: string;
  version: string;
  scope?: 'runtime' | 'dev' | 'optional';
  hasConflict?: boolean;
  hasDuplicate?: boolean;
  hasVulnerability?: boolean;
  children?: DepNode[];
}

const SCOPES = ['runtime', 'dev', 'optional'] as const;

export const DependencyTree = defineComponent({
  name: 'DependencyTree',
  props: {
    rootPackage: { type: String, required: true },
    dependencies: { type: Array as PropType<DepNode[]>, required: true },
    expandDepth: { type: Number, default: 2 },
    showDevDeps: { type: Boolean, default: true },
    showVulnerabilities: { type: Boolean, default: true },
    selectedPackage: { type: String, default: undefined },
  },
  emits: ['select', 'expand', 'collapse'],
  setup(props, { emit }) {
    const state = ref<DependencyTreeState>('idle');
    const searchQuery = ref('');
    const selectedName = ref<string | null>(props.selectedPackage ?? null);
    const expandedSet = ref(new Set<string>());
    const scopeFilter = ref<string | null>(null);
    const focusIndex = ref(0);

    function send(event: DependencyTreeEvent) {
      state.value = dependencyTreeReducer(state.value, event);
    }

    // Auto-expand to expandDepth
    function autoExpand(deps: DepNode[], depth: number) {
      if (depth >= props.expandDepth) return;
      for (const dep of deps) {
        expandedSet.value.add(dep.name);
        if (dep.children) autoExpand(dep.children, depth + 1);
      }
    }
    autoExpand(props.dependencies, 0);

    const selectedNode = computed(() => {
      function find(deps: DepNode[]): DepNode | undefined {
        for (const d of deps) {
          if (d.name === selectedName.value) return d;
          if (d.children) { const f = find(d.children); if (f) return f; }
        }
        return undefined;
      }
      return find(props.dependencies);
    });

    function filterDeps(deps: DepNode[]): DepNode[] {
      return deps.filter((d) => {
        if (scopeFilter.value && d.scope !== scopeFilter.value) return false;
        if (searchQuery.value && !d.name.toLowerCase().includes(searchQuery.value.toLowerCase())) return false;
        return true;
      });
    }

    function renderNode(dep: DepNode, depth: number): any {
      const isExpanded = expandedSet.value.has(dep.name);
      const isSelected = selectedName.value === dep.name;
      const hasChildren = dep.children && dep.children.length > 0;

      const nodeChildren: any[] = [];
      if (hasChildren) {
        nodeChildren.push(h('span', {
          'data-part': 'expand-toggle', 'aria-hidden': 'true',
          onClick: (e: Event) => { e.stopPropagation(); if (isExpanded) { expandedSet.value.delete(dep.name); send({ type: 'COLLAPSE' }); } else { expandedSet.value.add(dep.name); send({ type: 'EXPAND' }); } },
          style: { cursor: 'pointer' },
        }, isExpanded ? '\u25BC' : '\u25B6'));
      } else {
        nodeChildren.push(h('span', { style: { width: '1em', display: 'inline-block' } }));
      }

      nodeChildren.push(h('span', { 'data-part': 'package-name' }, dep.name));
      nodeChildren.push(h('div', { 'data-part': 'version-badge' }, dep.version));
      if (dep.hasConflict) nodeChildren.push(h('div', { 'data-part': 'conflict-icon', 'aria-label': 'Version conflict' }, '\u26A0'));
      if (dep.hasDuplicate) nodeChildren.push(h('div', { 'data-part': 'dup-badge' }, 'dup'));
      if (props.showVulnerabilities && dep.hasVulnerability) nodeChildren.push(h('div', { 'data-part': 'vuln-icon', 'aria-label': 'Vulnerability' }, '\u{1F6A8}'));

      const items: any[] = [
        h('div', {
          'data-part': 'tree-node', 'data-selected': isSelected ? 'true' : 'false',
          'data-scope': dep.scope ?? 'runtime',
          role: 'treeitem', tabindex: -1,
          style: { paddingLeft: `${depth * 16}px`, cursor: 'pointer' },
          onClick: () => { selectedName.value = dep.name; send({ type: 'SELECT', name: dep.name }); emit('select', dep.name); },
        }, nodeChildren),
      ];

      if (isExpanded && dep.children) {
        items.push(h('div', { role: 'group' }, dep.children.map((child) => renderNode(child, depth + 1))));
      }

      return h('div', { key: dep.name + dep.version }, items);
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); selectedName.value = null; send({ type: 'DESELECT' }); }
    }

    return () => {
      const children: any[] = [];

      // Search
      children.push(h('div', { 'data-part': 'search-bar' }, [
        h('input', {
          type: 'search', 'data-part': 'search-input', placeholder: 'Filter dependencies...',
          value: searchQuery.value,
          onInput: (e: Event) => { const v = (e.target as HTMLInputElement).value; searchQuery.value = v; if (v) send({ type: 'SEARCH', query: v }); else send({ type: 'CLEAR' }); },
          'aria-label': 'Filter dependencies',
        }),
      ]));

      // Scope filter
      children.push(h('div', { 'data-part': 'scope-filter', role: 'toolbar' }, [
        h('button', { type: 'button', 'data-part': 'scope-chip', 'data-active': !scopeFilter.value ? 'true' : 'false', 'aria-pressed': !scopeFilter.value, onClick: () => { scopeFilter.value = null; send({ type: 'FILTER_SCOPE' }); } }, 'All'),
        ...SCOPES.map((s) => h('button', { type: 'button', 'data-part': 'scope-chip', 'data-scope': s, 'data-active': scopeFilter.value === s ? 'true' : 'false', 'aria-pressed': scopeFilter.value === s, onClick: () => { scopeFilter.value = scopeFilter.value === s ? null : s; send({ type: 'FILTER_SCOPE' }); } }, s)),
      ]));

      // Tree
      const filteredDeps = filterDeps(props.dependencies);
      children.push(h('div', { 'data-part': 'tree', role: 'tree', 'aria-label': `Dependencies of ${props.rootPackage}` },
        filteredDeps.map((dep) => renderNode(dep, 0))));

      // Detail panel
      if (state.value === 'nodeSelected' && selectedNode.value) {
        const n = selectedNode.value;
        children.push(h('div', { 'data-part': 'detail-panel', 'data-visible': 'true' }, [
          h('div', { 'data-part': 'detail-header' }, [
            h('span', {}, n.name), h('span', {}, n.version),
            h('button', { type: 'button', 'data-part': 'close-detail', onClick: () => { selectedName.value = null; send({ type: 'DESELECT' }); } }, '\u2715'),
          ]),
          n.scope ? h('div', {}, `Scope: ${n.scope}`) : null,
          n.hasConflict ? h('div', { 'data-part': 'conflict-detail' }, 'Has version conflict') : null,
          n.hasVulnerability ? h('div', { 'data-part': 'vuln-detail' }, 'Has known vulnerability') : null,
        ]));
      }

      return h('div', {
        role: 'tree',
        'aria-label': `Dependency tree: ${props.rootPackage}`,
        'data-surface-widget': '',
        'data-widget-name': 'dependency-tree',
        'data-part': 'root',
        'data-state': state.value,
        tabindex: 0,
        onKeydown: handleKeydown,
      }, children);
    };
  },
});

export default DependencyTree;
