/* ---------------------------------------------------------------------------
 * PromptInput — Vanilla implementation
 *
 * Multi-line text input with auto-resize, character counter, submit button,
 * attach button, model selector. Enter to submit, Escape to clear.
 * ------------------------------------------------------------------------- */

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

export interface PromptInputProps {
  [key: string]: unknown;
  className?: string;
  value?: string;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  model?: string;
  models?: string[];
  onSubmit?: (value: string) => void;
  onChange?: (value: string) => void;
  onAttach?: () => void;
  onModelChange?: (model: string) => void;
}
export interface PromptInputOptions { target: HTMLElement; props: PromptInputProps; }

let _promptInputUid = 0;

export class PromptInput {
  private el: HTMLElement;
  private props: PromptInputProps;
  private state: PromptInputState = 'empty';
  private disposers: Array<() => void> = [];
  private currentValue = '';

  constructor(options: PromptInputOptions) {
    this.props = { ...options.props };
    this.currentValue = (this.props.value as string) ?? '';
    if (this.currentValue) this.state = 'composing';
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'prompt-input');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-label', 'Prompt input');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'prompt-input-' + (++_promptInputUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  send(type: string): void {
    this.state = promptInputReducer(this.state, { type } as any);
    this.el.setAttribute('data-state', this.state);
  }

  update(props: Partial<PromptInputProps>): void {
    Object.assign(this.props, props);
    if (props.value !== undefined) this.currentValue = props.value as string;
    this.cleanup();
    this.el.innerHTML = '';
    this.render();
  }

  destroy(): void {
    this.cleanup();
    this.el.remove();
  }

  private cleanup(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
  }

  private render(): void {
    const { placeholder = 'Type a message...', maxLength = 4000, disabled = false, model, models = [] } = this.props;
    this.el.setAttribute('data-state', this.state);
    if (this.props.className) this.el.className = this.props.className;

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.setAttribute('data-part', 'toolbar');

    const attachButton = document.createElement('button');
    attachButton.setAttribute('data-part', 'attach-button');
    attachButton.setAttribute('type', 'button');
    attachButton.setAttribute('aria-label', 'Attach file');
    attachButton.textContent = '\u{1F4CE}';
    const onAttach = () => { this.send('ATTACH'); this.props.onAttach?.(); };
    attachButton.addEventListener('click', onAttach);
    this.disposers.push(() => attachButton.removeEventListener('click', onAttach));
    toolbar.appendChild(attachButton);

    if ((models as string[]).length > 0) {
      const modelSelector = document.createElement('select');
      modelSelector.setAttribute('data-part', 'model-selector');
      modelSelector.setAttribute('aria-label', 'Select model');
      for (const m of (models as string[])) {
        const opt = document.createElement('option');
        opt.value = m; opt.textContent = m;
        if (m === model) opt.selected = true;
        modelSelector.appendChild(opt);
      }
      const onModelChange = () => this.props.onModelChange?.(modelSelector.value);
      modelSelector.addEventListener('change', onModelChange);
      this.disposers.push(() => modelSelector.removeEventListener('change', onModelChange));
      toolbar.appendChild(modelSelector);
    } else if (model) {
      const badge = document.createElement('span');
      badge.setAttribute('data-part', 'model-selector');
      badge.textContent = model;
      toolbar.appendChild(badge);
    }
    this.el.appendChild(toolbar);

    // Textarea
    const textarea = document.createElement('textarea');
    textarea.setAttribute('data-part', 'textarea');
    textarea.setAttribute('role', 'textbox');
    textarea.setAttribute('aria-label', 'Message input');
    textarea.setAttribute('placeholder', placeholder);
    textarea.setAttribute('rows', '1');
    if (maxLength) textarea.setAttribute('maxlength', String(maxLength));
    if (disabled) textarea.setAttribute('disabled', '');
    textarea.value = this.currentValue;

    const autoResize = () => { textarea.style.height = 'auto'; textarea.style.height = textarea.scrollHeight + 'px'; };
    const counter = document.createElement('span');
    counter.setAttribute('data-part', 'counter');
    counter.setAttribute('aria-live', 'polite');
    counter.textContent = `${this.currentValue.length}/${maxLength}`;

    const onInput = () => {
      this.currentValue = textarea.value;
      this.send(this.currentValue ? 'INPUT' : 'CLEAR');
      counter.textContent = `${this.currentValue.length}/${maxLength}`;
      this.props.onChange?.(this.currentValue);
      autoResize();
    };
    textarea.addEventListener('input', onInput);
    this.disposers.push(() => textarea.removeEventListener('input', onInput));

    const doSubmit = () => {
      if (!this.currentValue.trim() || disabled) return;
      this.send('SUBMIT');
      this.props.onSubmit?.(this.currentValue);
      this.currentValue = ''; textarea.value = '';
      this.send('SUBMIT_COMPLETE');
      counter.textContent = `0/${maxLength}`;
      autoResize();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSubmit(); }
      if (e.key === 'Escape') { e.preventDefault(); this.currentValue = ''; textarea.value = ''; this.send('CLEAR'); counter.textContent = `0/${maxLength}`; autoResize(); }
    };
    textarea.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => textarea.removeEventListener('keydown', onKeyDown));
    this.el.appendChild(textarea);
    this.el.appendChild(counter);

    // Submit
    const submitButton = document.createElement('button');
    submitButton.setAttribute('data-part', 'submit-button');
    submitButton.setAttribute('type', 'button');
    submitButton.setAttribute('aria-label', 'Send message');
    submitButton.textContent = 'Send';
    if (disabled || !this.currentValue.trim()) submitButton.setAttribute('disabled', '');
    submitButton.addEventListener('click', doSubmit);
    this.disposers.push(() => submitButton.removeEventListener('click', doSubmit));
    this.el.appendChild(submitButton);

    requestAnimationFrame(autoResize);
  }
}

export default PromptInput;
