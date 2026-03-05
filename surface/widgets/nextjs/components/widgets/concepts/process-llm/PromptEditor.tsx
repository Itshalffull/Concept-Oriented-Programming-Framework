/* ---------------------------------------------------------------------------
 * PromptEditor — Server Component
 *
 * Multi-message prompt template editor for LLM steps. Supports role-based
 * message blocks (system, user, assistant), template variables with
 * {{syntax}} highlighting, auto-detected variable pills, token count
 * estimation, and a test panel for previewing prompt output.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface PromptMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PromptTool {
  name: string;
  description?: string;
}

export interface PromptEditorProps {
  /** System prompt text. */
  systemPrompt?: string | undefined;
  /** User prompt template text. */
  userPrompt: string;
  /** Model identifier. */
  model: string;
  /** Available tools for the LLM step. */
  tools: PromptTool[];
  /** Whether to show the test button and panel. */
  showTest?: boolean;
  /** Whether to show the tool list. */
  showTools?: boolean;
  /** Whether to show the token count. */
  showTokenCount?: boolean;
  /** Additional messages beyond system/user. */
  messages?: PromptMessage[];
  /** Test result from the last test run. */
  testResult?: string;
  /** Test error message. */
  testError?: string;
  /** Server-computed state: 'editing' | 'testing' | 'viewing'. */
  state?: 'editing' | 'testing' | 'viewing';
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

/** Extract {{variable}} references from text. */
function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
}

/** Collect variables from all prompt text. */
function extractAllVariables(
  systemPrompt: string,
  userPrompt: string,
  messages: PromptMessage[],
): string[] {
  let allText = systemPrompt + userPrompt;
  for (const msg of messages) {
    allText += msg.content;
  }
  return extractVariables(allText);
}

/** Rough token count estimation (~4 chars per token). */
function estimateTokens(
  systemPrompt: string,
  userPrompt: string,
  messages: PromptMessage[],
): number {
  let total = systemPrompt.length + userPrompt.length;
  for (const msg of messages) {
    total += msg.content.length;
  }
  return Math.ceil(total / 4);
}

const ROLE_LABELS: Record<string, string> = {
  system: 'System',
  user: 'User',
  assistant: 'Assistant',
};

const ROLES: Array<'system' | 'user' | 'assistant'> = ['system', 'user', 'assistant'];

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function PromptEditor({
  systemPrompt = '',
  userPrompt,
  model,
  tools,
  showTest = true,
  showTools = true,
  showTokenCount = true,
  messages = [],
  testResult,
  testError,
  state = 'editing',
  children,
}: PromptEditorProps) {
  const detectedVariables = extractAllVariables(systemPrompt, userPrompt, messages);
  const tokenCount = estimateTokens(systemPrompt, userPrompt, messages);

  return (
    <div
      role="form"
      aria-label="Prompt editor"
      data-surface-widget=""
      data-widget-name="prompt-editor"
      data-part="root"
      data-state={state}
      tabIndex={0}
    >
      {/* System prompt block */}
      <div data-part="system-block">
        <label data-part="block-label">
          <span data-part="role-tag">System</span>
          <textarea
            data-part="system-textarea"
            role="textbox"
            aria-label="System prompt"
            placeholder="System instructions..."
            defaultValue={systemPrompt}
            rows={3}
          />
        </label>
      </div>

      {/* User prompt block */}
      <div data-part="user-block">
        <label data-part="block-label">
          <span data-part="role-tag">User</span>
          <textarea
            data-part="user-textarea"
            role="textbox"
            aria-label="User prompt"
            placeholder="User prompt template..."
            defaultValue={userPrompt}
            rows={5}
          />
        </label>
      </div>

      {/* Additional message blocks */}
      {messages.map((msg, index) => (
        <div key={msg.id} data-part="message-block" data-role={msg.role}>
          <div data-part="message-header">
            <select
              data-part="role-selector"
              defaultValue={msg.role}
              aria-label={`Message ${index + 1} role`}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <div data-part="message-actions">
              <button
                type="button"
                data-part="move-up"
                disabled={index === 0}
                aria-label="Move message up"
              >
                {'\u2191'}
              </button>
              <button
                type="button"
                data-part="move-down"
                disabled={index === messages.length - 1}
                aria-label="Move message down"
              >
                {'\u2193'}
              </button>
              <button
                type="button"
                data-part="remove-message"
                aria-label={`Remove message ${index + 1}`}
              >
                {'\u2715'}
              </button>
            </div>
          </div>
          <textarea
            data-part="message-content"
            role="textbox"
            aria-label={`${ROLE_LABELS[msg.role]} message content`}
            defaultValue={msg.content}
            rows={3}
          />
        </div>
      ))}

      {/* Add message button */}
      <button
        type="button"
        data-part="add-message"
        aria-label="Add message"
      >
        + Add Message
      </button>

      {/* Variable pills */}
      <div data-part="variables" aria-label="Detected template variables">
        {detectedVariables.map((variable) => (
          <span key={variable} data-part="variable-pill" aria-label={`Variable: ${variable}`}>
            {`{{${variable}}}`}
          </span>
        ))}
        {detectedVariables.length === 0 && (
          <span data-part="no-variables">No template variables detected</span>
        )}
      </div>

      {/* Model badge */}
      <div data-part="model">
        <span data-part="model-label">{model}</span>
      </div>

      {/* Token count */}
      {showTokenCount && (
        <span data-part="token-count" role="status" aria-live="polite" data-visible="true">
          ~{tokenCount} tokens
        </span>
      )}

      {/* Test button */}
      {showTest && (
        <button
          type="button"
          data-part="test"
          data-visible="true"
          disabled={state === 'testing'}
          aria-label="Test prompt"
        >
          {state === 'testing' ? 'Testing...' : 'Test Prompt'}
        </button>
      )}

      {/* Test result panel */}
      <div
        data-part="test-panel"
        data-visible={state === 'viewing' ? 'true' : 'false'}
        aria-hidden={state !== 'viewing'}
      >
        {state === 'viewing' && testResult && (
          <div data-part="test-result">
            <div data-part="test-result-header">
              <span>Test Result</span>
              <button
                type="button"
                data-part="edit-button"
                aria-label="Back to editing"
              >
                Edit
              </button>
            </div>
            <pre data-part="test-output">{testResult}</pre>
          </div>
        )}
        {testError && (
          <div data-part="test-error" role="alert">
            {testError}
          </div>
        )}
      </div>

      {/* Tool list */}
      {showTools && tools.length > 0 && (
        <div data-part="tools" data-visible="true" aria-label="Available tools">
          <span data-part="tools-header">Tools ({tools.length})</span>
          <ul data-part="tool-list" role="list">
            {tools.map((tool) => (
              <li key={tool.name} data-part="tool-item" role="listitem">
                <span data-part="tool-name">{tool.name}</span>
                {tool.description && (
                  <span data-part="tool-description">{tool.description}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {children}
    </div>
  );
}

export { PromptEditor };
