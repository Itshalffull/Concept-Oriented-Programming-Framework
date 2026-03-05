import { defineComponent, h, ref, computed } from 'vue';

/* ---------------------------------------------------------------------------
 * CircleOrgChart state machine
 * ------------------------------------------------------------------------- */

export type CircleOrgChartState = 'idle' | 'circleSelected';
export type CircleOrgChartEvent =
  | { type: 'SELECT_CIRCLE'; id: string }
  | { type: 'DESELECT' }
  | { type: 'EXPAND'; id: string }
  | { type: 'COLLAPSE'; id: string };

export function circleOrgChartReducer(state: CircleOrgChartState, event: CircleOrgChartEvent): CircleOrgChartState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_CIRCLE') return 'circleSelected';
      return state;
    case 'circleSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_CIRCLE') return 'circleSelected';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Types & Helpers
 * ------------------------------------------------------------------------- */

export interface CircleMember { name: string; role: string; }

export interface Circle {
  id: string; name: string; purpose: string; parentId?: string;
  members: CircleMember[]; jurisdiction?: string; policies?: string[];
}

interface CircleTreeNode { circle: Circle; children: CircleTreeNode[]; }

function buildTree(circles: Circle[]): CircleTreeNode[] {
  const byId = new Map<string, CircleTreeNode>();
  for (const c of circles) byId.set(c.id, { circle: c, children: [] });
  const roots: CircleTreeNode[] = [];
  for (const c of circles) {
    const node = byId.get(c.id)!;
    if (c.parentId && byId.has(c.parentId)) byId.get(c.parentId)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function flattenVisible(roots: CircleTreeNode[], expandedSet: Set<string>): Circle[] {
  const result: Circle[] = [];
  function walk(nodes: CircleTreeNode[]) {
    for (const node of nodes) {
      result.push(node.circle);
      if (node.children.length > 0 && expandedSet.has(node.circle.id)) walk(node.children);
    }
  }
  walk(roots);
  return result;
}

function findNode(nodes: CircleTreeNode[], id: string): CircleTreeNode | undefined {
  for (const node of nodes) {
    if (node.circle.id === id) return node;
    if (node.children.length) { const f = findNode(node.children, id); if (f) return f; }
  }
  return undefined;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const CircleOrgChart = defineComponent({
  name: 'CircleOrgChart',
  props: {
    circles: { type: Array as () => Circle[], required: true },
    selectedCircleId: { type: String, default: undefined },
    layout: { type: String, default: 'tree' },
    showPolicies: { type: Boolean, default: true },
    showJurisdiction: { type: Boolean, default: true },
    maxAvatars: { type: Number, default: 5 },
    expandedIds: { type: Array as () => string[], default: undefined },
  },
  emits: ['selectCircle'],
  setup(props, { emit }) {
    const internalSelectedId = ref<string | undefined>(props.selectedCircleId);
    const selectedId = computed(() => props.selectedCircleId !== undefined ? props.selectedCircleId : internalSelectedId.value);
    const widgetState = computed<CircleOrgChartState>(() => selectedId.value ? 'circleSelected' : 'idle');

    const internalExpandedIds = ref<Set<string>>(new Set(props.expandedIds ?? []));
    const expandedSet = computed(() => props.expandedIds ? new Set(props.expandedIds) : internalExpandedIds.value);

    const focusedId = ref<string | undefined>(undefined);

    const tree = computed(() => buildTree(props.circles));
    const flatList = computed(() => flattenVisible(tree.value, expandedSet.value));

    const handleSelect = (id: string) => {
      const nextId = id === selectedId.value ? undefined : id;
      internalSelectedId.value = nextId;
      emit('selectCircle', nextId);
    };

    const handleToggleExpand = (id: string) => {
      const next = new Set(internalExpandedIds.value);
      if (next.has(id)) next.delete(id); else next.add(id);
      internalExpandedIds.value = next;
    };

    const focusNode = (id: string) => { focusedId.value = id; };

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentIndex = flatList.value.findIndex((c) => c.id === focusedId.value);
      switch (e.key) {
        case 'ArrowDown': { e.preventDefault(); const next = Math.min(currentIndex + 1, flatList.value.length - 1); if (flatList.value[next]) focusNode(flatList.value[next].id); break; }
        case 'ArrowUp': { e.preventDefault(); const prev = Math.max(currentIndex - 1, 0); if (flatList.value[prev]) focusNode(flatList.value[prev].id); break; }
        case 'ArrowRight': {
          e.preventDefault();
          if (focusedId.value) {
            const node = findNode(tree.value, focusedId.value);
            if (node && node.children.length > 0) {
              if (!expandedSet.value.has(focusedId.value)) handleToggleExpand(focusedId.value);
              else focusNode(node.children[0].circle.id);
            }
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (focusedId.value) {
            if (expandedSet.value.has(focusedId.value)) handleToggleExpand(focusedId.value);
            else { const c = props.circles.find((ci) => ci.id === focusedId.value); if (c?.parentId) focusNode(c.parentId); }
          }
          break;
        }
        case 'Enter': { e.preventDefault(); if (focusedId.value) handleSelect(focusedId.value); break; }
        case 'Escape': { e.preventDefault(); internalSelectedId.value = undefined; emit('selectCircle', undefined); break; }
      }
    };

    function renderCircleNode(node: CircleTreeNode, depth: number): ReturnType<typeof h> {
      const { circle, children } = node;
      const hasChildren = children.length > 0;
      const isExpanded = expandedSet.value.has(circle.id);
      const isSelected = selectedId.value === circle.id;
      const isFocused = focusedId.value === circle.id;
      const visibleMembers = circle.members.slice(0, props.maxAvatars);
      const overflowCount = Math.max(0, circle.members.length - props.maxAvatars);

      return h('div', {
        key: circle.id, role: 'treeitem',
        'aria-expanded': hasChildren ? isExpanded : undefined,
        'aria-selected': isSelected,
        'aria-label': `${circle.name}: ${circle.purpose}`,
        'aria-level': depth + 1,
        'data-part': 'circle-node', 'data-selected': isSelected ? 'true' : 'false', 'data-id': circle.id,
        tabindex: isFocused ? 0 : -1,
        onClick: (e: MouseEvent) => { e.stopPropagation(); handleSelect(circle.id); },
        onFocus: () => focusNode(circle.id),
        style: { paddingLeft: `${depth * 24}px` },
      }, [
        hasChildren ? h('span', { 'data-part': 'expand-toggle', 'aria-hidden': 'true', onClick: (e: MouseEvent) => { e.stopPropagation(); handleToggleExpand(circle.id); } }, isExpanded ? '\u25BC' : '\u25B6') : null,
        h('span', { 'data-part': 'circle-label' }, circle.name),
        h('span', { 'data-part': 'circle-purpose', 'aria-hidden': 'true' }, circle.purpose),
        h('span', { 'data-part': 'member-count' }, `${circle.members.length} member${circle.members.length !== 1 ? 's' : ''}`),
        h('div', { 'data-part': 'member-avatars' }, [
          ...visibleMembers.map((member, idx) => h('span', { key: idx, 'data-part': 'member-avatar', 'aria-label': `${member.name}, ${member.role}`, title: `${member.name} (${member.role})` }, member.name.charAt(0).toUpperCase())),
          overflowCount > 0 ? h('span', { 'data-part': 'member-overflow', 'aria-label': `${overflowCount} more members` }, `+${overflowCount}`) : null,
        ]),
        props.showPolicies && circle.policies && circle.policies.length > 0
          ? h('div', { 'data-part': 'policies', 'data-visible': 'true' }, circle.policies.map((policy, idx) => h('span', { key: idx, 'data-part': 'policy-badge' }, policy)))
          : null,
        props.showJurisdiction && circle.jurisdiction
          ? h('span', { 'data-part': 'jurisdiction', 'data-visible': 'true' }, circle.jurisdiction)
          : null,
        hasChildren && isExpanded
          ? h('div', { 'data-part': 'children', role: 'group', 'data-visible': 'true' }, children.map((child) => renderCircleNode(child, depth + 1)))
          : null,
      ]);
    }

    const selectedCircle = computed(() => selectedId.value ? props.circles.find((c) => c.id === selectedId.value) : undefined);

    return () => h('div', {
      role: 'tree', 'aria-label': 'Governance circles',
      'data-surface-widget': '', 'data-widget-name': 'circle-org-chart',
      'data-part': 'root', 'data-state': widgetState.value, 'data-layout': props.layout,
      onKeydown: handleKeyDown,
    }, [
      ...tree.value.map((rootNode) => renderCircleNode(rootNode, 0)),
      h('div', {
        'data-part': 'detail-panel', role: 'complementary', 'aria-label': 'Circle details',
        'data-visible': widgetState.value === 'circleSelected' ? 'true' : 'false',
      }, selectedCircle.value ? [
        h('div', { 'data-part': 'detail-header' }, [
          h('span', { 'data-part': 'detail-title' }, selectedCircle.value.name),
          h('button', { type: 'button', 'data-part': 'detail-close', 'aria-label': 'Close detail panel', tabindex: 0, onClick: () => { internalSelectedId.value = undefined; emit('selectCircle', undefined); } }, '\u2715'),
        ]),
        h('div', { 'data-part': 'detail-body' }, [
          h('div', { 'data-part': 'detail-field' }, [h('span', { 'data-part': 'detail-label' }, 'Purpose'), h('span', { 'data-part': 'detail-value' }, selectedCircle.value.purpose)]),
          selectedCircle.value.jurisdiction ? h('div', { 'data-part': 'detail-field' }, [h('span', { 'data-part': 'detail-label' }, 'Jurisdiction'), h('span', { 'data-part': 'detail-value' }, selectedCircle.value.jurisdiction)]) : null,
          selectedCircle.value.policies && selectedCircle.value.policies.length > 0 ? h('div', { 'data-part': 'detail-field' }, [h('span', { 'data-part': 'detail-label' }, 'Policies'), h('span', { 'data-part': 'detail-value' }, selectedCircle.value.policies.join(', '))]) : null,
          h('div', { 'data-part': 'detail-field' }, [h('span', { 'data-part': 'detail-label' }, 'Members'), h('span', { 'data-part': 'detail-value' }, `${selectedCircle.value.members.length} member${selectedCircle.value.members.length !== 1 ? 's' : ''}`)]),
          h('div', { 'data-part': 'detail-members' }, selectedCircle.value.members.map((member, idx) => h('div', { key: idx, 'data-part': 'detail-member' }, [h('span', { 'data-part': 'detail-member-name' }, member.name), h('span', { 'data-part': 'detail-member-role' }, member.role)]))),
        ]),
      ] : []),
    ]);
  },
});

export default CircleOrgChart;
