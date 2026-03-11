import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

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

/* --- Types --- */

export interface ExpressionToggleInputProps {
  [key: string]: unknown;
  class?: string;
  value: string;
  mode: string;
  fieldType?: 'text' | 'number' | 'boolean' | 'object';
  variables?: string[];
  expression?: string;
  previewValue?: string;
  expressionValid?: boolean;
  onChange?: (value: string) => void;
  onExpressionChange?: (expression: string) => void;
  onToggleMode?: (mode: 'fixed' | 'expression') => void;
}
export interface ExpressionToggleInputResult { element: HTMLElement; dispose: () => void; }

/* --- Component --- */

export function ExpressionToggleInput(props: ExpressionToggleInputProps): ExpressionToggleInputResult {
  const sig = surfaceCreateSignal<ExpressionToggleInputState>('fixed');
  const send = (type: string) => sig.set(expressionToggleInputReducer(sig.get(), { type } as any));

  const fieldType = (props.fieldType as string) ?? 'text';
  const variables = (props.variables ?? []) as string[];
  const onChange = props.onChange as ((v: string) => void) | undefined;
  const onExpressionChange = props.onExpressionChange as ((v: string) => void) | undefined;
  const onToggleMode = props.onToggleMode as ((m: 'fixed' | 'expression') => void) | undefined;

  let fixedValue = (props.value as string) ?? '';
  let expressionValue = (props.expression as string) ?? '';
  let acQuery = '';
  let acIndex = 0;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'expression-toggle-input');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Expression toggle input');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Mode toggle
  const modeToggleEl = document.createElement('button');
  modeToggleEl.type = 'button';
  modeToggleEl.setAttribute('data-part', 'mode-toggle');
  modeToggleEl.setAttribute('role', 'switch');
  modeToggleEl.setAttribute('aria-label', 'Expression mode');
  modeToggleEl.setAttribute('aria-checked', 'false');
  modeToggleEl.textContent = 'Fixed';
  modeToggleEl.addEventListener('click', () => {
    const newMode = sig.get() === 'fixed' ? 'expression' : 'fixed';
    send('TOGGLE');
    onToggleMode?.(newMode as 'fixed' | 'expression');
  });
  root.appendChild(modeToggleEl);

  // Fixed input container
  const fixedDiv = document.createElement('div');
  fixedDiv.setAttribute('data-part', 'fixed-input');
  fixedDiv.setAttribute('data-visible', 'true');
  root.appendChild(fixedDiv);

  // Build fixed input based on fieldType
  let fixedInputEl: HTMLInputElement | HTMLTextAreaElement;
  if (fieldType === 'boolean') {
    const label = document.createElement('label');
    label.setAttribute('data-part', 'boolean-label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('data-part', 'fixed-checkbox');
    checkbox.checked = fixedValue === 'true';
    checkbox.setAttribute('aria-label', 'Fixed boolean value');
    checkbox.addEventListener('change', () => {
      fixedValue = String(checkbox.checked);
      send('INPUT');
      onChange?.(fixedValue);
      boolLabel.textContent = fixedValue;
    });
    label.appendChild(checkbox);
    const boolLabel = document.createTextNode(fixedValue === 'true' ? 'true' : 'false');
    label.appendChild(boolLabel);
    fixedDiv.appendChild(label);
    fixedInputEl = checkbox as any;
  } else if (fieldType === 'number') {
    fixedInputEl = document.createElement('input');
    fixedInputEl.type = 'number';
    fixedInputEl.setAttribute('data-part', 'fixed-number');
    (fixedInputEl as HTMLInputElement).value = fixedValue;
    fixedInputEl.setAttribute('aria-label', 'Fixed number value');
    fixedInputEl.addEventListener('input', () => {
      fixedValue = (fixedInputEl as HTMLInputElement).value;
      send('INPUT');
      onChange?.(fixedValue);
    });
    fixedDiv.appendChild(fixedInputEl);
  } else if (fieldType === 'object') {
    fixedInputEl = document.createElement('textarea');
    fixedInputEl.setAttribute('data-part', 'fixed-object');
    (fixedInputEl as HTMLTextAreaElement).value = fixedValue;
    fixedInputEl.setAttribute('aria-label', 'Fixed object value (JSON)');
    (fixedInputEl as HTMLTextAreaElement).rows = 4;
    fixedInputEl.addEventListener('input', () => {
      fixedValue = (fixedInputEl as HTMLTextAreaElement).value;
      send('INPUT');
      onChange?.(fixedValue);
    });
    fixedDiv.appendChild(fixedInputEl);
  } else {
    fixedInputEl = document.createElement('input');
    fixedInputEl.type = 'text';
    fixedInputEl.setAttribute('data-part', 'fixed-text');
    (fixedInputEl as HTMLInputElement).value = fixedValue;
    fixedInputEl.setAttribute('aria-label', 'Fixed text value');
    fixedInputEl.addEventListener('input', () => {
      fixedValue = (fixedInputEl as HTMLInputElement).value;
      send('INPUT');
      onChange?.(fixedValue);
    });
    fixedDiv.appendChild(fixedInputEl);
  }

  // Expression input container
  const exprDiv = document.createElement('div');
  exprDiv.setAttribute('data-part', 'expression-input');
  exprDiv.setAttribute('data-visible', 'false');
  exprDiv.setAttribute('aria-hidden', 'true');
  exprDiv.style.display = 'none';
  root.appendChild(exprDiv);

  const exprTextarea = document.createElement('textarea');
  exprTextarea.setAttribute('data-part', 'expression-textarea');
  exprTextarea.setAttribute('role', 'textbox');
  exprTextarea.setAttribute('aria-label', 'Expression editor');
  exprTextarea.value = expressionValue;
  exprTextarea.rows = 3;
  exprTextarea.spellcheck = false;
  exprTextarea.addEventListener('input', () => {
    expressionValue = exprTextarea.value;
    send('INPUT');
    onExpressionChange?.(expressionValue);
    // Detect variable reference
    const lastWord = expressionValue.split(/[\s()+\-*/,]+/).pop() ?? '';
    if (lastWord.length > 0 && variables.some((v) => v.toLowerCase().startsWith(lastWord.toLowerCase()))) {
      acQuery = lastWord;
      acIndex = 0;
      send('SHOW_AC');
      rebuildAutocomplete();
    }
  });
  exprDiv.appendChild(exprTextarea);

  // Autocomplete dropdown
  const acEl = document.createElement('div');
  acEl.setAttribute('data-part', 'autocomplete');
  acEl.setAttribute('data-visible', 'false');
  acEl.setAttribute('role', 'listbox');
  acEl.setAttribute('aria-label', 'Variable suggestions');
  acEl.style.display = 'none';
  root.appendChild(acEl);

  function getSuggestions(): string[] {
    if (!acQuery) return variables;
    const q = acQuery.toLowerCase();
    return variables.filter((v) => v.toLowerCase().includes(q));
  }

  function rebuildAutocomplete() {
    acEl.innerHTML = '';
    const suggestions = getSuggestions();
    if (suggestions.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.setAttribute('data-part', 'autocomplete-empty');
      emptyDiv.setAttribute('role', 'option');
      emptyDiv.setAttribute('aria-disabled', 'true');
      emptyDiv.textContent = 'No matching variables';
      acEl.appendChild(emptyDiv);
      return;
    }
    for (let i = 0; i < suggestions.length; i++) {
      const item = document.createElement('div');
      item.setAttribute('data-part', 'autocomplete-item');
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', acIndex === i ? 'true' : 'false');
      item.setAttribute('data-focused', acIndex === i ? 'true' : 'false');
      item.textContent = suggestions[i];
      item.addEventListener('click', () => selectSuggestion(suggestions[i]));
      item.addEventListener('mouseenter', () => { acIndex = i; rebuildAutocomplete(); });
      acEl.appendChild(item);
    }
  }

  function selectSuggestion(variable: string) {
    const parts = expressionValue.split(/[\s()+\-*/,]+/);
    const lastPart = parts[parts.length - 1] ?? '';
    expressionValue = expressionValue.slice(0, expressionValue.length - lastPart.length) + variable;
    exprTextarea.value = expressionValue;
    onExpressionChange?.(expressionValue);
    send('SELECT');
    exprTextarea.focus();
  }

  // Preview
  const previewEl = document.createElement('div');
  previewEl.setAttribute('data-part', 'preview');
  previewEl.setAttribute('role', 'status');
  previewEl.setAttribute('aria-live', 'polite');
  root.appendChild(previewEl);

  function updatePreview() {
    previewEl.innerHTML = '';
    const isExpr = sig.get() !== 'fixed';
    if (isExpr && props.previewValue !== undefined) {
      const span = document.createElement('span');
      span.setAttribute('data-part', 'preview-value');
      span.setAttribute('data-valid', props.expressionValid !== false ? 'true' : 'false');
      span.textContent = props.previewValue as string;
      previewEl.appendChild(span);
    } else if (isExpr && expressionValue) {
      const span = document.createElement('span');
      span.setAttribute('data-part', 'preview-placeholder');
      span.textContent = 'Enter expression to preview';
      previewEl.appendChild(span);
    }
  }

  // Keyboard
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'e') {
      e.preventDefault();
      const newMode = sig.get() === 'fixed' ? 'expression' : 'fixed';
      send('TOGGLE');
      onToggleMode?.(newMode as 'fixed' | 'expression');
      return;
    }
    if (sig.get() === 'autocompleting') {
      const suggestions = getSuggestions();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        acIndex = Math.min(acIndex + 1, suggestions.length - 1);
        rebuildAutocomplete();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        acIndex = Math.max(acIndex - 1, 0);
        rebuildAutocomplete();
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        if (suggestions[acIndex]) selectSuggestion(suggestions[acIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        send('DISMISS');
        return;
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      send('DISMISS');
    }
  });

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    const isExpr = s === 'expression' || s === 'autocompleting';
    modeToggleEl.setAttribute('aria-checked', isExpr ? 'true' : 'false');
    modeToggleEl.textContent = isExpr ? 'Expression' : 'Fixed';

    fixedDiv.style.display = isExpr ? 'none' : '';
    fixedDiv.setAttribute('data-visible', isExpr ? 'false' : 'true');
    fixedDiv.setAttribute('aria-hidden', isExpr ? 'true' : 'false');

    exprDiv.style.display = isExpr ? '' : 'none';
    exprDiv.setAttribute('data-visible', isExpr ? 'true' : 'false');
    exprDiv.setAttribute('aria-hidden', isExpr ? 'false' : 'true');

    acEl.style.display = s === 'autocompleting' ? '' : 'none';
    acEl.setAttribute('data-visible', s === 'autocompleting' ? 'true' : 'false');

    if (isExpr) exprTextarea.focus();
    updatePreview();
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default ExpressionToggleInput;
