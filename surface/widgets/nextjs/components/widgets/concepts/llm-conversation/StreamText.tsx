/* ---------------------------------------------------------------------------
 * StreamText — Server Component
 *
 * Token-by-token text renderer for streaming LLM responses.
 * Displays content with optional cursor and stop button.
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface StreamTextProps {
  /** Text content to display. */
  content: string;
  /** Whether content is currently streaming. */
  streaming: boolean;
  /** Whether to render as HTML (markdown). */
  renderMarkdown?: boolean;
  /** Cursor style variant. */
  cursorStyle?: 'bar' | 'block' | 'underline';
  /** Enable smooth scrolling. */
  smoothScroll?: boolean;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function StreamText({
  content,
  streaming,
  renderMarkdown = true,
  cursorStyle = 'bar',
  smoothScroll: _smoothScroll = true,
}: StreamTextProps) {
  const state = streaming ? 'streaming' : (content ? 'complete' : 'idle');

  return (
    <div
      role="region"
      aria-label="Streaming response"
      aria-live="polite"
      aria-busy={streaming ? 'true' : 'false'}
      data-surface-widget=""
      data-widget-name="stream-text"
      data-part="root"
      data-state={state}
      tabIndex={0}
    >
      <div
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

        {streaming && (
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

      {streaming && (
        <button
          type="button"
          data-part="stop-button"
          data-state={state}
          data-visible="true"
          role="button"
          aria-label="Stop generation"
          tabIndex={0}
        >
          Stop
        </button>
      )}
    </div>
  );
}

export { StreamText };
