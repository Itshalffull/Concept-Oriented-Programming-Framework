import { StackLayout, Label, Button, FlexboxLayout, ActivityIndicator } from '@nativescript/core';

/* ---------------------------------------------------------------------------
 * ChatMessage state machine
 * States: idle (initial), hovered, streaming, copied
 * ------------------------------------------------------------------------- */

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

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

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

export interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  variant?: 'default' | 'compact' | 'bubble';
  showAvatar?: boolean;
  showTimestamp?: boolean;
  isStreaming?: boolean;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onEdit?: () => void;
}

/* ---------------------------------------------------------------------------
 * Widget
 * ------------------------------------------------------------------------- */

export function createChatMessage(props: ChatMessageProps): { view: StackLayout; dispose: () => void } {
  const {
    role: messageRole,
    content,
    timestamp,
    showAvatar = true,
    showTimestamp = true,
    isStreaming = false,
    onCopy,
    onRegenerate,
    onEdit,
  } = props;

  let state: ChatMessageState = isStreaming ? 'streaming' : 'idle';
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  const disposers: (() => void)[] = [];

  function send(event: ChatMessageEvent) {
    state = chatMessageReducer(state, event);
    update();
  }

  const roleLabel = ROLE_LABELS[messageRole] ?? messageRole;

  const root = new StackLayout();
  root.className = 'chat-message';
  root.automationText = `${roleLabel} message`;

  // Avatar
  if (showAvatar) {
    const avatar = new Label();
    avatar.className = 'chat-message-avatar';
    avatar.text = ROLE_AVATARS[messageRole] ?? messageRole.charAt(0).toUpperCase();
    root.addChild(avatar);
  }

  // Role label
  const roleLabelView = new Label();
  roleLabelView.className = 'chat-message-role';
  roleLabelView.text = roleLabel;
  root.addChild(roleLabelView);

  // Body
  const body = new Label();
  body.className = 'chat-message-body';
  body.text = content;
  body.textWrap = true;
  root.addChild(body);

  // Streaming indicator
  const streamingIndicator = new ActivityIndicator();
  streamingIndicator.className = 'chat-message-streaming';
  streamingIndicator.busy = true;
  streamingIndicator.width = 16;
  streamingIndicator.height = 16;
  streamingIndicator.visibility = (isStreaming ? 'visible' : 'collapse') as any;
  root.addChild(streamingIndicator);

  // Timestamp
  const tsLabel = new Label();
  tsLabel.className = 'chat-message-timestamp';
  tsLabel.text = timestamp;
  tsLabel.visibility = (showTimestamp ? 'visible' : 'collapse') as any;
  root.addChild(tsLabel);

  // Actions toolbar
  const actions = new FlexboxLayout();
  actions.className = 'chat-message-actions';
  actions.flexDirection = 'row' as any;
  actions.visibility = 'collapse' as any;

  const copyBtn = new Button();
  copyBtn.className = 'chat-message-copy';
  copyBtn.text = 'Copy';
  copyBtn.automationText = 'Copy message';
  const copyHandler = () => {
    send({ type: 'COPY' });
    onCopy?.();
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => send({ type: 'COPY_TIMEOUT' }), 2000);
  };
  copyBtn.on('tap', copyHandler);
  disposers.push(() => copyBtn.off('tap', copyHandler));
  actions.addChild(copyBtn);

  if (onRegenerate && messageRole === 'assistant') {
    const regenBtn = new Button();
    regenBtn.className = 'chat-message-regenerate';
    regenBtn.text = 'Regenerate';
    regenBtn.automationText = 'Regenerate message';
    const regenHandler = () => { onRegenerate(); };
    regenBtn.on('tap', regenHandler);
    disposers.push(() => regenBtn.off('tap', regenHandler));
    actions.addChild(regenBtn);
  }

  if (onEdit && messageRole === 'user') {
    const editBtn = new Button();
    editBtn.className = 'chat-message-edit';
    editBtn.text = 'Edit';
    editBtn.automationText = 'Edit message';
    const editHandler = () => { onEdit(); };
    editBtn.on('tap', editHandler);
    disposers.push(() => editBtn.off('tap', editHandler));
    actions.addChild(editBtn);
  }

  root.addChild(actions);

  // Tap to show actions (simulates hover on mobile)
  const tapHandler = () => {
    if (state === 'streaming') return;
    if (state === 'hovered') {
      send({ type: 'LEAVE' });
    } else {
      send({ type: 'HOVER' });
    }
  };
  root.on('tap', tapHandler);
  disposers.push(() => root.off('tap', tapHandler));

  function update() {
    const actionsVisible = state === 'hovered' && !isStreaming;
    actions.visibility = (actionsVisible ? 'visible' : 'collapse') as any;
    copyBtn.text = state === 'copied' ? 'Copied!' : 'Copy';
    streamingIndicator.visibility = (state === 'streaming' ? 'visible' : 'collapse') as any;
    streamingIndicator.busy = state === 'streaming';
  }

  return {
    view: root,
    dispose() {
      clearTimeout(copyTimer);
      disposers.forEach((d) => d());
    },
  };
}

export default createChatMessage;
