export type StreamTextState = 'idle' | 'streaming' | 'complete' | 'stopped';
export type StreamTextEvent =
  | { type: 'STREAM_START' }
  | { type: 'TOKEN' }
  | { type: 'STREAM_END' }
  | { type: 'STOP' };

export function streamTextReducer(state: StreamTextState, event: StreamTextEvent): StreamTextState {
  switch (state) {
    case 'idle':
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'streaming':
      if (event.type === 'TOKEN') return 'streaming';
      if (event.type === 'STREAM_END') return 'complete';
      if (event.type === 'STOP') return 'stopped';
      return state;
    case 'complete':
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'stopped':
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useReducer,
  useRef,
  useEffect,
  useCallback,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react';

export interface StreamTextProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'content'> {
  content: string;
  streaming: boolean;
  onStop?: () => void;
  renderMarkdown?: boolean;
  cursorStyle?: 'bar' | 'block' | 'underline';
  smoothScroll?: boolean;
}

const StreamText = forwardRef<HTMLDivElement, StreamTextProps>(function StreamText(
  {
    content,
    streaming,
    onStop,
    renderMarkdown = true,
    cursorStyle = 'bar',
    smoothScroll = true,
    ...restProps
  },
  ref,
) {
  const [state, send] = useReducer(streamTextReducer, streaming ? 'streaming' : 'idle');
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevStreamingRef = useRef(streaming);

  // Synchronize streaming prop with internal state machine
  useEffect(() => {
    const wasStreaming = prevStreamingRef.current;
    prevStreamingRef.current = streaming;

    if (streaming && !wasStreaming) {
      send({ type: 'STREAM_START' });
    } else if (!streaming && wasStreaming) {
      send({ type: 'STREAM_END' });
    }
  }, [streaming]);

  // Dispatch TOKEN on content changes while streaming
  useEffect(() => {
    if (state === 'streaming' && content) {
      send({ type: 'TOKEN' });
    }
  }, [content, state]);

  // Auto-scroll to bottom during streaming
  useEffect(() => {
    if (state !== 'streaming') return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smoothScroll ? 'smooth' : 'auto',
    });
  }, [content, state, smoothScroll]);

  const handleStop = useCallback(() => {
    if (state !== 'streaming') return;
    send({ type: 'STOP' });
    onStop?.();
  }, [state, onStop]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleStop();
      }
    },
    [handleStop],
  );

  const isStreaming = state === 'streaming';

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Streaming response"
      aria-live="polite"
      aria-busy={isStreaming ? 'true' : 'false'}
      data-surface-widget=""
      data-widget-name="stream-text"
      data-part="root"
      data-state={state}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      {...restProps}
    >
      <div
        ref={scrollRef}
        data-part="text-block"
        data-state={state}
        data-markdown={renderMarkdown ? 'true' : 'false'}
        style={{ overflow: 'auto' }}
      >
        {renderMarkdown ? (
          <div dangerouslySetInnerHTML={{ __html: content }} />
        ) : (
          <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>
        )}

        {isStreaming && (
          <span
            data-part="cursor"
            data-style={cursorStyle}
            data-visible="true"
            data-state={state}
            aria-hidden="true"
            style={{
              display: 'inline-block',
              animation: 'clef-cursor-blink 1s step-end infinite',
              ...(cursorStyle === 'bar'
                ? { width: '2px', height: '1.2em', verticalAlign: 'text-bottom', backgroundColor: 'currentColor' }
                : cursorStyle === 'block'
                  ? { width: '0.6em', height: '1.2em', verticalAlign: 'text-bottom', backgroundColor: 'currentColor', opacity: 0.7 }
                  : { width: '0.6em', height: '2px', verticalAlign: 'baseline', backgroundColor: 'currentColor' }),
            }}
          />
        )}
      </div>

      {isStreaming && (
        <button
          type="button"
          data-part="stop-button"
          data-state={state}
          data-visible="true"
          role="button"
          aria-label="Stop generation"
          tabIndex={0}
          onClick={handleStop}
        >
          Stop
        </button>
      )}
    </div>
  );
});

StreamText.displayName = 'StreamText';
export { StreamText };
export default StreamText;
