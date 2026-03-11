import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type ChatMessageState = 'idle' | 'hovered' | 'streaming' | 'copied';
export type ChatMessageEvent =
  | { type: 'HOVER' }
  | { type: 'LEAVE' }
  | { type: 'STREAM_START' }
  | { type: 'STREAM_END' }
  | { type: 'COPY' }
  | { type: 'COPY_TIMEOUT' };

export function chatMessageReducer(state: ChatMessageState, event: ChatMessageEvent): ChatMessageState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'STREAM_START') return 'streaming';
      if (event.type === 'COPY') return 'copied';
      return state;
    case 'hovered':
      if (event.type === 'LEAVE') return 'idle';
      if (event.type === 'COPY') return 'copied';
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'streaming':
      if (event.type === 'STREAM_END') return 'idle';
      return state;
    case 'copied':
      if (event.type === 'COPY_TIMEOUT') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface ChatMessageProps { [key: string]: unknown; class?: string; }
export interface ChatMessageResult { element: HTMLElement; dispose: () => void; }

export function ChatMessage(props: ChatMessageProps): ChatMessageResult {
  const sig = surfaceCreateSignal<ChatMessageState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(chatMessageReducer(sig.get(), { type } as any));

  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  const root = document.createElement('article');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'chat-message');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'article');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  root.addEventListener('mouseenter', () => send('HOVER'));
  root.addEventListener('mouseleave', () => send('LEAVE'));
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'c') {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        e.preventDefault();
        handleCopy();
      }
    }
  });

  const avatarEl = document.createElement('div');
  avatarEl.setAttribute('data-part', 'avatar');
  avatarEl.setAttribute('aria-hidden', 'true');
  root.appendChild(avatarEl);

  const roleLabelEl = document.createElement('span');
  roleLabelEl.setAttribute('data-part', 'role-label');
  root.appendChild(roleLabelEl);

  const bodyEl = document.createElement('div');
  bodyEl.setAttribute('data-part', 'body');
  bodyEl.setAttribute('role', 'region');
  bodyEl.setAttribute('aria-label', 'Message content');
  root.appendChild(bodyEl);

  const timestampEl = document.createElement('span');
  timestampEl.setAttribute('data-part', 'timestamp');
  root.appendChild(timestampEl);

  const actionsEl = document.createElement('div');
  actionsEl.setAttribute('data-part', 'actions');
  actionsEl.setAttribute('role', 'toolbar');
  actionsEl.setAttribute('aria-label', 'Message actions');
  root.appendChild(actionsEl);

  const copyButtonEl = document.createElement('button');
  copyButtonEl.setAttribute('type', 'button');
  copyButtonEl.setAttribute('data-part', 'copy-button');
  copyButtonEl.setAttribute('aria-label', 'Copy message');
  copyButtonEl.setAttribute('aria-live', 'polite');
  copyButtonEl.setAttribute('tabindex', '0');
  copyButtonEl.textContent = 'Copy';
  copyButtonEl.addEventListener('click', handleCopy);
  actionsEl.appendChild(copyButtonEl);

  function handleCopy() {
    send('COPY');
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => send('COPY_TIMEOUT'), 2000);
  }

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    const actionsVisible = s === 'hovered';
    actionsEl.setAttribute('data-visible', actionsVisible ? 'true' : 'false');
    actionsEl.style.visibility = actionsVisible ? 'visible' : 'hidden';
    actionsEl.style.pointerEvents = actionsVisible ? 'auto' : 'none';
    copyButtonEl.setAttribute('data-state', s === 'copied' ? 'copied' : 'idle');
    copyButtonEl.setAttribute('aria-label', s === 'copied' ? 'Copied to clipboard' : 'Copy message');
    copyButtonEl.textContent = s === 'copied' ? 'Copied!' : 'Copy';
  });

  return {
    element: root,
    dispose() {
      unsub();
      if (copyTimer) clearTimeout(copyTimer);
      root.remove();
    },
  };
}

export default ChatMessage;
