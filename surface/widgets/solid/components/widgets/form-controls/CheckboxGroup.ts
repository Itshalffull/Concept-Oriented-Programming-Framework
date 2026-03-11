// Clef Surface Widget — SolidJS Provider
// Imperative DOM, factory function returning { element, dispose }

import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

function solidCreateSignal<T>(initial: T): [() => T, (v: T) => void] {
  const sig = surfaceCreateSignal<T>(initial);
  return [() => sig.get(), (v: T) => sig.set(v)];
}

function solidCreateEffect(deps: Array<() => unknown>, fn: () => void | (() => void)): () => void {
  let cleanup: void | (() => void);
  cleanup = fn();
  let lastValues = deps.map(d => d());
  const interval = setInterval(() => {
    const currentValues = deps.map(d => d());
    const changed = currentValues.some((v, i) => v !== lastValues[i]);
    if (changed) {
      lastValues = currentValues;
      if (typeof cleanup === 'function') cleanup();
      cleanup = fn();
    }
  }, 16);
  return () => { clearInterval(interval); if (typeof cleanup === 'function') cleanup(); };
}

let _idCounter = 0;
function uid(): string { return 'solid-' + (++_idCounter); }


export interface CheckboxGroupOptionItem { value: string; label: string; disabled?: boolean; }

export interface CheckboxGroupProps {
  values?: string[];
  defaultValues?: string[];
  options: CheckboxGroupOptionItem[];
  orientation?: 'horizontal' | 'vertical';
  label: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  min?: number;
  max?: number;
  onChange?: (values: string[]) => void;
  size?: 'sm' | 'md' | 'lg';
  class?: string;
}

export interface CheckboxGroupResult { element: HTMLElement; dispose: () => void; }

export function CheckboxGroup(props: CheckboxGroupProps): CheckboxGroupResult {
  const {
    defaultValues = [], options, orientation = 'vertical', label,
    disabled = false, required = false, name: nameProp,
    min, max, onChange, size = 'md'
  } = props;
  const id = uid();
  const groupName = nameProp ?? id;
  const labelId = id + '-label';
  const [values, setValues] = solidCreateSignal<string[]>(props.values ?? defaultValues);

  const root = document.createElement('div');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', label);
  root.setAttribute('aria-orientation', orientation);
  root.setAttribute('aria-required', String(required));
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'checkbox-group');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-orientation', orientation);
  root.setAttribute('data-disabled', String(disabled));
  root.setAttribute('data-size', size);
  if (props.class) root.className = props.class;

  const labelEl = document.createElement('span');
  labelEl.setAttribute('data-part', 'label');
  labelEl.id = labelId;
  labelEl.textContent = label;
  root.appendChild(labelEl);

  const itemsDiv = document.createElement('div');
  itemsDiv.setAttribute('data-part', 'items');
  itemsDiv.setAttribute('data-orientation', orientation);
  itemsDiv.setAttribute('aria-labelledby', labelId);
  root.appendChild(itemsDiv);

  options.forEach(option => {
    const isDisabled = option.disabled || disabled;
    const optionId = id + '-' + option.value;

    const lbl = document.createElement('label');
    lbl.setAttribute('data-part', 'item');
    lbl.setAttribute('data-disabled', String(isDisabled));

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('data-part', 'itemInput');
    input.id = optionId;
    input.name = groupName + '[]';
    input.value = option.value;
    input.disabled = isDisabled;
    input.setAttribute('role', 'checkbox');
    input.setAttribute('aria-disabled', String(isDisabled));
    input.setAttribute('aria-label', option.label);
    Object.assign(input.style, { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' });
    lbl.appendChild(input);

    const ctrl = document.createElement('span');
    ctrl.setAttribute('data-part', 'itemControl');
    ctrl.setAttribute('aria-hidden', 'true');
    lbl.appendChild(ctrl);

    const labelText = document.createElement('span');
    labelText.setAttribute('data-part', 'itemLabel');
    labelText.textContent = option.label;
    lbl.appendChild(labelText);

    input.addEventListener('change', () => {
      if (disabled || isDisabled) return;
      const cur = values();
      const isChecked = cur.includes(option.value);
      if (isChecked) {
        if (min !== undefined && cur.length <= min) return;
        const next = cur.filter(v => v !== option.value);
        setValues(next);
        onChange?.(next);
      } else {
        if (max !== undefined && cur.length >= max) return;
        const next = [...cur, option.value];
        setValues(next);
        onChange?.(next);
      }
    });

    itemsDiv.appendChild(lbl);
  });

  const dispose = solidCreateEffect([values], () => {
    const cur = values();
    const items = itemsDiv.querySelectorAll('[data-part="item"]');
    items.forEach((item, i) => {
      const opt = options[i];
      const checked = cur.includes(opt.value);
      item.setAttribute('data-state', checked ? 'checked' : 'unchecked');
      const inp = item.querySelector('input') as HTMLInputElement;
      if (inp) { inp.checked = checked; inp.setAttribute('aria-checked', String(checked)); }
      const ctrl = item.querySelector('[data-part="itemControl"]');
      if (ctrl) ctrl.setAttribute('data-state', checked ? 'checked' : 'unchecked');
    });
  });

  return { element: root, dispose };
}
export default CheckboxGroup;
