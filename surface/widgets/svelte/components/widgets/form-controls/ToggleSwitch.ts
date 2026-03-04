import { uid } from '../shared/uid.js';

export interface ToggleSwitchProps {
  checked?: boolean;
  disabled?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  onChange?: (checked: boolean) => void;
  className?: string;
}

export interface ToggleSwitchInstance {
  element: HTMLElement;
  update(props: Partial<ToggleSwitchProps>): void;
  destroy(): void;
}

export function createToggleSwitch(options: {
  target: HTMLElement;
  props: ToggleSwitchProps;
}): ToggleSwitchInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('label');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'toggle-switch');
  root.setAttribute('data-part', 'root');

  const hiddenInput = document.createElement('input');
  hiddenInput.type = 'checkbox';
  hiddenInput.setAttribute('data-part', 'hidden-input');
  hiddenInput.style.cssText = 'position:absolute;opacity:0;width:1px;height:1px;overflow:hidden;';
  hiddenInput.id = id;
  hiddenInput.setAttribute('role', 'switch');
  root.appendChild(hiddenInput);

  const trackEl = document.createElement('span');
  trackEl.setAttribute('data-part', 'track');
  trackEl.setAttribute('aria-hidden', 'true');
  root.appendChild(trackEl);

  const thumbEl = document.createElement('span');
  thumbEl.setAttribute('data-part', 'thumb');
  thumbEl.setAttribute('aria-hidden', 'true');
  trackEl.appendChild(thumbEl);

  const labelEl = document.createElement('span');
  labelEl.setAttribute('data-part', 'label');
  root.appendChild(labelEl);

  function handleChange() {
    if (currentProps.disabled) return;
    const v = !currentProps.checked;
    currentProps.checked = v;
    currentProps.onChange?.(v);
    sync();
  }
  hiddenInput.addEventListener('change', handleChange);
  cleanups.push(() => hiddenInput.removeEventListener('change', handleChange));

  function sync() {
    const checked = currentProps.checked ?? false;
    root.setAttribute('data-state', checked ? 'checked' : 'unchecked');
    root.setAttribute('data-size', currentProps.size ?? 'md');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    hiddenInput.checked = checked;
    hiddenInput.disabled = currentProps.disabled ?? false;
    hiddenInput.setAttribute('aria-checked', checked ? 'true' : 'false');
    trackEl.setAttribute('data-state', checked ? 'checked' : 'unchecked');
    labelEl.textContent = currentProps.label ?? '';
    labelEl.style.display = currentProps.label ? '' : 'none';
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

export default createToggleSwitch;
