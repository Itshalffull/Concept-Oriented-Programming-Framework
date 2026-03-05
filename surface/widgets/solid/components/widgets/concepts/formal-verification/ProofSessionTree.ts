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

export interface ProofSessionTreeProps { [key: string]: unknown; class?: string; }
export interface ProofSessionTreeResult { element: HTMLElement; dispose: () => void; }

export function ProofSessionTree(props: ProofSessionTreeProps): ProofSessionTreeResult {
  const sig = surfaceCreateSignal<ProofSessionTreeState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(proofSessionTreeReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'proof-session-tree');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'tree');
  root.setAttribute('aria-label', 'Proof session tree');
  root.setAttribute('data-state', state());
  if (props.class) root.className = props.class as string;

  /* Summary */
  const summaryEl = document.createElement('div');
  summaryEl.setAttribute('data-part', 'summary');
  summaryEl.setAttribute('aria-live', 'polite');
  summaryEl.textContent = '0 of 0 goals proved';
  root.appendChild(summaryEl);

  /* Tree item template */
  const treeItemEl = document.createElement('div');
  treeItemEl.setAttribute('data-part', 'tree-item');
  treeItemEl.setAttribute('data-status', 'open');
  treeItemEl.setAttribute('data-selected', 'false');
  treeItemEl.setAttribute('role', 'treeitem');
  treeItemEl.setAttribute('tabindex', '0');
  treeItemEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state() === 'selected') send('DESELECT');
    else send('SELECT');
  });

  /* Expand trigger */
  const expandTriggerEl = document.createElement('button');
  expandTriggerEl.type = 'button';
  expandTriggerEl.setAttribute('data-part', 'expand-trigger');
  expandTriggerEl.setAttribute('data-expanded', 'false');
  expandTriggerEl.setAttribute('data-visible', 'true');
  expandTriggerEl.setAttribute('aria-label', 'Expand');
  expandTriggerEl.setAttribute('tabindex', '-1');
  expandTriggerEl.textContent = '\u25B6';
  expandTriggerEl.addEventListener('click', (e) => {
    e.stopPropagation();
    const expanded = expandTriggerEl.getAttribute('data-expanded') === 'true';
    if (expanded) {
      send('COLLAPSE');
      expandTriggerEl.setAttribute('data-expanded', 'false');
      expandTriggerEl.textContent = '\u25B6';
      expandTriggerEl.setAttribute('aria-label', 'Expand');
      childrenEl.style.display = 'none';
      childrenEl.setAttribute('data-visible', 'false');
    } else {
      send('EXPAND');
      expandTriggerEl.setAttribute('data-expanded', 'true');
      expandTriggerEl.textContent = '\u25BC';
      expandTriggerEl.setAttribute('aria-label', 'Collapse');
      childrenEl.style.display = 'block';
      childrenEl.setAttribute('data-visible', 'true');
    }
  });
  treeItemEl.appendChild(expandTriggerEl);

  /* Status badge */
  const statusBadgeEl = document.createElement('span');
  statusBadgeEl.setAttribute('data-part', 'status-badge');
  statusBadgeEl.setAttribute('aria-hidden', 'true');
  statusBadgeEl.textContent = '\u25CB';
  treeItemEl.appendChild(statusBadgeEl);

  /* Item label */
  const itemLabelEl = document.createElement('span');
  itemLabelEl.setAttribute('data-part', 'item-label');
  treeItemEl.appendChild(itemLabelEl);

  /* Progress bar */
  const progressBarEl = document.createElement('span');
  progressBarEl.setAttribute('data-part', 'progress-bar');
  progressBarEl.setAttribute('data-visible', 'true');
  progressBarEl.setAttribute('role', 'progressbar');
  progressBarEl.setAttribute('aria-valuemin', '0');
  progressBarEl.setAttribute('aria-valuemax', '1');
  treeItemEl.appendChild(progressBarEl);

  /* Children */
  const childrenEl = document.createElement('div');
  childrenEl.setAttribute('data-part', 'children');
  childrenEl.setAttribute('role', 'group');
  childrenEl.setAttribute('data-visible', 'true');
  treeItemEl.appendChild(childrenEl);

  root.appendChild(treeItemEl);

  /* Detail panel */
  const detailPanelEl = document.createElement('div');
  detailPanelEl.setAttribute('data-part', 'detail-panel');
  detailPanelEl.setAttribute('role', 'complementary');
  detailPanelEl.setAttribute('aria-label', 'Goal details');
  detailPanelEl.setAttribute('data-visible', 'false');
  detailPanelEl.style.display = 'none';

  const detailHeaderEl = document.createElement('div');
  detailHeaderEl.setAttribute('data-part', 'detail-header');

  const detailStatusEl = document.createElement('span');
  detailStatusEl.setAttribute('data-part', 'detail-status');
  detailHeaderEl.appendChild(detailStatusEl);

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

  const goalField = document.createElement('div');
  goalField.setAttribute('data-part', 'detail-field');
  const goalLabel = document.createElement('span');
  goalLabel.setAttribute('data-part', 'detail-label');
  goalLabel.textContent = 'Goal';
  goalField.appendChild(goalLabel);
  const goalValue = document.createElement('span');
  goalValue.setAttribute('data-part', 'detail-value');
  goalField.appendChild(goalValue);
  detailBodyEl.appendChild(goalField);

  const statusField = document.createElement('div');
  statusField.setAttribute('data-part', 'detail-field');
  const statusLabel = document.createElement('span');
  statusLabel.setAttribute('data-part', 'detail-label');
  statusLabel.textContent = 'Status';
  statusField.appendChild(statusLabel);
  const statusValue = document.createElement('span');
  statusValue.setAttribute('data-part', 'detail-value');
  statusField.appendChild(statusValue);
  detailBodyEl.appendChild(statusField);

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
        if (state() === 'selected') send('DESELECT');
        else send('SELECT');
        break;
      case 'Home':
      case 'End':
        e.preventDefault();
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
    const isSelected = s === 'selected';
    treeItemEl.setAttribute('data-selected', isSelected ? 'true' : 'false');
    treeItemEl.setAttribute('aria-selected', String(isSelected));
    detailPanelEl.setAttribute('data-visible', isSelected ? 'true' : 'false');
    detailPanelEl.style.display = isSelected ? 'block' : 'none';
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default ProofSessionTree;
