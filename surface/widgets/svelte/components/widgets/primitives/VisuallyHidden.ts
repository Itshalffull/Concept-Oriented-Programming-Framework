import { uid } from '../shared/uid.js';

export interface VisuallyHiddenProps {
  text?: string;
  children?: string | HTMLElement;
  className?: string;
}

export interface VisuallyHiddenInstance {
  element: HTMLElement;
  update(props: Partial<VisuallyHiddenProps>): void;
  destroy(): void;
}

export function createVisuallyHidden(options: {
  target: HTMLElement;
  props: VisuallyHiddenProps;
}): VisuallyHiddenInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const cleanups: (() => void)[] = [];

  const root = document.createElement('span');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'visually-hidden');
  root.setAttribute('data-part', 'root');
  root.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';

  function sync() {
    if (typeof currentProps.children === 'string') root.textContent = currentProps.children;
    else if (currentProps.children instanceof HTMLElement) { root.innerHTML = ''; root.appendChild(currentProps.children); }
    else root.textContent = currentProps.text ?? '';
    if (currentProps.className) root.className = currentProps.className;
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createVisuallyHidden;
