/* ---------------------------------------------------------------------------
 * PromptEditor — Multi-message prompt template editor for LLM steps
 *
 * Supports role-based message blocks (system, user, assistant), template
 * variables with {{syntax}} highlighting, auto-detected variable pills,
 * token count estimation, and a test panel for previewing prompt output.
 * ------------------------------------------------------------------------- */

export type PromptEditorState = 'editing' | 'testing' | 'viewing';
export type PromptEditorEvent =
  | { type: 'TEST' }
  | { type: 'INPUT' }
  | { type: 'TEST_COMPLETE'; result?: string }
  | { type: 'TEST_ERROR'; error?: string }
  | { type: 'EDIT' };

export function promptEditorReducer(state: PromptEditorState, event: PromptEditorEvent): PromptEditorState {
  switch (state) {
    case 'editing':
      if (event.type === 'TEST') return 'testing';
      if (event.type === 'INPUT') return 'editing';
      return state;
    case 'testing':
      if (event.type === 'TEST_COMPLETE') return 'viewing';
      if (event.type === 'TEST_ERROR') return 'editing';
      return state;
    case 'viewing':
      if (event.type === 'EDIT') return 'editing';
      if (event.type === 'TEST') return 'testing';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useCallback,
  useMemo,
  useReducer,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

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

export interface PromptEditorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** System prompt text */
  systemPrompt?: string | undefined;
  /** User prompt template text */
  userPrompt: string;
  /** Model identifier */
  model: string;
  /** Available tools for the LLM step */
  tools: PromptTool[];
  /** Whether to show the test button and panel */
  showTest?: boolean;
  /** Whether to show the tool list */
  showTools?: boolean;
  /** Whether to show the token count */
  showTokenCount?: boolean;
  /** Additional messages beyond system/user */
  messages?: PromptMessage[];
  /** Test result from the last test run */
  testResult?: string;
  /** Test error message */
  testError?: string;
  /** Called when system prompt changes */
  onSystemPromptChange?: (value: string) => void;
  /** Called when user prompt changes */
  onUserPromptChange?: (value: string) => void;
  /** Called when messages are updated */
  onMessagesChange?: (messages: PromptMessage[]) => void;
  /** Called when test is triggered */
  onTest?: () => void;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

/** Extract {{variable}} references from text */
function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
}

/** Rough token count estimation (~4 chars per token) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const ROLE_LABELS: Record<string, string> = {
  system: 'System',
  user: 'User',
  assistant: 'Assistant',
};

const ROLES: Array<'system' | 'user' | 'assistant'> = ['system', 'user', 'assistant'];

let nextMsgId = 1;
function generateMsgId(): string {
  return `msg-${nextMsgId++}`;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const PromptEditor = forwardRef<HTMLDivElement, PromptEditorProps>(function PromptEditor(
  {
    systemPrompt,
    userPrompt,
    model,
    tools,
    showTest = true,
    showTools = true,
    showTokenCount = true,
    messages: messagesProp,
    testResult,
    testError,
    onSystemPromptChange,
    onUserPromptChange,
    onMessagesChange,
    onTest,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(promptEditorReducer, 'editing');
  const [systemText, setSystemText] = useState(systemPrompt ?? '');
  const [userText, setUserText] = useState(userPrompt);
  const [messages, setMessages] = useState<PromptMessage[]>(messagesProp ?? []);
  const [lastTestResult, setLastTestResult] = useState(testResult);
  const [lastTestError, setLastTestError] = useState(testError);

  // Collect all text for token counting
  const allText = useMemo(() => {
    let total = systemText + userText;
    for (const msg of messages) {
      total += msg.content;
    }
    return total;
  }, [systemText, userText, messages]);

  const tokenCount = useMemo(() => estimateTokens(allText), [allText]);

  // Extract variables from all prompt text
  const detectedVariables = useMemo(() => {
    return extractVariables(allText);
  }, [allText]);

  const handleSystemChange = useCallback((value: string) => {
    setSystemText(value);
    send({ type: 'INPUT' });
    onSystemPromptChange?.(value);
  }, [onSystemPromptChange]);

  const handleUserChange = useCallback((value: string) => {
    setUserText(value);
    send({ type: 'INPUT' });
    onUserPromptChange?.(value);
  }, [onUserPromptChange]);

  const handleMessageContentChange = useCallback((id: string, content: string) => {
    setMessages((prev) => {
      const updated = prev.map((m) => (m.id === id ? { ...m, content } : m));
      onMessagesChange?.(updated);
      return updated;
    });
    send({ type: 'INPUT' });
  }, [onMessagesChange]);

  const handleMessageRoleChange = useCallback((id: string, role: PromptMessage['role']) => {
    setMessages((prev) => {
      const updated = prev.map((m) => (m.id === id ? { ...m, role } : m));
      onMessagesChange?.(updated);
      return updated;
    });
  }, [onMessagesChange]);

  const handleAddMessage = useCallback(() => {
    const newMsg: PromptMessage = { id: generateMsgId(), role: 'user', content: '' };
    setMessages((prev) => {
      const updated = [...prev, newMsg];
      onMessagesChange?.(updated);
      return updated;
    });
  }, [onMessagesChange]);

  const handleRemoveMessage = useCallback((id: string) => {
    setMessages((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      onMessagesChange?.(updated);
      return updated;
    });
  }, [onMessagesChange]);

  const handleMoveMessage = useCallback((id: string, direction: -1 | 1) => {
    setMessages((prev) => {
      const index = prev.findIndex((m) => m.id === id);
      if (index < 0) return prev;
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const updated = [...prev];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      onMessagesChange?.(updated);
      return updated;
    });
  }, [onMessagesChange]);

  const handleTest = useCallback(() => {
    send({ type: 'TEST' });
    onTest?.();
  }, [onTest]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleTest();
    }
  }, [handleTest]);

  // Sync test results from props
  useMemo(() => {
    if (testResult !== undefined && state === 'testing') {
      setLastTestResult(testResult);
      send({ type: 'TEST_COMPLETE', result: testResult });
    }
    if (testError !== undefined && state === 'testing') {
      setLastTestError(testError);
      send({ type: 'TEST_ERROR', error: testError });
    }
  }, [testResult, testError, state]);

  return (
    <div
      ref={ref}
      role="form"
      aria-label="Prompt editor"
      data-surface-widget=""
      data-widget-name="prompt-editor"
      data-part="root"
      data-state={state}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      {...rest}
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
            value={systemText}
            onChange={(e) => handleSystemChange(e.target.value)}
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
            value={userText}
            onChange={(e) => handleUserChange(e.target.value)}
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
              value={msg.role}
              onChange={(e) => handleMessageRoleChange(msg.id, e.target.value as PromptMessage['role'])}
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
                onClick={() => handleMoveMessage(msg.id, -1)}
                aria-label="Move message up"
              >
                {'\u2191'}
              </button>
              <button
                type="button"
                data-part="move-down"
                disabled={index === messages.length - 1}
                onClick={() => handleMoveMessage(msg.id, 1)}
                aria-label="Move message down"
              >
                {'\u2193'}
              </button>
              <button
                type="button"
                data-part="remove-message"
                onClick={() => handleRemoveMessage(msg.id)}
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
            value={msg.content}
            onChange={(e) => handleMessageContentChange(msg.id, e.target.value)}
            rows={3}
          />
        </div>
      ))}

      {/* Add message button */}
      <button
        type="button"
        data-part="add-message"
        onClick={handleAddMessage}
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
          onClick={handleTest}
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
        {state === 'viewing' && lastTestResult && (
          <div data-part="test-result">
            <div data-part="test-result-header">
              <span>Test Result</span>
              <button
                type="button"
                data-part="edit-button"
                onClick={() => send({ type: 'EDIT' })}
                aria-label="Back to editing"
              >
                Edit
              </button>
            </div>
            <pre data-part="test-output">{lastTestResult}</pre>
          </div>
        )}
        {lastTestError && (
          <div data-part="test-error" role="alert">
            {lastTestError}
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
});

PromptEditor.displayName = 'PromptEditor';
export { PromptEditor };
export default PromptEditor;
