/* ---------------------------------------------------------------------------
 * ChatMessage — Vanilla implementation
 *
 * Displays a single message in a conversation with role avatar, content body,
 * timestamp, and action buttons (copy, regenerate, edit). Supports streaming
 * state with animated cursor.
 * ------------------------------------------------------------------------- */

export type ChatMessageState = 'idle' | 'hovered' | 'copied';
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
      if (event.type === 'COPY') return 'copied';
      return state;
    case 'hovered':
      if (event.type === 'LEAVE') return 'idle';
      if (event.type === 'COPY') return 'copied';
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
  system: '\u2699',
  tool: '\u{1F527}',
};

const ROLE_LABELS: Record<string, string> = {
  user: 'User',
  assistant: 'Assistant',
  system: 'System',
  tool: 'Tool',
};

export interface ChatMessageProps {
  [key: string]: unknown;
  className?: string;
  role?: string;
  content?: string;
  timestamp?: string;
  variant?: 'default' | 'compact' | 'bubble';
  streaming?: boolean;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onEdit?: () => void;
}
export interface ChatMessageOptions { target: HTMLElement; props: ChatMessageProps; }

let _chatMessageUid = 0;

export class ChatMessage {
  private el: HTMLElement;
  private props: ChatMessageProps;
  private state: ChatMessageState = 'idle';
  private disposers: Array<() => void> = [];
  private copyTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(options: ChatMessageOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'chat-message');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'article');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'chat-message-' + (++_chatMessageUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  send(type: string): void {
    this.state = chatMessageReducer(this.state, { type } as any);
    this.el.setAttribute('data-state', this.state);
  }

  update(props: Partial<ChatMessageProps>): void {
    Object.assign(this.props, props);
    this.cleanup();
    this.el.innerHTML = '';
    this.render();
  }

  destroy(): void {
    this.cleanup();
    if (this.copyTimeout) clearTimeout(this.copyTimeout);
    this.el.remove();
  }

  private cleanup(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
  }

  private render(): void {
    const { role = 'user', content = '', timestamp = '', variant = 'default', streaming = false } = this.props;
    this.el.setAttribute('data-state', this.state);
    this.el.setAttribute('data-role', role);
    this.el.setAttribute('data-variant', variant);
    this.el.setAttribute('aria-label', `${ROLE_LABELS[role] ?? role} message`);
    if (this.props.className) this.el.className = this.props.className;

    // Hover events
    const onEnter = () => this.send('HOVER');
    const onLeave = () => this.send('LEAVE');
    this.el.addEventListener('mouseenter', onEnter);
    this.el.addEventListener('mouseleave', onLeave);
    this.disposers.push(() => {
      this.el.removeEventListener('mouseenter', onEnter);
      this.el.removeEventListener('mouseleave', onLeave);
    });

    // Avatar
    const avatar = document.createElement('div');
    avatar.setAttribute('data-part', 'avatar');
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = ROLE_AVATARS[role] ?? role.charAt(0).toUpperCase();
    this.el.appendChild(avatar);

    // Role label
    const roleLabel = document.createElement('span');
    roleLabel.setAttribute('data-part', 'role-label');
    roleLabel.textContent = ROLE_LABELS[role] ?? role;
    this.el.appendChild(roleLabel);

    // Body
    const body = document.createElement('div');
    body.setAttribute('data-part', 'body');
    body.textContent = content;
    if (streaming) {
      body.setAttribute('aria-busy', 'true');
      const cursor = document.createElement('span');
      cursor.setAttribute('data-part', 'cursor');
      cursor.setAttribute('aria-hidden', 'true');
      cursor.textContent = '\u2588';
      body.appendChild(cursor);
    }
    this.el.appendChild(body);

    // Timestamp
    if (timestamp) {
      const ts = document.createElement('span');
      ts.setAttribute('data-part', 'timestamp');
      ts.textContent = timestamp;
      this.el.appendChild(ts);
    }

    // Actions bar
    const actions = document.createElement('div');
    actions.setAttribute('data-part', 'actions');
    actions.setAttribute('data-visible', this.state === 'hovered' ? 'true' : 'false');

    // Copy button
    const copyButton = document.createElement('button');
    copyButton.setAttribute('data-part', 'copy-button');
    copyButton.setAttribute('type', 'button');
    copyButton.setAttribute('aria-label', 'Copy message');
    copyButton.textContent = this.state === 'copied' ? 'Copied!' : 'Copy';
    const onCopy = () => {
      if (navigator.clipboard && content) {
        navigator.clipboard.writeText(content).catch(() => {});
      }
      this.send('COPY');
      copyButton.textContent = 'Copied!';
      this.props.onCopy?.();
      this.copyTimeout = setTimeout(() => {
        this.send('COPY_TIMEOUT');
        copyButton.textContent = 'Copy';
      }, 2000);
    };
    copyButton.addEventListener('click', onCopy);
    this.disposers.push(() => copyButton.removeEventListener('click', onCopy));
    actions.appendChild(copyButton);

    // Regenerate button (assistant only)
    if (role === 'assistant' && this.props.onRegenerate) {
      const regenButton = document.createElement('button');
      regenButton.setAttribute('data-part', 'regenerate-button');
      regenButton.setAttribute('type', 'button');
      regenButton.setAttribute('aria-label', 'Regenerate response');
      regenButton.textContent = 'Regenerate';
      const onRegen = () => (this.props.onRegenerate as () => void)?.();
      regenButton.addEventListener('click', onRegen);
      this.disposers.push(() => regenButton.removeEventListener('click', onRegen));
      actions.appendChild(regenButton);
    }

    // Edit button (user only)
    if (role === 'user' && this.props.onEdit) {
      const editButton = document.createElement('button');
      editButton.setAttribute('data-part', 'edit-button');
      editButton.setAttribute('type', 'button');
      editButton.setAttribute('aria-label', 'Edit message');
      editButton.textContent = 'Edit';
      const onEditClick = () => (this.props.onEdit as () => void)?.();
      editButton.addEventListener('click', onEditClick);
      this.disposers.push(() => editButton.removeEventListener('click', onEditClick));
      actions.appendChild(editButton);
    }

    this.el.appendChild(actions);
  }
}

export default ChatMessage;
