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

/* --- Helpers --- */

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '\u2026';
}

function formatTimeRemaining(timestamp: string): string {
  const target = new Date(timestamp).getTime();
  const now = Date.now();
  const diffMs = target - now;
  const absDiff = Math.abs(diffMs);
  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const isPast = diffMs < 0;
  const suffix = isPast ? ' ago' : ' remaining';
  if (days > 0) return `${days}d${suffix}`;
  if (hours > 0) return `${hours}h${suffix}`;
  if (minutes > 0) return `${minutes}m${suffix}`;
  return `${seconds}s${suffix}`;
}

function actionLabelForStatus(status: string): string {
  switch (status) {
    case 'Active': return 'Vote';
    case 'Passed':
    case 'Approved': return 'Execute';
    case 'Draft': return 'Edit';
    default: return 'View';
  }
}

export interface ProposalCardProps { [key: string]: unknown; class?: string; }
export interface ProposalCardResult { element: HTMLElement; dispose: () => void; }

export function ProposalCard(props: ProposalCardProps): ProposalCardResult {
  const sig = surfaceCreateSignal<ProposalCardState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(proposalCardReducer(sig.get(), { type } as any));

  const title = String(props.title ?? '');
  const description = String(props.description ?? '');
  const author = String(props.author ?? '');
  const status = String(props.status ?? 'Draft');
  const timestamp = String(props.timestamp ?? new Date().toISOString());
  const variant = String(props.variant ?? 'full') as 'full' | 'compact' | 'minimal';
  const showVoteBar = props.showVoteBar !== false;
  const showQuorum = props.showQuorum === true;
  const truncateDescription = typeof props.truncateDescription === 'number' ? props.truncateDescription : 120;
  const onClick = props.onClick as (() => void) | undefined;
  const onNavigate = props.onNavigate as (() => void) | undefined;

  const truncatedDescription = truncate(description, truncateDescription);
  const relativeTime = formatTimeRemaining(timestamp);
  const actionLabel = actionLabelForStatus(status);

  const showDesc = variant !== 'minimal';
  const showProposer = variant !== 'minimal';
  const showVoteBarSlot = showVoteBar && status === 'Active' && variant !== 'minimal';
  const showQuorumSlot = showQuorum && variant === 'full';
  const showAction = variant !== 'minimal';

  let navTimer: ReturnType<typeof setTimeout> | null = null;

  const root = document.createElement('article');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'proposal-card');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'article');
  root.setAttribute('aria-label', `${status} proposal: ${title}`);
  root.setAttribute('data-state', state());
  root.setAttribute('data-variant', variant);
  root.setAttribute('data-status', status);
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Status badge */
  const statusBadgeEl = document.createElement('div');
  statusBadgeEl.setAttribute('data-part', 'status-badge');
  statusBadgeEl.setAttribute('data-status', status);
  statusBadgeEl.setAttribute('role', 'status');
  statusBadgeEl.setAttribute('aria-label', `Status: ${status}`);
  statusBadgeEl.textContent = status;
  root.appendChild(statusBadgeEl);

  /* Title */
  const titleEl = document.createElement('h3');
  titleEl.setAttribute('data-part', 'title');
  titleEl.setAttribute('role', 'heading');
  titleEl.setAttribute('aria-level', '3');
  titleEl.textContent = title;
  root.appendChild(titleEl);

  /* Description */
  if (showDesc) {
    const descEl = document.createElement('p');
    descEl.setAttribute('data-part', 'description');
    descEl.setAttribute('data-visible', 'true');
    descEl.textContent = truncatedDescription;
    root.appendChild(descEl);
  }

  /* Proposer */
  if (showProposer) {
    const proposerEl = document.createElement('div');
    proposerEl.setAttribute('data-part', 'proposer');
    proposerEl.setAttribute('data-author', author);
    proposerEl.setAttribute('aria-label', `Proposed by ${author}`);
    const avatarSlot = document.createElement('span');
    avatarSlot.setAttribute('data-part', 'avatar');
    avatarSlot.setAttribute('aria-hidden', 'true');
    proposerEl.appendChild(avatarSlot);
    const authorSpan = document.createElement('span');
    authorSpan.textContent = author;
    proposerEl.appendChild(authorSpan);
    root.appendChild(proposerEl);
  }

  /* Vote bar slot */
  if (showVoteBarSlot) {
    const voteBarEl = document.createElement('div');
    voteBarEl.setAttribute('data-part', 'vote-bar');
    voteBarEl.setAttribute('data-visible', 'true');
    root.appendChild(voteBarEl);
  }

  /* Quorum gauge slot */
  if (showQuorumSlot) {
    const quorumEl = document.createElement('div');
    quorumEl.setAttribute('data-part', 'quorum-gauge');
    quorumEl.setAttribute('data-visible', 'true');
    root.appendChild(quorumEl);
  }

  /* Time remaining */
  const timeEl = document.createElement('span');
  timeEl.setAttribute('data-part', 'time-remaining');
  timeEl.setAttribute('data-timestamp', timestamp);
  timeEl.setAttribute('role', 'timer');
  timeEl.setAttribute('aria-live', 'off');
  timeEl.textContent = relativeTime;
  root.appendChild(timeEl);

  /* Action button */
  if (showAction) {
    const actionEl = document.createElement('button');
    actionEl.type = 'button';
    actionEl.setAttribute('data-part', 'action');
    actionEl.setAttribute('role', 'button');
    actionEl.setAttribute('aria-label', `View proposal: ${title}`);
    actionEl.setAttribute('tabindex', '0');
    actionEl.textContent = actionLabel;
    actionEl.addEventListener('click', (e) => {
      e.stopPropagation();
      send('CLICK');
    });
    root.appendChild(actionEl);
  }

  /* Events */
  root.addEventListener('click', () => send('CLICK'));
  root.addEventListener('mouseenter', () => send('HOVER'));
  root.addEventListener('mouseleave', () => send('UNHOVER'));
  root.addEventListener('focus', () => send('FOCUS'));
  root.addEventListener('blur', () => send('BLUR'));
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      send(sig.get() === 'focused' ? 'ENTER' : 'CLICK');
    }
  });

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    if (s === 'navigating') {
      onClick?.();
      onNavigate?.();
      navTimer = setTimeout(() => send('NAVIGATE_COMPLETE'), 0);
    }
  });

  return {
    element: root,
    dispose() {
      unsub();
      if (navTimer) clearTimeout(navTimer);
      root.remove();
    },
  };
}

export default ProposalCard;
