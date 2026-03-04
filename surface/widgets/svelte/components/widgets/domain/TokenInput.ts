import { uid } from '../shared/uid.js';

export interface TokenInputProps {
  tokens?: string[];
  placeholder?: string;
  disabled?: boolean;
  maxTokens?: number;
  allowDuplicates?: boolean;
  separator?: string;
  onChange?: (tokens: string[]) => void;
  onAdd?: (token: string) => void;
  onRemove?: (token: string) => void;
  children?: string | HTMLElement;
}

export interface TokenInputInstance {
  element: HTMLElement;
  update(props: Partial<TokenInputProps>): void;
  destroy(): void;
}

export function createTokenInput(options: {
  target: HTMLElement;
  props: TokenInputProps;
}): TokenInputInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'token-input');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'listbox');
  root.setAttribute('aria-label', 'Token input');
  root.id = id;

  const tokensEl = document.createElement('div');
  tokensEl.setAttribute('data-part', 'tokens');
  root.appendChild(tokensEl);

  const inputEl = document.createElement('input');
  inputEl.setAttribute('data-part', 'input');
  inputEl.setAttribute('type', 'text');
  root.appendChild(inputEl);

  function addToken(value: string) {
    const v = value.trim();
    if (!v) return;
    const tokens = [...(currentProps.tokens ?? [])];
    if (!currentProps.allowDuplicates && tokens.includes(v)) return;
    if (tokens.length >= (currentProps.maxTokens ?? Infinity)) return;
    tokens.push(v);
    currentProps.onAdd?.(v);
    currentProps.onChange?.(tokens);
  }

  inputEl.addEventListener('keydown', ((e: KeyboardEvent) => {
    const sep = currentProps.separator ?? ',';
    if (e.key === 'Enter' || e.key === sep) {
      e.preventDefault();
      addToken(inputEl.value);
      inputEl.value = '';
    }
    if (e.key === 'Backspace' && !inputEl.value) {
      const tokens = [...(currentProps.tokens ?? [])];
      const removed = tokens.pop();
      if (removed) { currentProps.onRemove?.(removed); currentProps.onChange?.(tokens); }
    }
  }) as EventListener);
  cleanups.push(() => {});

  function renderTokens() {
    tokensEl.innerHTML = '';
    (currentProps.tokens ?? []).forEach(t => {
      const chip = document.createElement('span');
      chip.setAttribute('data-part', 'token');
      chip.setAttribute('role', 'option');
      chip.textContent = t;
      const removeBtn = document.createElement('button');
      removeBtn.setAttribute('type', 'button');
      removeBtn.setAttribute('aria-label', 'Remove ' + t);
      removeBtn.textContent = '\u00d7';
      removeBtn.addEventListener('click', () => {
        const tokens = (currentProps.tokens ?? []).filter(tk => tk !== t);
        currentProps.onRemove?.(t);
        currentProps.onChange?.(tokens);
      });
      chip.appendChild(removeBtn);
      tokensEl.appendChild(chip);
    });
  }

  function sync() {
    root.setAttribute('data-state', 'idle');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    inputEl.placeholder = currentProps.placeholder ?? '';
    inputEl.disabled = currentProps.disabled ?? false;
    renderTokens();
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createTokenInput;
