/* ---------------------------------------------------------------------------
 * PromptEditor — Vanilla implementation
 *
 * Multi-message prompt template editor for LLM steps with system/user
 * prompt blocks, role selectors, variable pills, token count estimation,
 * test button/panel, and tool list.
 * ------------------------------------------------------------------------- */

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

export interface PromptMessage { id: string; role: 'system' | 'user' | 'assistant'; content: string; }
export interface PromptTool { name: string; description?: string; }

export interface PromptEditorProps {
  [key: string]: unknown; className?: string;
  systemPrompt?: string;
  userPrompt?: string;
  model?: string;
  tools?: PromptTool[];
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
export interface PromptEditorOptions { target: HTMLElement; props: PromptEditorProps; }

let _promptEditorUid = 0;
let _promptMsgId = 0;

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
}

function estimateTokens(text: string): number { return Math.ceil(text.length / 4); }

const ROLE_LABELS: Record<string, string> = { system: 'System', user: 'User', assistant: 'Assistant' };
const ROLES: Array<'system' | 'user' | 'assistant'> = ['system', 'user', 'assistant'];

export class PromptEditor {
  private el: HTMLElement;
  private props: PromptEditorProps;
  private state: PromptEditorState = 'editing';
  private disposers: Array<() => void> = [];
  private systemText = '';
  private userText = '';
  private messages: PromptMessage[] = [];
  private lastTestResult?: string;
  private lastTestError?: string;

  constructor(options: PromptEditorOptions) {
    this.props = { ...options.props };
    this.systemText = (this.props.systemPrompt as string) ?? '';
    this.userText = (this.props.userPrompt as string) ?? '';
    this.messages = [...((this.props.messages ?? []) as PromptMessage[])];
    this.lastTestResult = this.props.testResult as string | undefined;
    this.lastTestError = this.props.testError as string | undefined;
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'prompt-editor');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'form');
    this.el.setAttribute('aria-label', 'Prompt editor');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'prompt-editor-' + (++_promptEditorUid);
    const onKeyDown = (e: KeyboardEvent) => { if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); this.handleTest(); } };
    this.el.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => this.el.removeEventListener('keydown', onKeyDown));
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  send(type: string): void { this.state = promptEditorReducer(this.state, { type } as any); this.el.setAttribute('data-state', this.state); }

  update(props: Partial<PromptEditorProps>): void {
    Object.assign(this.props, props);
    if (props.systemPrompt !== undefined) this.systemText = props.systemPrompt as string;
    if (props.userPrompt !== undefined) this.userText = props.userPrompt as string;
    if (props.messages) this.messages = [...(props.messages as PromptMessage[])];
    if (props.testResult !== undefined && this.state === 'testing') { this.lastTestResult = props.testResult as string; this.send('TEST_COMPLETE'); }
    if (props.testError !== undefined && this.state === 'testing') { this.lastTestError = props.testError as string; this.send('TEST_ERROR'); }
    this.cleanupRender();
    this.el.innerHTML = '';
    this.render();
  }

  destroy(): void { this.cleanup(); this.el.remove(); }
  private cleanup(): void { for (const d of this.disposers) d(); this.disposers = []; }
  private cleanupRender(): void { const kept = this.disposers.slice(0, 1); for (let i = 1; i < this.disposers.length; i++) this.disposers[i](); this.disposers = kept; }
  private rerender(): void { this.cleanupRender(); this.el.innerHTML = ''; this.render(); }

  private get allText(): string { return this.systemText + this.userText + this.messages.map(m => m.content).join(''); }
  private handleTest(): void { this.send('TEST'); this.props.onTest?.(); this.rerender(); }

  private render(): void {
    const model = (this.props.model as string) ?? '';
    const tools = (this.props.tools ?? []) as PromptTool[];
    const showTest = this.props.showTest !== false;
    const showTools = this.props.showTools !== false;
    const showTokenCount = this.props.showTokenCount !== false;
    const tokenCount = estimateTokens(this.allText);
    const detectedVars = extractVariables(this.allText);

    this.el.setAttribute('data-state', this.state);
    if (this.props.className) this.el.className = this.props.className as string;

    // System prompt block
    const systemBlock = document.createElement('div');
    systemBlock.setAttribute('data-part', 'system-block');
    const systemLabel = document.createElement('label');
    systemLabel.setAttribute('data-part', 'block-label');
    const systemTag = document.createElement('span');
    systemTag.setAttribute('data-part', 'role-tag');
    systemTag.textContent = 'System';
    systemLabel.appendChild(systemTag);
    const systemArea = document.createElement('textarea');
    systemArea.setAttribute('data-part', 'system-textarea');
    systemArea.setAttribute('role', 'textbox');
    systemArea.setAttribute('aria-label', 'System prompt');
    systemArea.setAttribute('placeholder', 'System instructions...');
    systemArea.setAttribute('rows', '3');
    systemArea.value = this.systemText;
    const onSystemInput = () => { this.systemText = systemArea.value; this.send('INPUT'); this.props.onSystemPromptChange?.(this.systemText); this.updateTokenCount(); };
    systemArea.addEventListener('input', onSystemInput);
    this.disposers.push(() => systemArea.removeEventListener('input', onSystemInput));
    systemLabel.appendChild(systemArea);
    systemBlock.appendChild(systemLabel);
    this.el.appendChild(systemBlock);

    // User prompt block
    const userBlock = document.createElement('div');
    userBlock.setAttribute('data-part', 'user-block');
    const userLabel = document.createElement('label');
    userLabel.setAttribute('data-part', 'block-label');
    const userTag = document.createElement('span');
    userTag.setAttribute('data-part', 'role-tag');
    userTag.textContent = 'User';
    userLabel.appendChild(userTag);
    const userArea = document.createElement('textarea');
    userArea.setAttribute('data-part', 'user-textarea');
    userArea.setAttribute('role', 'textbox');
    userArea.setAttribute('aria-label', 'User prompt');
    userArea.setAttribute('placeholder', 'User prompt template...');
    userArea.setAttribute('rows', '5');
    userArea.value = this.userText;
    const onUserInput = () => { this.userText = userArea.value; this.send('INPUT'); this.props.onUserPromptChange?.(this.userText); this.updateTokenCount(); };
    userArea.addEventListener('input', onUserInput);
    this.disposers.push(() => userArea.removeEventListener('input', onUserInput));
    userLabel.appendChild(userArea);
    userBlock.appendChild(userLabel);
    this.el.appendChild(userBlock);

    // Additional message blocks
    this.messages.forEach((msg, index) => {
      const block = document.createElement('div');
      block.setAttribute('data-part', 'message-block');
      block.setAttribute('data-role', msg.role);

      const header = document.createElement('div');
      header.setAttribute('data-part', 'message-header');
      const selector = document.createElement('select');
      selector.setAttribute('data-part', 'role-selector');
      selector.setAttribute('aria-label', `Message ${index + 1} role`);
      for (const r of ROLES) { const opt = document.createElement('option'); opt.value = r; opt.textContent = ROLE_LABELS[r]; if (r === msg.role) opt.selected = true; selector.appendChild(opt); }
      const onRoleChange = () => { msg.role = selector.value as any; this.props.onMessagesChange?.([...this.messages]); };
      selector.addEventListener('change', onRoleChange);
      this.disposers.push(() => selector.removeEventListener('change', onRoleChange));
      header.appendChild(selector);

      const actions = document.createElement('div');
      actions.setAttribute('data-part', 'message-actions');
      const moveUp = document.createElement('button');
      moveUp.setAttribute('type', 'button');
      moveUp.setAttribute('data-part', 'move-up');
      moveUp.setAttribute('aria-label', 'Move message up');
      moveUp.textContent = '\u2191';
      if (index === 0) moveUp.setAttribute('disabled', '');
      const onMoveUp = () => { if (index > 0) { [this.messages[index - 1], this.messages[index]] = [this.messages[index], this.messages[index - 1]]; this.props.onMessagesChange?.([...this.messages]); this.rerender(); } };
      moveUp.addEventListener('click', onMoveUp);
      this.disposers.push(() => moveUp.removeEventListener('click', onMoveUp));
      actions.appendChild(moveUp);

      const moveDown = document.createElement('button');
      moveDown.setAttribute('type', 'button');
      moveDown.setAttribute('data-part', 'move-down');
      moveDown.setAttribute('aria-label', 'Move message down');
      moveDown.textContent = '\u2193';
      if (index === this.messages.length - 1) moveDown.setAttribute('disabled', '');
      const onMoveDown = () => { if (index < this.messages.length - 1) { [this.messages[index], this.messages[index + 1]] = [this.messages[index + 1], this.messages[index]]; this.props.onMessagesChange?.([...this.messages]); this.rerender(); } };
      moveDown.addEventListener('click', onMoveDown);
      this.disposers.push(() => moveDown.removeEventListener('click', onMoveDown));
      actions.appendChild(moveDown);

      const removeBtn = document.createElement('button');
      removeBtn.setAttribute('type', 'button');
      removeBtn.setAttribute('data-part', 'remove-message');
      removeBtn.setAttribute('aria-label', `Remove message ${index + 1}`);
      removeBtn.textContent = '\u2715';
      const onRemove = () => { this.messages.splice(index, 1); this.props.onMessagesChange?.([...this.messages]); this.rerender(); };
      removeBtn.addEventListener('click', onRemove);
      this.disposers.push(() => removeBtn.removeEventListener('click', onRemove));
      actions.appendChild(removeBtn);

      header.appendChild(actions);
      block.appendChild(header);

      const contentArea = document.createElement('textarea');
      contentArea.setAttribute('data-part', 'message-content');
      contentArea.setAttribute('role', 'textbox');
      contentArea.setAttribute('aria-label', `${ROLE_LABELS[msg.role]} message content`);
      contentArea.setAttribute('rows', '3');
      contentArea.value = msg.content;
      const onContent = () => { msg.content = contentArea.value; this.send('INPUT'); this.props.onMessagesChange?.([...this.messages]); this.updateTokenCount(); };
      contentArea.addEventListener('input', onContent);
      this.disposers.push(() => contentArea.removeEventListener('input', onContent));
      block.appendChild(contentArea);

      this.el.appendChild(block);
    });

    // Add message button
    const addBtn = document.createElement('button');
    addBtn.setAttribute('type', 'button');
    addBtn.setAttribute('data-part', 'add-message');
    addBtn.setAttribute('aria-label', 'Add message');
    addBtn.textContent = '+ Add Message';
    const onAdd = () => { this.messages.push({ id: `msg-${++_promptMsgId}`, role: 'user', content: '' }); this.props.onMessagesChange?.([...this.messages]); this.rerender(); };
    addBtn.addEventListener('click', onAdd);
    this.disposers.push(() => addBtn.removeEventListener('click', onAdd));
    this.el.appendChild(addBtn);

    // Variable pills
    const varsDiv = document.createElement('div');
    varsDiv.setAttribute('data-part', 'variables');
    varsDiv.setAttribute('aria-label', 'Detected template variables');
    if (detectedVars.length > 0) {
      for (const v of detectedVars) { const pill = document.createElement('span'); pill.setAttribute('data-part', 'variable-pill'); pill.setAttribute('aria-label', `Variable: ${v}`); pill.textContent = `{{${v}}}`; varsDiv.appendChild(pill); }
    } else {
      const noVars = document.createElement('span');
      noVars.setAttribute('data-part', 'no-variables');
      noVars.textContent = 'No template variables detected';
      varsDiv.appendChild(noVars);
    }
    this.el.appendChild(varsDiv);

    // Model badge
    const modelDiv = document.createElement('div');
    modelDiv.setAttribute('data-part', 'model');
    const modelLabel = document.createElement('span');
    modelLabel.setAttribute('data-part', 'model-label');
    modelLabel.textContent = model;
    modelDiv.appendChild(modelLabel);
    this.el.appendChild(modelDiv);

    // Token count
    if (showTokenCount) {
      const tokenSpan = document.createElement('span');
      tokenSpan.setAttribute('data-part', 'token-count');
      tokenSpan.setAttribute('role', 'status');
      tokenSpan.setAttribute('aria-live', 'polite');
      tokenSpan.setAttribute('data-visible', 'true');
      tokenSpan.textContent = `~${tokenCount} tokens`;
      this.el.appendChild(tokenSpan);
    }

    // Test button
    if (showTest) {
      const testBtn = document.createElement('button');
      testBtn.setAttribute('type', 'button');
      testBtn.setAttribute('data-part', 'test');
      testBtn.setAttribute('data-visible', 'true');
      testBtn.setAttribute('aria-label', 'Test prompt');
      testBtn.textContent = this.state === 'testing' ? 'Testing...' : 'Test Prompt';
      if (this.state === 'testing') testBtn.setAttribute('disabled', '');
      const onTestClick = () => this.handleTest();
      testBtn.addEventListener('click', onTestClick);
      this.disposers.push(() => testBtn.removeEventListener('click', onTestClick));
      this.el.appendChild(testBtn);
    }

    // Test result panel
    const testPanel = document.createElement('div');
    testPanel.setAttribute('data-part', 'test-panel');
    testPanel.setAttribute('data-visible', this.state === 'viewing' ? 'true' : 'false');
    testPanel.setAttribute('aria-hidden', String(this.state !== 'viewing'));
    if (this.state === 'viewing' && this.lastTestResult) {
      const resultDiv = document.createElement('div');
      resultDiv.setAttribute('data-part', 'test-result');
      const resultHeader = document.createElement('div');
      resultHeader.setAttribute('data-part', 'test-result-header');
      const resultLabel = document.createElement('span');
      resultLabel.textContent = 'Test Result';
      resultHeader.appendChild(resultLabel);
      const editBtn = document.createElement('button');
      editBtn.setAttribute('type', 'button');
      editBtn.setAttribute('data-part', 'edit-button');
      editBtn.setAttribute('aria-label', 'Back to editing');
      editBtn.textContent = 'Edit';
      const onEdit = () => { this.send('EDIT'); this.rerender(); };
      editBtn.addEventListener('click', onEdit);
      this.disposers.push(() => editBtn.removeEventListener('click', onEdit));
      resultHeader.appendChild(editBtn);
      resultDiv.appendChild(resultHeader);
      const pre = document.createElement('pre');
      pre.setAttribute('data-part', 'test-output');
      pre.textContent = this.lastTestResult;
      resultDiv.appendChild(pre);
      testPanel.appendChild(resultDiv);
    }
    if (this.lastTestError) {
      const errorDiv = document.createElement('div');
      errorDiv.setAttribute('data-part', 'test-error');
      errorDiv.setAttribute('role', 'alert');
      errorDiv.textContent = this.lastTestError;
      testPanel.appendChild(errorDiv);
    }
    this.el.appendChild(testPanel);

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
      const ul = document.createElement('ul');
      ul.setAttribute('data-part', 'tool-list');
      ul.setAttribute('role', 'list');
      for (const tool of tools) {
        const li = document.createElement('li');
        li.setAttribute('data-part', 'tool-item');
        li.setAttribute('role', 'listitem');
        const nameSpan = document.createElement('span');
        nameSpan.setAttribute('data-part', 'tool-name');
        nameSpan.textContent = tool.name;
        li.appendChild(nameSpan);
        if (tool.description) { const descSpan = document.createElement('span'); descSpan.setAttribute('data-part', 'tool-description'); descSpan.textContent = tool.description; li.appendChild(descSpan); }
        ul.appendChild(li);
      }
      toolsDiv.appendChild(ul);
      this.el.appendChild(toolsDiv);
    }
  }

  private updateTokenCount(): void {
    const el = this.el.querySelector('[data-part="token-count"]');
    if (el) el.textContent = `~${estimateTokens(this.allText)} tokens`;
  }
}

export default PromptEditor;
