/* ---------------------------------------------------------------------------
 * ReasoningBlock — Server Component
 *
 * Collapsible display for LLM chain-of-thought or reasoning content.
 * Shows header with brain icon, optional duration, and expandable body.
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ReasoningBlockProps {
  /** Reasoning / chain-of-thought content. */
  content: string;
  /** Controlled collapsed state. */
  collapsed: boolean;
  /** Start in expanded state. */
  defaultExpanded?: boolean;
  /** Show the duration label. */
  showDuration?: boolean;
  /** Whether content is currently streaming. */
  streaming?: boolean;
  /** Time spent reasoning, in milliseconds. */
  duration?: number | undefined;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function ReasoningBlock({
  content,
  collapsed,
  defaultExpanded = false,
  showDuration = true,
  streaming = false,
  duration,
}: ReasoningBlockProps) {
  const state = streaming ? 'streaming' : (collapsed && !defaultExpanded ? 'collapsed' : 'expanded');
  const isBodyVisible = state === 'expanded' || state === 'streaming';
  const headerText = state === 'streaming' ? 'Thinking...' : 'Reasoning';

  return (
    <div
      role="group"
      aria-label="Model reasoning"
      data-surface-widget=""
      data-widget-name="reasoning-block"
      data-part="root"
      data-state={state}
    >
      {/* Header */}
      <div
        data-part="header"
        role="button"
        aria-expanded={isBodyVisible}
        aria-label="Toggle reasoning details"
        tabIndex={0}
      >
        <div data-part="header-icon" aria-hidden="true">
          {'\uD83E\uDDE0'}
        </div>

        <span data-part="header-text">
          {headerText}
        </span>

        {showDuration && state !== 'streaming' && duration != null && (
          <span data-part="duration" data-visible="true">
            {`${duration}ms`}
          </span>
        )}
      </div>

      {/* Body */}
      <div
        data-part="body"
        role="region"
        aria-label="Reasoning content"
        data-visible={isBodyVisible ? 'true' : 'false'}
      >
        {isBodyVisible && (
          <div data-part="content">
            {content}
          </div>
        )}
      </div>

      {showDuration && state === 'streaming' && (
        <span data-part="duration" data-visible="false" aria-hidden="true" />
      )}
    </div>
  );
}

export { ReasoningBlock };
