import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type PromptEditorState = 'editing' | 'testing' | 'viewing';
export type PromptEditorEvent =
  | { type: 'TEST' }
  | { type: 'INPUT' }
  | { type: 'TEST_COMPLETE' }
  | { type: 'TEST_ERROR' }
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

/* --- Types --- */

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
  [key: string]: unknown;
  class?: string;
  systemPrompt?: string;
  userPrompt: string;
  model: string;
  tools: PromptTool[];
  showTest?: boolean;
  showTools?: boolean;
  showTokenCount?: boolean;
  messages?: PromptMessage[];
  testResult?: string;
  testError?: string;
  onSystemPromptChange?: (value: string) => void;
  onUserPromptChange?: (value: string) => void;
  onMessagesChange?: (messages: PromptMessage[]) => void;
  onTest?: () => void;
}
export interface PromptEditorResult { element: HTMLElement; dispose: () => void; }

/* --- Helpers --- */

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const ROLE_LABELS: Record<string, string> = { system: 'System', user: 'User', assistant: 'Assistant' };
const ROLES: Array<'system' | 'user' | 'assistant'> = ['system', 'user', 'assistant'];

let nextMsgId = 1;
function generateMsgId(): string { return `msg-${nextMsgId++}`; }

/* --- Component --- */

export function PromptEditor(props: PromptEditorProps): PromptEditorResult {
  const sig = surfaceCreateSignal<PromptEditorState>('editing');
  const send = (type: string) => sig.set(promptEditorReducer(sig.get(), { type } as any));

  const model = (props.model as string) ?? '';
  const tools = (props.tools ?? []) as PromptTool[];
  const showTest = props.showTest !== false;
  const showTools = props.showTools !== false;
  const showTokenCount = props.showTokenCount !== false;
  const onSystemPromptChange = props.onSystemPromptChange as ((v: string) => void) | undefined;
  const onUserPromptChange = props.onUserPromptChange as ((v: string) => void) | undefined;
  const onMessagesChange = props.onMessagesChange as ((msgs: PromptMessage[]) => void) | undefined;
  const onTest = props.onTest as (() => void) | undefined;

  let systemText = (props.systemPrompt as string) ?? '';
  let userText = (props.userPrompt as string) ?? '';
  let messages: PromptMessage[] = (props.messages as PromptMessage[]) ?? [];
  let lastTestResult = props.testResult as string | undefined;
  let lastTestError = props.testError as string | undefined;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'prompt-editor');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'form');
  root.setAttribute('aria-label', 'Prompt editor');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // System prompt block
  const systemBlockEl = document.createElement('div');
  systemBlockEl.setAttribute('data-part', 'system-block');
  root.appendChild(systemBlockEl);

  const systemLabel = document.createElement('label');
  systemLabel.setAttribute('data-part', 'block-label');
  systemBlockEl.appendChild(systemLabel);

  const systemRoleTag = document.createElement('span');
  systemRoleTag.setAttribute('data-part', 'role-tag');
  systemRoleTag.textContent = 'System';
  systemLabel.appendChild(systemRoleTag);

  const systemTextarea = document.createElement('textarea');
  systemTextarea.setAttribute('data-part', 'system-textarea');
  systemTextarea.setAttribute('role', 'textbox');
  systemTextarea.setAttribute('aria-label', 'System prompt');
  systemTextarea.placeholder = 'System instructions...';
  systemTextarea.value = systemText;
  systemTextarea.rows = 3;
  systemTextarea.addEventListener('input', () => {
    systemText = systemTextarea.value;
    send('INPUT');
    onSystemPromptChange?.(systemText);
    updateVariablesAndTokens();
  });
  systemLabel.appendChild(systemTextarea);

  // User prompt block
  const userBlockEl = document.createElement('div');
  userBlockEl.setAttribute('data-part', 'user-block');
  root.appendChild(userBlockEl);

  const userLabel = document.createElement('label');
  userLabel.setAttribute('data-part', 'block-label');
  userBlockEl.appendChild(userLabel);

  const userRoleTag = document.createElement('span');
  userRoleTag.setAttribute('data-part', 'role-tag');
  userRoleTag.textContent = 'User';
  userLabel.appendChild(userRoleTag);

  const userTextarea = document.createElement('textarea');
  userTextarea.setAttribute('data-part', 'user-textarea');
  userTextarea.setAttribute('role', 'textbox');
  userTextarea.setAttribute('aria-label', 'User prompt');
  userTextarea.placeholder = 'User prompt template...';
  userTextarea.value = userText;
  userTextarea.rows = 5;
  userTextarea.addEventListener('input', () => {
    userText = userTextarea.value;
    send('INPUT');
    onUserPromptChange?.(userText);
    updateVariablesAndTokens();
  });
  userLabel.appendChild(userTextarea);

  // Additional messages container
  const messagesContainer = document.createElement('div');
  messagesContainer.setAttribute('data-part', 'messages-container');
  root.appendChild(messagesContainer);

  function rebuildMessages() {
    messagesContainer.innerHTML = '';
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const blockDiv = document.createElement('div');
      blockDiv.setAttribute('data-part', 'message-block');
      blockDiv.setAttribute('data-role', msg.role);

      const headerDiv = document.createElement('div');
      headerDiv.setAttribute('data-part', 'message-header');

      const roleSelect = document.createElement('select');
      roleSelect.setAttribute('data-part', 'role-selector');
      roleSelect.setAttribute('aria-label', `Message ${i + 1} role`);
      roleSelect.value = msg.role;
      for (const r of ROLES) {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = ROLE_LABELS[r];
        if (r === msg.role) opt.selected = true;
        roleSelect.appendChild(opt);
      }
      roleSelect.addEventListener('change', () => {
        messages[i] = { ...messages[i], role: roleSelect.value as PromptMessage['role'] };
        onMessagesChange?.(messages);
      });
      headerDiv.appendChild(roleSelect);

      const actionsDiv = document.createElement('div');
      actionsDiv.setAttribute('data-part', 'message-actions');

      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.setAttribute('data-part', 'move-up');
      upBtn.disabled = i === 0;
      upBtn.setAttribute('aria-label', 'Move message up');
      upBtn.textContent = '\u2191';
      upBtn.addEventListener('click', () => {
        if (i > 0) { [messages[i], messages[i - 1]] = [messages[i - 1], messages[i]]; onMessagesChange?.(messages); rebuildMessages(); }
      });
      actionsDiv.appendChild(upBtn);

      const downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.setAttribute('data-part', 'move-down');
      downBtn.disabled = i === messages.length - 1;
      downBtn.setAttribute('aria-label', 'Move message down');
      downBtn.textContent = '\u2193';
      downBtn.addEventListener('click', () => {
        if (i < messages.length - 1) { [messages[i], messages[i + 1]] = [messages[i + 1], messages[i]]; onMessagesChange?.(messages); rebuildMessages(); }
      });
      actionsDiv.appendChild(downBtn);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.setAttribute('data-part', 'remove-message');
      removeBtn.setAttribute('aria-label', `Remove message ${i + 1}`);
      removeBtn.textContent = '\u2715';
      removeBtn.addEventListener('click', () => {
        messages = messages.filter((m) => m.id !== msg.id);
        onMessagesChange?.(messages);
        rebuildMessages();
        updateVariablesAndTokens();
      });
      actionsDiv.appendChild(removeBtn);

      headerDiv.appendChild(actionsDiv);
      blockDiv.appendChild(headerDiv);

      const contentTextarea = document.createElement('textarea');
      contentTextarea.setAttribute('data-part', 'message-content');
      contentTextarea.setAttribute('role', 'textbox');
      contentTextarea.setAttribute('aria-label', `${ROLE_LABELS[msg.role]} message content`);
      contentTextarea.value = msg.content;
      contentTextarea.rows = 3;
      contentTextarea.addEventListener('input', () => {
        messages[i] = { ...messages[i], content: contentTextarea.value };
        send('INPUT');
        onMessagesChange?.(messages);
        updateVariablesAndTokens();
      });
      blockDiv.appendChild(contentTextarea);

      messagesContainer.appendChild(blockDiv);
    }
  }

  rebuildMessages();

  // Add message button
  const addMsgBtn = document.createElement('button');
  addMsgBtn.type = 'button';
  addMsgBtn.setAttribute('data-part', 'add-message');
  addMsgBtn.setAttribute('aria-label', 'Add message');
  addMsgBtn.textContent = '+ Add Message';
  addMsgBtn.addEventListener('click', () => {
    messages = [...messages, { id: generateMsgId(), role: 'user', content: '' }];
    onMessagesChange?.(messages);
    rebuildMessages();
  });
  root.appendChild(addMsgBtn);

  // Variables
  const variablesDiv = document.createElement('div');
  variablesDiv.setAttribute('data-part', 'variables');
  variablesDiv.setAttribute('aria-label', 'Detected template variables');
  root.appendChild(variablesDiv);

  // Model badge
  const modelDiv = document.createElement('div');
  modelDiv.setAttribute('data-part', 'model');
  const modelLabel = document.createElement('span');
  modelLabel.setAttribute('data-part', 'model-label');
  modelLabel.textContent = model;
  modelDiv.appendChild(modelLabel);
  root.appendChild(modelDiv);

  // Token count
  const tokenCountEl = document.createElement('span');
  tokenCountEl.setAttribute('data-part', 'token-count');
  tokenCountEl.setAttribute('role', 'status');
  tokenCountEl.setAttribute('aria-live', 'polite');
  tokenCountEl.setAttribute('data-visible', 'true');
  if (showTokenCount) root.appendChild(tokenCountEl);

  function getAllText(): string {
    let total = systemText + userText;
    for (const msg of messages) total += msg.content;
    return total;
  }

  function updateVariablesAndTokens() {
    const allText = getAllText();
    const detected = extractVariables(allText);

    variablesDiv.innerHTML = '';
    if (detected.length > 0) {
      for (const v of detected) {
        const pill = document.createElement('span');
        pill.setAttribute('data-part', 'variable-pill');
        pill.setAttribute('aria-label', `Variable: ${v}`);
        pill.textContent = `{{${v}}}`;
        variablesDiv.appendChild(pill);
      }
    } else {
      const noVars = document.createElement('span');
      noVars.setAttribute('data-part', 'no-variables');
      noVars.textContent = 'No template variables detected';
      variablesDiv.appendChild(noVars);
    }

    if (showTokenCount) {
      const tokens = estimateTokens(allText);
      tokenCountEl.textContent = `~${tokens} tokens`;
    }
  }

  updateVariablesAndTokens();

  // Test button
  const testBtn = document.createElement('button');
  testBtn.type = 'button';
  testBtn.setAttribute('data-part', 'test');
  testBtn.setAttribute('data-visible', 'true');
  testBtn.setAttribute('aria-label', 'Test prompt');
  testBtn.textContent = 'Test Prompt';
  testBtn.addEventListener('click', () => {
    send('TEST');
    onTest?.();
  });
  if (showTest) root.appendChild(testBtn);

  // Test panel
  const testPanelEl = document.createElement('div');
  testPanelEl.setAttribute('data-part', 'test-panel');
  testPanelEl.setAttribute('data-visible', 'false');
  testPanelEl.setAttribute('aria-hidden', 'true');
  testPanelEl.style.display = 'none';
  root.appendChild(testPanelEl);

  function rebuildTestPanel() {
    testPanelEl.innerHTML = '';
    if (sig.get() === 'viewing' && lastTestResult) {
      testPanelEl.style.display = '';
      testPanelEl.setAttribute('data-visible', 'true');
      testPanelEl.setAttribute('aria-hidden', 'false');

      const resultDiv = document.createElement('div');
      resultDiv.setAttribute('data-part', 'test-result');

      const headerDiv = document.createElement('div');
      headerDiv.setAttribute('data-part', 'test-result-header');
      const headerSpan = document.createElement('span');
      headerSpan.textContent = 'Test Result';
      headerDiv.appendChild(headerSpan);

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.setAttribute('data-part', 'edit-button');
      editBtn.setAttribute('aria-label', 'Back to editing');
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => send('EDIT'));
      headerDiv.appendChild(editBtn);
      resultDiv.appendChild(headerDiv);

      const pre = document.createElement('pre');
      pre.setAttribute('data-part', 'test-output');
      pre.textContent = lastTestResult;
      resultDiv.appendChild(pre);

      testPanelEl.appendChild(resultDiv);
    } else {
      testPanelEl.style.display = 'none';
      testPanelEl.setAttribute('data-visible', 'false');
      testPanelEl.setAttribute('aria-hidden', 'true');
    }

    if (lastTestError) {
      const errorDiv = document.createElement('div');
      errorDiv.setAttribute('data-part', 'test-error');
      errorDiv.setAttribute('role', 'alert');
      errorDiv.textContent = lastTestError;
      testPanelEl.appendChild(errorDiv);
      testPanelEl.style.display = '';
    }
  }

  // Tool list
  if (showTools && tools.length > 0) {
    const toolsDiv = document.createElement('div');
    toolsDiv.setAttribute('data-part', 'tools');
    toolsDiv.setAttribute('data-visible', 'true');
    toolsDiv.setAttribute('aria-label', 'Available tools');

    const toolsHeader = document.createElement('span');
    toolsHeader.setAttribute('data-part', 'tools-header');
    toolsHeader.textContent = `Tools (${tools.length})`;
    toolsDiv.appendChild(toolsHeader);

    const toolList = document.createElement('ul');
    toolList.setAttribute('data-part', 'tool-list');
    toolList.setAttribute('role', 'list');
    for (const tool of tools) {
      const li = document.createElement('li');
      li.setAttribute('data-part', 'tool-item');
      li.setAttribute('role', 'listitem');
      const nameSpan = document.createElement('span');
      nameSpan.setAttribute('data-part', 'tool-name');
      nameSpan.textContent = tool.name;
      li.appendChild(nameSpan);
      if (tool.description) {
        const descSpan = document.createElement('span');
        descSpan.setAttribute('data-part', 'tool-description');
        descSpan.textContent = tool.description;
        li.appendChild(descSpan);
      }
      toolList.appendChild(li);
    }
    toolsDiv.appendChild(toolList);
    root.appendChild(toolsDiv);
  }

  // Keyboard
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      send('TEST');
      onTest?.();
    }
  });

  // Sync test results from props
  if (props.testResult !== undefined && sig.get() === 'testing') {
    lastTestResult = props.testResult as string;
    send('TEST_COMPLETE');
  }
  if (props.testError !== undefined && sig.get() === 'testing') {
    lastTestError = props.testError as string;
    send('TEST_ERROR');
  }

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    const isEditing = s === 'editing';
    systemTextarea.disabled = !isEditing;
    userTextarea.disabled = !isEditing;
    testBtn.disabled = s === 'testing';
    testBtn.textContent = s === 'testing' ? 'Testing...' : 'Test Prompt';
    rebuildTestPanel();
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default PromptEditor;
