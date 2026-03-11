import { uid } from '../shared/uid.js';

export interface ChipInputProps {
  values?: string[];
  placeholder?: string;
  disabled?: boolean;
  maxItems?: number;
  separator?: string;
  allowDuplicates?: boolean;
  label?: string;
  error?: string;
  onChange?: (values: string[]) => void;
  className?: string;
}

export interface ChipInputInstance {
  element: HTMLElement;
  update(props: Partial<ChipInputProps>): void;
  destroy(): void;
}

export function createChipInput(options: {
  target: HTMLElement;
  props: ChipInputProps;
}): ChipInputInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'chip-input');
  root.setAttribute('data-part', 'root');

  const labelEl = document.createElement('label');
  labelEl.setAttribute('data-part', 'label');
  labelEl.setAttribute('for', id);
  root.appendChild(labelEl);

  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-part', 'input-wrapper');
  root.appendChild(wrapper);

  const chipsEl = document.createElement('div');
  chipsEl.setAttribute('data-part', 'chips');
  wrapper.appendChild(chipsEl);

  const inputEl = document.createElement('input');
  inputEl.setAttribute('data-part', 'input');
  inputEl.type = 'text';
  inputEl.id = id;
  wrapper.appendChild(inputEl);

  const errorEl = document.createElement('span');
  errorEl.setAttribute('data-part', 'error');
  errorEl.setAttribute('role', 'alert');
  errorEl.setAttribute('aria-live', 'polite');
  root.appendChild(errorEl);

  function addValue(val: string) {
    const v = val.trim();
    if (!v) return;
    const vals = [...(currentProps.values ?? [])];
    if (!currentProps.allowDuplicates && vals.includes(v)) return;
    if (currentProps.maxItems && vals.length >= currentProps.maxItems) return;
    vals.push(v);
    currentProps.values = vals;
    currentProps.onChange?.(vals);
    sync();
  }

  function removeValue(idx: number) {
    const vals = [...(currentProps.values ?? [])];
    vals.splice(idx, 1);
    currentProps.values = vals;
    currentProps.onChange?.(vals);
    sync();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (currentProps.disabled) return;
    const sep = currentProps.separator ?? ',';
    if (e.key === 'Enter' || e.key === sep) {
      e.preventDefault();
      addValue(inputEl.value);
      inputEl.value = '';
    }
    if (e.key === 'Backspace' && !inputEl.value && (currentProps.values?.length ?? 0) > 0) {
      removeValue((currentProps.values?.length ?? 1) - 1);
    }
  }
  inputEl.addEventListener('keydown', handleKeydown as EventListener);
  cleanups.push(() => inputEl.removeEventListener('keydown', handleKeydown as EventListener));

  function handleBlur() {
    if (inputEl.value.trim()) { addValue(inputEl.value); inputEl.value = ''; }
  }
  inputEl.addEventListener('blur', handleBlur);
  cleanups.push(() => inputEl.removeEventListener('blur', handleBlur));

  function sync() {
    const vals = currentProps.values ?? [];
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    root.setAttribute('data-invalid', currentProps.error ? 'true' : 'false');
    inputEl.disabled = currentProps.disabled ?? false;
    inputEl.placeholder = currentProps.placeholder ?? '';

    labelEl.textContent = currentProps.label ?? '';
    labelEl.style.display = currentProps.label ? '' : 'none';
    errorEl.textContent = currentProps.error ?? '';
    errorEl.style.display = currentProps.error ? '' : 'none';

    chipsEl.innerHTML = '';
    vals.forEach((v, i) => {
      const chip = document.createElement('span');
      chip.setAttribute('data-part', 'chip');
      chip.textContent = v;
      const del = document.createElement('button');
      del.setAttribute('type', 'button');
      del.setAttribute('aria-label', 'Remove ' + v);
      del.textContent = '\u00d7';
      del.addEventListener('click', () => removeValue(i));
      chip.appendChild(del);
      chipsEl.appendChild(chip);
    });

    if (currentProps.className) root.className = currentProps.className;
    else root.className = '';
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createChipInput;
