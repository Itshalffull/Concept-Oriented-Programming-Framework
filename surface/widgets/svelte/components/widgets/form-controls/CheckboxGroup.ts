import { uid } from '../shared/uid.js';

export interface CheckboxGroupProps {
  value?: string[];
  options?: Array<{ label: string; value: string; disabled?: boolean }>;
  orientation?: 'horizontal' | 'vertical';
  disabled?: boolean;
  label?: string;
  description?: string;
  error?: string;
  min?: number;
  max?: number;
  onChange?: (value: string[]) => void;
  className?: string;
}

export interface CheckboxGroupInstance {
  element: HTMLElement;
  update(props: Partial<CheckboxGroupProps>): void;
  destroy(): void;
}

export function createCheckboxGroup(options: {
  target: HTMLElement;
  props: CheckboxGroupProps;
}): CheckboxGroupInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('fieldset');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'checkbox-group');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'group');

  const legendEl = document.createElement('legend');
  legendEl.setAttribute('data-part', 'label');
  root.appendChild(legendEl);

  const descEl = document.createElement('span');
  descEl.setAttribute('data-part', 'description');
  root.appendChild(descEl);

  const listEl = document.createElement('div');
  listEl.setAttribute('data-part', 'list');
  root.appendChild(listEl);

  const errorEl = document.createElement('span');
  errorEl.setAttribute('data-part', 'error');
  errorEl.setAttribute('role', 'alert');
  errorEl.setAttribute('aria-live', 'polite');
  root.appendChild(errorEl);

  function handleChange(optValue: string) {
    if (currentProps.disabled) return;
    const vals = [...(currentProps.value ?? [])];
    const idx = vals.indexOf(optValue);
    if (idx >= 0) {
      if (currentProps.min && vals.length <= currentProps.min) return;
      vals.splice(idx, 1);
    } else {
      if (currentProps.max && vals.length >= currentProps.max) return;
      vals.push(optValue);
    }
    currentProps.value = vals;
    currentProps.onChange?.(vals);
    sync();
  }

  function sync() {
    const opts = currentProps.options ?? [];
    const vals = currentProps.value ?? [];
    const orientation = currentProps.orientation ?? 'vertical';

    root.setAttribute('data-orientation', orientation);
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    root.setAttribute('data-invalid', currentProps.error ? 'true' : 'false');
    root.disabled = currentProps.disabled ?? false;

    legendEl.textContent = currentProps.label ?? '';
    legendEl.style.display = currentProps.label ? '' : 'none';
    descEl.textContent = currentProps.description ?? '';
    descEl.style.display = currentProps.description ? '' : 'none';
    errorEl.textContent = currentProps.error ?? '';
    errorEl.style.display = currentProps.error ? '' : 'none';

    /* Rebuild options */
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    cleanups.length = 0;
    opts.forEach((opt) => {
      const label = document.createElement('label');
      label.setAttribute('data-part', 'option');
      label.setAttribute('data-disabled', (opt.disabled || currentProps.disabled) ? 'true' : 'false');

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = vals.includes(opt.value);
      input.disabled = opt.disabled || currentProps.disabled || false;
      input.value = opt.value;

      const handler = () => handleChange(opt.value);
      input.addEventListener('change', handler);
      cleanups.push(() => input.removeEventListener('change', handler));

      const span = document.createElement('span');
      span.textContent = opt.label;

      label.appendChild(input);
      label.appendChild(span);
      listEl.appendChild(label);
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

export default createCheckboxGroup;
