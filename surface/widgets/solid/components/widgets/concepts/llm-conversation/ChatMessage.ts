import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type ChatMessageState = 'idle' | 'hovered' | 'streaming' | 'copied';
export type ChatMessageEvent =
  | { type: 'HOVER' }
  | { type: 'STREAM_START' }
  | { type: 'COPY' }
  | { type: 'LEAVE' }
  | { type: 'STREAM_END' }
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

const ROLE_AVATARS: Record<string, string> = {
  user: '\u{1F464}',
  assistant: '\u{1F916}',
  system: '\u2699\uFE0F',
  tool: '\u{1F527}',
};

const ROLE_LABELS: Record<string, string> = {
  user: 'User',
  assistant: 'Assistant',
  system: 'System',
  tool: 'Tool',
};

export interface ChatMessageProps { [key: string]: unknown; class?: string; }
export interface ChatMessageResult { element: HTMLElement; dispose: () => void; }

export function ChatMessage(props: ChatMessageProps): ChatMessageResult {
  const isStreaming = Boolean(props.isStreaming);
  const sig = surfaceCreateSignal<ChatMessageState>(isStreaming ? 'streaming' : 'idle');
  const send = (event: ChatMessageEvent) => { sig.set(chatMessageReducer(sig.get(), event)); };

  const messageRole = String(props.role ?? 'user');
  const content = String(props.content ?? '');
  const timestamp = String(props.timestamp ?? '');
  const variant = String(props.variant ?? 'default');
  const showAvatar = props.showAvatar !== false;
  const showTimestamp = props.showTimestamp !== false;
  const onCopy = props.onCopy as (() => void) | undefined;
  const onRegenerate = props.onRegenerate as (() => void) | undefined;
  const onEdit = props.onEdit as (() => void) | undefined;

  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  const root = document.createElement('article');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'chat-message');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('data-role', messageRole);
  root.setAttribute('data-variant', variant);
  root.setAttribute('data-streaming', isStreaming ? 'true' : 'false');
  root.setAttribute('role', 'article');
  root.setAttribute('aria-label', `${ROLE_LABELS[messageRole] ?? messageRole} message`);
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Avatar
  const avatarEl = document.createElement('div');
  avatarEl.setAttribute('data-part', 'avatar');
  avatarEl.setAttribute('data-role', messageRole);
  avatarEl.setAttribute('data-visible', showAvatar ? 'true' : 'false');
  avatarEl.setAttribute('aria-hidden', 'true');
  if (showAvatar) {
    avatarEl.textContent = ROLE_AVATARS[messageRole] ?? messageRole.charAt(0).toUpperCase();
  }
  root.appendChild(avatarEl);

  // Role label
  const roleLabelEl = document.createElement('span');
  roleLabelEl.setAttribute('data-part', 'role-label');
  roleLabelEl.textContent = ROLE_LABELS[messageRole] ?? messageRole;
  root.appendChild(roleLabelEl);

  // Body
  const bodyEl = document.createElement('div');
  bodyEl.setAttribute('data-part', 'body');
  bodyEl.setAttribute('data-role', messageRole);
  bodyEl.setAttribute('role', 'region');
  bodyEl.setAttribute('aria-label', 'Message content');
  bodyEl.textContent = content;
  root.appendChild(bodyEl);

  // Streaming cursor
  const cursorEl = document.createElement('span');
  cursorEl.setAttribute('data-part', 'streaming-cursor');
  cursorEl.setAttribute('aria-hidden', 'true');
  cursorEl.style.display = isStreaming ? 'inline-block' : 'none';
  cursorEl.style.width = '2px';
  cursorEl.style.height = '1em';
  cursorEl.style.backgroundColor = 'currentColor';
  cursorEl.style.marginLeft = '2px';
  cursorEl.style.verticalAlign = 'text-bottom';
  bodyEl.appendChild(cursorEl);

  // Timestamp
  const timestampEl = document.createElement('span');
  timestampEl.setAttribute('data-part', 'timestamp');
  timestampEl.setAttribute('data-visible', showTimestamp ? 'true' : 'false');
  timestampEl.textContent = showTimestamp ? timestamp : '';
  root.appendChild(timestampEl);

  // Actions toolbar
  const actionsEl = document.createElement('div');
  actionsEl.setAttribute('data-part', 'actions');
  actionsEl.setAttribute('role', 'toolbar');
  actionsEl.setAttribute('aria-label', 'Message actions');
  actionsEl.setAttribute('data-visible', 'false');
  actionsEl.style.visibility = 'hidden';
  actionsEl.style.position = 'absolute';
  actionsEl.style.pointerEvents = 'none';
  root.appendChild(actionsEl);

  // Copy button
  const copyButtonEl = document.createElement('button');
  copyButtonEl.setAttribute('type', 'button');
  copyButtonEl.setAttribute('data-part', 'copy-button');
  copyButtonEl.setAttribute('data-state', 'idle');
  copyButtonEl.setAttribute('aria-label', 'Copy message');
  copyButtonEl.setAttribute('aria-live', 'polite');
  copyButtonEl.setAttribute('tabindex', '0');
  copyButtonEl.textContent = 'Copy';
  copyButtonEl.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(content); } catch { /* noop */ }
    send({ type: 'COPY' });
    onCopy?.();
  });
  actionsEl.appendChild(copyButtonEl);

  // Regenerate button (assistant only)
  if (onRegenerate && messageRole === 'assistant') {
    const regenBtn = document.createElement('button');
    regenBtn.setAttribute('type', 'button');
    regenBtn.setAttribute('data-part', 'regenerate-button');
    regenBtn.setAttribute('aria-label', 'Regenerate message');
    regenBtn.setAttribute('tabindex', '0');
    regenBtn.textContent = 'Regenerate';
    regenBtn.addEventListener('click', () => onRegenerate());
    actionsEl.appendChild(regenBtn);
  }

  // Edit button (user only)
  if (onEdit && messageRole === 'user') {
    const editBtn = document.createElement('button');
    editBtn.setAttribute('type', 'button');
    editBtn.setAttribute('data-part', 'edit-button');
    editBtn.setAttribute('aria-label', 'Edit message');
    editBtn.setAttribute('tabindex', '0');
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => onEdit());
    actionsEl.appendChild(editBtn);
  }

  // Event listeners
  root.addEventListener('mouseenter', () => send({ type: 'HOVER' }));
  root.addEventListener('mouseleave', () => send({ type: 'LEAVE' }));
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'c') {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        e.preventDefault();
        navigator.clipboard.writeText(content).catch(() => {});
        send({ type: 'COPY' });
        onCopy?.();
      }
    }
  });

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    const actionsVisible = s === 'hovered' && !isStreaming;
    actionsEl.setAttribute('data-visible', actionsVisible ? 'true' : 'false');
    actionsEl.style.visibility = actionsVisible ? 'visible' : 'hidden';
    actionsEl.style.position = actionsVisible ? 'relative' : 'absolute';
    actionsEl.style.pointerEvents = actionsVisible ? 'auto' : 'none';

    copyButtonEl.setAttribute('data-state', s === 'copied' ? 'copied' : 'idle');
    copyButtonEl.setAttribute('aria-label', s === 'copied' ? 'Copied to clipboard' : 'Copy message');
    copyButtonEl.textContent = s === 'copied' ? 'Copied!' : 'Copy';

    if (s === 'copied') {
      copyTimer = setTimeout(() => send({ type: 'COPY_TIMEOUT' }), 2000);
    }

    cursorEl.style.display = s === 'streaming' ? 'inline-block' : 'none';
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
