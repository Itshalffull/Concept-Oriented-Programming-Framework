import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type PromptTemplateEditorState = 'editing' | 'messageSelected' | 'compiling';
export type PromptTemplateEditorEvent =
  | { type: 'ADD_MESSAGE' }
  | { type: 'REMOVE_MESSAGE' }
  | { type: 'REORDER' }
  | { type: 'COMPILE' }
  | { type: 'SELECT_MESSAGE' }
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

type MessageRole = 'system' | 'user' | 'assistant';

interface TemplateMessage {
  role: MessageRole;
  content: string;
}

interface TemplateVariable {
  name: string;
  type: string;
  defaultValue?: string;
  description?: string;
}

const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

function extractVariables(content: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(VARIABLE_REGEX.source, 'g');
  while ((match = re.exec(content)) !== null) found.add(match[1]);
  return Array.from(found);
}

function extractAllVariables(messages: TemplateMessage[]): string[] {
  const found = new Set<string>();
  for (const msg of messages) for (const v of extractVariables(msg.content)) found.add(v);
  return Array.from(found);
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function resolveTemplate(content: string, values: Record<string, string>): string {
  return content.replace(VARIABLE_REGEX, (full, name) => values[name] !== undefined ? values[name] : full);
}

export interface PromptTemplateEditorProps { [key: string]: unknown; class?: string; }
export interface PromptTemplateEditorResult { element: HTMLElement; dispose: () => void; }

export function PromptTemplateEditor(props: PromptTemplateEditorProps): PromptTemplateEditorResult {
  const sig = surfaceCreateSignal<PromptTemplateEditorState>('editing');
  const send = (event: PromptTemplateEditorEvent) => { sig.set(promptTemplateEditorReducer(sig.get(), event)); };

  const initialMessages = (props.messages ?? [{ role: 'system', content: '' }]) as TemplateMessage[];
  const declaredVariables = (props.variables ?? []) as TemplateVariable[];
  const modelId = props.modelId as string | undefined;
  const showParameters = props.showParameters !== false;
  const showTokenCount = props.showTokenCount !== false;
  const maxMessages = Number(props.maxMessages ?? 20);
  const onMessagesChange = props.onMessagesChange as ((msgs: TemplateMessage[]) => void) | undefined;
  const onCompile = props.onCompile as ((msgs: TemplateMessage[], vars: Record<string, string>) => void) | undefined;

  let messages = [...initialMessages];
  let selectedIndex: number | null = null;
  let previewMode = false;
  const variableValues: Record<string, string> = {};
  let dragIndex: number | null = null;

  const varLookup = new Map<string, TemplateVariable>();
  for (const v of declaredVariables) varLookup.set(v.name, v);

  const getResolvedValues = (): Record<string, string> => {
    const allVarNames = new Set([...extractAllVariables(messages), ...declaredVariables.map(v => v.name)]);
    const result: Record<string, string> = {};
    for (const name of allVarNames) {
      result[name] = variableValues[name] ?? varLookup.get(name)?.defaultValue ?? '';
    }
    return result;
  };

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'prompt-template-editor');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('role', 'form');
  root.setAttribute('aria-label', 'Prompt template editor');
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Toolbar
  const toolbarEl = document.createElement('div');
  toolbarEl.setAttribute('data-part', 'toolbar');
  toolbarEl.setAttribute('data-state', sig.get());
  root.appendChild(toolbarEl);

  const previewToggle = document.createElement('button');
  previewToggle.setAttribute('type', 'button');
  previewToggle.setAttribute('data-part', 'preview-toggle');
  previewToggle.setAttribute('aria-pressed', 'false');
  previewToggle.setAttribute('title', 'Toggle preview (Ctrl+P)');
  previewToggle.textContent = 'Preview';
  toolbarEl.appendChild(previewToggle);

  const compileBtn = document.createElement('button');
  compileBtn.setAttribute('type', 'button');
  compileBtn.setAttribute('data-part', 'compile-button');
  compileBtn.setAttribute('aria-label', 'Compile template (Ctrl+Enter)');
  compileBtn.textContent = 'Compile';
  toolbarEl.appendChild(compileBtn);

  // Message list
  const messageListEl = document.createElement('div');
  messageListEl.setAttribute('data-part', 'message-list');
  messageListEl.setAttribute('data-state', sig.get());
  messageListEl.setAttribute('role', 'list');
  messageListEl.setAttribute('aria-label', 'Template messages');
  root.appendChild(messageListEl);

  // Add button
  const addBtn = document.createElement('button');
  addBtn.setAttribute('type', 'button');
  addBtn.setAttribute('data-part', 'add-button');
  addBtn.setAttribute('data-state', sig.get());
  addBtn.setAttribute('aria-label', 'Add message');
  addBtn.setAttribute('tabindex', '0');
  addBtn.textContent = '+ Add Message';
  root.appendChild(addBtn);

  // Variable panel
  const variablePanelEl = document.createElement('div');
  variablePanelEl.setAttribute('data-part', 'variable-panel');
  variablePanelEl.setAttribute('data-state', sig.get());
  variablePanelEl.setAttribute('role', 'complementary');
  variablePanelEl.setAttribute('aria-label', 'Template variables');
  root.appendChild(variablePanelEl);

  // Parameter panel
  const parameterEl = document.createElement('div');
  parameterEl.setAttribute('data-part', 'parameters');
  parameterEl.setAttribute('data-state', sig.get());
  parameterEl.setAttribute('data-visible', 'true');
  if (!showParameters) parameterEl.style.display = 'none';
  root.appendChild(parameterEl);

  // Token count
  const tokenCountEl = document.createElement('span');
  tokenCountEl.setAttribute('data-part', 'token-count');
  tokenCountEl.setAttribute('data-state', sig.get());
  tokenCountEl.setAttribute('data-visible', 'true');
  tokenCountEl.setAttribute('role', 'status');
  tokenCountEl.setAttribute('aria-live', 'polite');
  if (!showTokenCount) tokenCountEl.style.display = 'none';
  root.appendChild(tokenCountEl);

  const renderMessages = () => {
    messageListEl.innerHTML = '';
    const resolved = getResolvedValues();

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const isSelected = selectedIndex === i;

      const blockEl = document.createElement('div');
      blockEl.setAttribute('data-part', 'message-block');
      blockEl.setAttribute('data-state', sig.get());
      blockEl.setAttribute('data-role', msg.role);
      blockEl.setAttribute('data-selected', isSelected ? 'true' : 'false');
      blockEl.setAttribute('role', 'listitem');
      blockEl.setAttribute('aria-label', `${msg.role} message`);
      blockEl.setAttribute('draggable', 'true');

      blockEl.addEventListener('click', () => {
        selectedIndex = i;
        send({ type: 'SELECT_MESSAGE' });
        renderMessages();
      });

      blockEl.addEventListener('dragstart', () => { dragIndex = i; });
      blockEl.addEventListener('dragover', (e) => { e.preventDefault(); });
      blockEl.addEventListener('drop', () => {
        if (dragIndex === null || dragIndex === i) { dragIndex = null; return; }
        const [moved] = messages.splice(dragIndex, 1);
        messages.splice(i, 0, moved);
        onMessagesChange?.(messages);
        send({ type: 'REORDER' });
        dragIndex = null;
        renderMessages();
      });

      // Reorder handle
      const handleEl = document.createElement('span');
      handleEl.setAttribute('data-part', 'reorder-handle');
      handleEl.setAttribute('aria-hidden', 'true');
      handleEl.style.cursor = 'grab';
      handleEl.style.marginRight = '8px';
      handleEl.style.userSelect = 'none';
      handleEl.innerHTML = '&#x2630;';
      blockEl.appendChild(handleEl);

      // Role selector
      const roleSelect = document.createElement('select');
      roleSelect.setAttribute('data-part', 'role-selector');
      roleSelect.setAttribute('aria-label', `Role for message ${i + 1}`);
      for (const role of ['system', 'user', 'assistant'] as MessageRole[]) {
        const opt = document.createElement('option');
        opt.value = role;
        opt.textContent = role;
        if (role === msg.role) opt.selected = true;
        roleSelect.appendChild(opt);
      }
      roleSelect.addEventListener('change', () => {
        messages[i] = { ...messages[i], role: roleSelect.value as MessageRole };
        onMessagesChange?.(messages);
        renderMessages();
      });
      blockEl.appendChild(roleSelect);

      // Delete button
      const delBtn = document.createElement('button');
      delBtn.setAttribute('type', 'button');
      delBtn.setAttribute('data-part', 'delete-button');
      delBtn.setAttribute('aria-label', `Remove message ${i + 1}`);
      delBtn.disabled = messages.length <= 1;
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (messages.length <= 1) return;
        messages.splice(i, 1);
        onMessagesChange?.(messages);
        if (selectedIndex === i) { selectedIndex = null; send({ type: 'DESELECT' }); }
        else { send({ type: 'REMOVE_MESSAGE' }); }
        renderMessages();
      });
      blockEl.appendChild(delBtn);

      // Content area
      if (previewMode) {
        const previewDiv = document.createElement('div');
        previewDiv.setAttribute('data-part', 'template-preview');
        previewDiv.style.marginTop = '8px';
        previewDiv.style.padding = '8px';
        previewDiv.style.fontFamily = 'monospace';
        previewDiv.style.whiteSpace = 'pre-wrap';
        previewDiv.style.minHeight = '60px';
        previewDiv.textContent = resolveTemplate(msg.content, resolved);
        blockEl.appendChild(previewDiv);
      } else {
        const textarea = document.createElement('textarea');
        textarea.setAttribute('role', 'textbox');
        textarea.setAttribute('aria-label', `Template content for ${msg.role} message ${i + 1}`);
        textarea.setAttribute('data-part', 'template-input');
        textarea.value = msg.content;
        textarea.placeholder = `Enter ${msg.role} prompt template... Use {{variable}} for placeholders`;
        textarea.style.display = 'block';
        textarea.style.width = '100%';
        textarea.style.marginTop = '8px';
        textarea.style.padding = '8px';
        textarea.style.fontFamily = 'monospace';
        textarea.style.minHeight = '80px';
        textarea.style.resize = 'vertical';
        textarea.addEventListener('input', () => {
          messages[i] = { ...messages[i], content: textarea.value };
          onMessagesChange?.(messages);
          updateTokenCount();
          renderVariablePanel();
          renderVariablePills(blockEl, messages[i].content);
        });
        textarea.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newVal = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
            messages[i] = { ...messages[i], content: newVal };
            textarea.value = newVal;
            onMessagesChange?.(messages);
            requestAnimationFrame(() => { textarea.selectionStart = textarea.selectionEnd = start + 2; });
          }
        });
        blockEl.appendChild(textarea);

        // Variable pills
        renderVariablePills(blockEl, msg.content);
      }

      messageListEl.appendChild(blockEl);
    }

    updateTokenCount();
    renderVariablePanel();
  };

  const renderVariablePills = (container: HTMLElement, content: string) => {
    const existing = container.querySelector('[data-part="variable-pills"]');
    if (existing) existing.remove();

    const vars = extractVariables(content);
    if (vars.length === 0 || previewMode) return;

    const pillsDiv = document.createElement('div');
    pillsDiv.setAttribute('data-part', 'variable-pills');
    pillsDiv.setAttribute('data-state', sig.get());
    pillsDiv.style.display = 'flex';
    pillsDiv.style.flexWrap = 'wrap';
    pillsDiv.style.gap = '4px';
    pillsDiv.style.marginTop = '6px';

    for (const varName of vars) {
      const declared = varLookup.get(varName);
      const pill = document.createElement('span');
      pill.setAttribute('data-part', 'variable-pill');
      pill.setAttribute('title', declared?.description ?? `Variable: ${varName}`);
      pill.style.display = 'inline-flex';
      pill.style.alignItems = 'center';
      pill.style.gap = '4px';
      pill.style.padding = '2px 8px';
      pill.style.borderRadius = '12px';
      pill.style.fontSize = '12px';
      pill.textContent = varName;
      if (declared) {
        const typeSpan = document.createElement('span');
        typeSpan.style.opacity = '0.7';
        typeSpan.textContent = `: ${declared.type}`;
        pill.appendChild(typeSpan);
      }
      pillsDiv.appendChild(pill);
    }
    container.appendChild(pillsDiv);
  };

  const renderVariablePanel = () => {
    variablePanelEl.innerHTML = '';
    const allVarNames = new Set([...extractAllVariables(messages), ...declaredVariables.map(v => v.name)]);
    if (allVarNames.size === 0) { variablePanelEl.style.display = 'none'; return; }
    variablePanelEl.style.display = '';

    const heading = document.createElement('h3');
    heading.style.margin = '0 0 8px';
    heading.style.fontSize = '14px';
    heading.style.fontWeight = '600';
    heading.textContent = 'Variables';
    variablePanelEl.appendChild(heading);

    for (const varName of allVarNames) {
      const declared = varLookup.get(varName);
      const row = document.createElement('div');
      row.setAttribute('data-part', 'variable-input-row');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '8px';
      row.style.marginBottom = '8px';

      const label = document.createElement('label');
      label.style.minWidth = '100px';
      label.style.fontFamily = 'monospace';
      label.style.fontSize = '13px';
      label.textContent = `{{${varName}}}`;
      if (declared) {
        const typeLabel = document.createElement('span');
        typeLabel.style.color = '#6b7280';
        typeLabel.style.fontSize = '11px';
        typeLabel.style.marginLeft = '4px';
        typeLabel.textContent = `(${declared.type})`;
        label.appendChild(typeLabel);
      }
      row.appendChild(label);

      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('data-part', 'variable-input');
      input.setAttribute('aria-label', `Value for variable ${varName}`);
      input.value = variableValues[varName] ?? '';
      input.placeholder = declared?.defaultValue ?? '';
      input.style.flex = '1';
      input.style.padding = '4px 8px';
      input.style.fontFamily = 'monospace';
      input.style.fontSize = '13px';
      input.addEventListener('input', () => { variableValues[varName] = input.value; });
      row.appendChild(input);

      if (declared?.description) {
        const helpSpan = document.createElement('span');
        helpSpan.style.color = '#9ca3af';
        helpSpan.style.fontSize = '11px';
        helpSpan.title = declared.description;
        helpSpan.textContent = '?';
        row.appendChild(helpSpan);
      }

      variablePanelEl.appendChild(row);
    }
  };

  const renderParameters = () => {
    parameterEl.innerHTML = '';
    if (!showParameters) return;

    const heading = document.createElement('h3');
    heading.style.margin = '0 0 8px';
    heading.style.fontSize = '14px';
    heading.style.fontWeight = '600';
    heading.textContent = 'Parameters';
    parameterEl.appendChild(heading);

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';

    const label = document.createElement('label');
    label.style.fontSize = '13px';
    label.textContent = 'Model:';
    row.appendChild(label);

    const modelInput = document.createElement('input');
    modelInput.type = 'text';
    modelInput.setAttribute('data-part', 'model-selector');
    modelInput.value = modelId ?? '';
    modelInput.readOnly = true;
    modelInput.style.padding = '4px 8px';
    modelInput.style.fontSize = '13px';
    row.appendChild(modelInput);

    parameterEl.appendChild(row);
  };

  const updateTokenCount = () => {
    if (!showTokenCount) return;
    const totalContent = messages.map(m => m.content).join('\n');
    const charCount = totalContent.length;
    const tokens = estimateTokens(totalContent);
    tokenCountEl.textContent = `${charCount} chars | ~${tokens} tokens`;
  };

  // Event handlers
  previewToggle.addEventListener('click', () => {
    previewMode = !previewMode;
    previewToggle.setAttribute('aria-pressed', String(previewMode));
    previewToggle.textContent = previewMode ? 'Edit' : 'Preview';
    renderMessages();
  });

  compileBtn.addEventListener('click', () => {
    send({ type: 'COMPILE' });
    try {
      onCompile?.(messages, getResolvedValues());
      send({ type: 'COMPILE_COMPLETE' });
    } catch {
      send({ type: 'COMPILE_ERROR' });
    }
  });

  addBtn.addEventListener('click', () => {
    if (messages.length >= maxMessages) return;
    messages.push({ role: 'user', content: '' });
    onMessagesChange?.(messages);
    send({ type: 'ADD_MESSAGE' });
    renderMessages();
  });

  // Keyboard
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'p') { e.preventDefault(); previewToggle.click(); return; }
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); compileBtn.click(); return; }
    if (e.ctrlKey && e.shiftKey && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); addBtn.click(); return; }
    if (e.key === 'Delete' && selectedIndex !== null) {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'TEXTAREA' && target.tagName !== 'INPUT') {
        e.preventDefault();
        if (messages.length > 1) {
          messages.splice(selectedIndex, 1);
          onMessagesChange?.(messages);
          selectedIndex = null;
          send({ type: 'DESELECT' });
          renderMessages();
        }
      }
    }
    if (e.key === 'Escape') { e.preventDefault(); selectedIndex = null; send({ type: 'DESELECT' }); renderMessages(); }
  });

  // Initial render
  renderMessages();
  renderParameters();

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    toolbarEl.setAttribute('data-state', s);
    addBtn.setAttribute('data-state', s);
    compileBtn.disabled = s === 'compiling';
    compileBtn.textContent = s === 'compiling' ? 'Compiling...' : 'Compile';
    addBtn.disabled = messages.length >= maxMessages;
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default PromptTemplateEditor;
