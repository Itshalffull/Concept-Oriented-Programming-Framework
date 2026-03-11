import { defineComponent, h, ref, computed } from 'vue';

/* ---------------------------------------------------------------------------
 * ProofSessionTree state machine
 * ------------------------------------------------------------------------- */

export type ProofSessionTreeState = 'idle' | 'selected' | 'ready' | 'fetching';
export type ProofSessionTreeEvent =
  | { type: 'SELECT' }
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'DESELECT' }
  | { type: 'LOAD_CHILDREN' }
  | { type: 'LOAD_COMPLETE' }
  | { type: 'LOAD_ERROR' };

export function proofSessionTreeReducer(state: ProofSessionTreeState, event: ProofSessionTreeEvent): ProofSessionTreeState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT') return 'selected';
      if (event.type === 'EXPAND') return 'idle';
      if (event.type === 'COLLAPSE') return 'idle';
      return state;
    case 'selected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT') return 'selected';
      return state;
    case 'ready':
      if (event.type === 'LOAD_CHILDREN') return 'fetching';
      return state;
    case 'fetching':
      if (event.type === 'LOAD_COMPLETE') return 'ready';
      if (event.type === 'LOAD_ERROR') return 'ready';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Types & Helpers
 * ------------------------------------------------------------------------- */

export interface ProofGoal {
  id: string;
  label: string;
  status: 'open' | 'proved' | 'failed' | 'skipped';
  tactic?: string;
  children?: ProofGoal[];
  progress?: number;
}

const STATUS_ICONS: Record<ProofGoal['status'], string> = {
  proved: '\u2713', failed: '\u2717', open: '\u25CB', skipped: '\u2298',
};

const STATUS_LABELS: Record<ProofGoal['status'], string> = {
  proved: 'Proved', failed: 'Failed', open: 'Open', skipped: 'Skipped',
};

function flattenVisible(goals: ProofGoal[], expandedSet: Set<string>): ProofGoal[] {
  const result: ProofGoal[] = [];
  function walk(nodes: ProofGoal[]) {
    for (const goal of nodes) {
      result.push(goal);
      if (goal.children?.length && expandedSet.has(goal.id)) walk(goal.children);
    }
  }
  walk(goals);
  return result;
}

function findGoal(goals: ProofGoal[], id: string): ProofGoal | undefined {
  for (const goal of goals) {
    if (goal.id === id) return goal;
    if (goal.children?.length) { const f = findGoal(goal.children, id); if (f) return f; }
  }
  return undefined;
}

function countGoals(goals: ProofGoal[]): { total: number; proved: number } {
  let total = 0; let proved = 0;
  function walk(nodes: ProofGoal[]) {
    for (const goal of nodes) {
      total++;
      if (goal.status === 'proved') proved++;
      if (goal.children?.length) walk(goal.children);
    }
  }
  walk(goals);
  return { total, proved };
}

function siblingInfo(goals: ProofGoal[], targetId: string): { setSize: number; posInSet: number } {
  function search(nodes: ProofGoal[]): { setSize: number; posInSet: number } | undefined {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === targetId) return { setSize: nodes.length, posInSet: i + 1 };
      if (nodes[i].children?.length) { const f = search(nodes[i].children!); if (f) return f; }
    }
    return undefined;
  }
  return search(goals) ?? { setSize: 1, posInSet: 1 };
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const ProofSessionTree = defineComponent({
  name: 'ProofSessionTree',
  props: {
    goals: { type: Array as () => ProofGoal[], required: true },
    selectedId: { type: String, default: undefined },
    expandedIds: { type: Array as () => string[], default: undefined },
  },
  emits: ['selectGoal'],
  setup(props, { emit }) {
    const internalSelectedId = ref<string | undefined>(props.selectedId);
    const selectedId = computed(() => props.selectedId !== undefined ? props.selectedId : internalSelectedId.value);

    const internalExpandedIds = ref<Set<string>>(new Set(props.expandedIds ?? []));
    const expandedSet = computed(() => props.expandedIds ? new Set(props.expandedIds) : internalExpandedIds.value);

    const focusedId = ref<string | undefined>(undefined);

    const flatList = computed(() => flattenVisible(props.goals, expandedSet.value));
    const counts = computed(() => countGoals(props.goals));

    const displayState = computed<ProofSessionTreeState>(() => selectedId.value ? 'selected' : 'idle');

    const handleSelect = (id: string) => {
      const nextId = id === selectedId.value ? undefined : id;
      internalSelectedId.value = nextId;
      emit('selectGoal', nextId);
    };

    const handleToggleExpand = (id: string) => {
      const next = new Set(internalExpandedIds.value);
      if (next.has(id)) next.delete(id); else next.add(id);
      internalExpandedIds.value = next;
    };

    const focusNode = (id: string) => { focusedId.value = id; };

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentIndex = flatList.value.findIndex((g) => g.id === focusedId.value);
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const next = Math.min(currentIndex + 1, flatList.value.length - 1);
          if (flatList.value[next]) focusNode(flatList.value[next].id);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prev = Math.max(currentIndex - 1, 0);
          if (flatList.value[prev]) focusNode(flatList.value[prev].id);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          if (focusedId.value) {
            const goal = findGoal(props.goals, focusedId.value);
            if (goal?.children?.length) {
              if (!expandedSet.value.has(focusedId.value)) handleToggleExpand(focusedId.value);
              else focusNode(goal.children[0].id);
            }
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (focusedId.value) {
            if (expandedSet.value.has(focusedId.value)) handleToggleExpand(focusedId.value);
          }
          break;
        }
        case 'Enter': { e.preventDefault(); if (focusedId.value) handleSelect(focusedId.value); break; }
        case 'Home': { e.preventDefault(); if (flatList.value.length) focusNode(flatList.value[0].id); break; }
        case 'End': { e.preventDefault(); if (flatList.value.length) focusNode(flatList.value[flatList.value.length - 1].id); break; }
        case 'Escape': { e.preventDefault(); internalSelectedId.value = undefined; emit('selectGoal', undefined); break; }
      }
    };

    function renderGoalNode(goal: ProofGoal, depth: number): ReturnType<typeof h> {
      const hasChildren = !!(goal.children?.length);
      const isExpanded = expandedSet.value.has(goal.id);
      const isSelected = selectedId.value === goal.id;
      const isFocused = focusedId.value === goal.id;
      const { setSize, posInSet } = siblingInfo(props.goals, goal.id);

      return h('div', {
        key: goal.id, role: 'treeitem',
        'aria-expanded': hasChildren ? isExpanded : undefined,
        'aria-selected': isSelected,
        'aria-level': depth + 1,
        'aria-setsize': setSize, 'aria-posinset': posInSet,
        'aria-label': `${goal.label} - ${STATUS_LABELS[goal.status]}`,
        'data-part': 'tree-item', 'data-status': goal.status,
        'data-selected': isSelected ? 'true' : 'false', 'data-id': goal.id,
        tabindex: isFocused ? 0 : -1,
        onClick: (e: MouseEvent) => { e.stopPropagation(); handleSelect(goal.id); },
        onFocus: () => focusNode(goal.id),
        style: { paddingLeft: `${depth * 20}px` },
      }, [
        h('button', {
          type: 'button', 'data-part': 'expand-trigger',
          'data-expanded': isExpanded ? 'true' : 'false',
          'data-visible': hasChildren ? 'true' : 'false',
          'aria-label': isExpanded ? 'Collapse' : 'Expand',
          tabindex: -1,
          onClick: (e: MouseEvent) => { e.stopPropagation(); if (hasChildren) handleToggleExpand(goal.id); },
          style: { visibility: hasChildren ? 'visible' : 'hidden' },
        }, isExpanded ? '\u25BC' : '\u25B6'),
        h('span', { 'data-part': 'status-badge', 'data-status': goal.status, 'aria-hidden': 'true' }, STATUS_ICONS[goal.status]),
        h('span', { 'data-part': 'item-label' }, goal.label),
        goal.progress != null
          ? h('span', {
              'data-part': 'progress-bar', 'data-visible': 'true', 'data-value': goal.progress,
              role: 'progressbar', 'aria-valuenow': goal.progress, 'aria-valuemin': 0, 'aria-valuemax': 1,
              'aria-label': `${Math.round(goal.progress * 100)}% complete`,
            }, `${Math.round(goal.progress * 100)}%`)
          : null,
        hasChildren && isExpanded
          ? h('div', { 'data-part': 'children', role: 'group', 'data-visible': 'true' },
              goal.children!.map((child) => renderGoalNode(child, depth + 1)))
          : null,
      ]);
    }

    const selectedGoal = computed(() => selectedId.value ? findGoal(props.goals, selectedId.value) : undefined);

    return () => h('div', {
      role: 'tree', 'aria-label': 'Proof session tree',
      'data-surface-widget': '', 'data-widget-name': 'proof-session-tree',
      'data-part': 'root', 'data-state': displayState.value,
      'data-count': props.goals.length,
      onKeydown: handleKeyDown,
    }, [
      // Summary
      h('div', { 'data-part': 'summary', 'aria-live': 'polite' },
        `${counts.value.proved} of ${counts.value.total} goals proved`),
      // Tree items
      ...props.goals.map((goal) => renderGoalNode(goal, 0)),
      // Detail panel
      h('div', {
        'data-part': 'detail-panel', role: 'complementary', 'aria-label': 'Goal details',
        'data-visible': selectedGoal.value ? 'true' : 'false',
      }, selectedGoal.value ? [
        h('div', { 'data-part': 'detail-header' }, [
          h('span', { 'data-part': 'detail-status', 'data-status': selectedGoal.value.status },
            `${STATUS_ICONS[selectedGoal.value.status]} ${STATUS_LABELS[selectedGoal.value.status]}`),
          h('button', {
            type: 'button', 'data-part': 'detail-close', 'aria-label': 'Close detail panel', tabindex: 0,
            onClick: () => { internalSelectedId.value = undefined; emit('selectGoal', undefined); },
          }, '\u2715'),
        ]),
        h('div', { 'data-part': 'detail-body' }, [
          h('div', { 'data-part': 'detail-field' }, [
            h('span', { 'data-part': 'detail-label' }, 'Goal'),
            h('span', { 'data-part': 'detail-value' }, selectedGoal.value.label),
          ]),
          h('div', { 'data-part': 'detail-field' }, [
            h('span', { 'data-part': 'detail-label' }, 'Status'),
            h('span', { 'data-part': 'detail-value', 'data-status': selectedGoal.value.status },
              `${STATUS_ICONS[selectedGoal.value.status]} ${STATUS_LABELS[selectedGoal.value.status]}`),
          ]),
          selectedGoal.value.tactic
            ? h('div', { 'data-part': 'detail-field' }, [
                h('span', { 'data-part': 'detail-label' }, 'Tactic'),
                h('span', { 'data-part': 'detail-value' }, selectedGoal.value.tactic),
              ])
            : null,
          selectedGoal.value.progress != null
            ? h('div', { 'data-part': 'detail-field' }, [
                h('span', { 'data-part': 'detail-label' }, 'Progress'),
                h('span', { 'data-part': 'detail-value' }, `${Math.round(selectedGoal.value.progress * 100)}%`),
              ])
            : null,
          selectedGoal.value.children && selectedGoal.value.children.length > 0
            ? h('div', { 'data-part': 'detail-field' }, [
                h('span', { 'data-part': 'detail-label' }, 'Sub-goals'),
                h('span', { 'data-part': 'detail-value' }, `${selectedGoal.value.children.length} goals`),
              ])
            : null,
        ]),
      ] : []),
    ]);
  },
});

export default ProofSessionTree;
