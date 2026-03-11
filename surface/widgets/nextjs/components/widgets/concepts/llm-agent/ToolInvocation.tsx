/* ---------------------------------------------------------------------------
 * ToolInvocation — Server Component
 *
 * Collapsible card displaying an LLM tool call execution with
 * arguments, result, status, and optional retry action.
 * ------------------------------------------------------------------------- */

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

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ToolInvocationProps {
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
  /** Start in expanded state. */
  defaultExpanded?: boolean;
  /** Show the arguments block. */
  showArguments?: boolean;
  /** Show the result block. */
  showResult?: boolean;
  /** Flag for destructive tools (shows warning badge). */
  destructive?: boolean;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function ToolInvocation({
  toolName,
  arguments: args,
  result,
  status,
  duration,
  defaultExpanded = false,
  showArguments = true,
  showResult = true,
  destructive = false,
}: ToolInvocationProps) {
  const viewState = defaultExpanded ? 'expanded' : 'collapsed';
  const isExpanded = defaultExpanded;

  const formattedArgs = formatJson(args);
  const formattedResult = result ? formatJson(result) : undefined;

  const statusIcon = (() => {
    switch (status) {
      case 'running': return '\u25CB';
      case 'succeeded': return '\u2713';
      case 'failed': return '\u2717';
      default: return '\u2022';
    }
  })();

  const statusLabel = (() => {
    switch (status) {
      case 'running': return 'Running';
      case 'succeeded': return 'Succeeded';
      case 'failed': return 'Failed';
      default: return 'Pending';
    }
  })();

  return (
    <div
      role="article"
      aria-label={`Tool call: ${toolName}`}
      aria-expanded={isExpanded}
      data-surface-widget=""
      data-widget-name="tool-invocation"
      data-part="root"
      data-state={viewState}
      data-status={status}
      tabIndex={0}
    >
      {/* Header */}
      <div
        data-part="header"
        role="button"
        aria-label={`${toolName} \u2014 ${statusLabel}`}
        tabIndex={0}
      >
        <div data-part="tool-icon" aria-hidden="true">
          {'\u2699'}
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
            {'\u26A0'}
          </span>
        )}

        <div
          data-part="status-icon"
          data-status={status}
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

      {/* Body */}
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

            {status === 'failed' && (
              <button
                type="button"
                data-part="retry-button"
                data-visible="true"
                aria-label="Retry tool call"
                tabIndex={0}
              >
                Retry
              </button>
            )}
          </>
        )}
      </div>

      {!destructive && (
        <span data-part="warning-badge" data-visible="false" aria-hidden="true" />
      )}
    </div>
  );
}

export { ToolInvocation };
