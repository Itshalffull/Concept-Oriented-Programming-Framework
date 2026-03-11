import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

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

export interface ProofGoal {
  id: string;
  label: string;
  status: 'open' | 'proved' | 'failed' | 'skipped';
  tactic?: string;
  children?: ProofGoal[];
  progress?: number;
}

const STATUS_ICONS: Record<ProofGoal['status'], string> = {
  proved: '\u2713',
  failed: '\u2717',
  open: '\u25CB',
  skipped: '\u2298',
};

const STATUS_LABELS: Record<ProofGoal['status'], string> = {
  proved: 'Proved',
  failed: 'Failed',
  open: 'Open',
  skipped: 'Skipped',
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
    if (goal.children?.length) {
      const found = findGoal(goal.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

function countGoals(goals: ProofGoal[]): { total: number; proved: number } {
  let total = 0;
  let proved = 0;
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

export interface ProofSessionTreeProps { [key: string]: unknown; class?: string; }
export interface ProofSessionTreeResult { element: HTMLElement; dispose: () => void; }

export function ProofSessionTree(props: ProofSessionTreeProps): ProofSessionTreeResult {
  const sig = surfaceCreateSignal<ProofSessionTreeState>('idle');
  const send = (type: string) => sig.set(proofSessionTreeReducer(sig.get(), { type } as any));

  const goals = (props.goals ?? []) as ProofGoal[];
  const onSelectGoal = props.onSelectGoal as ((id: string | undefined) => void) | undefined;
  const controlledExpandedIds = props.expandedIds as string[] | undefined;

  let selectedId: string | undefined = props.selectedId as string | undefined;
  let expandedSet = new Set<string>(controlledExpandedIds ?? []);
  let focusedId: string | undefined;
  const nodeRefs = new Map<string, HTMLDivElement>();

  const { total, proved } = countGoals(goals);

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'proof-session-tree');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'tree');
  root.setAttribute('aria-label', 'Proof session tree');
  root.setAttribute('data-state', selectedId ? 'selected' : 'idle');
  root.setAttribute('data-count', String(goals.length));
  if (props.class) root.className = props.class as string;

  /* Summary */
  const summaryEl = document.createElement('div');
  summaryEl.setAttribute('data-part', 'summary');
  summaryEl.setAttribute('aria-live', 'polite');
  summaryEl.textContent = `${proved} of ${total} goals proved`;
  root.appendChild(summaryEl);

  /* Tree container */
  const treeContainer = document.createElement('div');
  root.appendChild(treeContainer);

  /* Detail panel */
  const detailPanelEl = document.createElement('div');
  detailPanelEl.setAttribute('data-part', 'detail-panel');
  detailPanelEl.setAttribute('role', 'complementary');
  detailPanelEl.setAttribute('aria-label', 'Goal details');
  detailPanelEl.setAttribute('data-visible', 'false');
  root.appendChild(detailPanelEl);

  function renderGoalNode(goal: ProofGoal, depth: number): HTMLDivElement {
    const hasChildren = !!(goal.children?.length);
    const isExpanded = expandedSet.has(goal.id);
    const isSelected = selectedId === goal.id;
    const isFocused = focusedId === goal.id;

    const el = document.createElement('div');
    el.setAttribute('role', 'treeitem');
    if (hasChildren) el.setAttribute('aria-expanded', String(isExpanded));
    el.setAttribute('aria-selected', String(isSelected));
    el.setAttribute('aria-level', String(depth + 1));
    el.setAttribute('aria-label', `${goal.label} - ${STATUS_LABELS[goal.status]}`);
    el.setAttribute('data-part', 'tree-item');
    el.setAttribute('data-status', goal.status);
    el.setAttribute('data-selected', isSelected ? 'true' : 'false');
    el.setAttribute('data-id', goal.id);
    el.setAttribute('tabindex', isFocused ? '0' : '-1');
    el.style.paddingLeft = `${depth * 20}px`;
    nodeRefs.set(goal.id, el);

    el.addEventListener('click', (e) => { e.stopPropagation(); handleSelect(goal.id); });
    el.addEventListener('focus', () => { focusedId = goal.id; });

    /* Expand trigger */
    const expandBtn = document.createElement('button');
    expandBtn.type = 'button';
    expandBtn.setAttribute('data-part', 'expand-trigger');
    expandBtn.setAttribute('data-expanded', isExpanded ? 'true' : 'false');
    expandBtn.setAttribute('data-visible', hasChildren ? 'true' : 'false');
    expandBtn.setAttribute('aria-label', isExpanded ? 'Collapse' : 'Expand');
    expandBtn.setAttribute('tabindex', '-1');
    expandBtn.style.visibility = hasChildren ? 'visible' : 'hidden';
    expandBtn.textContent = isExpanded ? '\u25BC' : '\u25B6';
    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (hasChildren) handleToggleExpand(goal.id);
    });
    el.appendChild(expandBtn);

    /* Status badge */
    const statusBadge = document.createElement('span');
    statusBadge.setAttribute('data-part', 'status-badge');
    statusBadge.setAttribute('data-status', goal.status);
    statusBadge.setAttribute('aria-hidden', 'true');
    statusBadge.textContent = STATUS_ICONS[goal.status];
    el.appendChild(statusBadge);

    /* Label */
    const labelSpan = document.createElement('span');
    labelSpan.setAttribute('data-part', 'item-label');
    labelSpan.textContent = goal.label;
    el.appendChild(labelSpan);

    /* Progress bar */
    if (goal.progress != null) {
      const progressSpan = document.createElement('span');
      progressSpan.setAttribute('data-part', 'progress-bar');
      progressSpan.setAttribute('data-visible', 'true');
      progressSpan.setAttribute('data-value', String(goal.progress));
      progressSpan.setAttribute('role', 'progressbar');
      progressSpan.setAttribute('aria-valuenow', String(goal.progress));
      progressSpan.setAttribute('aria-valuemin', '0');
      progressSpan.setAttribute('aria-valuemax', '1');
      progressSpan.setAttribute('aria-label', `${Math.round(goal.progress * 100)}% complete`);
      progressSpan.textContent = `${Math.round(goal.progress * 100)}%`;
      el.appendChild(progressSpan);
    }

    /* Children */
    if (hasChildren && isExpanded) {
      const childrenEl = document.createElement('div');
      childrenEl.setAttribute('data-part', 'children');
      childrenEl.setAttribute('role', 'group');
      childrenEl.setAttribute('data-visible', 'true');
      for (const child of goal.children!) {
        childrenEl.appendChild(renderGoalNode(child, depth + 1));
      }
      el.appendChild(childrenEl);
    }

    return el;
  }

  function rebuildTree(): void {
    treeContainer.innerHTML = '';
    nodeRefs.clear();
    for (const goal of goals) {
      treeContainer.appendChild(renderGoalNode(goal, 0));
    }
    updateDetailPanel();
    root.setAttribute('data-state', selectedId ? 'selected' : 'idle');
  }

  function handleSelect(id: string): void {
    const nextId = id === selectedId ? undefined : id;
    selectedId = nextId;
    onSelectGoal?.(nextId);
    send(nextId ? 'SELECT' : 'DESELECT');
    rebuildTree();
  }

  function handleToggleExpand(id: string): void {
    if (expandedSet.has(id)) {
      expandedSet.delete(id);
      send('COLLAPSE');
    } else {
      expandedSet.add(id);
      send('EXPAND');
    }
    rebuildTree();
  }

  function updateDetailPanel(): void {
    detailPanelEl.innerHTML = '';
    const selectedGoal = selectedId ? findGoal(goals, selectedId) : undefined;
    detailPanelEl.setAttribute('data-visible', selectedGoal ? 'true' : 'false');

    if (!selectedGoal) return;

    /* Header */
    const headerEl = document.createElement('div');
    headerEl.setAttribute('data-part', 'detail-header');

    const statusSpan = document.createElement('span');
    statusSpan.setAttribute('data-part', 'detail-status');
    statusSpan.setAttribute('data-status', selectedGoal.status);
    statusSpan.textContent = `${STATUS_ICONS[selectedGoal.status]} ${STATUS_LABELS[selectedGoal.status]}`;
    headerEl.appendChild(statusSpan);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('data-part', 'detail-close');
    closeBtn.setAttribute('aria-label', 'Close detail panel');
    closeBtn.setAttribute('tabindex', '0');
    closeBtn.textContent = '\u2715';
    closeBtn.addEventListener('click', () => {
      selectedId = undefined;
      onSelectGoal?.(undefined);
      send('DESELECT');
      rebuildTree();
    });
    headerEl.appendChild(closeBtn);
    detailPanelEl.appendChild(headerEl);

    /* Body */
    const bodyEl = document.createElement('div');
    bodyEl.setAttribute('data-part', 'detail-body');

    const addField = (label: string, value: string, status?: string) => {
      const f = document.createElement('div');
      f.setAttribute('data-part', 'detail-field');
      const l = document.createElement('span');
      l.setAttribute('data-part', 'detail-label');
      l.textContent = label;
      f.appendChild(l);
      const v = document.createElement('span');
      v.setAttribute('data-part', 'detail-value');
      if (status) v.setAttribute('data-status', status);
      v.textContent = value;
      f.appendChild(v);
      bodyEl.appendChild(f);
    };

    addField('Goal', selectedGoal.label);
    addField('Status', `${STATUS_ICONS[selectedGoal.status]} ${STATUS_LABELS[selectedGoal.status]}`, selectedGoal.status);
    if (selectedGoal.tactic) addField('Tactic', selectedGoal.tactic);
    if (selectedGoal.progress != null) addField('Progress', `${Math.round(selectedGoal.progress * 100)}%`);
    if (selectedGoal.children && selectedGoal.children.length > 0) {
      addField('Sub-goals', `${selectedGoal.children.length} goals`);
    }

    detailPanelEl.appendChild(bodyEl);
  }

  root.addEventListener('keydown', (e) => {
    const flatList = flattenVisible(goals, expandedSet);
    const currentIndex = flatList.findIndex((g) => g.id === focusedId);

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const nextIndex = Math.min(currentIndex + 1, flatList.length - 1);
        if (flatList[nextIndex]) { focusedId = flatList[nextIndex].id; nodeRefs.get(focusedId!)?.focus(); }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prevIndex = Math.max(currentIndex - 1, 0);
        if (flatList[prevIndex]) { focusedId = flatList[prevIndex].id; nodeRefs.get(focusedId!)?.focus(); }
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        if (focusedId) {
          const goal = findGoal(goals, focusedId);
          if (goal?.children?.length) {
            if (!expandedSet.has(focusedId)) {
              handleToggleExpand(focusedId);
            } else {
              focusedId = goal.children[0].id;
              nodeRefs.get(focusedId!)?.focus();
            }
          }
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        if (focusedId && expandedSet.has(focusedId)) {
          handleToggleExpand(focusedId);
        }
        break;
      }
      case 'Enter':
        e.preventDefault();
        if (focusedId) handleSelect(focusedId);
        break;
      case 'Home':
        e.preventDefault();
        if (flatList.length) { focusedId = flatList[0].id; nodeRefs.get(focusedId!)?.focus(); }
        break;
      case 'End':
        e.preventDefault();
        if (flatList.length) { focusedId = flatList[flatList.length - 1].id; nodeRefs.get(focusedId!)?.focus(); }
        break;
      case 'Escape':
        e.preventDefault();
        selectedId = undefined;
        onSelectGoal?.(undefined);
        send('DESELECT');
        rebuildTree();
        break;
    }
  });

  rebuildTree();

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default ProofSessionTree;
