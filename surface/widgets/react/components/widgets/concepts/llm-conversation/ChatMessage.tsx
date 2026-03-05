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

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

/* ---------------------------------------------------------------------------
 * Role avatar map
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

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ChatMessageProps extends Omit<HTMLAttributes<HTMLElement>, 'children' | 'role'> {
  /** Message author role. */
  role: 'user' | 'assistant' | 'system' | 'tool';
  /** Message text content. */
  content: string;
  /** ISO timestamp string. */
  timestamp: string;
  /** Visual variant. */
  variant?: 'default' | 'compact' | 'bubble';
  /** Show the role avatar. */
  showAvatar?: boolean;
  /** Show the timestamp. */
  showTimestamp?: boolean;
  /** Whether the message is actively streaming. */
  isStreaming?: boolean;
  /** Callback after content is copied. */
  onCopy?: () => void;
  /** Callback to regenerate this message. */
  onRegenerate?: () => void;
  /** Callback to edit this message. */
  onEdit?: () => void;
  /** Optional override for body content. */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const ChatMessage = forwardRef<HTMLElement, ChatMessageProps>(function ChatMessage(
  {
    role: messageRole,
    content,
    timestamp,
    variant = 'default',
    showAvatar = true,
    showTimestamp = true,
    isStreaming = false,
    onCopy,
    onRegenerate,
    onEdit,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(chatMessageReducer, isStreaming ? 'streaming' : 'idle');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  /* Sync streaming prop to state machine */
  useEffect(() => {
    if (isStreaming) {
      send({ type: 'STREAM_START' });
    } else {
      send({ type: 'STREAM_END' });
    }
  }, [isStreaming]);

  /* Copy timeout: return to idle after 2 seconds */
  useEffect(() => {
    if (state === 'copied') {
      timerRef.current = setTimeout(() => send({ type: 'COPY_TIMEOUT' }), 2000);
      return () => clearTimeout(timerRef.current);
    }
  }, [state]);

  /* Copy handler with clipboard API */
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      /* fallback: noop */
    }
    send({ type: 'COPY' });
    onCopy?.();
  }, [content, onCopy]);

  /* Keyboard handler: Ctrl+C to copy */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'c') {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          e.preventDefault();
          handleCopy();
        }
      }
    },
    [handleCopy],
  );

  const roleLabel = ROLE_LABELS[messageRole] ?? messageRole;
  const actionsVisible = state === 'hovered' && !isStreaming;

  return (
    <article
      ref={ref}
      role="article"
      aria-label={`${roleLabel} message`}
      data-surface-widget=""
      data-widget-name="chat-message"
      data-part="root"
      data-state={state}
      data-role={messageRole}
      data-variant={variant}
      data-streaming={isStreaming ? 'true' : 'false'}
      tabIndex={0}
      onMouseEnter={() => send({ type: 'HOVER' })}
      onMouseLeave={() => send({ type: 'LEAVE' })}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {/* Avatar */}
      <div
        data-part="avatar"
        data-role={messageRole}
        data-visible={showAvatar ? 'true' : 'false'}
        aria-hidden="true"
      >
        {showAvatar && (ROLE_AVATARS[messageRole] ?? messageRole.charAt(0).toUpperCase())}
      </div>

      {/* Role label */}
      <span data-part="role-label">
        {roleLabel}
      </span>

      {/* Body: markdown content area */}
      <div
        data-part="body"
        data-role={messageRole}
        role="region"
        aria-label="Message content"
      >
        {children ?? content}
        {isStreaming && (
          <span
            data-part="streaming-cursor"
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: '2px',
              height: '1em',
              backgroundColor: 'currentColor',
              marginLeft: '2px',
              verticalAlign: 'text-bottom',
              animation: 'chat-message-blink 1s step-end infinite',
            }}
          />
        )}
      </div>

      {/* Timestamp */}
      <span
        data-part="timestamp"
        data-visible={showTimestamp ? 'true' : 'false'}
      >
        {showTimestamp ? timestamp : null}
      </span>

      {/* Actions toolbar: visible on hover, hidden during streaming */}
      <div
        data-part="actions"
        data-visible={actionsVisible ? 'true' : 'false'}
        role="toolbar"
        aria-label="Message actions"
        style={{
          visibility: actionsVisible ? 'visible' : 'hidden',
          position: actionsVisible ? 'relative' : 'absolute',
          pointerEvents: actionsVisible ? 'auto' : 'none',
        }}
      >
        {/* Copy button */}
        <button
          type="button"
          data-part="copy-button"
          data-state={state === 'copied' ? 'copied' : 'idle'}
          aria-label={state === 'copied' ? 'Copied to clipboard' : 'Copy message'}
          aria-live="polite"
          tabIndex={0}
          onClick={handleCopy}
        >
          {state === 'copied' ? 'Copied!' : 'Copy'}
        </button>

        {/* Regenerate button (assistant messages) */}
        {onRegenerate && messageRole === 'assistant' && (
          <button
            type="button"
            data-part="regenerate-button"
            aria-label="Regenerate message"
            tabIndex={0}
            onClick={onRegenerate}
          >
            Regenerate
          </button>
        )}

        {/* Edit button (user messages) */}
        {onEdit && messageRole === 'user' && (
          <button
            type="button"
            data-part="edit-button"
            aria-label="Edit message"
            tabIndex={0}
            onClick={onEdit}
          >
            Edit
          </button>
        )}
      </div>

      {/* Blink keyframes injected inline for portability */}
      {isStreaming && (
        <style>{`
          @keyframes chat-message-blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}</style>
      )}
    </article>
  );
});

ChatMessage.displayName = 'ChatMessage';
export { ChatMessage };
export default ChatMessage;
