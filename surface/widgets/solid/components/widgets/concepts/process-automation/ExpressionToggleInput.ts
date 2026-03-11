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

export interface ExpressionToggleInputProps { [key: string]: unknown; class?: string; }
export interface ExpressionToggleInputResult { element: HTMLElement; dispose: () => void; }

export function ExpressionToggleInput(props: ExpressionToggleInputProps): ExpressionToggleInputResult {
  const sig = surfaceCreateSignal<ExpressionToggleInputState>('fixed');
  const state = () => sig.get();
  const send = (type: string) => sig.set(expressionToggleInputReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'expression-toggle-input');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Expression toggle input');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Mode toggle button */
  const modeToggleEl = document.createElement('button');
  modeToggleEl.type = 'button';
  modeToggleEl.setAttribute('data-part', 'mode-toggle');
  modeToggleEl.setAttribute('role', 'switch');
  modeToggleEl.setAttribute('aria-label', 'Expression mode');
  modeToggleEl.setAttribute('aria-checked', 'false');
  modeToggleEl.textContent = 'Fixed';
  modeToggleEl.addEventListener('click', () => { send('TOGGLE'); });
  root.appendChild(modeToggleEl);

  /* Fixed value input */
  const fixedInputEl = document.createElement('div');
  fixedInputEl.setAttribute('data-part', 'fixed-input');
  fixedInputEl.setAttribute('data-visible', 'true');
  fixedInputEl.setAttribute('aria-hidden', 'false');
  const fixedText = document.createElement('input');
  fixedText.type = 'text';
  fixedText.setAttribute('data-part', 'fixed-text');
  fixedText.setAttribute('aria-label', 'Fixed text value');
  fixedText.addEventListener('input', () => { send('INPUT'); });
  fixedInputEl.appendChild(fixedText);
  root.appendChild(fixedInputEl);

  /* Expression editor */
  const expressionInputEl = document.createElement('div');
  expressionInputEl.setAttribute('data-part', 'expression-input');
  expressionInputEl.setAttribute('data-visible', 'false');
  expressionInputEl.setAttribute('aria-hidden', 'true');
  const expressionTextarea = document.createElement('textarea');
  expressionTextarea.setAttribute('data-part', 'expression-textarea');
  expressionTextarea.setAttribute('role', 'textbox');
  expressionTextarea.setAttribute('aria-label', 'Expression editor');
  expressionTextarea.rows = 3;
  expressionTextarea.spellcheck = false;
  expressionTextarea.addEventListener('input', () => { send('INPUT'); });
  expressionInputEl.appendChild(expressionTextarea);
  root.appendChild(expressionInputEl);

  /* Autocomplete dropdown */
  const autocompleteEl = document.createElement('div');
  autocompleteEl.setAttribute('data-part', 'autocomplete');
  autocompleteEl.setAttribute('data-visible', 'false');
  autocompleteEl.setAttribute('role', 'listbox');
  autocompleteEl.setAttribute('aria-label', 'Variable suggestions');
  const acItemEl = document.createElement('div');
  acItemEl.setAttribute('data-part', 'autocomplete-item');
  acItemEl.setAttribute('role', 'option');
  acItemEl.setAttribute('aria-selected', 'false');
  acItemEl.textContent = 'variable';
  acItemEl.addEventListener('click', () => { send('SELECT'); });
  autocompleteEl.appendChild(acItemEl);
  const acEmptyEl = document.createElement('div');
  acEmptyEl.setAttribute('data-part', 'autocomplete-empty');
  acEmptyEl.setAttribute('role', 'option');
  acEmptyEl.setAttribute('aria-disabled', 'true');
  acEmptyEl.textContent = 'No matching variables';
  acEmptyEl.style.display = 'none';
  autocompleteEl.appendChild(acEmptyEl);
  root.appendChild(autocompleteEl);

  /* Live preview */
  const previewEl = document.createElement('div');
  previewEl.setAttribute('data-part', 'preview');
  previewEl.setAttribute('role', 'status');
  previewEl.setAttribute('aria-live', 'polite');
  const previewPlaceholder = document.createElement('span');
  previewPlaceholder.setAttribute('data-part', 'preview-placeholder');
  previewPlaceholder.textContent = 'Enter expression to preview';
  previewPlaceholder.style.display = 'none';
  previewEl.appendChild(previewPlaceholder);
  root.appendChild(previewEl);

  /* Keyboard navigation */
  root.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'e') {
      e.preventDefault();
      send('TOGGLE');
      return;
    }
    if (sig.get() === 'autocompleting') {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        send('SELECT');
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

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    const isExpr = s !== 'fixed';
    modeToggleEl.setAttribute('aria-checked', isExpr ? 'true' : 'false');
    modeToggleEl.textContent = isExpr ? 'Expression' : 'Fixed';
    fixedInputEl.setAttribute('data-visible', !isExpr ? 'true' : 'false');
    fixedInputEl.setAttribute('aria-hidden', isExpr ? 'true' : 'false');
    expressionInputEl.setAttribute('data-visible', isExpr ? 'true' : 'false');
    expressionInputEl.setAttribute('aria-hidden', !isExpr ? 'true' : 'false');
    autocompleteEl.setAttribute('data-visible', s === 'autocompleting' ? 'true' : 'false');
    previewPlaceholder.style.display = isExpr ? 'inline' : 'none';
    if (isExpr) {
      expressionTextarea.focus();
    }
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default ExpressionToggleInput;
