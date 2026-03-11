/* ---------------------------------------------------------------------------
 * ReasoningBlock state machine
 * States: collapsed (initial), expanded, streaming
 * See widget spec: repertoire/concepts/llm-agent/widgets/reasoning-block.widget
 * ------------------------------------------------------------------------- */

export type ReasoningBlockState = 'collapsed' | 'expanded' | 'streaming';
export type ReasoningBlockEvent =
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'TOGGLE' }
  | { type: 'STREAM_START' }
  | { type: 'TOKEN' }
  | { type: 'STREAM_END' };

export function reasoningBlockReducer(state: ReasoningBlockState, event: ReasoningBlockEvent): ReasoningBlockState {
  switch (state) {
    case 'collapsed':
      if (event.type === 'EXPAND' || event.type === 'TOGGLE') return 'expanded';
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'expanded':
      if (event.type === 'COLLAPSE' || event.type === 'TOGGLE') return 'collapsed';
      return state;
    case 'streaming':
      if (event.type === 'TOKEN') return 'streaming';
      if (event.type === 'STREAM_END') return 'collapsed';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useCallback,
  useEffect,
  useReducer,
  type HTMLAttributes,
} from 'react';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ReasoningBlockProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Reasoning / chain-of-thought content (plain text or markdown). */
  content: string;
  /** Controlled collapsed state. */
  collapsed: boolean;
  /** Callback when toggle is triggered. */
  onToggle?: () => void;
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

const ReasoningBlock = forwardRef<HTMLDivElement, ReasoningBlockProps>(function ReasoningBlock(
  {
    content,
    collapsed,
    onToggle,
    defaultExpanded = false,
    showDuration = true,
    streaming = false,
    duration,
    ...rest
  },
  ref,
) {
  const initialState: ReasoningBlockState = streaming
    ? 'streaming'
    : defaultExpanded
      ? 'expanded'
      : 'collapsed';

  const [state, send] = useReducer(reasoningBlockReducer, initialState);

  // Sync streaming prop to state machine
  useEffect(() => {
    if (streaming && state !== 'streaming') {
      send({ type: 'STREAM_START' });
    }
    if (!streaming && state === 'streaming') {
      send({ type: 'STREAM_END' });
    }
  }, [streaming, state]);

  const isBodyVisible = state === 'expanded' || state === 'streaming';

  const handleToggle = useCallback(() => {
    if (state === 'streaming') return; // Cannot toggle during streaming
    send({ type: 'TOGGLE' });
    onToggle?.();
  }, [state, onToggle]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  }, [handleToggle]);

  const headerText = state === 'streaming' ? 'Thinking...' : 'Reasoning';

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Model reasoning"
      data-surface-widget=""
      data-widget-name="reasoning-block"
      data-part="root"
      data-state={state}
      {...rest}
    >
      {/* Header — clickable to toggle expand/collapse */}
      <div
        data-part="header"
        role="button"
        aria-expanded={isBodyVisible}
        aria-label="Toggle reasoning details"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
      >
        <div data-part="header-icon" aria-hidden="true">
          {'\uD83E\uDDE0'}{/* brain emoji */}
        </div>

        <span data-part="header-text">
          {headerText}
        </span>

        {showDuration && state !== 'streaming' && duration != null && (
          <span
            data-part="duration"
            data-visible="true"
          >
            {`${duration}ms`}
          </span>
        )}
      </div>

      {/* Body — visible when expanded or streaming */}
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

      {/* Duration outside header (hidden when not applicable) */}
      {showDuration && state === 'streaming' && (
        <span data-part="duration" data-visible="false" aria-hidden="true" />
      )}
    </div>
  );
});

ReasoningBlock.displayName = 'ReasoningBlock';
export { ReasoningBlock };
export default ReasoningBlock;
