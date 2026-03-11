import { uid } from '../shared/uid.js';

export interface LabelProps {
  htmlFor?: string;
  required?: boolean;
  disabled?: boolean;
  text?: string;
  children?: string | HTMLElement;
  className?: string;
}

export interface LabelInstance {
  element: HTMLElement;
  update(props: Partial<LabelProps>): void;
  destroy(): void;
}

export function createLabel(options: {
  target: HTMLElement;
  props: LabelProps;
}): LabelInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const cleanups: (() => void)[] = [];

  const root = document.createElement('label');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'label');
  root.setAttribute('data-part', 'root');

  const textSpan = document.createElement('span');
  textSpan.setAttribute('data-part', 'text');
  root.appendChild(textSpan);

  const reqInd = document.createElement('span');
  reqInd.setAttribute('data-part', 'required-indicator');
  reqInd.setAttribute('aria-hidden', 'true');
  reqInd.textContent = ' *';
  root.appendChild(reqInd);

  function sync() {
    if (currentProps.htmlFor) root.setAttribute('for', currentProps.htmlFor); else root.removeAttribute('for');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    root.setAttribute('data-required', currentProps.required ? 'true' : 'false');
    textSpan.textContent = currentProps.text ?? '';
    if (typeof currentProps.children === 'string') textSpan.textContent = currentProps.children;
    else if (currentProps.children instanceof HTMLElement) { textSpan.innerHTML = ''; textSpan.appendChild(currentProps.children); }
    reqInd.style.display = currentProps.required ? '' : 'none';
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createLabel;
