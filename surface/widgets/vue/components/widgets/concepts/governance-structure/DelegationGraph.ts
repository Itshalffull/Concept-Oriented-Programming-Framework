import { defineComponent, h, ref, computed, watch } from 'vue';

/* ---------------------------------------------------------------------------
 * DelegationGraph state machine
 * ------------------------------------------------------------------------- */

export type DelegationGraphState = 'browsing' | 'searching' | 'selected' | 'delegating' | 'undelegating';
export type DelegationGraphEvent =
  | { type: 'SEARCH'; query: string }
  | { type: 'SELECT_DELEGATE'; id: string }
  | { type: 'SWITCH_VIEW' }
  | { type: 'CLEAR_SEARCH' }
  | { type: 'DESELECT' }
  | { type: 'DELEGATE' }
  | { type: 'UNDELEGATE' }
  | { type: 'DELEGATE_COMPLETE' }
  | { type: 'DELEGATE_ERROR' }
  | { type: 'UNDELEGATE_COMPLETE' }
  | { type: 'UNDELEGATE_ERROR' };

export function delegationGraphReducer(state: DelegationGraphState, event: DelegationGraphEvent): DelegationGraphState {
  switch (state) {
    case 'browsing':
      if (event.type === 'SEARCH') return 'searching';
      if (event.type === 'SELECT_DELEGATE') return 'selected';
      if (event.type === 'SWITCH_VIEW') return 'browsing';
      return state;
    case 'searching':
      if (event.type === 'CLEAR_SEARCH') return 'browsing';
      if (event.type === 'SELECT_DELEGATE') return 'selected';
      return state;
    case 'selected':
      if (event.type === 'DESELECT') return 'browsing';
      if (event.type === 'DELEGATE') return 'delegating';
      if (event.type === 'UNDELEGATE') return 'undelegating';
      return state;
    case 'delegating':
      if (event.type === 'DELEGATE_COMPLETE') return 'browsing';
      if (event.type === 'DELEGATE_ERROR') return 'selected';
      return state;
    case 'undelegating':
      if (event.type === 'UNDELEGATE_COMPLETE') return 'browsing';
      if (event.type === 'UNDELEGATE_ERROR') return 'selected';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Types & Helpers
 * ------------------------------------------------------------------------- */

export interface DelegationNode { id: string; label: string; weight?: number; avatar?: string; }
export interface DelegationEdge { from: string; to: string; weight?: number; }

function computeEffectiveWeight(nodeId: string, nodes: DelegationNode[], edges: DelegationEdge[], visited = new Set<string>()): number {
  if (visited.has(nodeId)) return 0;
  visited.add(nodeId);
  const node = nodes.find((n) => n.id === nodeId);
  const base = node?.weight ?? 1;
  let delegated = 0;
  for (const edge of edges.filter((e) => e.to === nodeId)) {
    delegated += computeEffectiveWeight(edge.from, nodes, edges, new Set(visited)) * (edge.weight ?? 1);
  }
  return base + delegated;
}

function findUpstream(nodeId: string, edges: DelegationEdge[], visited = new Set<string>()): string[] {
  if (visited.has(nodeId)) return [];
  visited.add(nodeId);
  const direct = edges.filter((e) => e.to === nodeId).map((e) => e.from);
  const result = [...direct];
  for (const d of direct) result.push(...findUpstream(d, edges, new Set(visited)));
  return [...new Set(result)];
}

function findDownstream(nodeId: string, edges: DelegationEdge[], visited = new Set<string>()): string[] {
  if (visited.has(nodeId)) return [];
  visited.add(nodeId);
  const direct = edges.filter((e) => e.from === nodeId).map((e) => e.to);
  const result = [...direct];
  for (const d of direct) result.push(...findDownstream(d, edges, new Set(visited)));
  return [...new Set(result)];
}

function formatWeight(w: number): string {
  return Number.isInteger(w) ? String(w) : w.toFixed(2);
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const DelegationGraph = defineComponent({
  name: 'DelegationGraph',
  props: {
    nodes: { type: Array as () => DelegationNode[], required: true },
    edges: { type: Array as () => DelegationEdge[], required: true },
    currentUserId: { type: String, default: undefined },
    viewMode: { type: String, default: 'list' },
    sortBy: { type: String, default: 'power' },
    showCurrentDelegation: { type: Boolean, default: true },
  },
  emits: ['delegate', 'undelegate', 'selectNode'],
  setup(props, { slots, emit }) {
    const state = ref<DelegationGraphState>('browsing');
    const send = (event: DelegationGraphEvent) => { state.value = delegationGraphReducer(state.value, event); };

    const searchQuery = ref('');
    const selectedNodeId = ref<string | null>(null);
    const focusedIndex = ref(0);
    const activeView = ref(props.viewMode as 'list' | 'graph');

    const nodeWeights = computed(() => {
      const weights = new Map<string, number>();
      for (const node of props.nodes) weights.set(node.id, computeEffectiveWeight(node.id, props.nodes, props.edges));
      return weights;
    });

    const totalWeightDelegated = computed(() => props.edges.reduce((sum, e) => sum + (e.weight ?? 1), 0));

    const selectedChain = computed(() => {
      if (!selectedNodeId.value) return { upstream: [] as string[], downstream: [] as string[] };
      return { upstream: findUpstream(selectedNodeId.value, props.edges), downstream: findDownstream(selectedNodeId.value, props.edges) };
    });

    const filteredNodes = computed(() => {
      let result = [...props.nodes];
      if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        result = result.filter((n) => n.label.toLowerCase().includes(q));
      }
      result.sort((a, b) => {
        if (props.sortBy === 'name') return a.label.localeCompare(b.label);
        return (nodeWeights.value.get(b.id) ?? 0) - (nodeWeights.value.get(a.id) ?? 0);
      });
      return result;
    });

    const currentDelegation = computed(() => {
      if (!props.currentUserId) return null;
      const edge = props.edges.find((e) => e.from === props.currentUserId);
      if (!edge) return null;
      const delegatee = props.nodes.find((n) => n.id === edge.to);
      return delegatee ? { id: delegatee.id, label: delegatee.label, weight: edge.weight ?? 1 } : null;
    });

    const isDelegatedTo = (nodeId: string) => {
      if (!props.currentUserId) return false;
      return props.edges.some((e) => e.from === props.currentUserId && e.to === nodeId);
    };

    const isInChain = (nodeId: string) => {
      if (!selectedNodeId.value) return false;
      if (nodeId === selectedNodeId.value) return true;
      return selectedChain.value.upstream.includes(nodeId) || selectedChain.value.downstream.includes(nodeId);
    };

    const handleSelectNode = (nodeId: string) => {
      selectedNodeId.value = nodeId;
      send({ type: 'SELECT_DELEGATE', id: nodeId });
      emit('selectNode', nodeId);
    };

    const handleDeselect = () => { selectedNodeId.value = null; send({ type: 'DESELECT' }); };

    const handleDelegate = (toId: string) => {
      if (!props.currentUserId) return;
      send({ type: 'DELEGATE' });
      emit('delegate', props.currentUserId, toId);
      setTimeout(() => send({ type: 'DELEGATE_COMPLETE' }), 0);
    };

    const handleUndelegate = (toId: string) => {
      if (!props.currentUserId) return;
      send({ type: 'UNDELEGATE' });
      emit('undelegate', props.currentUserId, toId);
      setTimeout(() => send({ type: 'UNDELEGATE_COMPLETE' }), 0);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); focusedIndex.value = Math.min(focusedIndex.value + 1, filteredNodes.value.length - 1); break;
        case 'ArrowUp': e.preventDefault(); focusedIndex.value = Math.max(focusedIndex.value - 1, 0); break;
        case 'Enter': { e.preventDefault(); const n = filteredNodes.value[focusedIndex.value]; if (n) handleSelectNode(n.id); break; }
        case 'Escape': e.preventDefault(); handleDeselect(); break;
      }
    };

    const selectedNode = computed(() => selectedNodeId.value ? props.nodes.find((n) => n.id === selectedNodeId.value) ?? null : null);

    return () => h('div', {
      role: 'region', 'aria-label': 'Delegation management',
      'data-surface-widget': '', 'data-widget-name': 'delegation-graph',
      'data-part': 'root', 'data-state': state.value, 'data-view': activeView.value,
      tabindex: 0, onKeydown: handleKeyDown,
    }, [
      // Search
      h('div', { 'data-part': 'search-input' }, [
        h('input', {
          type: 'search', placeholder: 'Search delegates...',
          value: searchQuery.value, 'aria-label': 'Search delegates by name',
          'data-state': state.value,
          onInput: (e: Event) => {
            const val = (e.target as HTMLInputElement).value;
            searchQuery.value = val;
            if (val && state.value === 'browsing') send({ type: 'SEARCH', query: val });
            else if (!val && state.value === 'searching') send({ type: 'CLEAR_SEARCH' });
          },
        }),
      ]),
      h('div', { 'data-part': 'sort-control', 'data-sort': props.sortBy }),
      h('button', {
        type: 'button', 'data-part': 'view-toggle', 'data-mode': activeView.value,
        'aria-label': `Switch to ${activeView.value === 'list' ? 'graph' : 'list'} view`,
        onClick: () => { activeView.value = activeView.value === 'list' ? 'graph' : 'list'; send({ type: 'SWITCH_VIEW' }); },
      }, activeView.value === 'list' ? 'Graph' : 'List'),
      // Summary
      h('div', { 'data-part': 'summary', 'aria-label': 'Delegation summary' }, [
        h('span', { 'data-part': 'total-participants' }, `${props.nodes.length} participant${props.nodes.length !== 1 ? 's' : ''}`),
        h('span', { 'data-part': 'total-weight' }, `${formatWeight(totalWeightDelegated.value)} weight delegated`),
      ]),
      // Current delegation
      props.showCurrentDelegation
        ? h('div', { 'data-part': 'current-info', 'data-visible': 'true', 'aria-label': 'Your current delegation' }, [
            currentDelegation.value
              ? h('span', null, [`Delegating to `, h('strong', null, currentDelegation.value.label), ` (weight: ${formatWeight(currentDelegation.value.weight)})`])
              : h('span', null, 'Not currently delegating'),
          ])
        : null,
      // List view
      h('ul', {
        role: 'tree', 'aria-label': 'Delegates', 'data-part': 'delegate-list',
        'data-visible': activeView.value === 'list' ? 'true' : 'false',
        style: activeView.value !== 'list' ? { display: 'none' } : undefined,
      }, filteredNodes.value.map((node, index) => {
        const ew = nodeWeights.value.get(node.id) ?? 0;
        const delegated = isDelegatedTo(node.id);
        const up = findUpstream(node.id, props.edges).length;
        return h('li', {
          key: node.id, role: 'treeitem',
          'aria-label': `${node.label} \u2014 voting power: ${formatWeight(ew)}`,
          'aria-selected': selectedNodeId.value === node.id,
          'data-part': 'delegate-item', 'data-selected': selectedNodeId.value === node.id ? 'true' : 'false',
          'data-highlighted': isInChain(node.id) ? 'true' : 'false', 'data-state': state.value,
          tabindex: index === focusedIndex.value ? 0 : -1,
          onClick: () => handleSelectNode(node.id),
        }, [
          h('span', { 'data-part': 'avatar', 'aria-hidden': 'true' }, node.avatar ?? node.label.charAt(0).toUpperCase()),
          h('span', { 'data-part': 'delegate-name' }, node.label),
          h('span', { 'data-part': 'voting-power', 'aria-label': `Voting power: ${formatWeight(ew)}` }, formatWeight(ew)),
          h('span', { 'data-part': 'participation', 'aria-label': `${up} delegator${up !== 1 ? 's' : ''}` }, `${up} delegator${up !== 1 ? 's' : ''}`),
          props.currentUserId && node.id !== props.currentUserId
            ? h('button', {
                type: 'button', 'data-part': 'delegate-action', role: 'button',
                'aria-label': delegated ? `Undelegate from ${node.label}` : `Delegate to ${node.label}`,
                tabindex: 0,
                onClick: (e: MouseEvent) => { e.stopPropagation(); delegated ? handleUndelegate(node.id) : handleDelegate(node.id); },
              }, delegated ? 'Undelegate' : 'Delegate')
            : null,
        ]);
      })),
      // Graph view
      h('div', {
        'data-part': 'graph-view', 'data-visible': activeView.value === 'graph' ? 'true' : 'false',
        'aria-label': 'Delegation graph',
        style: activeView.value !== 'graph' ? { display: 'none' } : undefined,
      }, [
        h('ul', { role: 'tree', 'aria-label': 'Delegation relationships' },
          filteredNodes.value.map((node) => {
            const outgoing = props.edges.filter((e) => e.from === node.id);
            const incoming = props.edges.filter((e) => e.to === node.id);
            const ew = nodeWeights.value.get(node.id) ?? 0;
            return h('li', { key: node.id, role: 'treeitem', 'aria-label': `${node.label}: ${formatWeight(ew)} effective weight`, 'data-node-id': node.id, 'data-highlighted': isInChain(node.id) ? 'true' : 'false', onClick: () => handleSelectNode(node.id) }, [
              h('span', { 'data-part': 'delegate-name' }, node.label),
              h('span', { 'data-part': 'voting-power' }, formatWeight(ew)),
              outgoing.length > 0 ? h('ul', { role: 'group', 'aria-label': `${node.label} delegates to` }, outgoing.map((edge) => {
                const target = props.nodes.find((n) => n.id === edge.to);
                return h('li', { key: `${edge.from}-${edge.to}`, role: 'treeitem' }, `\u2192 ${target?.label ?? edge.to} (weight: ${formatWeight(edge.weight ?? 1)})`);
              })) : null,
              incoming.length > 0 ? h('ul', { role: 'group', 'aria-label': 'Delegated by' }, incoming.map((edge) => {
                const source = props.nodes.find((n) => n.id === edge.from);
                return h('li', { key: `${edge.from}-${edge.to}`, role: 'treeitem' }, `\u2190 ${source?.label ?? edge.from} (weight: ${formatWeight(edge.weight ?? 1)})`);
              })) : null,
            ]);
          }),
        ),
      ]),
      // Detail panel
      state.value === 'selected' && selectedNode.value
        ? h('div', { 'data-part': 'detail-panel', role: 'complementary', 'aria-label': `Delegation details for ${selectedNode.value.label}` }, [
            h('div', { 'data-part': 'detail-header' }, [
              h('span', { 'data-part': 'avatar', 'aria-hidden': 'true' }, selectedNode.value.avatar ?? selectedNode.value.label.charAt(0).toUpperCase()),
              h('h3', { 'data-part': 'delegate-name' }, selectedNode.value.label),
              h('button', { type: 'button', 'aria-label': 'Close detail panel', onClick: handleDeselect }, 'Close'),
            ]),
            h('dl', { 'data-part': 'detail-stats' }, [
              h('dt', null, 'Effective voting power'), h('dd', { 'data-part': 'voting-power' }, formatWeight(nodeWeights.value.get(selectedNode.value.id) ?? 0)),
              h('dt', null, 'Base weight'), h('dd', null, formatWeight(selectedNode.value.weight ?? 1)),
              h('dt', null, 'Upstream delegators'), h('dd', null, String(selectedChain.value.upstream.length)),
              h('dt', null, 'Downstream delegatees'), h('dd', null, String(selectedChain.value.downstream.length)),
            ]),
            selectedChain.value.upstream.length > 0 ? h('div', { 'data-part': 'chain-upstream', 'aria-label': 'Upstream delegators' }, [h('h4', null, 'Delegates from'), h('ul', null, selectedChain.value.upstream.map((id) => { const n = props.nodes.find((node) => node.id === id); return h('li', { key: id }, [h('button', { type: 'button', onClick: () => handleSelectNode(id), 'aria-label': `Select ${n?.label ?? id}` }, n?.label ?? id)]); }))]) : null,
            selectedChain.value.downstream.length > 0 ? h('div', { 'data-part': 'chain-downstream', 'aria-label': 'Downstream delegatees' }, [h('h4', null, 'Delegates to'), h('ul', null, selectedChain.value.downstream.map((id) => { const n = props.nodes.find((node) => node.id === id); return h('li', { key: id }, [h('button', { type: 'button', onClick: () => handleSelectNode(id), 'aria-label': `Select ${n?.label ?? id}` }, n?.label ?? id)]); }))]) : null,
          ])
        : null,
      // Confirmation dialog
      (state.value === 'delegating' || state.value === 'undelegating')
        ? h('div', { 'data-part': 'confirmation', role: 'alertdialog', 'aria-label': state.value === 'delegating' ? 'Confirm delegation' : 'Confirm undelegation' }, [
            h('p', null, state.value === 'delegating' ? `Delegating to ${selectedNode.value?.label ?? 'delegate'}...` : `Removing delegation from ${selectedNode.value?.label ?? 'delegate'}...`),
          ])
        : null,
      slots.default ? slots.default() : null,
    ]);
  },
});

export default DelegationGraph;
