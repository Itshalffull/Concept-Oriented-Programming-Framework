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

export interface PromptTemplateEditorProps { [key: string]: unknown; class?: string; }
export interface PromptTemplateEditorResult { element: HTMLElement; dispose: () => void; }

export function PromptTemplateEditor(props: PromptTemplateEditorProps): PromptTemplateEditorResult {
  const sig = surfaceCreateSignal<PromptTemplateEditorState>('editing');
  const state = () => sig.get();
  const send = (type: string) => sig.set(promptTemplateEditorReducer(sig.get(), { type } as any));

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'prompt-template-editor');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'form');
  root.setAttribute('aria-label', 'Prompt template editor');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (sig.get() === 'messageSelected') send('DESELECT');
    }
  });

  const messageListEl = document.createElement('div');
  messageListEl.setAttribute('data-part', 'message-list');
  messageListEl.setAttribute('role', 'list');
  messageListEl.setAttribute('aria-label', 'Template messages');
  root.appendChild(messageListEl);

  const messageBlockEl = document.createElement('div');
  messageBlockEl.setAttribute('data-part', 'message-block');
  messageBlockEl.setAttribute('role', 'listitem');
  messageBlockEl.setAttribute('tabindex', '-1');
  messageBlockEl.addEventListener('click', () => send('SELECT_MESSAGE'));
  messageListEl.appendChild(messageBlockEl);

  const roleSelectorEl = document.createElement('div');
  roleSelectorEl.setAttribute('data-part', 'role-selector');
  messageBlockEl.appendChild(roleSelectorEl);

  const templateInputEl = document.createElement('textarea');
  templateInputEl.setAttribute('data-part', 'template-input');
  templateInputEl.setAttribute('aria-label', 'Message template');
  messageBlockEl.appendChild(templateInputEl);

  const variablePillsEl = document.createElement('div');
  variablePillsEl.setAttribute('data-part', 'variable-pills');
  variablePillsEl.setAttribute('role', 'list');
  variablePillsEl.setAttribute('aria-label', 'Template variables');
  messageBlockEl.appendChild(variablePillsEl);

  const reorderHandleEl = document.createElement('div');
  reorderHandleEl.setAttribute('data-part', 'reorder-handle');
  reorderHandleEl.setAttribute('aria-hidden', 'true');
  reorderHandleEl.style.cursor = 'grab';
  reorderHandleEl.textContent = '\u2630';
  reorderHandleEl.addEventListener('pointerdown', () => send('REORDER'));
  messageBlockEl.appendChild(reorderHandleEl);

  const deleteButtonEl = document.createElement('button');
  deleteButtonEl.setAttribute('type', 'button');
  deleteButtonEl.setAttribute('data-part', 'delete-button');
  deleteButtonEl.setAttribute('aria-label', 'Remove message');
  deleteButtonEl.setAttribute('tabindex', '0');
  deleteButtonEl.textContent = 'Remove';
  deleteButtonEl.addEventListener('click', (e) => { e.stopPropagation(); send('REMOVE_MESSAGE'); });
  messageBlockEl.appendChild(deleteButtonEl);

  const addButtonEl = document.createElement('button');
  addButtonEl.setAttribute('type', 'button');
  addButtonEl.setAttribute('data-part', 'add-button');
  addButtonEl.setAttribute('aria-label', 'Add message');
  addButtonEl.setAttribute('tabindex', '0');
  addButtonEl.textContent = '+ Add Message';
  addButtonEl.addEventListener('click', () => send('ADD_MESSAGE'));
  root.appendChild(addButtonEl);

  const parameterPanelEl = document.createElement('div');
  parameterPanelEl.setAttribute('data-part', 'parameter-panel');
  parameterPanelEl.setAttribute('role', 'complementary');
  parameterPanelEl.setAttribute('aria-label', 'Model parameters');
  root.appendChild(parameterPanelEl);

  const tokenCountEl = document.createElement('span');
  tokenCountEl.setAttribute('data-part', 'token-count');
  tokenCountEl.setAttribute('aria-label', 'Token count');
  root.appendChild(tokenCountEl);

  const compileButtonEl = document.createElement('button');
  compileButtonEl.setAttribute('type', 'button');
  compileButtonEl.setAttribute('data-part', 'compile-button');
  compileButtonEl.setAttribute('aria-label', 'Compile template');
  compileButtonEl.setAttribute('tabindex', '0');
  compileButtonEl.textContent = 'Compile';
  compileButtonEl.addEventListener('click', () => send('COMPILE'));
  root.appendChild(compileButtonEl);

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    messageBlockEl.setAttribute('data-selected', s === 'messageSelected' ? 'true' : 'false');
    compileButtonEl.disabled = s === 'compiling';
    compileButtonEl.textContent = s === 'compiling' ? 'Compiling...' : 'Compile';
    compileButtonEl.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default PromptTemplateEditor;
