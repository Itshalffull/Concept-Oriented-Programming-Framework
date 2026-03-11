import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type DelegationGraphState = 'browsing' | 'searching' | 'selected' | 'delegating' | 'undelegating';
export type DelegationGraphEvent =
  | { type: 'SEARCH' }
  | { type: 'SELECT_DELEGATE' }
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

interface DelegationNode { id: string; label: string; weight?: number; avatar?: string; }
interface DelegationEdge { from: string; to: string; weight?: number; }

function computeEffectiveWeight(nodeId: string, nodes: DelegationNode[], edges: DelegationEdge[], visited = new Set<string>()): number {
  if (visited.has(nodeId)) return 0;
  visited.add(nodeId);
  const node = nodes.find((n) => n.id === nodeId);
  const base = node?.weight ?? 1;
  let delegated = 0;
  for (const e of edges) {
    if (e.to === nodeId) delegated += computeEffectiveWeight(e.from, nodes, edges, new Set(visited)) * (e.weight ?? 1);
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

function formatWeight(w: number): string {
  return Number.isInteger(w) ? String(w) : w.toFixed(2);
}

export interface DelegationGraphProps { [key: string]: unknown; class?: string; }
export interface DelegationGraphResult { element: HTMLElement; dispose: () => void; }

export function DelegationGraph(props: DelegationGraphProps): DelegationGraphResult {
  const sig = surfaceCreateSignal<DelegationGraphState>('browsing');
  const send = (type: string) => sig.set(delegationGraphReducer(sig.get(), { type } as any));

  const nodes = (props.nodes ?? []) as DelegationNode[];
  const edges = (props.edges ?? []) as DelegationEdge[];
  const currentUserId = props.currentUserId as string | undefined;
  const sortBy = String(props.sortBy ?? 'power');
  const showCurrentDelegation = props.showCurrentDelegation !== false;
  const onDelegate = props.onDelegate as ((from: string, to: string) => void) | undefined;
  const onUndelegate = props.onUndelegate as ((from: string, to: string) => void) | undefined;
  const onSelectNode = props.onSelectNode as ((nodeId: string) => void) | undefined;

  let searchQuery = '';
  let selectedNodeId: string | null = null;
  let focusedIndex = 0;
  let activeView: 'list' | 'graph' = (props.viewMode as 'list' | 'graph') ?? 'list';

  const nodeWeights = new Map<string, number>();
  for (const n of nodes) nodeWeights.set(n.id, computeEffectiveWeight(n.id, nodes, edges));

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'delegation-graph');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Delegation management');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('data-view', activeView);
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Search */
  const searchDiv = document.createElement('div');
  searchDiv.setAttribute('data-part', 'search-input');
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search delegates...';
  searchInput.setAttribute('aria-label', 'Search delegates by name');
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    if (searchQuery && sig.get() === 'browsing') send('SEARCH');
    else if (!searchQuery && sig.get() === 'searching') send('CLEAR_SEARCH');
    rebuildList();
  });
  searchDiv.appendChild(searchInput);
  root.appendChild(searchDiv);

  /* Sort control */
  const sortControlEl = document.createElement('div');
  sortControlEl.setAttribute('data-part', 'sort-control');
  sortControlEl.setAttribute('data-sort', sortBy);
  root.appendChild(sortControlEl);

  /* View toggle */
  const viewToggleBtn = document.createElement('button');
  viewToggleBtn.type = 'button';
  viewToggleBtn.setAttribute('data-part', 'view-toggle');
  viewToggleBtn.setAttribute('data-mode', activeView);
  viewToggleBtn.setAttribute('aria-label', `Switch to ${activeView === 'list' ? 'graph' : 'list'} view`);
  viewToggleBtn.textContent = activeView === 'list' ? 'Graph' : 'List';
  viewToggleBtn.addEventListener('click', () => {
    activeView = activeView === 'list' ? 'graph' : 'list';
    root.setAttribute('data-view', activeView);
    viewToggleBtn.setAttribute('data-mode', activeView);
    viewToggleBtn.textContent = activeView === 'list' ? 'Graph' : 'List';
    viewToggleBtn.setAttribute('aria-label', `Switch to ${activeView === 'list' ? 'graph' : 'list'} view`);
    send('SWITCH_VIEW');
    delegateListEl.style.display = activeView === 'list' ? '' : 'none';
    graphViewEl.style.display = activeView === 'graph' ? '' : 'none';
  });
  root.appendChild(viewToggleBtn);

  /* Summary */
  const summaryEl = document.createElement('div');
  summaryEl.setAttribute('data-part', 'summary');
  summaryEl.setAttribute('aria-label', 'Delegation summary');
  const totalPart = document.createElement('span');
  totalPart.setAttribute('data-part', 'total-participants');
  totalPart.textContent = `${nodes.length} participant${nodes.length !== 1 ? 's' : ''}`;
  summaryEl.appendChild(totalPart);
  const totalWeight = edges.reduce((s, e) => s + (e.weight ?? 1), 0);
  const weightPart = document.createElement('span');
  weightPart.setAttribute('data-part', 'total-weight');
  weightPart.textContent = `${formatWeight(totalWeight)} weight delegated`;
  summaryEl.appendChild(weightPart);
  root.appendChild(summaryEl);

  /* Current delegation info */
  if (showCurrentDelegation) {
    const currentInfoEl = document.createElement('div');
    currentInfoEl.setAttribute('data-part', 'current-info');
    currentInfoEl.setAttribute('data-visible', 'true');
    currentInfoEl.setAttribute('aria-label', 'Your current delegation');
    const currentEdge = currentUserId ? edges.find((e) => e.from === currentUserId) : null;
    const delegatee = currentEdge ? nodes.find((n) => n.id === currentEdge.to) : null;
    const sp = document.createElement('span');
    sp.textContent = delegatee
      ? `Delegating to ${delegatee.label} (weight: ${formatWeight(currentEdge!.weight ?? 1)})`
      : 'Not currently delegating';
    currentInfoEl.appendChild(sp);
    root.appendChild(currentInfoEl);
  }

  /* Delegate list */
  const delegateListEl = document.createElement('ul');
  delegateListEl.setAttribute('role', 'tree');
  delegateListEl.setAttribute('aria-label', 'Delegates');
  delegateListEl.setAttribute('data-part', 'delegate-list');
  delegateListEl.setAttribute('data-visible', activeView === 'list' ? 'true' : 'false');
  delegateListEl.style.display = activeView === 'list' ? '' : 'none';
  root.appendChild(delegateListEl);

  /* Graph view */
  const graphViewEl = document.createElement('div');
  graphViewEl.setAttribute('data-part', 'graph-view');
  graphViewEl.setAttribute('data-visible', activeView === 'graph' ? 'true' : 'false');
  graphViewEl.setAttribute('aria-label', 'Delegation graph');
  graphViewEl.style.display = activeView === 'graph' ? '' : 'none';
  root.appendChild(graphViewEl);

  /* Detail panel */
  const detailPanelEl = document.createElement('div');
  detailPanelEl.setAttribute('data-part', 'detail-panel');
  detailPanelEl.setAttribute('role', 'complementary');
  detailPanelEl.style.display = 'none';
  root.appendChild(detailPanelEl);

  function getFilteredNodes(): DelegationNode[] {
    let result = [...nodes];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((n) => n.label.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      if (sortBy === 'name') return a.label.localeCompare(b.label);
      return (nodeWeights.get(b.id) ?? 0) - (nodeWeights.get(a.id) ?? 0);
    });
    return result;
  }

  function rebuildList(): void {
    delegateListEl.innerHTML = '';
    const filtered = getFilteredNodes();
    for (let i = 0; i < filtered.length; i++) {
      const node = filtered[i];
      const effectiveWeight = nodeWeights.get(node.id) ?? 0;
      const isSelected = selectedNodeId === node.id;
      const delegated = currentUserId ? edges.some((e) => e.from === currentUserId && e.to === node.id) : false;
      const upstreamCount = findUpstream(node.id, edges).length;

      const li = document.createElement('li');
      li.setAttribute('role', 'treeitem');
      li.setAttribute('aria-label', `${node.label} \u2014 voting power: ${formatWeight(effectiveWeight)}`);
      li.setAttribute('aria-selected', String(isSelected));
      li.setAttribute('data-part', 'delegate-item');
      li.setAttribute('data-selected', isSelected ? 'true' : 'false');
      li.setAttribute('data-state', sig.get());
      li.setAttribute('tabindex', i === focusedIndex ? '0' : '-1');
      const idx = i;
      li.addEventListener('click', () => { focusedIndex = idx; handleSelectNode(node.id); });

      const av = document.createElement('span');
      av.setAttribute('data-part', 'avatar');
      av.setAttribute('aria-hidden', 'true');
      av.textContent = node.avatar ?? node.label.charAt(0).toUpperCase();
      li.appendChild(av);

      const nameEl = document.createElement('span');
      nameEl.setAttribute('data-part', 'delegate-name');
      nameEl.textContent = node.label;
      li.appendChild(nameEl);

      const vpEl = document.createElement('span');
      vpEl.setAttribute('data-part', 'voting-power');
      vpEl.setAttribute('aria-label', `Voting power: ${formatWeight(effectiveWeight)}`);
      vpEl.textContent = formatWeight(effectiveWeight);
      li.appendChild(vpEl);

      const partEl = document.createElement('span');
      partEl.setAttribute('data-part', 'participation');
      partEl.setAttribute('aria-label', `${upstreamCount} delegator${upstreamCount !== 1 ? 's' : ''}`);
      partEl.textContent = `${upstreamCount} delegator${upstreamCount !== 1 ? 's' : ''}`;
      li.appendChild(partEl);

      if (currentUserId && node.id !== currentUserId) {
        const actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.setAttribute('data-part', 'delegate-action');
        actionBtn.setAttribute('role', 'button');
        actionBtn.setAttribute('aria-label', delegated ? `Undelegate from ${node.label}` : `Delegate to ${node.label}`);
        actionBtn.setAttribute('tabindex', '0');
        actionBtn.textContent = delegated ? 'Undelegate' : 'Delegate';
        actionBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (delegated) { send('UNDELEGATE'); onUndelegate?.(currentUserId!, node.id); setTimeout(() => send('UNDELEGATE_COMPLETE'), 0); }
          else { send('DELEGATE'); onDelegate?.(currentUserId!, node.id); setTimeout(() => send('DELEGATE_COMPLETE'), 0); }
        });
        li.appendChild(actionBtn);
      }

      delegateListEl.appendChild(li);
    }
  }

  function handleSelectNode(nodeId: string): void {
    selectedNodeId = nodeId;
    send('SELECT_DELEGATE');
    onSelectNode?.(nodeId);
    updateDetailPanel();
    rebuildList();
  }

  function handleDeselect(): void {
    selectedNodeId = null;
    send('DESELECT');
    detailPanelEl.style.display = 'none';
    rebuildList();
  }

  function updateDetailPanel(): void {
    if (sig.get() !== 'selected' || !selectedNodeId) {
      detailPanelEl.style.display = 'none';
      return;
    }
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;
    detailPanelEl.style.display = '';
    detailPanelEl.setAttribute('aria-label', `Delegation details for ${node.label}`);
    detailPanelEl.innerHTML = '';

    const headerEl = document.createElement('div');
    headerEl.setAttribute('data-part', 'detail-header');
    const av = document.createElement('span');
    av.setAttribute('data-part', 'avatar');
    av.setAttribute('aria-hidden', 'true');
    av.textContent = node.avatar ?? node.label.charAt(0).toUpperCase();
    headerEl.appendChild(av);
    const h3 = document.createElement('h3');
    h3.setAttribute('data-part', 'delegate-name');
    h3.textContent = node.label;
    headerEl.appendChild(h3);
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close detail panel');
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', handleDeselect);
    headerEl.appendChild(closeBtn);
    detailPanelEl.appendChild(headerEl);

    const dl = document.createElement('dl');
    dl.setAttribute('data-part', 'detail-stats');
    const addStat = (label: string, value: string) => {
      const dt = document.createElement('dt');
      dt.textContent = label;
      dl.appendChild(dt);
      const dd = document.createElement('dd');
      dd.textContent = value;
      dl.appendChild(dd);
    };
    addStat('Effective voting power', formatWeight(nodeWeights.get(node.id) ?? 0));
    addStat('Base weight', formatWeight(node.weight ?? 1));
    const upstream = findUpstream(node.id, edges);
    addStat('Upstream delegators', String(upstream.length));
    detailPanelEl.appendChild(dl);
  }

  root.addEventListener('keydown', (e) => {
    const filtered = getFilteredNodes();
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusedIndex = Math.min(focusedIndex + 1, filtered.length - 1);
        rebuildList();
        (delegateListEl.children[focusedIndex] as HTMLElement)?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusedIndex = Math.max(focusedIndex - 1, 0);
        rebuildList();
        (delegateListEl.children[focusedIndex] as HTMLElement)?.focus();
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[focusedIndex]) handleSelectNode(filtered[focusedIndex].id);
        break;
      case 'Escape':
        e.preventDefault();
        handleDeselect();
        break;
    }
  });

  rebuildList();

  const unsub = sig.subscribe((s) => { root.setAttribute('data-state', s); });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default DelegationGraph;
