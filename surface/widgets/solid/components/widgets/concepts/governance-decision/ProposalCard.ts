import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type ProposalCardState = 'idle' | 'hovered' | 'focused' | 'navigating';
export type ProposalCardEvent =
  | { type: 'HOVER' }
  | { type: 'FOCUS' }
  | { type: 'CLICK' }
  | { type: 'UNHOVER' }
  | { type: 'BLUR' }
  | { type: 'ENTER' }
  | { type: 'NAVIGATE_COMPLETE' };

export function proposalCardReducer(state: ProposalCardState, event: ProposalCardEvent): ProposalCardState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'FOCUS') return 'focused';
      if (event.type === 'CLICK') return 'navigating';
      return state;
    case 'hovered':
      if (event.type === 'UNHOVER') return 'idle';
      return state;
    case 'focused':
      if (event.type === 'BLUR') return 'idle';
      if (event.type === 'CLICK') return 'navigating';
      if (event.type === 'ENTER') return 'navigating';
      return state;
    case 'navigating':
      if (event.type === 'NAVIGATE_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface ProposalCardProps { [key: string]: unknown; class?: string; }
export interface ProposalCardResult { element: HTMLElement; dispose: () => void; }

export function ProposalCard(props: ProposalCardProps): ProposalCardResult {
  const sig = surfaceCreateSignal<ProposalCardState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(proposalCardReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('article');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'proposal-card');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'article');
  root.setAttribute('data-state', state());
  root.setAttribute('data-variant', 'full');
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Status badge */
  const statusBadgeEl = document.createElement('div');
  statusBadgeEl.setAttribute('data-part', 'status-badge');
  statusBadgeEl.setAttribute('role', 'status');
  root.appendChild(statusBadgeEl);

  /* Title */
  const titleEl = document.createElement('h3');
  titleEl.setAttribute('data-part', 'title');
  titleEl.setAttribute('role', 'heading');
  titleEl.setAttribute('aria-level', '3');
  root.appendChild(titleEl);

  /* Description */
  const descriptionEl = document.createElement('p');
  descriptionEl.setAttribute('data-part', 'description');
  descriptionEl.setAttribute('data-visible', 'true');
  root.appendChild(descriptionEl);

  /* Proposer */
  const proposerEl = document.createElement('div');
  proposerEl.setAttribute('data-part', 'proposer');
  const avatarEl = document.createElement('span');
  avatarEl.setAttribute('data-part', 'avatar');
  avatarEl.setAttribute('aria-hidden', 'true');
  proposerEl.appendChild(avatarEl);
  const proposerNameEl = document.createElement('span');
  proposerEl.appendChild(proposerNameEl);
  root.appendChild(proposerEl);

  /* Vote bar slot */
  const voteBarEl = document.createElement('div');
  voteBarEl.setAttribute('data-part', 'vote-bar');
  voteBarEl.setAttribute('data-visible', 'true');
  root.appendChild(voteBarEl);

  /* Quorum gauge slot */
  const quorumGaugeEl = document.createElement('div');
  quorumGaugeEl.setAttribute('data-part', 'quorum-gauge');
  quorumGaugeEl.setAttribute('data-visible', 'true');
  root.appendChild(quorumGaugeEl);

  /* Time remaining */
  const timeRemainingEl = document.createElement('span');
  timeRemainingEl.setAttribute('data-part', 'time-remaining');
  timeRemainingEl.setAttribute('role', 'timer');
  timeRemainingEl.setAttribute('aria-live', 'off');
  root.appendChild(timeRemainingEl);

  /* Action button */
  const actionEl = document.createElement('button');
  actionEl.type = 'button';
  actionEl.setAttribute('data-part', 'action');
  actionEl.setAttribute('role', 'button');
  actionEl.setAttribute('tabindex', '0');
  actionEl.textContent = 'View';
  actionEl.addEventListener('click', (e) => {
    e.stopPropagation();
    send('CLICK');
  });
  root.appendChild(actionEl);

  /* Event listeners */
  root.addEventListener('click', () => send('CLICK'));
  root.addEventListener('mouseenter', () => send('HOVER'));
  root.addEventListener('mouseleave', () => send('UNHOVER'));
  root.addEventListener('focus', () => send('FOCUS'));
  root.addEventListener('blur', () => send('BLUR'));
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      send(state() === 'focused' ? 'ENTER' : 'CLICK');
    }
  });

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    if (s === 'navigating') {
      setTimeout(() => send('NAVIGATE_COMPLETE'), 0);
    }
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default ProposalCard;
