export type ToolCallDetailState = 'idle' | 'retrying';
export type ToolCallDetailEvent =
  | { type: 'EXPAND_ARGS' }
  | { type: 'EXPAND_RESULT' }
  | { type: 'RETRY' }
  | { type: 'RETRY_COMPLETE' }
  | { type: 'RETRY_ERROR' };

export function toolCallDetailReducer(state: ToolCallDetailState, event: ToolCallDetailEvent): ToolCallDetailState {
  switch (state) {
    case 'idle':
      if (event.type === 'EXPAND_ARGS') return 'idle';
      if (event.type === 'EXPAND_RESULT') return 'idle';
      if (event.type === 'RETRY') return 'retrying';
      return state;
    case 'retrying':
      if (event.type === 'RETRY_COMPLETE') return 'idle';
      if (event.type === 'RETRY_ERROR') return 'idle';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useReducer,
  useState,
  useCallback,
  useMemo,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

// --- Public types ---

export type ToolCallStatus = 'pending' | 'success' | 'error';

export interface ToolCallDetailProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Name of the tool being called */
  toolName: string;
  /** Tool input arguments — JSON string or object */
  input: string | Record<string, unknown>;
  /** Tool output result — JSON string or object */
  output?: string | Record<string, unknown> | undefined;
  /** Execution status of the tool call */
  status?: ToolCallStatus;
  /** Duration in milliseconds */
  duration?: number | undefined;
  /** ISO timestamp of the tool call */
  timestamp?: string | undefined;
  /** Raw arguments string (kept for backward compat) */
  arguments?: string;
  /** Raw result string (kept for backward compat) */
  result?: string | undefined;
  /** Timing in ms (kept for backward compat) */
  timing?: number | undefined;
  /** Token usage count */
  tokenUsage?: number | undefined;
  /** Error message */
  error?: string | undefined;
  /** Whether to show timing info */
  showTiming?: boolean;
  /** Whether to show token badge */
  showTokens?: boolean;
  /** Callback when retry is triggered */
  onRetry?: () => void;
  /** Callback when retry completes */
  onRetryComplete?: () => void;
  /** Callback when retry errors */
  onRetryError?: (error: string) => void;
  children?: ReactNode;
}

// --- Helpers ---

function formatJson(value: string | Record<string, unknown> | undefined | null): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

function copyToClipboard(text: string): void {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {
      /* silent */
    });
  }
}

const STATUS_STYLES: Record<ToolCallStatus, { background: string; color: string; label: string }> = {
  pending: { background: '#fef3c7', color: '#92400e', label: 'Pending' },
  success: { background: '#d1fae5', color: '#065f46', label: 'Success' },
  error: { background: '#fee2e2', color: '#991b1b', label: 'Error' },
};

// --- Component ---

const ToolCallDetail = forwardRef<HTMLDivElement, ToolCallDetailProps>(function ToolCallDetail(
  {
    toolName,
    input,
    output,
    status = 'pending',
    duration,
    timestamp,
    arguments: argsProp,
    result,
    timing,
    tokenUsage,
    error,
    showTiming = true,
    showTokens = true,
    onRetry,
    onRetryComplete,
    onRetryError,
    children,
    ...restProps
  },
  ref,
) {
  const [state, send] = useReducer(toolCallDetailReducer, 'idle');
  const [argsExpanded, setArgsExpanded] = useState(true);
  const [resultExpanded, setResultExpanded] = useState(true);
  const [focusedSection, setFocusedSection] = useState<'input' | 'output' | null>(null);
  const inputSectionRef = useRef<HTMLDivElement>(null);
  const outputSectionRef = useRef<HTMLDivElement>(null);

  // Resolve values: prefer new props, fall back to legacy props
  const resolvedInput = input ?? argsProp ?? '';
  const resolvedOutput = output ?? result;
  const resolvedDuration = duration ?? timing;
  const resolvedStatus: ToolCallStatus = error ? 'error' : status;

  const formattedInput = useMemo(() => formatJson(resolvedInput), [resolvedInput]);
  const formattedOutput = useMemo(() => formatJson(resolvedOutput), [resolvedOutput]);
  const errorMessage = error ?? (resolvedStatus === 'error' && typeof resolvedOutput === 'string' ? resolvedOutput : undefined);

  const statusInfo = STATUS_STYLES[resolvedStatus];

  const handleRetry = useCallback(() => {
    if (state === 'retrying') return;
    send({ type: 'RETRY' });
    onRetry?.();
  }, [state, onRetry]);

  const handleToggleArgs = useCallback(() => {
    setArgsExpanded((prev) => !prev);
    send({ type: 'EXPAND_ARGS' });
  }, []);

  const handleToggleResult = useCallback(() => {
    setResultExpanded((prev) => !prev);
    send({ type: 'EXPAND_RESULT' });
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      // r -> retry (only when error exists)
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey && errorMessage) {
        e.preventDefault();
        handleRetry();
        return;
      }

      // Enter -> toggle focused section
      if (e.key === 'Enter') {
        const target = e.target as HTMLElement;
        if (target.closest('[data-part="arguments-panel"]')) {
          e.preventDefault();
          handleToggleArgs();
          return;
        }
        if (target.closest('[data-part="result-panel"]')) {
          e.preventDefault();
          handleToggleResult();
          return;
        }
      }

      // Ctrl+C -> copy focused section JSON
      if (e.ctrlKey && e.key === 'c') {
        // Only intercept if no text is selected
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;

        const target = e.target as HTMLElement;
        if (target.closest('[data-part="arguments-panel"]')) {
          e.preventDefault();
          copyToClipboard(formattedInput);
          return;
        }
        if (target.closest('[data-part="result-panel"]')) {
          e.preventDefault();
          copyToClipboard(formattedOutput);
          return;
        }
      }
    },
    [errorMessage, handleRetry, handleToggleArgs, handleToggleResult, formattedInput, formattedOutput],
  );

  return (
    <div
      ref={ref}
      role="article"
      aria-label={`Tool call: ${toolName}`}
      data-surface-widget=""
      data-widget-name="tool-call-detail"
      data-part="root"
      data-state={state}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ fontFamily: 'system-ui, sans-serif', fontSize: '14px' }}
      {...restProps}
    >
      {/* Header: tool name + status badge + duration */}
      <div
        data-part="header"
        data-state={state}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 12px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <span
          data-part="tool-name"
          data-state={state}
          style={{
            fontWeight: 600,
            fontFamily: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace',
            fontSize: '14px',
          }}
        >
          {toolName}
        </span>

        <span
          data-part="status-badge"
          data-state={state}
          role="status"
          aria-label={`Status: ${statusInfo.label}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 500,
            background: statusInfo.background,
            color: statusInfo.color,
          }}
        >
          {statusInfo.label}
        </span>

        {resolvedDuration !== undefined && showTiming && (
          <span
            data-part="timing-bar"
            data-state={state}
            data-visible="true"
            style={{
              marginLeft: 'auto',
              fontSize: '12px',
              color: '#6b7280',
            }}
          >
            {resolvedDuration}ms
          </span>
        )}
      </div>

      {/* Input section (collapsible) */}
      <div
        ref={inputSectionRef}
        data-part="arguments-panel"
        data-state={state}
        role="region"
        aria-label="Arguments"
        tabIndex={0}
        onFocus={() => setFocusedSection('input')}
        onBlur={() => setFocusedSection(null)}
        style={{ borderBottom: '1px solid #e5e7eb' }}
      >
        <button
          type="button"
          aria-expanded={argsExpanded}
          onClick={handleToggleArgs}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            width: '100%',
            padding: '8px 12px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            color: '#374151',
            textAlign: 'left',
          }}
        >
          <span style={{ transform: argsExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 150ms', display: 'inline-block' }}>
            &#9654;
          </span>
          Input
          <button
            type="button"
            aria-label="Copy input JSON"
            onClick={(e) => { e.stopPropagation(); copyToClipboard(formattedInput); }}
            style={{
              marginLeft: 'auto',
              padding: '2px 6px',
              fontSize: '11px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              background: '#f9fafb',
              cursor: 'pointer',
              color: '#6b7280',
            }}
          >
            Copy
          </button>
        </button>
        {argsExpanded && (
          <pre
            role="code"
            aria-label="Arguments"
            style={{
              margin: 0,
              padding: '8px 12px',
              fontSize: '12px',
              fontFamily: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace',
              background: '#f9fafb',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {formattedInput}
          </pre>
        )}
      </div>

      {/* Output section (collapsible) */}
      {(resolvedOutput !== undefined || errorMessage) && (
        <div
          ref={outputSectionRef}
          data-part="result-panel"
          data-state={state}
          data-visible="true"
          role="region"
          aria-label="Result"
          tabIndex={0}
          onFocus={() => setFocusedSection('output')}
          onBlur={() => setFocusedSection(null)}
          style={{ borderBottom: '1px solid #e5e7eb' }}
        >
          <button
            type="button"
            aria-expanded={resultExpanded}
            onClick={handleToggleResult}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              width: '100%',
              padding: '8px 12px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              color: '#374151',
              textAlign: 'left',
            }}
          >
            <span style={{ transform: resultExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 150ms', display: 'inline-block' }}>
              &#9654;
            </span>
            Output
            <button
              type="button"
              aria-label="Copy output JSON"
              onClick={(e) => { e.stopPropagation(); copyToClipboard(errorMessage ?? formattedOutput); }}
              style={{
                marginLeft: 'auto',
                padding: '2px 6px',
                fontSize: '11px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: '#f9fafb',
                cursor: 'pointer',
                color: '#6b7280',
              }}
            >
              Copy
            </button>
          </button>
          {resultExpanded && (
            resolvedStatus === 'error' && errorMessage ? (
              <div
                data-part="error-panel"
                data-state={state}
                data-visible="true"
                role="alert"
                aria-label="Error details"
                style={{
                  margin: 0,
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontFamily: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace',
                  background: '#fef2f2',
                  color: '#991b1b',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  borderLeft: '3px solid #ef4444',
                }}
              >
                {errorMessage}
              </div>
            ) : (
              <pre
                role="code"
                aria-label="Result"
                style={{
                  margin: 0,
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontFamily: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace',
                  background: '#f9fafb',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {formattedOutput}
              </pre>
            )
          )}
        </div>
      )}

      {/* Token usage badge */}
      {showTokens && tokenUsage !== undefined && (
        <div
          data-part="token-badge"
          data-state={state}
          data-visible="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            margin: '8px 12px',
            padding: '2px 8px',
            fontSize: '12px',
            border: '1px solid #d1d5db',
            borderRadius: '9999px',
            color: '#6b7280',
          }}
        >
          {tokenUsage} tokens
        </div>
      )}

      {/* Timestamp display */}
      {timestamp && (
        <div
          data-part="timestamp"
          data-state={state}
          style={{
            padding: '4px 12px 8px',
            fontSize: '12px',
            color: '#9ca3af',
          }}
        >
          {timestamp}
        </div>
      )}

      {/* Retry button — only visible when error exists */}
      {errorMessage && (
        <button
          type="button"
          data-part="retry-button"
          data-state={state}
          data-visible="true"
          aria-label="Retry tool call"
          disabled={state === 'retrying'}
          tabIndex={0}
          onClick={handleRetry}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            margin: '4px 12px 12px',
            padding: '6px 14px',
            fontSize: '13px',
            fontWeight: 500,
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            background: state === 'retrying' ? '#f3f4f6' : '#ffffff',
            cursor: state === 'retrying' ? 'not-allowed' : 'pointer',
            color: '#374151',
          }}
        >
          {state === 'retrying' ? 'Retrying...' : (children ?? 'Retry')}
        </button>
      )}
    </div>
  );
});

ToolCallDetail.displayName = 'ToolCallDetail';
export { ToolCallDetail };
export default ToolCallDetail;
