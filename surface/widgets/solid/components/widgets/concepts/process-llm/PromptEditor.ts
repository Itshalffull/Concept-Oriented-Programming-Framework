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

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface PromptEditorProps { [key: string]: unknown; class?: string; }
export interface PromptEditorResult { element: HTMLElement; dispose: () => void; }

export function PromptEditor(props: PromptEditorProps): PromptEditorResult {
  const sig = surfaceCreateSignal<PromptEditorState>('editing');
  const state = () => sig.get();
  const send = (type: string) => sig.set(promptEditorReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'prompt-editor');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'form');
  root.setAttribute('aria-label', 'Prompt editor');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* System prompt block */
  const systemBlockEl = document.createElement('div');
  systemBlockEl.setAttribute('data-part', 'system-block');
  const systemLabel = document.createElement('label');
  systemLabel.setAttribute('data-part', 'block-label');
  const systemTag = document.createElement('span');
  systemTag.setAttribute('data-part', 'role-tag');
  systemTag.textContent = 'System';
  systemLabel.appendChild(systemTag);
  const systemTextarea = document.createElement('textarea');
  systemTextarea.setAttribute('data-part', 'system-textarea');
  systemTextarea.setAttribute('role', 'textbox');
  systemTextarea.setAttribute('aria-label', 'System prompt');
  systemTextarea.placeholder = 'System instructions...';
  systemTextarea.rows = 3;
  systemTextarea.addEventListener('input', () => {
    send('INPUT');
    updateTokenCount();
    updateVariablePills();
  });
  systemLabel.appendChild(systemTextarea);
  systemBlockEl.appendChild(systemLabel);
  root.appendChild(systemBlockEl);

  /* User prompt block */
  const userBlockEl = document.createElement('div');
  userBlockEl.setAttribute('data-part', 'user-block');
  const userLabel = document.createElement('label');
  userLabel.setAttribute('data-part', 'block-label');
  const userTag = document.createElement('span');
  userTag.setAttribute('data-part', 'role-tag');
  userTag.textContent = 'User';
  userLabel.appendChild(userTag);
  const userTextarea = document.createElement('textarea');
  userTextarea.setAttribute('data-part', 'user-textarea');
  userTextarea.setAttribute('role', 'textbox');
  userTextarea.setAttribute('aria-label', 'User prompt');
  userTextarea.placeholder = 'User prompt template...';
  userTextarea.rows = 5;
  userTextarea.addEventListener('input', () => {
    send('INPUT');
    updateTokenCount();
    updateVariablePills();
  });
  userLabel.appendChild(userTextarea);
  userBlockEl.appendChild(userLabel);
  root.appendChild(userBlockEl);

  /* Add message button */
  const addMessageBtn = document.createElement('button');
  addMessageBtn.type = 'button';
  addMessageBtn.setAttribute('data-part', 'add-message');
  addMessageBtn.setAttribute('aria-label', 'Add message');
  addMessageBtn.textContent = '+ Add Message';
  root.appendChild(addMessageBtn);

  /* Variable pills */
  const variablePillsEl = document.createElement('div');
  variablePillsEl.setAttribute('data-part', 'variables');
  variablePillsEl.setAttribute('aria-label', 'Detected template variables');
  const noVarsSpan = document.createElement('span');
  noVarsSpan.setAttribute('data-part', 'no-variables');
  noVarsSpan.textContent = 'No template variables detected';
  variablePillsEl.appendChild(noVarsSpan);
  root.appendChild(variablePillsEl);

  function updateVariablePills(): void {
    const allText = systemTextarea.value + userTextarea.value;
    const matches = allText.match(/\{\{(\w+)\}\}/g);
    variablePillsEl.innerHTML = '';
    if (matches && matches.length > 0) {
      const unique = [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
      for (const v of unique) {
        const pill = document.createElement('span');
        pill.setAttribute('data-part', 'variable-pill');
        pill.setAttribute('aria-label', `Variable: ${v}`);
        pill.textContent = `{{${v}}}`;
        variablePillsEl.appendChild(pill);
      }
    } else {
      const nv = document.createElement('span');
      nv.setAttribute('data-part', 'no-variables');
      nv.textContent = 'No template variables detected';
      variablePillsEl.appendChild(nv);
    }
  }

  /* Model badge */
  const modelBadgeEl = document.createElement('div');
  modelBadgeEl.setAttribute('data-part', 'model');
  const modelLabel = document.createElement('span');
  modelLabel.setAttribute('data-part', 'model-label');
  modelLabel.textContent = 'gpt-4';
  modelBadgeEl.appendChild(modelLabel);
  root.appendChild(modelBadgeEl);

  /* Token count */
  const tokenCountEl = document.createElement('span');
  tokenCountEl.setAttribute('data-part', 'token-count');
  tokenCountEl.setAttribute('role', 'status');
  tokenCountEl.setAttribute('aria-live', 'polite');
  tokenCountEl.setAttribute('data-visible', 'true');
  tokenCountEl.textContent = '~0 tokens';
  root.appendChild(tokenCountEl);

  function updateTokenCount(): void {
    const allText = systemTextarea.value + userTextarea.value;
    tokenCountEl.textContent = `~${estimateTokens(allText)} tokens`;
  }

  /* Test button */
  const testBtn = document.createElement('button');
  testBtn.type = 'button';
  testBtn.setAttribute('data-part', 'test');
  testBtn.setAttribute('data-visible', 'true');
  testBtn.setAttribute('aria-label', 'Test prompt');
  testBtn.textContent = 'Test Prompt';
  testBtn.addEventListener('click', () => { send('TEST'); });
  root.appendChild(testBtn);

  /* Test panel */
  const testPanelEl = document.createElement('div');
  testPanelEl.setAttribute('data-part', 'test-panel');
  testPanelEl.setAttribute('data-visible', 'false');
  testPanelEl.setAttribute('aria-hidden', 'true');

  const testResultEl = document.createElement('div');
  testResultEl.setAttribute('data-part', 'test-result');
  testResultEl.style.display = 'none';
  const testResultHeader = document.createElement('div');
  testResultHeader.setAttribute('data-part', 'test-result-header');
  const testResultLabel = document.createElement('span');
  testResultLabel.textContent = 'Test Result';
  testResultHeader.appendChild(testResultLabel);
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.setAttribute('data-part', 'edit-button');
  editBtn.setAttribute('aria-label', 'Back to editing');
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => { send('EDIT'); });
  testResultHeader.appendChild(editBtn);
  testResultEl.appendChild(testResultHeader);
  const testOutput = document.createElement('pre');
  testOutput.setAttribute('data-part', 'test-output');
  testOutput.textContent = '';
  testResultEl.appendChild(testOutput);
  testPanelEl.appendChild(testResultEl);

  const testErrorEl = document.createElement('div');
  testErrorEl.setAttribute('data-part', 'test-error');
  testErrorEl.setAttribute('role', 'alert');
  testErrorEl.style.display = 'none';
  testPanelEl.appendChild(testErrorEl);

  root.appendChild(testPanelEl);

  /* Tool list */
  const toolsEl = document.createElement('div');
  toolsEl.setAttribute('data-part', 'tools');
  toolsEl.setAttribute('data-visible', 'true');
  toolsEl.setAttribute('aria-label', 'Available tools');
  const toolsHeader = document.createElement('span');
  toolsHeader.setAttribute('data-part', 'tools-header');
  toolsHeader.textContent = 'Tools (0)';
  toolsEl.appendChild(toolsHeader);
  const toolListEl = document.createElement('ul');
  toolListEl.setAttribute('data-part', 'tool-list');
  toolListEl.setAttribute('role', 'list');
  toolsEl.appendChild(toolListEl);
  root.appendChild(toolsEl);

  /* Keyboard shortcut: Ctrl+Enter to test */
  root.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      send('TEST');
    }
  });

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    testBtn.disabled = s === 'testing';
    testBtn.textContent = s === 'testing' ? 'Testing...' : 'Test Prompt';
    const showTestPanel = s === 'viewing';
    testPanelEl.setAttribute('data-visible', showTestPanel ? 'true' : 'false');
    testPanelEl.setAttribute('aria-hidden', showTestPanel ? 'false' : 'true');
    testResultEl.style.display = showTestPanel ? 'block' : 'none';
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default PromptEditor;
