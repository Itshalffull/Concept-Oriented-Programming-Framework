/* ---------------------------------------------------------------------------
 * PromptTemplateEditor — Vanilla implementation
 *
 * Multi-message prompt template editor with role selectors, variable pills,
 * token count estimation, add/remove/reorder messages, and compile button.
 * ------------------------------------------------------------------------- */

export type PromptTemplateEditorState = 'editing' | 'messageSelected' | 'compiling';
export type PromptTemplateEditorEvent = | { type: 'ADD_MESSAGE' } | { type: 'REMOVE_MESSAGE' } | { type: 'REORDER' } | { type: 'COMPILE' } | { type: 'SELECT_MESSAGE' } | { type: 'DESELECT' } | { type: 'COMPILE_COMPLETE' } | { type: 'COMPILE_ERROR' };

export function promptTemplateEditorReducer(state: PromptTemplateEditorState, event: PromptTemplateEditorEvent): PromptTemplateEditorState {
  switch (state) {
    case 'editing': if (event.type === 'COMPILE') return 'compiling'; if (event.type === 'SELECT_MESSAGE') return 'messageSelected'; return state;
    case 'messageSelected': if (event.type === 'DESELECT') return 'editing'; if (event.type === 'SELECT_MESSAGE') return 'messageSelected'; return state;
    case 'compiling': if (event.type === 'COMPILE_COMPLETE' || event.type === 'COMPILE_ERROR') return 'editing'; return state;
    default: return state;
  }
}

export interface TemplateMessage { id: string; role: 'system' | 'user' | 'assistant'; content: string; }

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
}

function estimateTokens(text: string): number { return Math.ceil(text.length / 4); }

export interface PromptTemplateEditorProps {
  [key: string]: unknown; className?: string;
  messages?: TemplateMessage[];
  onMessagesChange?: (messages: TemplateMessage[]) => void;
  onCompile?: () => void;
}
export interface PromptTemplateEditorOptions { target: HTMLElement; props: PromptTemplateEditorProps; }

let _promptTemplateEditorUid = 0;
let _msgId = 0;

export class PromptTemplateEditor {
  private el: HTMLElement;
  private props: PromptTemplateEditorProps;
  private state: PromptTemplateEditorState = 'editing';
  private disposers: Array<() => void> = [];
  private messages: TemplateMessage[] = [];

  constructor(options: PromptTemplateEditorOptions) {
    this.props = { ...options.props };
    this.messages = [...((this.props.messages ?? []) as TemplateMessage[])];
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'prompt-template-editor');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'form');
    this.el.setAttribute('aria-label', 'Prompt template editor');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'prompt-template-editor-' + (++_promptTemplateEditorUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  send(type: string): void { this.state = promptTemplateEditorReducer(this.state, { type } as any); this.el.setAttribute('data-state', this.state); }
  update(props: Partial<PromptTemplateEditorProps>): void { Object.assign(this.props, props); if (props.messages) this.messages = [...(props.messages as TemplateMessage[])]; this.cleanup(); this.el.innerHTML = ''; this.render(); }
  destroy(): void { this.cleanup(); this.el.remove(); }
  private cleanup(): void { for (const d of this.disposers) d(); this.disposers = []; }
  private rerender(): void { this.cleanup(); this.el.innerHTML = ''; this.render(); }

  private render(): void {
    this.el.setAttribute('data-state', this.state);
    if (this.props.className) this.el.className = this.props.className;
    const allText = this.messages.map(m => m.content).join('');

    // Message list
    const messageList = document.createElement('div');
    messageList.setAttribute('data-part', 'message-list');
    messageList.setAttribute('role', 'list');
    this.messages.forEach((msg, index) => {
      const block = document.createElement('div');
      block.setAttribute('data-part', 'message-block');
      block.setAttribute('data-role', msg.role);
      block.setAttribute('role', 'listitem');

      const roleSelector = document.createElement('select');
      roleSelector.setAttribute('data-part', 'role-selector');
      roleSelector.setAttribute('aria-label', `Message ${index + 1} role`);
      for (const r of ['system', 'user', 'assistant']) {
        const opt = document.createElement('option');
        opt.value = r; opt.textContent = r.charAt(0).toUpperCase() + r.slice(1);
        if (r === msg.role) opt.selected = true;
        roleSelector.appendChild(opt);
      }
      const onRoleChange = () => { msg.role = roleSelector.value as any; this.props.onMessagesChange?.([...this.messages]); };
      roleSelector.addEventListener('change', onRoleChange);
      this.disposers.push(() => roleSelector.removeEventListener('change', onRoleChange));
      block.appendChild(roleSelector);

      const input = document.createElement('textarea');
      input.setAttribute('data-part', 'template-input');
      input.setAttribute('aria-label', `${msg.role} message content`);
      input.setAttribute('rows', '3');
      input.value = msg.content;
      const onInput = () => { msg.content = input.value; this.props.onMessagesChange?.([...this.messages]); this.updateFooter(); };
      input.addEventListener('input', onInput);
      this.disposers.push(() => input.removeEventListener('input', onInput));
      block.appendChild(input);

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.setAttribute('data-part', 'delete-button');
      deleteBtn.setAttribute('type', 'button');
      deleteBtn.setAttribute('aria-label', `Remove message ${index + 1}`);
      deleteBtn.textContent = '\u2715';
      const onDelete = () => { this.messages.splice(index, 1); this.send('REMOVE_MESSAGE'); this.props.onMessagesChange?.([...this.messages]); this.rerender(); };
      deleteBtn.addEventListener('click', onDelete);
      this.disposers.push(() => deleteBtn.removeEventListener('click', onDelete));
      block.appendChild(deleteBtn);

      messageList.appendChild(block);
    });
    this.el.appendChild(messageList);

    // Add button
    const addBtn = document.createElement('button');
    addBtn.setAttribute('data-part', 'add-button');
    addBtn.setAttribute('type', 'button');
    addBtn.textContent = '+ Add Message';
    const onAdd = () => { this.messages.push({ id: `msg-${++_msgId}`, role: 'user', content: '' }); this.send('ADD_MESSAGE'); this.props.onMessagesChange?.([...this.messages]); this.rerender(); };
    addBtn.addEventListener('click', onAdd);
    this.disposers.push(() => addBtn.removeEventListener('click', onAdd));
    this.el.appendChild(addBtn);

    // Variable pills
    const vars = extractVariables(allText);
    const pills = document.createElement('div');
    pills.setAttribute('data-part', 'variable-pills');
    pills.setAttribute('aria-label', 'Detected variables');
    if (vars.length > 0) {
      for (const v of vars) { const pill = document.createElement('span'); pill.setAttribute('data-part', 'variable-pill'); pill.textContent = `{{${v}}}`; pills.appendChild(pill); }
    } else {
      const none = document.createElement('span');
      none.textContent = 'No template variables detected';
      pills.appendChild(none);
    }
    this.el.appendChild(pills);

    // Token count
    const tokenCount = document.createElement('span');
    tokenCount.setAttribute('data-part', 'token-count');
    tokenCount.setAttribute('role', 'status');
    tokenCount.textContent = `~${estimateTokens(allText)} tokens`;
    this.el.appendChild(tokenCount);

    // Compile button
    const compileBtn = document.createElement('button');
    compileBtn.setAttribute('data-part', 'compile-button');
    compileBtn.setAttribute('type', 'button');
    compileBtn.textContent = this.state === 'compiling' ? 'Compiling...' : 'Compile';
    if (this.state === 'compiling') compileBtn.setAttribute('disabled', '');
    const onCompile = () => { this.send('COMPILE'); this.props.onCompile?.(); };
    compileBtn.addEventListener('click', onCompile);
    this.disposers.push(() => compileBtn.removeEventListener('click', onCompile));
    this.el.appendChild(compileBtn);
  }

  private updateFooter(): void {
    const allText = this.messages.map(m => m.content).join('');
    const tc = this.el.querySelector('[data-part="token-count"]');
    if (tc) tc.textContent = `~${estimateTokens(allText)} tokens`;
  }
}

export default PromptTemplateEditor;
