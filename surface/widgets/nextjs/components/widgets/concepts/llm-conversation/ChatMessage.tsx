/* ---------------------------------------------------------------------------
 * ChatMessage — Server Component
 *
 * Role-differentiated message container for LLM conversations.
 * Renders avatar, role label, body content, timestamp, and action buttons.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Constants
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

export interface ChatMessageProps {
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
  /** Whether to show the regenerate action (assistant only). */
  showRegenerate?: boolean;
  /** Whether to show the edit action (user only). */
  showEdit?: boolean;
  /** Optional override for body content. */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function ChatMessage({
  role: messageRole,
  content,
  timestamp,
  variant = 'default',
  showAvatar = true,
  showTimestamp = true,
  isStreaming = false,
  showRegenerate = false,
  showEdit = false,
  children,
}: ChatMessageProps) {
  const roleLabel = ROLE_LABELS[messageRole] ?? messageRole;

  return (
    <article
      role="article"
      aria-label={`${roleLabel} message`}
      data-surface-widget=""
      data-widget-name="chat-message"
      data-part="root"
      data-state="idle"
      data-role={messageRole}
      data-variant={variant}
      data-streaming={isStreaming ? 'true' : 'false'}
      tabIndex={0}
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

      {/* Actions toolbar (static representation for server component) */}
      <div
        data-part="actions"
        data-visible="false"
        role="toolbar"
        aria-label="Message actions"
      >
        {/* Copy button */}
        <button
          type="button"
          data-part="copy-button"
          data-state="idle"
          aria-label="Copy message"
          tabIndex={0}
        >
          Copy
        </button>

        {/* Regenerate button (assistant messages) */}
        {showRegenerate && messageRole === 'assistant' && (
          <button
            type="button"
            data-part="regenerate-button"
            aria-label="Regenerate message"
            tabIndex={0}
          >
            Regenerate
          </button>
        )}

        {/* Edit button (user messages) */}
        {showEdit && messageRole === 'user' && (
          <button
            type="button"
            data-part="edit-button"
            aria-label="Edit message"
            tabIndex={0}
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
}

export { ChatMessage };
