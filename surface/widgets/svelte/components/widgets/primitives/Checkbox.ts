import { uid } from '../shared/uid.js';

export interface CheckboxProps {
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  value?: string;
  label?: string;
  description?: string;
  onChange?: (checked: boolean) => void;
  className?: string;
}

export interface CheckboxInstance {
  element: HTMLElement;
  update(props: Partial<CheckboxProps>): void;
  destroy(): void;
}

export function createCheckbox(options: {
  target: HTMLElement;
  props: CheckboxProps;
}): CheckboxInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('label');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'checkbox');
  root.setAttribute('data-part', 'root');

  const hiddenInput = document.createElement('input');
  hiddenInput.type = 'checkbox';
  hiddenInput.setAttribute('data-part', 'hidden-input');
  hiddenInput.style.cssText = 'position:absolute;opacity:0;width:1px;height:1px;overflow:hidden;';
  hiddenInput.id = id;
  root.appendChild(hiddenInput);

  const controlEl = document.createElement('span');
  controlEl.setAttribute('data-part', 'control');
  controlEl.setAttribute('aria-hidden', 'true');
  root.appendChild(controlEl);

  const indicatorEl = document.createElement('span');
  indicatorEl.setAttribute('data-part', 'indicator');
  indicatorEl.setAttribute('aria-hidden', 'true');
  controlEl.appendChild(indicatorEl);

  const labelEl = document.createElement('span');
  labelEl.setAttribute('data-part', 'label');
  root.appendChild(labelEl);

  const descEl = document.createElement('span');
  descEl.setAttribute('data-part', 'description');
  root.appendChild(descEl);

  function handleChange() {
    if (currentProps.disabled) return;
    const v = !currentProps.checked;
    currentProps.checked = v;
    currentProps.indeterminate = false;
    sync();
    currentProps.onChange?.(v);
  }
  hiddenInput.addEventListener('change', handleChange);
  cleanups.push(() => hiddenInput.removeEventListener('change', handleChange));

  function sync() {
    const checked = currentProps.checked ?? false;
    const ind = currentProps.indeterminate ?? false;
    const dis = currentProps.disabled ?? false;

    hiddenInput.checked = checked;
    hiddenInput.indeterminate = ind;
    hiddenInput.disabled = dis;
    if (currentProps.name) hiddenInput.name = currentProps.name;
    if (currentProps.value) hiddenInput.value = currentProps.value;
    if (currentProps.required) hiddenInput.required = true;

    root.setAttribute('data-state', ind ? 'indeterminate' : checked ? 'checked' : 'unchecked');
    root.setAttribute('data-disabled', dis ? 'true' : 'false');
    controlEl.setAttribute('data-state', ind ? 'indeterminate' : checked ? 'checked' : 'unchecked');
    indicatorEl.textContent = ind ? '-' : checked ? '\u2713' : '';
    labelEl.textContent = currentProps.label ?? '';
    labelEl.style.display = currentProps.label ? '' : 'none';
    descEl.textContent = currentProps.description ?? '';
    descEl.style.display = currentProps.description ? '' : 'none';
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

export default createCheckbox;
