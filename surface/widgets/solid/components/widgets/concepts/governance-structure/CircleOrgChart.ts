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

export interface CircleOrgChartProps { [key: string]: unknown; class?: string; }
export interface CircleOrgChartResult { element: HTMLElement; dispose: () => void; }

export function CircleOrgChart(props: CircleOrgChartProps): CircleOrgChartResult {
  const sig = surfaceCreateSignal<CircleOrgChartState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(circleOrgChartReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'circle-org-chart');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'tree');
  root.setAttribute('aria-label', 'Governance circles');
  root.setAttribute('data-state', state());
  root.setAttribute('data-layout', 'tree');
  if (props.class) root.className = props.class as string;

  /* Circle node template */
  const circleNodeEl = document.createElement('div');
  circleNodeEl.setAttribute('data-part', 'circle-node');
  circleNodeEl.setAttribute('data-selected', 'false');
  circleNodeEl.setAttribute('role', 'treeitem');
  circleNodeEl.setAttribute('tabindex', '0');
  circleNodeEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state() === 'circleSelected') {
      send('DESELECT');
    } else {
      send('SELECT_CIRCLE');
    }
  });

  /* Expand toggle */
  const expandToggleEl = document.createElement('span');
  expandToggleEl.setAttribute('data-part', 'expand-toggle');
  expandToggleEl.setAttribute('aria-hidden', 'true');
  expandToggleEl.textContent = '\u25B6';
  expandToggleEl.addEventListener('click', (e) => {
    e.stopPropagation();
    send('EXPAND');
  });
  circleNodeEl.appendChild(expandToggleEl);

  /* Circle label */
  const circleLabelEl = document.createElement('span');
  circleLabelEl.setAttribute('data-part', 'circle-label');
  circleNodeEl.appendChild(circleLabelEl);

  /* Circle purpose */
  const circlePurposeEl = document.createElement('span');
  circlePurposeEl.setAttribute('data-part', 'circle-purpose');
  circlePurposeEl.setAttribute('aria-hidden', 'true');
  circleNodeEl.appendChild(circlePurposeEl);

  /* Member count */
  const memberCountEl = document.createElement('span');
  memberCountEl.setAttribute('data-part', 'member-count');
  circleNodeEl.appendChild(memberCountEl);

  /* Member avatars */
  const memberAvatarsEl = document.createElement('div');
  memberAvatarsEl.setAttribute('data-part', 'member-avatars');
  const memberAvatarEl = document.createElement('span');
  memberAvatarEl.setAttribute('data-part', 'member-avatar');
  memberAvatarsEl.appendChild(memberAvatarEl);
  const memberOverflowEl = document.createElement('span');
  memberOverflowEl.setAttribute('data-part', 'member-overflow');
  memberAvatarsEl.appendChild(memberOverflowEl);
  circleNodeEl.appendChild(memberAvatarsEl);

  /* Policy badges */
  const policiesEl = document.createElement('div');
  policiesEl.setAttribute('data-part', 'policies');
  policiesEl.setAttribute('data-visible', 'true');
  const policyBadgeEl = document.createElement('span');
  policyBadgeEl.setAttribute('data-part', 'policy-badge');
  policiesEl.appendChild(policyBadgeEl);
  circleNodeEl.appendChild(policiesEl);

  /* Jurisdiction tag */
  const jurisdictionEl = document.createElement('span');
  jurisdictionEl.setAttribute('data-part', 'jurisdiction');
  jurisdictionEl.setAttribute('data-visible', 'true');
  circleNodeEl.appendChild(jurisdictionEl);

  /* Children container */
  const childrenEl = document.createElement('div');
  childrenEl.setAttribute('data-part', 'children');
  childrenEl.setAttribute('role', 'group');
  childrenEl.setAttribute('data-visible', 'true');
  circleNodeEl.appendChild(childrenEl);

  root.appendChild(circleNodeEl);

  /* Detail panel */
  const detailPanelEl = document.createElement('div');
  detailPanelEl.setAttribute('data-part', 'detail-panel');
  detailPanelEl.setAttribute('role', 'complementary');
  detailPanelEl.setAttribute('aria-label', 'Circle details');
  detailPanelEl.setAttribute('data-visible', 'false');

  const detailHeaderEl = document.createElement('div');
  detailHeaderEl.setAttribute('data-part', 'detail-header');
  const detailTitleEl = document.createElement('span');
  detailTitleEl.setAttribute('data-part', 'detail-title');
  detailHeaderEl.appendChild(detailTitleEl);
  const detailCloseBtn = document.createElement('button');
  detailCloseBtn.type = 'button';
  detailCloseBtn.setAttribute('data-part', 'detail-close');
  detailCloseBtn.setAttribute('aria-label', 'Close detail panel');
  detailCloseBtn.setAttribute('tabindex', '0');
  detailCloseBtn.textContent = '\u2715';
  detailCloseBtn.addEventListener('click', () => send('DESELECT'));
  detailHeaderEl.appendChild(detailCloseBtn);
  detailPanelEl.appendChild(detailHeaderEl);

  const detailBodyEl = document.createElement('div');
  detailBodyEl.setAttribute('data-part', 'detail-body');

  /* Detail fields */
  const purposeField = document.createElement('div');
  purposeField.setAttribute('data-part', 'detail-field');
  const purposeLabel = document.createElement('span');
  purposeLabel.setAttribute('data-part', 'detail-label');
  purposeLabel.textContent = 'Purpose';
  purposeField.appendChild(purposeLabel);
  const purposeValue = document.createElement('span');
  purposeValue.setAttribute('data-part', 'detail-value');
  purposeField.appendChild(purposeValue);
  detailBodyEl.appendChild(purposeField);

  const membersField = document.createElement('div');
  membersField.setAttribute('data-part', 'detail-field');
  const membersLabel = document.createElement('span');
  membersLabel.setAttribute('data-part', 'detail-label');
  membersLabel.textContent = 'Members';
  membersField.appendChild(membersLabel);
  const membersValue = document.createElement('span');
  membersValue.setAttribute('data-part', 'detail-value');
  membersField.appendChild(membersValue);
  detailBodyEl.appendChild(membersField);

  const detailMembersEl = document.createElement('div');
  detailMembersEl.setAttribute('data-part', 'detail-members');
  detailBodyEl.appendChild(detailMembersEl);

  detailPanelEl.appendChild(detailBodyEl);
  root.appendChild(detailPanelEl);

  /* Keyboard navigation */
  root.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault();
        break;
      case 'ArrowRight':
        e.preventDefault();
        send('EXPAND');
        break;
      case 'ArrowLeft':
        e.preventDefault();
        send('COLLAPSE');
        break;
      case 'Enter':
        e.preventDefault();
        send('SELECT_CIRCLE');
        break;
      case 'Escape':
        e.preventDefault();
        send('DESELECT');
        break;
    }
  });

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    const isSelected = s === 'circleSelected';
    detailPanelEl.setAttribute('data-visible', isSelected ? 'true' : 'false');
    detailPanelEl.style.display = isSelected ? 'block' : 'none';
    circleNodeEl.setAttribute('data-selected', isSelected ? 'true' : 'false');
    circleNodeEl.setAttribute('aria-selected', String(isSelected));
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default CircleOrgChart;
