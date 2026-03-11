/* ---------------------------------------------------------------------------
 * PromptTemplateEditor — Server Component
 *
 * Multi-message prompt template editor with role selection, variable
 * extraction/highlighting, preview mode, drag reorder, and compile.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

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

export interface PromptTemplateEditorProps {
  /** Initial messages for the template. */
  messages?: TemplateMessage[];
  /** Declared variables with types/defaults. */
  variables?: TemplateVariable[];
  /** Selected model identifier. */
  modelId?: string | undefined;
  /** Show the parameter panel. */
  showParameters?: boolean;
  /** Show the token count display. */
  showTokenCount?: boolean;
  /** Maximum number of messages allowed. */
  maxMessages?: number;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

function extractVariables(content: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(VARIABLE_REGEX.source, 'g');
  while ((match = re.exec(content)) !== null) {
    found.add(match[1]);
  }
  return Array.from(found);
}

function extractAllVariables(messages: TemplateMessage[]): string[] {
  const found = new Set<string>();
  for (const msg of messages) {
    for (const v of extractVariables(msg.content)) {
      found.add(v);
    }
  }
  return Array.from(found);
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function renderHighlightedContent(content: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  const re = new RegExp(VARIABLE_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
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

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function PromptTemplateEditor({
  messages: initialMessages,
  variables: declaredVariables = [],
  modelId,
  showParameters = true,
  showTokenCount = true,
  maxMessages = 20,
  children,
}: PromptTemplateEditorProps) {
  const messages = initialMessages ?? [{ role: 'system' as MessageRole, content: '' }];
  const detectedVarNames = extractAllVariables(messages);
  const allVariableNames = Array.from(
    new Set([...detectedVarNames, ...declaredVariables.map((v) => v.name)])
  );

  const varLookup = new Map<string, TemplateVariable>();
  for (const v of declaredVariables) {
    varLookup.set(v.name, v);
  }

  const totalContent = messages.map((m) => m.content).join('\n');
  const charCount = totalContent.length;
  const tokenCount = estimateTokens(totalContent);

  return (
    <div
      role="form"
      aria-label="Prompt template editor"
      data-surface-widget=""
      data-widget-name="prompt-template-editor"
      data-part="root"
      data-state="editing"
      tabIndex={0}
    >
      {/* Toolbar */}
      <div data-part="toolbar" data-state="editing" style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <button
          type="button"
          data-part="preview-toggle"
          aria-pressed={false}
          title="Toggle preview (Ctrl+P)"
        >
          Preview
        </button>
        <button
          type="button"
          data-part="compile-button"
          aria-label="Compile template (Ctrl+Enter)"
        >
          Compile
        </button>
      </div>

      {/* Message List */}
      <div
        data-part="message-list"
        data-state="editing"
        role="list"
        aria-label="Template messages"
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            data-part="message-block"
            data-state="editing"
            data-role={msg.role}
            data-selected="false"
            role="listitem"
            aria-label={`${msg.role} message`}
            style={{
              border: '1px solid var(--surface-border, #e5e7eb)',
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
              defaultValue={msg.role}
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
              disabled={messages.length <= 1}
              style={{ marginLeft: '8px' }}
            >
              Delete
            </button>

            {/* Syntax-highlighted display */}
            <div
              data-part="template-input"
              style={{
                marginTop: '8px',
                padding: '8px',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                minHeight: '60px',
              }}
            >
              {renderHighlightedContent(msg.content)}
            </div>

            {/* Editable textarea */}
            <textarea
              role="textbox"
              aria-label={`Template content for ${msg.role} message ${index + 1}`}
              data-part="template-input"
              defaultValue={msg.content}
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

            {/* Variable pills for this message */}
            {extractVariables(msg.content).length > 0 && (
              <div
                data-part="variable-pills"
                data-state="editing"
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

      {/* Add Message Button */}
      <button
        type="button"
        data-part="add-button"
        data-state="editing"
        aria-label="Add message"
        tabIndex={0}
        disabled={messages.length >= maxMessages}
      >
        + Add Message
      </button>

      {/* Variable Panel */}
      {allVariableNames.length > 0 && (
        <div
          data-part="variable-panel"
          data-state="editing"
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
                    placeholder={declared?.defaultValue ?? ''}
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

      {/* Parameter Panel */}
      {showParameters && (
        <div
          data-part="parameters"
          data-state="editing"
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
              defaultValue={modelId ?? ''}
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

      {/* Token Count */}
      {showTokenCount && (
        <span
          data-part="token-count"
          data-state="editing"
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
}

export { PromptTemplateEditor };
