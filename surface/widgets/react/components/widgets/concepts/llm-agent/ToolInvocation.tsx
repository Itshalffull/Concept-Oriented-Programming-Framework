/* ---------------------------------------------------------------------------
 * ToolInvocation state machine
 * Parallel states: collapsed/hoveredCollapsed/expanded AND pending/running/succeeded/failed
 * See widget spec: repertoire/concepts/llm-agent/widgets/tool-invocation.widget
 * ------------------------------------------------------------------------- */

export type ToolInvocationViewState = 'collapsed' | 'hoveredCollapsed' | 'expanded';
export type ToolInvocationExecState = 'pending' | 'running' | 'succeeded' | 'failed';

export type ToolInvocationViewEvent =
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'HOVER' }
  | { type: 'LEAVE' };

export type ToolInvocationExecEvent =
  | { type: 'INVOKE' }
  | { type: 'SUCCESS' }
  | { type: 'FAILURE' }
  | { type: 'RETRY' }
  | { type: 'RESET' };

export function viewReducer(state: ToolInvocationViewState, event: ToolInvocationViewEvent): ToolInvocationViewState {
  switch (state) {
    case 'collapsed':
      if (event.type === 'EXPAND') return 'expanded';
      if (event.type === 'HOVER') return 'hoveredCollapsed';
      return state;
    case 'hoveredCollapsed':
      if (event.type === 'LEAVE') return 'collapsed';
      if (event.type === 'EXPAND') return 'expanded';
      return state;
    case 'expanded':
      if (event.type === 'COLLAPSE') return 'collapsed';
      return state;
    default:
      return state;
  }
}

export function execReducer(state: ToolInvocationExecState, event: ToolInvocationExecEvent): ToolInvocationExecState {
  switch (state) {
    case 'pending':
      if (event.type === 'INVOKE') return 'running';
      return state;
    case 'running':
      if (event.type === 'SUCCESS') return 'succeeded';
      if (event.type === 'FAILURE') return 'failed';
      return state;
    case 'succeeded':
      if (event.type === 'RESET') return 'pending';
      return state;
    case 'failed':
      if (event.type === 'RETRY') return 'running';
      if (event.type === 'RESET') return 'pending';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  type HTMLAttributes,
} from 'react';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ToolInvocationProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Tool function name. */
  toolName: string;
  /** Serialized JSON arguments. */
  arguments: string;
  /** Serialized JSON result. */
  result?: string | undefined;
  /** Execution status: pending | running | succeeded | failed. */
  status: string;
  /** Execution duration in milliseconds. */
  duration?: number | undefined;
  /** Callback to retry a failed invocation. */
  onRetry?: () => void;
  /** Start in expanded state. */
  defaultExpanded?: boolean;
  /** Show the arguments block. */
  showArguments?: boolean;
  /** Show the result block. */
  showResult?: boolean;
  /** Flag for destructive tools (shows warning badge). */
  'data-destructive'?: boolean;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function statusToExecState(status: string): ToolInvocationExecState {
  switch (status) {
    case 'running': return 'running';
    case 'succeeded': return 'succeeded';
    case 'failed': return 'failed';
    default: return 'pending';
  }
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const ToolInvocation = forwardRef<HTMLDivElement, ToolInvocationProps>(function ToolInvocation(
  {
    toolName,
    arguments: args,
    result,
    status,
    duration,
    onRetry,
    defaultExpanded = false,
    showArguments = true,
    showResult = true,
    'data-destructive': destructive,
    ...rest
  },
  ref,
) {
  const [viewState, sendView] = useReducer(viewReducer, defaultExpanded ? 'expanded' : 'collapsed');
  const [execState, sendExec] = useReducer(execReducer, statusToExecState(status));

  // Sync exec state when status prop changes
  useEffect(() => {
    const mapped = statusToExecState(status);
    if (mapped === 'running') sendExec({ type: 'INVOKE' });
    else if (mapped === 'succeeded') sendExec({ type: 'SUCCESS' });
    else if (mapped === 'failed') sendExec({ type: 'FAILURE' });
    else sendExec({ type: 'RESET' });
  }, [status]);

  const isExpanded = viewState === 'expanded';

  const toggleExpand = useCallback(() => {
    if (isExpanded) {
      sendView({ type: 'COLLAPSE' });
    } else {
      sendView({ type: 'EXPAND' });
    }
  }, [isExpanded]);

  const handleRetry = useCallback(() => {
    sendExec({ type: 'RETRY' });
    onRetry?.();
  }, [onRetry]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      toggleExpand();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      sendView({ type: 'COLLAPSE' });
    }
    if (e.key === 'r' && execState === 'failed') {
      e.preventDefault();
      handleRetry();
    }
  }, [toggleExpand, execState, handleRetry]);

  const formattedArgs = useMemo(() => formatJson(args), [args]);
  const formattedResult = useMemo(() => (result ? formatJson(result) : undefined), [result]);

  const statusIcon = (() => {
    switch (execState) {
      case 'running': return '\u25CB'; // spinner placeholder (circle)
      case 'succeeded': return '\u2713'; // checkmark
      case 'failed': return '\u2717'; // x mark
      default: return '\u2022'; // bullet for pending
    }
  })();

  const statusLabel = (() => {
    switch (execState) {
      case 'running': return 'Running';
      case 'succeeded': return 'Succeeded';
      case 'failed': return 'Failed';
      default: return 'Pending';
    }
  })();

  return (
    <div
      ref={ref}
      role="article"
      aria-label={`Tool call: ${toolName}`}
      aria-expanded={isExpanded}
      data-surface-widget=""
      data-widget-name="tool-invocation"
      data-part="root"
      data-state={viewState}
      data-status={execState}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerEnter={() => sendView({ type: 'HOVER' })}
      onPointerLeave={() => sendView({ type: 'LEAVE' })}
      {...rest}
    >
      {/* Header — clickable to toggle expand/collapse */}
      <div
        data-part="header"
        role="button"
        aria-label={`${toolName} \u2014 ${statusLabel}`}
        tabIndex={0}
        onClick={toggleExpand}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            toggleExpand();
          }
        }}
      >
        <div data-part="tool-icon" aria-hidden="true">
          {'\u2699'}{/* gear icon */}
        </div>

        <span data-part="tool-name">
          {toolName}
        </span>

        {destructive && (
          <span
            data-part="warning-badge"
            data-visible="true"
            role="status"
            aria-label="Destructive tool"
          >
            {'\u26A0'}{/* warning triangle */}
          </span>
        )}

        <div
          data-part="status-icon"
          data-status={execState}
          aria-label={statusLabel}
        >
          {statusIcon}
        </div>

        <span
          data-part="duration"
          data-visible={duration != null ? 'true' : 'false'}
        >
          {duration != null ? `${duration}ms` : ''}
        </span>
      </div>

      {/* Body — visible when expanded */}
      <div
        data-part="body"
        data-visible={isExpanded ? 'true' : 'false'}
      >
        {isExpanded && (
          <>
            {showArguments && (
              <div data-part="arguments" data-visible="true">
                <pre
                  role="code"
                  aria-label="Tool arguments"
                  data-part="arguments-code"
                >
                  <code>{formattedArgs}</code>
                </pre>
              </div>
            )}

            {showResult && formattedResult && (
              <div data-part="result" data-visible="true">
                <pre
                  role="code"
                  aria-label="Tool result"
                  data-part="result-code"
                >
                  <code>{formattedResult}</code>
                </pre>
              </div>
            )}

            {execState === 'failed' && (
              <button
                type="button"
                data-part="retry-button"
                data-visible="true"
                aria-label="Retry tool call"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRetry();
                }}
              >
                Retry
              </button>
            )}
          </>
        )}
      </div>

      {/* Warning badge outside header for non-destructive tools (hidden) */}
      {!destructive && (
        <span data-part="warning-badge" data-visible="false" aria-hidden="true" />
      )}
    </div>
  );
});

ToolInvocation.displayName = 'ToolInvocation';
export { ToolInvocation };
export default ToolInvocation;
