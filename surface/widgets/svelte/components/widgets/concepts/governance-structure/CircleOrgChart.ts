import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type CircleOrgChartState = 'idle' | 'circleSelected';
export type CircleOrgChartEvent =
  | { type: 'SELECT_CIRCLE' }
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'DESELECT' };

export function circleOrgChartReducer(state: CircleOrgChartState, event: CircleOrgChartEvent): CircleOrgChartState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_CIRCLE') return 'circleSelected';
      if (event.type === 'EXPAND') return 'idle';
      if (event.type === 'COLLAPSE') return 'idle';
      return state;
    case 'circleSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_CIRCLE') return 'circleSelected';
      return state;
    default:
      return state;
  }
}

interface CircleMember { name: string; role: string; }
interface Circle {
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
  for (const n of nodes) {
    if (n.circle.id === id) return n;
    if (n.children.length) { const f = findNode(n.children, id); if (f) return f; }
  }
  return undefined;
}

export interface CircleOrgChartProps { [key: string]: unknown; class?: string; }
export interface CircleOrgChartResult { element: HTMLElement; dispose: () => void; }

export function CircleOrgChart(props: CircleOrgChartProps): CircleOrgChartResult {
  const sig = surfaceCreateSignal<CircleOrgChartState>('idle');
  const send = (type: string) => sig.set(circleOrgChartReducer(sig.get(), { type } as any));

  const circles = (props.circles ?? []) as Circle[];
  const layout = String(props.layout ?? 'tree');
  const showPolicies = props.showPolicies !== false;
  const showJurisdiction = props.showJurisdiction !== false;
  const maxAvatars = typeof props.maxAvatars === 'number' ? props.maxAvatars : 5;
  const onSelectCircle = props.onSelectCircle as ((id: string | undefined) => void) | undefined;
  const controlledExpandedIds = props.expandedIds as string[] | undefined;

  let selectedId: string | undefined = props.selectedCircleId as string | undefined;
  let expandedSet = new Set<string>(controlledExpandedIds ?? []);
  let focusedId: string | undefined;
  const nodeRefs = new Map<string, HTMLDivElement>();
  const tree = buildTree(circles);

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'circle-org-chart');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'tree');
  root.setAttribute('aria-label', 'Governance circles');
  root.setAttribute('data-state', selectedId ? 'circleSelected' : 'idle');
  root.setAttribute('data-layout', layout);
  if (props.class) root.className = props.class as string;

  const treeContainer = document.createElement('div');
  root.appendChild(treeContainer);

  const detailPanelEl = document.createElement('div');
  detailPanelEl.setAttribute('data-part', 'detail-panel');
  detailPanelEl.setAttribute('role', 'complementary');
  detailPanelEl.setAttribute('aria-label', 'Circle details');
  detailPanelEl.setAttribute('data-visible', selectedId ? 'true' : 'false');
  root.appendChild(detailPanelEl);

  function renderCircleNode(node: CircleTreeNode, depth: number): HTMLDivElement {
    const { circle, children } = node;
    const hasChildren = children.length > 0;
    const isExpanded = expandedSet.has(circle.id);
    const isSelected = selectedId === circle.id;
    const isFocused = focusedId === circle.id;
    const visibleMembers = circle.members.slice(0, maxAvatars);
    const overflowCount = Math.max(0, circle.members.length - maxAvatars);

    const el = document.createElement('div');
    el.setAttribute('role', 'treeitem');
    if (hasChildren) el.setAttribute('aria-expanded', String(isExpanded));
    el.setAttribute('aria-selected', String(isSelected));
    el.setAttribute('aria-label', `${circle.name}: ${circle.purpose}`);
    el.setAttribute('aria-level', String(depth + 1));
    el.setAttribute('data-part', 'circle-node');
    el.setAttribute('data-selected', isSelected ? 'true' : 'false');
    el.setAttribute('data-id', circle.id);
    el.setAttribute('tabindex', isFocused ? '0' : '-1');
    el.style.paddingLeft = `${depth * 24}px`;
    nodeRefs.set(circle.id, el);

    el.addEventListener('click', (e) => { e.stopPropagation(); handleSelect(circle.id); });
    el.addEventListener('focus', () => { focusedId = circle.id; });

    if (hasChildren) {
      const toggle = document.createElement('span');
      toggle.setAttribute('data-part', 'expand-toggle');
      toggle.setAttribute('aria-hidden', 'true');
      toggle.textContent = isExpanded ? '\u25BC' : '\u25B6';
      toggle.addEventListener('click', (e) => { e.stopPropagation(); handleToggleExpand(circle.id); });
      el.appendChild(toggle);
    }

    const labelEl = document.createElement('span');
    labelEl.setAttribute('data-part', 'circle-label');
    labelEl.textContent = circle.name;
    el.appendChild(labelEl);

    const purposeEl = document.createElement('span');
    purposeEl.setAttribute('data-part', 'circle-purpose');
    purposeEl.setAttribute('aria-hidden', 'true');
    purposeEl.textContent = circle.purpose;
    el.appendChild(purposeEl);

    const countEl = document.createElement('span');
    countEl.setAttribute('data-part', 'member-count');
    countEl.textContent = `${circle.members.length} member${circle.members.length !== 1 ? 's' : ''}`;
    el.appendChild(countEl);

    const avatarsEl = document.createElement('div');
    avatarsEl.setAttribute('data-part', 'member-avatars');
    for (const member of visibleMembers) {
      const av = document.createElement('span');
      av.setAttribute('data-part', 'member-avatar');
      av.setAttribute('aria-label', `${member.name}, ${member.role}`);
      av.title = `${member.name} (${member.role})`;
      av.textContent = member.name.charAt(0).toUpperCase();
      avatarsEl.appendChild(av);
    }
    if (overflowCount > 0) {
      const ov = document.createElement('span');
      ov.setAttribute('data-part', 'member-overflow');
      ov.setAttribute('aria-label', `${overflowCount} more members`);
      ov.textContent = `+${overflowCount}`;
      avatarsEl.appendChild(ov);
    }
    el.appendChild(avatarsEl);

    if (showPolicies && circle.policies?.length) {
      const policiesEl = document.createElement('div');
      policiesEl.setAttribute('data-part', 'policies');
      policiesEl.setAttribute('data-visible', 'true');
      for (const policy of circle.policies) {
        const badge = document.createElement('span');
        badge.setAttribute('data-part', 'policy-badge');
        badge.textContent = policy;
        policiesEl.appendChild(badge);
      }
      el.appendChild(policiesEl);
    }

    if (showJurisdiction && circle.jurisdiction) {
      const jEl = document.createElement('span');
      jEl.setAttribute('data-part', 'jurisdiction');
      jEl.setAttribute('data-visible', 'true');
      jEl.textContent = circle.jurisdiction;
      el.appendChild(jEl);
    }

    if (hasChildren && isExpanded) {
      const childrenEl = document.createElement('div');
      childrenEl.setAttribute('data-part', 'children');
      childrenEl.setAttribute('role', 'group');
      childrenEl.setAttribute('data-visible', 'true');
      for (const child of children) childrenEl.appendChild(renderCircleNode(child, depth + 1));
      el.appendChild(childrenEl);
    }

    return el;
  }

  function rebuildTree(): void {
    treeContainer.innerHTML = '';
    nodeRefs.clear();
    for (const rootNode of tree) treeContainer.appendChild(renderCircleNode(rootNode, 0));
    updateDetailPanel();
    root.setAttribute('data-state', selectedId ? 'circleSelected' : 'idle');
  }

  function handleSelect(id: string): void {
    selectedId = id === selectedId ? undefined : id;
    onSelectCircle?.(selectedId);
    if (selectedId) send('SELECT_CIRCLE'); else send('DESELECT');
    rebuildTree();
  }

  function handleToggleExpand(id: string): void {
    if (expandedSet.has(id)) expandedSet.delete(id); else expandedSet.add(id);
    rebuildTree();
  }

  function updateDetailPanel(): void {
    detailPanelEl.innerHTML = '';
    detailPanelEl.setAttribute('data-visible', selectedId ? 'true' : 'false');
    if (!selectedId) return;
    const c = circles.find((c) => c.id === selectedId);
    if (!c) return;

    const headerEl = document.createElement('div');
    headerEl.setAttribute('data-part', 'detail-header');
    const titleEl = document.createElement('span');
    titleEl.setAttribute('data-part', 'detail-title');
    titleEl.textContent = c.name;
    headerEl.appendChild(titleEl);
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('data-part', 'detail-close');
    closeBtn.setAttribute('aria-label', 'Close detail panel');
    closeBtn.setAttribute('tabindex', '0');
    closeBtn.textContent = '\u2715';
    closeBtn.addEventListener('click', () => { selectedId = undefined; onSelectCircle?.(undefined); send('DESELECT'); rebuildTree(); });
    headerEl.appendChild(closeBtn);
    detailPanelEl.appendChild(headerEl);

    const bodyEl = document.createElement('div');
    bodyEl.setAttribute('data-part', 'detail-body');

    const addField = (label: string, value: string) => {
      const f = document.createElement('div');
      f.setAttribute('data-part', 'detail-field');
      const l = document.createElement('span');
      l.setAttribute('data-part', 'detail-label');
      l.textContent = label;
      f.appendChild(l);
      const v = document.createElement('span');
      v.setAttribute('data-part', 'detail-value');
      v.textContent = value;
      f.appendChild(v);
      bodyEl.appendChild(f);
    };

    addField('Purpose', c.purpose);
    if (c.jurisdiction) addField('Jurisdiction', c.jurisdiction);
    if (c.policies?.length) addField('Policies', c.policies.join(', '));
    addField('Members', `${c.members.length} member${c.members.length !== 1 ? 's' : ''}`);

    const membersEl = document.createElement('div');
    membersEl.setAttribute('data-part', 'detail-members');
    for (const member of c.members) {
      const mEl = document.createElement('div');
      mEl.setAttribute('data-part', 'detail-member');
      const nameEl = document.createElement('span');
      nameEl.setAttribute('data-part', 'detail-member-name');
      nameEl.textContent = member.name;
      mEl.appendChild(nameEl);
      const roleEl = document.createElement('span');
      roleEl.setAttribute('data-part', 'detail-member-role');
      roleEl.textContent = member.role;
      mEl.appendChild(roleEl);
      membersEl.appendChild(mEl);
    }
    bodyEl.appendChild(membersEl);
    detailPanelEl.appendChild(bodyEl);
  }

  root.addEventListener('keydown', (e) => {
    const flatList = flattenVisible(tree, expandedSet);
    const currentIndex = flatList.findIndex((c) => c.id === focusedId);
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = Math.min(currentIndex + 1, flatList.length - 1);
        if (flatList[next]) { focusedId = flatList[next].id; nodeRefs.get(focusedId!)?.focus(); }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = Math.max(currentIndex - 1, 0);
        if (flatList[prev]) { focusedId = flatList[prev].id; nodeRefs.get(focusedId!)?.focus(); }
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        if (focusedId) {
          const node = findNode(tree, focusedId);
          if (node?.children.length) {
            if (!expandedSet.has(focusedId)) handleToggleExpand(focusedId);
            else { focusedId = node.children[0].circle.id; nodeRefs.get(focusedId!)?.focus(); }
          }
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        if (focusedId) {
          if (expandedSet.has(focusedId)) handleToggleExpand(focusedId);
          else {
            const c = circles.find((c) => c.id === focusedId);
            if (c?.parentId) { focusedId = c.parentId; nodeRefs.get(focusedId!)?.focus(); }
          }
        }
        break;
      }
      case 'Enter':
        e.preventDefault();
        if (focusedId) handleSelect(focusedId);
        break;
      case 'Escape':
        e.preventDefault();
        selectedId = undefined;
        onSelectCircle?.(undefined);
        send('DESELECT');
        rebuildTree();
        break;
    }
  });

  rebuildTree();

  const unsub = sig.subscribe((s) => { root.setAttribute('data-state', s); });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default CircleOrgChart;
