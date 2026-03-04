import { uid } from '../shared/uid.js';

export interface RadioGroupProps {
  value?: string;
  options?: Array<{ label: string; value: string; disabled?: boolean }>;
  orientation?: 'horizontal' | 'vertical';
  disabled?: boolean;
  label?: string;
  description?: string;
  error?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export interface RadioGroupInstance {
  element: HTMLElement;
  update(props: Partial<RadioGroupProps>): void;
  destroy(): void;
}

export function createRadioGroup(options: {
  target: HTMLElement;
  props: RadioGroupProps;
}): RadioGroupInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('fieldset');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'radio-group');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'radiogroup');

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
  root.appendChild(errorEl);

  function sync() {
    const opts = currentProps.options ?? [];
    root.setAttribute('data-orientation', currentProps.orientation ?? 'vertical');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    root.setAttribute('data-invalid', currentProps.error ? 'true' : 'false');
    root.disabled = currentProps.disabled ?? false;

    legendEl.textContent = currentProps.label ?? '';
    legendEl.style.display = currentProps.label ? '' : 'none';
    descEl.textContent = currentProps.description ?? '';
    descEl.style.display = currentProps.description ? '' : 'none';
    errorEl.textContent = currentProps.error ?? '';
    errorEl.style.display = currentProps.error ? '' : 'none';

    listEl.innerHTML = '';
    cleanups.length = 0;
    opts.forEach((opt) => {
      const label = document.createElement('label');
      label.setAttribute('data-part', 'option');
      label.setAttribute('data-disabled', (opt.disabled || currentProps.disabled) ? 'true' : 'false');

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = id;
      input.value = opt.value;
      input.checked = currentProps.value === opt.value;
      input.disabled = opt.disabled || currentProps.disabled || false;

      const handler = () => { currentProps.value = opt.value; currentProps.onChange?.(opt.value); sync(); };
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

export default createRadioGroup;
