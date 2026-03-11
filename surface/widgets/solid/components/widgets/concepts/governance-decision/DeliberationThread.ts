import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type DeliberationThreadState = 'viewing' | 'composing' | 'entrySelected';
export type DeliberationThreadEvent =
  | { type: 'REPLY_TO' }
  | { type: 'SELECT_ENTRY' }
  | { type: 'SEND' }
  | { type: 'CANCEL' }
  | { type: 'DESELECT' };

export function deliberationThreadReducer(state: DeliberationThreadState, event: DeliberationThreadEvent): DeliberationThreadState {
  switch (state) {
    case 'viewing':
      if (event.type === 'REPLY_TO') return 'composing';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      return state;
    case 'composing':
      if (event.type === 'SEND') return 'viewing';
      if (event.type === 'CANCEL') return 'viewing';
      return state;
    case 'entrySelected':
      if (event.type === 'DESELECT') return 'viewing';
      return state;
    default:
      return state;
  }
}

export interface DeliberationThreadProps { [key: string]: unknown; class?: string; }
export interface DeliberationThreadResult { element: HTMLElement; dispose: () => void; }

export function DeliberationThread(props: DeliberationThreadProps): DeliberationThreadResult {
  const sig = surfaceCreateSignal<DeliberationThreadState>('viewing');
  const state = () => sig.get();
  const send = (type: string) => sig.set(deliberationThreadReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'deliberation-thread');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'feed');
  root.setAttribute('aria-label', 'Deliberation thread');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Header */
  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  headerEl.setAttribute('data-state', state());

  const headerStatusEl = document.createElement('span');
  headerStatusEl.setAttribute('data-part', 'header-status');
  headerStatusEl.style.fontWeight = '600';
  headerStatusEl.style.textTransform = 'capitalize';
  headerEl.appendChild(headerStatusEl);

  const headerSummaryEl = document.createElement('p');
  headerSummaryEl.setAttribute('data-part', 'header-summary');
  headerSummaryEl.style.marginTop = '4px';
  headerEl.appendChild(headerSummaryEl);

  /* Sort controls */
  const sortControlsEl = document.createElement('div');
  sortControlsEl.setAttribute('data-part', 'sort-controls');
  sortControlsEl.setAttribute('role', 'group');
  sortControlsEl.setAttribute('aria-label', 'Sort entries');

  const sortModes = ['time', 'tag', 'relevance'];
  sortModes.forEach((mode) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-part', 'sort-button');
    btn.setAttribute('data-sort', mode);
    btn.setAttribute('data-active', 'false');
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('tabindex', '-1');
    btn.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    sortControlsEl.appendChild(btn);
  });
  headerEl.appendChild(sortControlsEl);
  root.appendChild(headerEl);

  /* Sentiment bar */
  const sentimentEl = document.createElement('div');
  sentimentEl.setAttribute('data-part', 'sentiment');
  sentimentEl.setAttribute('data-visible', 'true');
  sentimentEl.setAttribute('role', 'img');
  sentimentEl.setAttribute('aria-label', 'Sentiment');
  sentimentEl.style.display = 'flex';
  sentimentEl.style.height = '8px';
  sentimentEl.style.borderRadius = '4px';
  sentimentEl.style.overflow = 'hidden';
  sentimentEl.style.marginBottom = '8px';

  const sentimentForEl = document.createElement('div');
  sentimentForEl.setAttribute('data-part', 'sentiment-for');
  sentimentForEl.style.width = '50%';
  sentimentForEl.style.backgroundColor = '#22c55e';
  sentimentForEl.style.transition = 'width 0.3s ease';
  sentimentForEl.setAttribute('aria-hidden', 'true');
  sentimentEl.appendChild(sentimentForEl);

  const sentimentAgainstEl = document.createElement('div');
  sentimentAgainstEl.setAttribute('data-part', 'sentiment-against');
  sentimentAgainstEl.style.width = '50%';
  sentimentAgainstEl.style.backgroundColor = '#ef4444';
  sentimentAgainstEl.style.transition = 'width 0.3s ease';
  sentimentAgainstEl.setAttribute('aria-hidden', 'true');
  sentimentEl.appendChild(sentimentAgainstEl);
  root.appendChild(sentimentEl);

  /* Entry list */
  const entryListEl = document.createElement('div');
  entryListEl.setAttribute('data-part', 'entry-list');
  entryListEl.setAttribute('role', 'feed');
  entryListEl.setAttribute('aria-label', 'Contributions');

  const emptyStateEl = document.createElement('p');
  emptyStateEl.setAttribute('data-part', 'empty-state');
  emptyStateEl.style.color = '#9ca3af';
  emptyStateEl.style.fontStyle = 'italic';
  emptyStateEl.textContent = 'No contributions yet.';
  entryListEl.appendChild(emptyStateEl);

  /* Sample entry template */
  const entryEl = document.createElement('div');
  entryEl.setAttribute('data-part', 'entry');
  entryEl.setAttribute('role', 'article');
  entryEl.setAttribute('tabindex', '-1');

  const entryAvatarEl = document.createElement('div');
  entryAvatarEl.setAttribute('data-part', 'entry-avatar');
  entryAvatarEl.setAttribute('aria-hidden', 'true');
  entryEl.appendChild(entryAvatarEl);

  const entryAuthorEl = document.createElement('span');
  entryAuthorEl.setAttribute('data-part', 'entry-author');
  entryEl.appendChild(entryAuthorEl);

  const entryTagEl = document.createElement('span');
  entryTagEl.setAttribute('data-part', 'entry-tag');
  entryTagEl.setAttribute('data-visible', 'true');
  entryEl.appendChild(entryTagEl);

  const entryContentEl = document.createElement('div');
  entryContentEl.setAttribute('data-part', 'entry-content');
  entryEl.appendChild(entryContentEl);

  const entryTimestampEl = document.createElement('span');
  entryTimestampEl.setAttribute('data-part', 'entry-timestamp');
  entryTimestampEl.style.fontSize = '12px';
  entryTimestampEl.style.color = '#6b7280';
  entryEl.appendChild(entryTimestampEl);

  const replyBtnEl = document.createElement('button');
  replyBtnEl.type = 'button';
  replyBtnEl.setAttribute('data-part', 'reply');
  replyBtnEl.setAttribute('tabindex', '-1');
  replyBtnEl.textContent = 'Reply';
  replyBtnEl.addEventListener('click', (e) => {
    e.stopPropagation();
    send('REPLY_TO');
  });
  entryEl.appendChild(replyBtnEl);

  const collapseToggleEl = document.createElement('button');
  collapseToggleEl.type = 'button';
  collapseToggleEl.setAttribute('data-part', 'collapse-toggle');
  collapseToggleEl.setAttribute('tabindex', '-1');
  collapseToggleEl.textContent = 'Hide replies';
  entryEl.appendChild(collapseToggleEl);

  entryEl.addEventListener('click', () => {
    if (state() === 'entrySelected') {
      send('DESELECT');
    } else {
      send('SELECT_ENTRY');
    }
  });

  entryListEl.appendChild(entryEl);

  /* Replies container */
  const repliesEl = document.createElement('div');
  repliesEl.setAttribute('data-part', 'replies');
  repliesEl.setAttribute('role', 'group');
  entryListEl.appendChild(repliesEl);

  root.appendChild(entryListEl);

  /* Compose box */
  const composeEl = document.createElement('div');
  composeEl.setAttribute('data-part', 'compose');
  composeEl.setAttribute('data-visible', 'false');
  composeEl.setAttribute('role', 'group');
  composeEl.setAttribute('aria-label', 'Reply compose box');
  composeEl.style.marginLeft = '24px';
  composeEl.style.marginTop = '8px';

  const composeInputEl = document.createElement('textarea');
  composeInputEl.setAttribute('data-part', 'compose-input');
  composeInputEl.setAttribute('aria-label', 'Add contribution');
  composeInputEl.setAttribute('role', 'textbox');
  composeInputEl.placeholder = 'Add your contribution...';
  composeInputEl.rows = 3;
  composeInputEl.style.width = '100%';
  composeInputEl.style.resize = 'vertical';
  composeInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      send('SEND');
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      send('CANCEL');
    }
  });
  composeEl.appendChild(composeInputEl);

  const composeActionsEl = document.createElement('div');
  composeActionsEl.setAttribute('data-part', 'compose-actions');
  composeActionsEl.style.marginTop = '4px';
  composeActionsEl.style.display = 'flex';
  composeActionsEl.style.gap = '8px';

  const composeSendBtn = document.createElement('button');
  composeSendBtn.type = 'button';
  composeSendBtn.setAttribute('data-part', 'compose-send');
  composeSendBtn.setAttribute('aria-label', 'Send reply');
  composeSendBtn.textContent = 'Send';
  composeSendBtn.addEventListener('click', () => send('SEND'));
  composeActionsEl.appendChild(composeSendBtn);

  const composeCancelBtn = document.createElement('button');
  composeCancelBtn.type = 'button';
  composeCancelBtn.setAttribute('data-part', 'compose-cancel');
  composeCancelBtn.setAttribute('aria-label', 'Cancel reply');
  composeCancelBtn.textContent = 'Cancel';
  composeCancelBtn.addEventListener('click', () => send('CANCEL'));
  composeActionsEl.appendChild(composeCancelBtn);

  composeEl.appendChild(composeActionsEl);
  root.appendChild(composeEl);

  /* Keyboard handler */
  root.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
      if (e.key === 'Escape') { e.preventDefault(); send('CANCEL'); }
      return;
    }
    switch (e.key) {
      case 'r':
      case 'Enter':
        e.preventDefault();
        send('REPLY_TO');
        break;
      case 'Escape':
        e.preventDefault();
        if (state() === 'composing') send('CANCEL');
        else if (state() === 'entrySelected') send('DESELECT');
        break;
    }
  });

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    headerEl.setAttribute('data-state', s);
    composeEl.setAttribute('data-visible', s === 'composing' ? 'true' : 'false');
    composeEl.style.display = s === 'composing' ? 'block' : 'none';
    if (s === 'composing') {
      requestAnimationFrame(() => composeInputEl.focus());
    }
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default DeliberationThread;
