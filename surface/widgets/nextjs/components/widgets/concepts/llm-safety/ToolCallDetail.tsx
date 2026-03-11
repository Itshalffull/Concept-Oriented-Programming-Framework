/* ---------------------------------------------------------------------------
 * ToolCallDetail — Server Component
 *
 * Detailed view of a single tool call within an LLM execution showing
 * tool name, status badge, collapsible input/output sections, timing,
 * token usage, and error state with retry button.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type ToolCallStatus = 'pending' | 'success' | 'error';

export interface ToolCallDetailProps {
  /** Name of the tool being called. */
  toolName: string;
  /** Tool input arguments — JSON string or object. */
  input: string | Record<string, unknown>;
  /** Tool output result — JSON string or object. */
  output?: string | Record<string, unknown> | undefined;
  /** Execution status of the tool call. */
  status?: ToolCallStatus;
  /** Duration in milliseconds. */
  duration?: number | undefined;
  /** ISO timestamp of the tool call. */
  timestamp?: string | undefined;
  /** Raw arguments string (backward compat). */
  arguments?: string;
  /** Raw result string (backward compat). */
  result?: string | undefined;
  /** Timing in ms (backward compat). */
  timing?: number | undefined;
  /** Token usage count. */
  tokenUsage?: number | undefined;
  /** Error message. */
  error?: string | undefined;
  /** Whether to show timing info. */
  showTiming?: boolean;
  /** Whether to show token badge. */
  showTokens?: boolean;
  /** Whether arguments section is expanded. */
  argsExpanded?: boolean;
  /** Whether result section is expanded. */
  resultExpanded?: boolean;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

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

const STATUS_STYLES: Record<ToolCallStatus, { background: string; color: string; label: string }> = {
  pending: { background: '#fef3c7', color: '#92400e', label: 'Pending' },
  success: { background: '#d1fae5', color: '#065f46', label: 'Success' },
  error: { background: '#fee2e2', color: '#991b1b', label: 'Error' },
};

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function ToolCallDetail({
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
  argsExpanded = true,
  resultExpanded = true,
  children,
}: ToolCallDetailProps) {
  const resolvedInput = input ?? argsProp ?? '';
  const resolvedOutput = output ?? result;
  const resolvedDuration = duration ?? timing;
  const resolvedStatus: ToolCallStatus = error ? 'error' : status;

  const formattedInput = formatJson(resolvedInput);
  const formattedOutput = formatJson(resolvedOutput);
  const errorMessage = error ?? (resolvedStatus === 'error' && typeof resolvedOutput === 'string' ? resolvedOutput : undefined);

  const statusInfo = STATUS_STYLES[resolvedStatus];

  return (
    <div
      role="article"
      aria-label={`Tool call: ${toolName}`}
      data-surface-widget=""
      data-widget-name="tool-call-detail"
      data-part="root"
      data-state="idle"
      tabIndex={0}
      style={{ fontFamily: 'system-ui, sans-serif', fontSize: '14px' }}
    >
      {/* Header: tool name + status badge + duration */}
      <div
        data-part="header"
        data-state="idle"
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
          data-state="idle"
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
          data-state="idle"
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
            data-state="idle"
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
        data-part="arguments-panel"
        data-state="idle"
        role="region"
        aria-label="Arguments"
        tabIndex={0}
        style={{ borderBottom: '1px solid #e5e7eb' }}
      >
        <button
          type="button"
          aria-expanded={argsExpanded}
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
          <span style={{ transform: argsExpanded ? 'rotate(90deg)' : 'rotate(0)', display: 'inline-block' }}>
            &#9654;
          </span>
          Input
          <button
            type="button"
            aria-label="Copy input JSON"
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
          data-part="result-panel"
          data-state="idle"
          data-visible="true"
          role="region"
          aria-label="Result"
          tabIndex={0}
          style={{ borderBottom: '1px solid #e5e7eb' }}
        >
          <button
            type="button"
            aria-expanded={resultExpanded}
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
            <span style={{ transform: resultExpanded ? 'rotate(90deg)' : 'rotate(0)', display: 'inline-block' }}>
              &#9654;
            </span>
            Output
            <button
              type="button"
              aria-label="Copy output JSON"
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
                data-state="idle"
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
          data-state="idle"
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
          data-state="idle"
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
          data-state="idle"
          data-visible="true"
          aria-label="Retry tool call"
          tabIndex={0}
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
            background: '#ffffff',
            cursor: 'pointer',
            color: '#374151',
          }}
        >
          {children ?? 'Retry'}
        </button>
      )}
    </div>
  );
}

export { ToolCallDetail };
