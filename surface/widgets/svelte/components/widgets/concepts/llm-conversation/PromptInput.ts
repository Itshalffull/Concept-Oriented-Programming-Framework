import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type PromptInputState = 'empty' | 'composing' | 'submitting';
export type PromptInputEvent =
  | { type: 'INPUT' }
  | { type: 'PASTE' }
  | { type: 'ATTACH' }
  | { type: 'CLEAR' }
  | { type: 'SUBMIT' }
  | { type: 'SUBMIT_COMPLETE' }
  | { type: 'SUBMIT_ERROR' };

export function promptInputReducer(state: PromptInputState, event: PromptInputEvent): PromptInputState {
  switch (state) {
    case 'empty':
      if (event.type === 'INPUT') return 'composing';
      if (event.type === 'PASTE') return 'composing';
      if (event.type === 'ATTACH') return 'composing';
      return state;
    case 'composing':
      if (event.type === 'CLEAR') return 'empty';
      if (event.type === 'SUBMIT') return 'submitting';
      return state;
    case 'submitting':
      if (event.type === 'SUBMIT_COMPLETE') return 'empty';
      if (event.type === 'SUBMIT_ERROR') return 'composing';
      return state;
    default:
      return state;
  }
}

export interface PromptInputProps { [key: string]: unknown; class?: string; }
export interface PromptInputResult { element: HTMLElement; dispose: () => void; }

export function PromptInput(props: PromptInputProps): PromptInputResult {
  const sig = surfaceCreateSignal<PromptInputState>('empty');
  const state = () => sig.get();
  const send = (type: string) => sig.set(promptInputReducer(sig.get(), { type } as any));

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'prompt-input');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Message input');
  root.setAttribute('data-state', state());
  if (props.class) root.className = props.class as string;

  const textareaEl = document.createElement('textarea');
  textareaEl.setAttribute('data-part', 'textarea');
  textareaEl.setAttribute('role', 'textbox');
  textareaEl.setAttribute('aria-multiline', 'true');
  textareaEl.setAttribute('aria-label', 'Type your message');
  textareaEl.setAttribute('placeholder', 'Type a message...');
  textareaEl.setAttribute('rows', '1');
  textareaEl.style.resize = 'none';
  textareaEl.style.overflow = 'auto';
  textareaEl.addEventListener('input', () => {
    const val = textareaEl.value;
    if (val.length === 0) {
      send('CLEAR');
    } else {
      send('INPUT');
    }
    textareaEl.style.height = 'auto';
    textareaEl.style.height = `${textareaEl.scrollHeight}px`;
  });
  textareaEl.addEventListener('paste', () => {
    if (sig.get() === 'empty') send('PASTE');
  });
  textareaEl.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (sig.get() === 'composing') send('SUBMIT');
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      textareaEl.value = '';
      send('CLEAR');
    }
  });
  root.appendChild(textareaEl);

  const attachButtonEl = document.createElement('button');
  attachButtonEl.setAttribute('type', 'button');
  attachButtonEl.setAttribute('data-part', 'attach-button');
  attachButtonEl.setAttribute('aria-label', 'Attach file');
  attachButtonEl.setAttribute('tabindex', '0');
  attachButtonEl.textContent = 'Attach';
  attachButtonEl.addEventListener('click', () => send('ATTACH'));
  root.appendChild(attachButtonEl);

  const modelSelectorEl = document.createElement('div');
  modelSelectorEl.setAttribute('data-part', 'model-selector');
  root.appendChild(modelSelectorEl);

  const counterEl = document.createElement('span');
  counterEl.setAttribute('data-part', 'counter');
  counterEl.setAttribute('role', 'status');
  counterEl.setAttribute('aria-live', 'polite');
  counterEl.textContent = '0';
  root.appendChild(counterEl);

  const submitButtonEl = document.createElement('button');
  submitButtonEl.setAttribute('type', 'button');
  submitButtonEl.setAttribute('data-part', 'submit-button');
  submitButtonEl.setAttribute('aria-label', 'Send message');
  submitButtonEl.setAttribute('tabindex', '0');
  submitButtonEl.textContent = 'Send';
  submitButtonEl.addEventListener('click', () => {
    if (sig.get() === 'composing') send('SUBMIT');
  });
  root.appendChild(submitButtonEl);

  const toolbarEl = document.createElement('div');
  toolbarEl.setAttribute('data-part', 'toolbar');
  toolbarEl.setAttribute('role', 'toolbar');
  root.appendChild(toolbarEl);

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    textareaEl.setAttribute('data-state', s);
    textareaEl.setAttribute('data-empty', s === 'empty' ? 'true' : 'false');
    const isInputDisabled = s === 'submitting';
    textareaEl.disabled = isInputDisabled;
    attachButtonEl.disabled = isInputDisabled;
    attachButtonEl.setAttribute('data-state', s);
    submitButtonEl.setAttribute('data-state', s);
    const isSubmitDisabled = s === 'empty' || s === 'submitting';
    submitButtonEl.disabled = isSubmitDisabled;
    submitButtonEl.setAttribute('aria-disabled', isSubmitDisabled ? 'true' : 'false');
    submitButtonEl.textContent = s === 'submitting' ? 'Sending...' : 'Send';
    counterEl.setAttribute('data-state', s);
    counterEl.textContent = String(textareaEl.value.length);
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default PromptInput;
