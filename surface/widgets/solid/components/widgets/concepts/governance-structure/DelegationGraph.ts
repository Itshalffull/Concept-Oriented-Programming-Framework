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

export interface DelegationGraphProps { [key: string]: unknown; class?: string; }
export interface DelegationGraphResult { element: HTMLElement; dispose: () => void; }

export function DelegationGraph(props: DelegationGraphProps): DelegationGraphResult {
  const sig = surfaceCreateSignal<DelegationGraphState>('browsing');
  const state = () => sig.get();
  const send = (type: string) => sig.set(delegationGraphReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'delegation-graph');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Delegation management');
  root.setAttribute('data-state', state());
  root.setAttribute('data-view', 'list');
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Search input */
  const searchInputWrapper = document.createElement('div');
  searchInputWrapper.setAttribute('data-part', 'search-input');
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search delegates...';
  searchInput.setAttribute('aria-label', 'Search delegates by name');
  searchInput.setAttribute('data-state', state());
  searchInput.addEventListener('input', () => {
    if (searchInput.value && state() === 'browsing') send('SEARCH');
    else if (!searchInput.value && state() === 'searching') send('CLEAR_SEARCH');
  });
  searchInputWrapper.appendChild(searchInput);
  root.appendChild(searchInputWrapper);

  /* Sort control */
  const sortControlEl = document.createElement('div');
  sortControlEl.setAttribute('data-part', 'sort-control');
  sortControlEl.setAttribute('data-sort', 'power');
  root.appendChild(sortControlEl);

  /* View toggle */
  const viewToggleBtn = document.createElement('button');
  viewToggleBtn.type = 'button';
  viewToggleBtn.setAttribute('data-part', 'view-toggle');
  viewToggleBtn.setAttribute('data-mode', 'list');
  viewToggleBtn.setAttribute('aria-label', 'Switch to graph view');
  viewToggleBtn.textContent = 'Graph';
  viewToggleBtn.addEventListener('click', () => send('SWITCH_VIEW'));
  root.appendChild(viewToggleBtn);

  /* Summary */
  const summaryEl = document.createElement('div');
  summaryEl.setAttribute('data-part', 'summary');
  summaryEl.setAttribute('aria-label', 'Delegation summary');
  const totalParticipantsEl = document.createElement('span');
  totalParticipantsEl.setAttribute('data-part', 'total-participants');
  summaryEl.appendChild(totalParticipantsEl);
  const totalWeightEl = document.createElement('span');
  totalWeightEl.setAttribute('data-part', 'total-weight');
  summaryEl.appendChild(totalWeightEl);
  root.appendChild(summaryEl);

  /* Current delegation info */
  const currentInfoEl = document.createElement('div');
  currentInfoEl.setAttribute('data-part', 'current-info');
  currentInfoEl.setAttribute('data-visible', 'true');
  currentInfoEl.setAttribute('aria-label', 'Your current delegation');
  currentInfoEl.innerHTML = '<span>Not currently delegating</span>';
  root.appendChild(currentInfoEl);

  /* Delegate list */
  const delegateListEl = document.createElement('ul');
  delegateListEl.setAttribute('role', 'tree');
  delegateListEl.setAttribute('aria-label', 'Delegates');
  delegateListEl.setAttribute('data-part', 'delegate-list');
  delegateListEl.setAttribute('data-visible', 'true');

  /* Delegate item template */
  const delegateItemEl = document.createElement('li');
  delegateItemEl.setAttribute('role', 'treeitem');
  delegateItemEl.setAttribute('data-part', 'delegate-item');
  delegateItemEl.setAttribute('data-selected', 'false');
  delegateItemEl.setAttribute('data-highlighted', 'false');
  delegateItemEl.setAttribute('data-state', state());
  delegateItemEl.setAttribute('tabindex', '0');
  delegateItemEl.addEventListener('click', () => send('SELECT_DELEGATE'));

  const avatarEl = document.createElement('span');
  avatarEl.setAttribute('data-part', 'avatar');
  avatarEl.setAttribute('aria-hidden', 'true');
  delegateItemEl.appendChild(avatarEl);

  const delegateNameEl = document.createElement('span');
  delegateNameEl.setAttribute('data-part', 'delegate-name');
  delegateItemEl.appendChild(delegateNameEl);

  const votingPowerEl = document.createElement('span');
  votingPowerEl.setAttribute('data-part', 'voting-power');
  delegateItemEl.appendChild(votingPowerEl);

  const participationEl = document.createElement('span');
  participationEl.setAttribute('data-part', 'participation');
  delegateItemEl.appendChild(participationEl);

  const delegateActionBtn = document.createElement('button');
  delegateActionBtn.type = 'button';
  delegateActionBtn.setAttribute('data-part', 'delegate-action');
  delegateActionBtn.setAttribute('role', 'button');
  delegateActionBtn.setAttribute('tabindex', '0');
  delegateActionBtn.textContent = 'Delegate';
  delegateActionBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    send('DELEGATE');
  });
  delegateItemEl.appendChild(delegateActionBtn);

  delegateListEl.appendChild(delegateItemEl);
  root.appendChild(delegateListEl);

  /* Graph view */
  const graphViewEl = document.createElement('div');
  graphViewEl.setAttribute('data-part', 'graph-view');
  graphViewEl.setAttribute('data-visible', 'false');
  graphViewEl.setAttribute('aria-label', 'Delegation graph');
  graphViewEl.style.display = 'none';
  const graphTreeEl = document.createElement('ul');
  graphTreeEl.setAttribute('role', 'tree');
  graphTreeEl.setAttribute('aria-label', 'Delegation relationships');
  graphViewEl.appendChild(graphTreeEl);
  root.appendChild(graphViewEl);

  /* Detail panel */
  const detailPanelEl = document.createElement('div');
  detailPanelEl.setAttribute('data-part', 'detail-panel');
  detailPanelEl.setAttribute('role', 'complementary');
  detailPanelEl.style.display = 'none';

  const detailHeaderEl = document.createElement('div');
  detailHeaderEl.setAttribute('data-part', 'detail-header');
  const detailAvatar = document.createElement('span');
  detailAvatar.setAttribute('data-part', 'avatar');
  detailAvatar.setAttribute('aria-hidden', 'true');
  detailHeaderEl.appendChild(detailAvatar);
  const detailName = document.createElement('h3');
  detailName.setAttribute('data-part', 'delegate-name');
  detailHeaderEl.appendChild(detailName);
  const detailCloseBtn = document.createElement('button');
  detailCloseBtn.type = 'button';
  detailCloseBtn.setAttribute('aria-label', 'Close detail panel');
  detailCloseBtn.textContent = 'Close';
  detailCloseBtn.addEventListener('click', () => send('DESELECT'));
  detailHeaderEl.appendChild(detailCloseBtn);
  detailPanelEl.appendChild(detailHeaderEl);

  const detailStatsEl = document.createElement('dl');
  detailStatsEl.setAttribute('data-part', 'detail-stats');
  detailPanelEl.appendChild(detailStatsEl);

  const chainUpstreamEl = document.createElement('div');
  chainUpstreamEl.setAttribute('data-part', 'chain-upstream');
  chainUpstreamEl.setAttribute('aria-label', 'Upstream delegators');
  detailPanelEl.appendChild(chainUpstreamEl);

  const chainDownstreamEl = document.createElement('div');
  chainDownstreamEl.setAttribute('data-part', 'chain-downstream');
  chainDownstreamEl.setAttribute('aria-label', 'Downstream delegatees');
  detailPanelEl.appendChild(chainDownstreamEl);
  root.appendChild(detailPanelEl);

  /* Confirmation dialog */
  const confirmationEl = document.createElement('div');
  confirmationEl.setAttribute('data-part', 'confirmation');
  confirmationEl.setAttribute('role', 'alertdialog');
  confirmationEl.style.display = 'none';
  root.appendChild(confirmationEl);

  /* Keyboard handler */
  root.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault();
        break;
      case 'Enter':
        e.preventDefault();
        send('SELECT_DELEGATE');
        break;
      case 'Escape':
        e.preventDefault();
        send('DESELECT');
        break;
      case 'f':
        if (e.ctrlKey) {
          e.preventDefault();
          searchInput.focus();
        }
        break;
    }
  });

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    searchInput.setAttribute('data-state', s);
    delegateItemEl.setAttribute('data-state', s);
    const isSelected = s === 'selected';
    detailPanelEl.style.display = isSelected ? 'block' : 'none';
    delegateItemEl.setAttribute('data-selected', isSelected ? 'true' : 'false');
    const isDelegating = s === 'delegating' || s === 'undelegating';
    confirmationEl.style.display = isDelegating ? 'block' : 'none';
    confirmationEl.setAttribute('aria-label', s === 'delegating' ? 'Confirm delegation' : 'Confirm undelegation');
    if (isDelegating) {
      setTimeout(() => send(s === 'delegating' ? 'DELEGATE_COMPLETE' : 'UNDELEGATE_COMPLETE'), 0);
    }
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default DelegationGraph;
