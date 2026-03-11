export type PromptTemplateEditorState = 'editing' | 'messageSelected' | 'compiling';
export type PromptTemplateEditorEvent =
  | { type: 'ADD_MESSAGE' }
  | { type: 'REMOVE_MESSAGE'; index?: number }
  | { type: 'REORDER'; from?: number; to?: number }
  | { type: 'COMPILE' }
  | { type: 'SELECT_MESSAGE'; index?: number }
  | { type: 'DESELECT' }
  | { type: 'COMPILE_COMPLETE' }
  | { type: 'COMPILE_ERROR' };

export function promptTemplateEditorReducer(state: PromptTemplateEditorState, event: PromptTemplateEditorEvent): PromptTemplateEditorState {
  switch (state) {
    case 'editing':
      if (event.type === 'ADD_MESSAGE') return 'editing';
      if (event.type === 'REMOVE_MESSAGE') return 'editing';
      if (event.type === 'REORDER') return 'editing';
      if (event.type === 'COMPILE') return 'compiling';
      if (event.type === 'SELECT_MESSAGE') return 'messageSelected';
      return state;
    case 'messageSelected':
      if (event.type === 'DESELECT') return 'editing';
      if (event.type === 'SELECT_MESSAGE') return 'messageSelected';
      return state;
    case 'compiling':
      if (event.type === 'COMPILE_COMPLETE') return 'editing';
      if (event.type === 'COMPILE_ERROR') return 'editing';
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
  useRef,
  useEffect,
  useMemo,
  type HTMLAttributes,
  type ReactNode,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';

// --- Types ---

export type MessageRole = 'system' | 'user' | 'assistant';

export interface TemplateMessage {
  role: MessageRole;
  content: string;
}

export interface TemplateVariable {
  name: string;
  type: string;
  defaultValue?: string;
  description?: string;
}

export interface PromptTemplateEditorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Initial messages for the template (array of { role, content }) */
  messages?: TemplateMessage[];
  /** Declared variables with types/defaults */
  variables?: TemplateVariable[];
  /** Selected model identifier */
  modelId?: string | undefined;
  /** Show the parameter panel */
  showParameters?: boolean;
  /** Show the token count display */
  showTokenCount?: boolean;
  /** Maximum number of messages allowed */
  maxMessages?: number;
  /** Callback when messages change */
  onMessagesChange?: (messages: TemplateMessage[]) => void;
  /** Callback when compile is triggered */
  onCompile?: (messages: TemplateMessage[], resolvedVariables: Record<string, string>) => void;
  children?: ReactNode;
}

// --- Helpers ---

const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

/** Extract all unique variable names from a template string */
function extractVariables(content: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(VARIABLE_REGEX.source, 'g');
  while ((match = re.exec(content)) !== null) {
    found.add(match[1]);
  }
  return Array.from(found);
}

/** Extract variables from all messages */
function extractAllVariables(messages: TemplateMessage[]): string[] {
  const found = new Set<string>();
  for (const msg of messages) {
    for (const v of extractVariables(msg.content)) {
      found.add(v);
    }
  }
  return Array.from(found);
}

/** Rough token estimate (~4 chars per token, matching common tokenizer heuristics) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Resolve a template string by replacing {{var}} with provided values */
function resolveTemplate(content: string, values: Record<string, string>): string {
  return content.replace(VARIABLE_REGEX, (full, name) => {
    return values[name] !== undefined ? values[name] : full;
  });
}

/** Render template content with highlighted variable spans */
function renderHighlightedContent(content: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  const re = new RegExp(VARIABLE_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(content)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    // The highlighted variable
    parts.push(
      <span
        key={`var-${match.index}`}
        data-part="variable-highlight"
        style={{
          backgroundColor: 'var(--surface-variable-bg, #dbeafe)',
          color: 'var(--surface-variable-fg, #1e40af)',
          padding: '0 2px',
          borderRadius: '3px',
          fontWeight: 600,
        }}
      >
        {match[0]}
      </span>
    );
    lastIndex = re.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}

// --- Component ---

const PromptTemplateEditor = forwardRef<HTMLDivElement, PromptTemplateEditorProps>(function PromptTemplateEditor(
  {
    messages: initialMessages,
    variables: declaredVariables = [],
    modelId,
    showParameters = true,
    showTokenCount = true,
    maxMessages = 20,
    onMessagesChange,
    onCompile,
    children,
    ...restProps
  },
  ref,
) {
  const [state, send] = useReducer(promptTemplateEditorReducer, 'editing');

  // --- Internal message state ---
  const [messages, setMessages] = useState<TemplateMessage[]>(
    () => initialMessages ?? [{ role: 'system', content: '' }]
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // Sync external messages prop
  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  // Detect all variables across messages + declared variables
  const detectedVarNames = useMemo(() => extractAllVariables(messages), [messages]);
  const allVariableNames = useMemo(() => {
    const set = new Set([...detectedVarNames, ...declaredVariables.map((v) => v.name)]);
    return Array.from(set);
  }, [detectedVarNames, declaredVariables]);

  // Build a lookup from declared variables
  const varLookup = useMemo(() => {
    const map = new Map<string, TemplateVariable>();
    for (const v of declaredVariables) {
      map.set(v.name, v);
    }
    return map;
  }, [declaredVariables]);

  // Resolved variable values (user input -> default -> empty)
  const resolvedValues = useMemo(() => {
    const result: Record<string, string> = {};
    for (const name of allVariableNames) {
      result[name] = variableValues[name] ?? varLookup.get(name)?.defaultValue ?? '';
    }
    return result;
  }, [allVariableNames, variableValues, varLookup]);

  // Total character count and token estimate
  const totalContent = useMemo(() => messages.map((m) => m.content).join('\n'), [messages]);
  const charCount = totalContent.length;
  const tokenCount = estimateTokens(totalContent);

  // --- Callbacks ---

  const updateMessages = useCallback(
    (next: TemplateMessage[]) => {
      setMessages(next);
      onMessagesChange?.(next);
    },
    [onMessagesChange],
  );

  const handleAddMessage = useCallback(() => {
    if (messages.length >= maxMessages) return;
    const next = [...messages, { role: 'user' as MessageRole, content: '' }];
    updateMessages(next);
    send({ type: 'ADD_MESSAGE' });
  }, [messages, maxMessages, updateMessages]);

  const handleRemoveMessage = useCallback(
    (index: number) => {
      if (messages.length <= 1) return;
      const next = messages.filter((_, i) => i !== index);
      updateMessages(next);
      if (selectedIndex === index) {
        setSelectedIndex(null);
        send({ type: 'DESELECT' });
      } else {
        send({ type: 'REMOVE_MESSAGE', index });
      }
    },
    [messages, selectedIndex, updateMessages],
  );

  const handleSelectMessage = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      send({ type: 'SELECT_MESSAGE', index });
      // Focus the textarea for the selected message
      requestAnimationFrame(() => {
        textareaRefs.current[index]?.focus();
      });
    },
    [],
  );

  const handleRoleChange = useCallback(
    (index: number, role: MessageRole) => {
      const next = messages.map((m, i) => (i === index ? { ...m, role } : m));
      updateMessages(next);
    },
    [messages, updateMessages],
  );

  const handleContentChange = useCallback(
    (index: number, content: string) => {
      const next = messages.map((m, i) => (i === index ? { ...m, content } : m));
      updateMessages(next);
    },
    [messages, updateMessages],
  );

  const handleCompile = useCallback(() => {
    send({ type: 'COMPILE' });
    try {
      onCompile?.(messages, resolvedValues);
      send({ type: 'COMPILE_COMPLETE' });
    } catch {
      send({ type: 'COMPILE_ERROR' });
    }
  }, [messages, resolvedValues, onCompile]);

  const togglePreview = useCallback(() => {
    setPreviewMode((p) => !p);
  }, []);

  const handleVariableValueChange = useCallback((name: string, value: string) => {
    setVariableValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Drag-and-drop reorder
  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (targetIndex: number) => {
      if (dragIndex === null || dragIndex === targetIndex) {
        setDragIndex(null);
        return;
      }
      const next = [...messages];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, moved);
      updateMessages(next);
      send({ type: 'REORDER', from: dragIndex, to: targetIndex });
      setDragIndex(null);
    },
    [dragIndex, messages, updateMessages],
  );

  // --- Keyboard handler ---
  const handleRootKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      // Ctrl+P: toggle preview
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        togglePreview();
        return;
      }
      // Ctrl+Enter: compile
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        handleCompile();
        return;
      }
      // Ctrl+Shift+N: add message
      if (e.ctrlKey && e.shiftKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        handleAddMessage();
        return;
      }
      // Delete: remove selected message
      if (e.key === 'Delete' && selectedIndex !== null) {
        // Only act if focus is not inside a textarea
        const target = e.target as HTMLElement;
        if (target.tagName !== 'TEXTAREA' && target.tagName !== 'INPUT') {
          e.preventDefault();
          handleRemoveMessage(selectedIndex);
        }
      }
      // Escape: deselect
      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedIndex(null);
        send({ type: 'DESELECT' });
      }
    },
    [togglePreview, handleCompile, handleAddMessage, handleRemoveMessage, selectedIndex],
  );

  // Handle Tab inside textarea for indentation
  const handleTextareaKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>, index: number) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const value = ta.value;
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        handleContentChange(index, newValue);
        // Restore cursor after React re-render
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
    },
    [handleContentChange],
  );

  // --- Render ---

  return (
    <div
      ref={ref}
      role="form"
      aria-label="Prompt template editor"
      data-surface-widget=""
      data-widget-name="prompt-template-editor"
      data-part="root"
      data-state={state}
      onKeyDown={handleRootKeyDown}
      tabIndex={0}
      {...restProps}
    >
      {/* --- Toolbar --- */}
      <div data-part="toolbar" data-state={state} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <button
          type="button"
          data-part="preview-toggle"
          aria-pressed={previewMode}
          onClick={togglePreview}
          title="Toggle preview (Ctrl+P)"
        >
          {previewMode ? 'Edit' : 'Preview'}
        </button>
        <button
          type="button"
          data-part="compile-button"
          aria-label="Compile template (Ctrl+Enter)"
          onClick={handleCompile}
          disabled={state === 'compiling'}
        >
          {state === 'compiling' ? 'Compiling...' : 'Compile'}
        </button>
      </div>

      {/* --- Message List --- */}
      <div
        data-part="message-list"
        data-state={state}
        role="list"
        aria-label="Template messages"
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            data-part="message-block"
            data-state={state}
            data-role={msg.role}
            data-selected={selectedIndex === index ? 'true' : 'false'}
            role="listitem"
            aria-label={`${msg.role} message`}
            onClick={() => handleSelectMessage(index)}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(index)}
            style={{
              border: selectedIndex === index
                ? '2px solid var(--surface-accent, #3b82f6)'
                : '1px solid var(--surface-border, #e5e7eb)',
              borderRadius: '6px',
              padding: '8px',
              marginBottom: '8px',
            }}
          >
            {/* Reorder handle */}
            <span
              data-part="reorder-handle"
              aria-hidden="true"
              style={{ cursor: 'grab', marginRight: '8px', userSelect: 'none' }}
            >
              &#x2630;
            </span>

            {/* Role selector */}
            <select
              data-part="role-selector"
              value={msg.role}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                handleRoleChange(index, e.target.value as MessageRole)
              }
              aria-label={`Role for message ${index + 1}`}
            >
              <option value="system">system</option>
              <option value="user">user</option>
              <option value="assistant">assistant</option>
            </select>

            {/* Delete button */}
            <button
              type="button"
              data-part="delete-button"
              aria-label={`Remove message ${index + 1}`}
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveMessage(index);
              }}
              disabled={messages.length <= 1}
              style={{ marginLeft: '8px' }}
            >
              Delete
            </button>

            {/* Template input area */}
            {previewMode ? (
              <div
                data-part="template-preview"
                style={{
                  marginTop: '8px',
                  padding: '8px',
                  backgroundColor: 'var(--surface-preview-bg, #f9fafb)',
                  borderRadius: '4px',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  minHeight: '60px',
                }}
              >
                {resolveTemplate(msg.content, resolvedValues)}
              </div>
            ) : (
              <>
                {/* Syntax-highlighted overlay (read-only display layer) */}
                <div
                  data-part="template-input"
                  aria-hidden="true"
                  style={{
                    marginTop: '8px',
                    padding: '8px',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    minHeight: '60px',
                    pointerEvents: 'none',
                    position: 'absolute',
                    inset: 0,
                    // Hidden when textarea is focused; shown as overlay otherwise
                    display: 'none',
                  }}
                >
                  {renderHighlightedContent(msg.content)}
                </div>

                {/* Actual editable textarea */}
                <textarea
                  ref={(el) => { textareaRefs.current[index] = el; }}
                  role="textbox"
                  aria-label={`Template content for ${msg.role} message ${index + 1}`}
                  data-part="template-input"
                  value={msg.content}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    handleContentChange(index, e.target.value)
                  }
                  onKeyDown={(e) => handleTextareaKeyDown(e as unknown as KeyboardEvent<HTMLTextAreaElement>, index)}
                  placeholder={`Enter ${msg.role} prompt template... Use {{variable}} for placeholders`}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: '8px',
                    padding: '8px',
                    fontFamily: 'monospace',
                    minHeight: '80px',
                    resize: 'vertical',
                    border: '1px solid var(--surface-border, #d1d5db)',
                    borderRadius: '4px',
                  }}
                />
              </>
            )}

            {/* Variable pills for this message */}
            {!previewMode && extractVariables(msg.content).length > 0 && (
              <div
                data-part="variable-pills"
                data-state={state}
                style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}
              >
                {extractVariables(msg.content).map((varName) => {
                  const declared = varLookup.get(varName);
                  return (
                    <span
                      key={varName}
                      data-part="variable-pill"
                      title={declared?.description ?? `Variable: ${varName}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        backgroundColor: 'var(--surface-variable-bg, #dbeafe)',
                        color: 'var(--surface-variable-fg, #1e40af)',
                      }}
                    >
                      {varName}
                      {declared && (
                        <span style={{ opacity: 0.7 }}>: {declared.type}</span>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* --- Add Message Button --- */}
      <button
        type="button"
        data-part="add-button"
        data-state={state}
        aria-label="Add message"
        tabIndex={0}
        onClick={handleAddMessage}
        disabled={messages.length >= maxMessages}
      >
        + Add Message
      </button>

      {/* --- Variable Panel (complementary) --- */}
      {allVariableNames.length > 0 && (
        <div
          data-part="variable-panel"
          data-state={state}
          role="complementary"
          aria-label="Template variables"
          style={{
            marginTop: '16px',
            padding: '12px',
            border: '1px solid var(--surface-border, #e5e7eb)',
            borderRadius: '6px',
          }}
        >
          <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600 }}>Variables</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {allVariableNames.map((varName) => {
              const declared = varLookup.get(varName);
              return (
                <div
                  key={varName}
                  data-part="variable-input-row"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <label
                    htmlFor={`var-${varName}`}
                    style={{ minWidth: '100px', fontFamily: 'monospace', fontSize: '13px' }}
                  >
                    {`{{${varName}}}`}
                    {declared && (
                      <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '4px' }}>
                        ({declared.type})
                      </span>
                    )}
                  </label>
                  <input
                    id={`var-${varName}`}
                    type="text"
                    data-part="variable-input"
                    aria-label={`Value for variable ${varName}`}
                    value={variableValues[varName] ?? ''}
                    placeholder={declared?.defaultValue ?? ''}
                    onChange={(e) => handleVariableValueChange(varName, e.target.value)}
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      border: '1px solid var(--surface-border, #d1d5db)',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontSize: '13px',
                    }}
                  />
                  {declared?.description && (
                    <span style={{ color: '#9ca3af', fontSize: '11px' }} title={declared.description}>
                      ?
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- Parameter Panel --- */}
      {showParameters && (
        <div
          data-part="parameters"
          data-state={state}
          data-visible="true"
          style={{
            marginTop: '12px',
            padding: '12px',
            border: '1px solid var(--surface-border, #e5e7eb)',
            borderRadius: '6px',
          }}
        >
          <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600 }}>Parameters</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="pte-model-id" style={{ fontSize: '13px' }}>Model:</label>
            <input
              id="pte-model-id"
              type="text"
              data-part="model-selector"
              value={modelId ?? ''}
              readOnly
              style={{
                padding: '4px 8px',
                border: '1px solid var(--surface-border, #d1d5db)',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            />
          </div>
        </div>
      )}

      {/* --- Token Count --- */}
      {showTokenCount && (
        <span
          data-part="token-count"
          data-state={state}
          data-visible="true"
          role="status"
          aria-live="polite"
          style={{
            display: 'block',
            marginTop: '8px',
            fontSize: '12px',
            color: 'var(--surface-muted, #6b7280)',
          }}
        >
          {charCount} chars | ~{tokenCount} tokens
        </span>
      )}
    </div>
  );
});

PromptTemplateEditor.displayName = 'PromptTemplateEditor';
export { PromptTemplateEditor };
export default PromptTemplateEditor;
