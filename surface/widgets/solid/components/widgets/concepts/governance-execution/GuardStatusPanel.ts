import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type GuardStatusPanelState = 'idle' | 'guardSelected';
export type GuardStatusPanelEvent =
  | { type: 'SELECT_GUARD' }
  | { type: 'GUARD_TRIP' }
  | { type: 'DESELECT' };

export function guardStatusPanelReducer(state: GuardStatusPanelState, event: GuardStatusPanelEvent): GuardStatusPanelState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_GUARD') return 'guardSelected';
      if (event.type === 'GUARD_TRIP') return 'idle';
      return state;
    case 'guardSelected':
      if (event.type === 'DESELECT') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface GuardStatusPanelProps { [key: string]: unknown; class?: string; }
export interface GuardStatusPanelResult { element: HTMLElement; dispose: () => void; }

export function GuardStatusPanel(props: GuardStatusPanelProps): GuardStatusPanelResult {
  const sig = surfaceCreateSignal<GuardStatusPanelState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(guardStatusPanelReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'guard-status-panel');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Pre-execution guards');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '-1');
  if (props.class) root.className = props.class as string;

  /* Header */
  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  headerEl.setAttribute('data-state', state());

  const headingEl = document.createElement('h3');
  headingEl.setAttribute('data-part', 'heading');
  headingEl.textContent = 'Pre-execution Guards';
  headerEl.appendChild(headingEl);

  const summaryEl = document.createElement('span');
  summaryEl.setAttribute('data-part', 'summary');
  summaryEl.setAttribute('aria-live', 'polite');
  summaryEl.textContent = '0 of 0 guards passing';
  headerEl.appendChild(summaryEl);
  root.appendChild(headerEl);

  /* Blocking banner */
  const blockingBannerEl = document.createElement('div');
  blockingBannerEl.setAttribute('data-part', 'blocking-banner');
  blockingBannerEl.setAttribute('data-visible', 'true');
  blockingBannerEl.setAttribute('role', 'alert');
  blockingBannerEl.textContent = 'Execution is blocked by failing guards';
  root.appendChild(blockingBannerEl);

  /* Guard list */
  const guardListEl = document.createElement('div');
  guardListEl.setAttribute('data-part', 'guard-list');
  guardListEl.setAttribute('role', 'list');

  /* Guard item template */
  const guardItemEl = document.createElement('div');
  guardItemEl.setAttribute('data-part', 'guard-item');
  guardItemEl.setAttribute('data-status', 'pending');
  guardItemEl.setAttribute('data-selected', 'false');
  guardItemEl.setAttribute('role', 'listitem');
  guardItemEl.setAttribute('tabindex', '0');
  guardItemEl.addEventListener('click', () => {
    if (state() === 'guardSelected') {
      send('DESELECT');
    } else {
      send('SELECT_GUARD');
    }
  });
  guardItemEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (state() === 'guardSelected') {
        send('DESELECT');
      } else {
        send('SELECT_GUARD');
      }
    }
  });

  const guardIconEl = document.createElement('span');
  guardIconEl.setAttribute('data-part', 'guard-icon');
  guardIconEl.setAttribute('aria-hidden', 'true');
  guardItemEl.appendChild(guardIconEl);

  const guardNameEl = document.createElement('span');
  guardNameEl.setAttribute('data-part', 'guard-name');
  guardItemEl.appendChild(guardNameEl);

  const guardConditionEl = document.createElement('span');
  guardConditionEl.setAttribute('data-part', 'guard-condition');
  guardConditionEl.setAttribute('data-visible', 'true');
  guardItemEl.appendChild(guardConditionEl);

  const guardStatusEl = document.createElement('span');
  guardStatusEl.setAttribute('data-part', 'guard-status');
  guardItemEl.appendChild(guardStatusEl);

  /* Guard detail (expanded) */
  const guardDetailEl = document.createElement('div');
  guardDetailEl.setAttribute('data-part', 'guard-detail');
  guardDetailEl.style.display = 'none';

  const guardDetailDescEl = document.createElement('p');
  guardDetailDescEl.setAttribute('data-part', 'guard-detail-description');
  guardDetailEl.appendChild(guardDetailDescEl);

  const guardLastCheckedEl = document.createElement('span');
  guardLastCheckedEl.setAttribute('data-part', 'guard-last-checked');
  guardDetailEl.appendChild(guardLastCheckedEl);

  guardItemEl.appendChild(guardDetailEl);
  guardListEl.appendChild(guardItemEl);
  root.appendChild(guardListEl);

  /* Keyboard handler on root */
  root.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault();
        break;
      case 'Enter':
        e.preventDefault();
        if (state() === 'guardSelected') send('DESELECT');
        else send('SELECT_GUARD');
        break;
      case 'Escape':
        e.preventDefault();
        if (state() === 'guardSelected') send('DESELECT');
        break;
    }
  });

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    headerEl.setAttribute('data-state', s);
    const isSelected = s === 'guardSelected';
    guardItemEl.setAttribute('data-selected', isSelected ? 'true' : 'false');
    guardItemEl.setAttribute('aria-expanded', String(isSelected));
    guardDetailEl.style.display = isSelected ? 'block' : 'none';
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default GuardStatusPanel;
