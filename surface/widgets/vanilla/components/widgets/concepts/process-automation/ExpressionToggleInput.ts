/* ---------------------------------------------------------------------------
 * ExpressionToggleInput — Vanilla implementation
 *
 * Dual-mode input switching between fixed-value form widget and expression
 * editor with variable autocomplete and live preview.
 * ------------------------------------------------------------------------- */

export type ExpressionToggleInputState = 'fixed' | 'expression' | 'autocompleting';
export type ExpressionToggleInputEvent =
  | { type: 'TOGGLE' }
  | { type: 'INPUT' }
  | { type: 'SHOW_AC' }
  | { type: 'SELECT' }
  | { type: 'DISMISS' };

export function expressionToggleInputReducer(state: ExpressionToggleInputState, event: ExpressionToggleInputEvent): ExpressionToggleInputState {
  switch (state) {
    case 'fixed':
      if (event.type === 'TOGGLE') return 'expression';
      if (event.type === 'INPUT') return 'fixed';
      return state;
    case 'expression':
      if (event.type === 'TOGGLE') return 'fixed';
      if (event.type === 'INPUT') return 'expression';
      if (event.type === 'SHOW_AC') return 'autocompleting';
      return state;
    case 'autocompleting':
      if (event.type === 'SELECT') return 'expression';
      if (event.type === 'DISMISS') return 'expression';
      return state;
    default:
      return state;
  }
}

export interface ExpressionToggleInputProps {
  [key: string]: unknown; className?: string;
  value?: string;
  fieldType?: 'text' | 'number' | 'boolean' | 'object';
  variables?: string[];
  expression?: string;
  previewValue?: string;
  expressionValid?: boolean;
  onChange?: (value: string) => void;
  onExpressionChange?: (expression: string) => void;
  onToggleMode?: (mode: 'fixed' | 'expression') => void;
}
export interface ExpressionToggleInputOptions { target: HTMLElement; props: ExpressionToggleInputProps; }

let _expressionToggleInputUid = 0;

export class ExpressionToggleInput {
  private el: HTMLElement;
  private props: ExpressionToggleInputProps;
  private state: ExpressionToggleInputState = 'fixed';
  private disposers: Array<() => void> = [];
  private fixedValue = '';
  private expressionValue = '';
  private acQuery = '';
  private acIndex = 0;

  constructor(options: ExpressionToggleInputOptions) {
    this.props = { ...options.props };
    this.fixedValue = (this.props.value as string) ?? '';
    this.expressionValue = (this.props.expression as string) ?? '';
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'expression-toggle-input');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-label', 'Expression toggle input');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'expression-toggle-input-' + (++_expressionToggleInputUid);
    const onKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.el.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => this.el.removeEventListener('keydown', onKeyDown));
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  send(type: string): void { this.state = expressionToggleInputReducer(this.state, { type } as any); this.el.setAttribute('data-state', this.state); }
  update(props: Partial<ExpressionToggleInputProps>): void { Object.assign(this.props, props); if (props.value !== undefined) this.fixedValue = props.value as string; if (props.expression !== undefined) this.expressionValue = props.expression as string; this.cleanupRender(); this.el.innerHTML = ''; this.render(); }
  destroy(): void { this.cleanup(); this.el.remove(); }
  private cleanup(): void { for (const d of this.disposers) d(); this.disposers = []; }
  private cleanupRender(): void { const kept = this.disposers.slice(0, 1); for (let i = 1; i < this.disposers.length; i++) this.disposers[i](); this.disposers = kept; }
  private rerender(): void { this.cleanupRender(); this.el.innerHTML = ''; this.render(); }

  private get isExpressionMode(): boolean { return this.state !== 'fixed'; }
  private get variables(): string[] { return (this.props.variables ?? []) as string[]; }

  private get suggestions(): string[] {
    if (!this.acQuery) return this.variables;
    const q = this.acQuery.toLowerCase();
    return this.variables.filter(v => v.toLowerCase().includes(q));
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.ctrlKey && e.key === 'e') { e.preventDefault(); this.handleToggle(); return; }

    if (this.state === 'autocompleting') {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.acIndex = Math.min(this.acIndex + 1, this.suggestions.length - 1); this.rerender(); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); this.acIndex = Math.max(this.acIndex - 1, 0); this.rerender(); return; }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); const s = this.suggestions[this.acIndex]; if (s) this.handleSelectSuggestion(s); return; }
      if (e.key === 'Escape') { e.preventDefault(); this.send('DISMISS'); this.rerender(); return; }
    }

    if (e.key === 'Escape') { e.preventDefault(); this.send('DISMISS'); this.rerender(); }
  }

  private handleToggle(): void {
    const newMode = this.state === 'fixed' ? 'expression' : 'fixed';
    this.send('TOGGLE');
    this.props.onToggleMode?.(newMode as 'fixed' | 'expression');
    this.rerender();
  }

  private handleSelectSuggestion(variable: string): void {
    const parts = this.expressionValue.split(/[\s()+\-*/,]+/);
    const lastPart = parts[parts.length - 1] ?? '';
    this.expressionValue = this.expressionValue.slice(0, this.expressionValue.length - lastPart.length) + variable;
    this.props.onExpressionChange?.(this.expressionValue);
    this.send('SELECT');
    this.rerender();
  }

  private render(): void {
    const fieldType = (this.props.fieldType as string) ?? 'text';
    this.el.setAttribute('data-state', this.state);
    if (this.props.className) this.el.className = this.props.className as string;

    // Mode toggle
    const toggleBtn = document.createElement('button');
    toggleBtn.setAttribute('type', 'button');
    toggleBtn.setAttribute('data-part', 'mode-toggle');
    toggleBtn.setAttribute('role', 'switch');
    toggleBtn.setAttribute('aria-label', 'Expression mode');
    toggleBtn.setAttribute('aria-checked', String(this.isExpressionMode));
    toggleBtn.textContent = this.isExpressionMode ? 'Expression' : 'Fixed';
    const onToggle = () => this.handleToggle();
    toggleBtn.addEventListener('click', onToggle);
    this.disposers.push(() => toggleBtn.removeEventListener('click', onToggle));
    this.el.appendChild(toggleBtn);

    // Fixed input
    const fixedDiv = document.createElement('div');
    fixedDiv.setAttribute('data-part', 'fixed-input');
    fixedDiv.setAttribute('data-visible', !this.isExpressionMode ? 'true' : 'false');
    fixedDiv.setAttribute('aria-hidden', String(this.isExpressionMode));
    if (!this.isExpressionMode) {
      this.renderFixedInput(fixedDiv, fieldType);
    }
    this.el.appendChild(fixedDiv);

    // Expression input
    const exprDiv = document.createElement('div');
    exprDiv.setAttribute('data-part', 'expression-input');
    exprDiv.setAttribute('data-visible', this.isExpressionMode ? 'true' : 'false');
    exprDiv.setAttribute('aria-hidden', String(!this.isExpressionMode));
    if (this.isExpressionMode) {
      const textarea = document.createElement('textarea');
      textarea.setAttribute('data-part', 'expression-textarea');
      textarea.setAttribute('role', 'textbox');
      textarea.setAttribute('aria-label', 'Expression editor');
      textarea.setAttribute('rows', '3');
      textarea.setAttribute('spellcheck', 'false');
      textarea.value = this.expressionValue;
      const onInput = () => { this.expressionValue = textarea.value; this.send('INPUT'); this.props.onExpressionChange?.(this.expressionValue); this.checkAutocomplete(); };
      textarea.addEventListener('input', onInput);
      this.disposers.push(() => textarea.removeEventListener('input', onInput));
      exprDiv.appendChild(textarea);
    }
    this.el.appendChild(exprDiv);

    // Autocomplete dropdown
    const acDiv = document.createElement('div');
    acDiv.setAttribute('data-part', 'autocomplete');
    acDiv.setAttribute('data-visible', this.state === 'autocompleting' ? 'true' : 'false');
    acDiv.setAttribute('role', 'listbox');
    acDiv.setAttribute('aria-label', 'Variable suggestions');
    if (this.state === 'autocompleting') {
      const sugg = this.suggestions;
      if (sugg.length > 0) {
        sugg.forEach((variable, index) => {
          const item = document.createElement('div');
          item.setAttribute('data-part', 'autocomplete-item');
          item.setAttribute('role', 'option');
          item.setAttribute('aria-selected', String(this.acIndex === index));
          item.setAttribute('data-focused', this.acIndex === index ? 'true' : 'false');
          item.textContent = variable;
          const onClick = () => this.handleSelectSuggestion(variable);
          const onEnter = () => { this.acIndex = index; this.rerender(); };
          item.addEventListener('click', onClick);
          item.addEventListener('mouseenter', onEnter);
          this.disposers.push(() => item.removeEventListener('click', onClick), () => item.removeEventListener('mouseenter', onEnter));
          acDiv.appendChild(item);
        });
      } else {
        const empty = document.createElement('div');
        empty.setAttribute('data-part', 'autocomplete-empty');
        empty.setAttribute('role', 'option');
        empty.setAttribute('aria-disabled', 'true');
        empty.textContent = 'No matching variables';
        acDiv.appendChild(empty);
      }
    }
    this.el.appendChild(acDiv);

    // Preview
    const previewDiv = document.createElement('div');
    previewDiv.setAttribute('data-part', 'preview');
    previewDiv.setAttribute('role', 'status');
    previewDiv.setAttribute('aria-live', 'polite');
    if (this.isExpressionMode && this.props.previewValue !== undefined) {
      const span = document.createElement('span');
      span.setAttribute('data-part', 'preview-value');
      span.setAttribute('data-valid', this.props.expressionValid !== false ? 'true' : 'false');
      span.textContent = this.props.previewValue as string;
      previewDiv.appendChild(span);
    } else if (this.isExpressionMode && this.props.previewValue === undefined && this.expressionValue) {
      const span = document.createElement('span');
      span.setAttribute('data-part', 'preview-placeholder');
      span.textContent = 'Enter expression to preview';
      previewDiv.appendChild(span);
    }
    this.el.appendChild(previewDiv);
  }

  private renderFixedInput(container: HTMLElement, fieldType: string): void {
    switch (fieldType) {
      case 'boolean': {
        const label = document.createElement('label');
        label.setAttribute('data-part', 'boolean-label');
        const checkbox = document.createElement('input');
        checkbox.setAttribute('type', 'checkbox');
        checkbox.setAttribute('data-part', 'fixed-checkbox');
        checkbox.setAttribute('aria-label', 'Fixed boolean value');
        checkbox.checked = this.fixedValue === 'true';
        const onChange = () => { this.fixedValue = String(checkbox.checked); this.send('INPUT'); this.props.onChange?.(this.fixedValue); this.rerender(); };
        checkbox.addEventListener('change', onChange);
        this.disposers.push(() => checkbox.removeEventListener('change', onChange));
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(this.fixedValue === 'true' ? 'true' : 'false'));
        container.appendChild(label);
        break;
      }
      case 'number': {
        const input = document.createElement('input');
        input.setAttribute('type', 'number');
        input.setAttribute('data-part', 'fixed-number');
        input.setAttribute('aria-label', 'Fixed number value');
        input.value = this.fixedValue;
        const onInput = () => { this.fixedValue = input.value; this.send('INPUT'); this.props.onChange?.(this.fixedValue); };
        input.addEventListener('input', onInput);
        this.disposers.push(() => input.removeEventListener('input', onInput));
        container.appendChild(input);
        break;
      }
      case 'object': {
        const textarea = document.createElement('textarea');
        textarea.setAttribute('data-part', 'fixed-object');
        textarea.setAttribute('aria-label', 'Fixed object value (JSON)');
        textarea.setAttribute('rows', '4');
        textarea.value = this.fixedValue;
        const onInput = () => { this.fixedValue = textarea.value; this.send('INPUT'); this.props.onChange?.(this.fixedValue); };
        textarea.addEventListener('input', onInput);
        this.disposers.push(() => textarea.removeEventListener('input', onInput));
        container.appendChild(textarea);
        break;
      }
      case 'text':
      default: {
        const input = document.createElement('input');
        input.setAttribute('type', 'text');
        input.setAttribute('data-part', 'fixed-text');
        input.setAttribute('aria-label', 'Fixed text value');
        input.value = this.fixedValue;
        const onInput = () => { this.fixedValue = input.value; this.send('INPUT'); this.props.onChange?.(this.fixedValue); };
        input.addEventListener('input', onInput);
        this.disposers.push(() => input.removeEventListener('input', onInput));
        container.appendChild(input);
        break;
      }
    }
  }

  private checkAutocomplete(): void {
    const lastWord = this.expressionValue.split(/[\s()+\-*/,]+/).pop() ?? '';
    if (lastWord.length > 0 && this.variables.some(v => v.toLowerCase().startsWith(lastWord.toLowerCase()))) {
      this.acQuery = lastWord;
      this.acIndex = 0;
      this.send('SHOW_AC');
      this.rerender();
    }
  }
}

export default ExpressionToggleInput;
