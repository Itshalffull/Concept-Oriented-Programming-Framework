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
  const value = String(props.value ?? '');
  const sig = surfaceCreateSignal<PromptInputState>(value ? 'composing' : 'empty');
  const send = (event: PromptInputEvent) => { sig.set(promptInputReducer(sig.get(), event)); };

  const placeholder = String(props.placeholder ?? 'Type a message...');
  const maxLength = props.maxLength as number | undefined;
  const showModelSelector = props.showModelSelector !== false;
  const showAttach = props.showAttach !== false;
  const disabled = Boolean(props.disabled);
  const onSubmit = props.onSubmit as ((value: string) => void | Promise<void>) | undefined;
  const onChange = props.onChange as ((value: string) => void) | undefined;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'prompt-input');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('data-disabled', disabled ? 'true' : 'false');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Message input');
  if (props.class) root.className = props.class as string;

  // Textarea
  const textareaEl = document.createElement('textarea');
  textareaEl.setAttribute('data-part', 'textarea');
  textareaEl.setAttribute('data-state', sig.get());
  textareaEl.setAttribute('data-empty', value ? 'false' : 'true');
  textareaEl.setAttribute('role', 'textbox');
  textareaEl.setAttribute('aria-multiline', 'true');
  textareaEl.setAttribute('aria-label', 'Type your message');
  textareaEl.placeholder = placeholder;
  textareaEl.value = value;
  if (maxLength != null) textareaEl.maxLength = maxLength;
  textareaEl.rows = 1;
  textareaEl.style.resize = 'none';
  textareaEl.style.overflow = 'auto';
  root.appendChild(textareaEl);

  textareaEl.addEventListener('input', () => {
    const newValue = textareaEl.value;
    onChange?.(newValue);
    if (newValue.length === 0) {
      send({ type: 'CLEAR' });
    } else {
      send({ type: 'INPUT' });
    }
    // Auto-resize
    textareaEl.style.height = 'auto';
    textareaEl.style.height = `${textareaEl.scrollHeight}px`;
  });

  textareaEl.addEventListener('paste', () => {
    if (sig.get() === 'empty') send({ type: 'PASTE' });
  });

  const handleSubmit = async () => {
    if (!textareaEl.value.trim() || disabled || sig.get() === 'submitting') return;
    send({ type: 'SUBMIT' });
    try {
      await onSubmit?.(textareaEl.value);
      send({ type: 'SUBMIT_COMPLETE' });
    } catch {
      send({ type: 'SUBMIT_ERROR' });
    }
  };

  textareaEl.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onChange?.('');
      textareaEl.value = '';
      send({ type: 'CLEAR' });
      return;
    }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      send({ type: 'ATTACH' });
    }
  });

  // Attach button
  if (showAttach) {
    const attachBtn = document.createElement('button');
    attachBtn.setAttribute('type', 'button');
    attachBtn.setAttribute('data-part', 'attach-button');
    attachBtn.setAttribute('data-state', sig.get());
    attachBtn.setAttribute('data-visible', 'true');
    attachBtn.setAttribute('aria-label', 'Attach file');
    attachBtn.setAttribute('tabindex', '0');
    attachBtn.textContent = 'Attach';
    attachBtn.addEventListener('click', () => send({ type: 'ATTACH' }));
    root.appendChild(attachBtn);
  }

  // Model selector
  if (showModelSelector) {
    const modelSelectorEl = document.createElement('div');
    modelSelectorEl.setAttribute('data-part', 'model-selector');
    modelSelectorEl.setAttribute('data-state', sig.get());
    modelSelectorEl.setAttribute('data-visible', 'true');
    root.appendChild(modelSelectorEl);
  }

  // Counter
  const counterEl = document.createElement('span');
  counterEl.setAttribute('data-part', 'counter');
  counterEl.setAttribute('data-state', sig.get());
  counterEl.setAttribute('role', 'status');
  counterEl.setAttribute('aria-live', 'polite');
  counterEl.textContent = `${value.length}${maxLength != null ? ` / ${maxLength}` : ''}`;
  root.appendChild(counterEl);

  // Submit button
  const submitBtn = document.createElement('button');
  submitBtn.setAttribute('type', 'button');
  submitBtn.setAttribute('data-part', 'submit-button');
  submitBtn.setAttribute('data-state', sig.get());
  submitBtn.setAttribute('aria-label', 'Send message');
  submitBtn.setAttribute('tabindex', '0');
  submitBtn.textContent = 'Send';
  submitBtn.addEventListener('click', handleSubmit);
  root.appendChild(submitBtn);

  // Toolbar
  const toolbarEl = document.createElement('div');
  toolbarEl.setAttribute('data-part', 'toolbar');
  toolbarEl.setAttribute('data-state', sig.get());
  toolbarEl.setAttribute('role', 'toolbar');
  root.appendChild(toolbarEl);

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    textareaEl.setAttribute('data-state', s);
    textareaEl.setAttribute('data-empty', s === 'empty' ? 'true' : 'false');
    const isInputDisabled = s === 'submitting' || disabled;
    const isSubmitDisabled = s === 'empty' || s === 'submitting' || disabled;
    textareaEl.disabled = isInputDisabled;
    submitBtn.disabled = isSubmitDisabled;
    submitBtn.setAttribute('aria-disabled', isSubmitDisabled ? 'true' : 'false');
    submitBtn.setAttribute('data-state', s);
    if (s === 'submitting') {
      submitBtn.innerHTML = '<span data-part="spinner" aria-hidden="true"></span>';
    } else {
      submitBtn.textContent = 'Send';
    }
    counterEl.textContent = `${textareaEl.value.length}${maxLength != null ? ` / ${maxLength}` : ''}`;
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default PromptInput;
