import { uid } from '../shared/uid.js';

export interface IconProps {
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  label?: string;
  decorative?: boolean;
  children?: string | HTMLElement;
  className?: string;
}

export interface IconInstance {
  element: HTMLElement;
  update(props: Partial<IconProps>): void;
  destroy(): void;
}

export function createIcon(options: {
  target: HTMLElement;
  props: IconProps;
}): IconInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const cleanups: (() => void)[] = [];

  const root = document.createElement('span');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'icon');
  root.setAttribute('data-part', 'root');

  function sync() {
    const decorative = currentProps.decorative ?? !currentProps.label;
    root.setAttribute('role', decorative ? 'presentation' : 'img');
    root.setAttribute('aria-hidden', decorative ? 'true' : 'false');
    if (currentProps.label) root.setAttribute('aria-label', currentProps.label); else root.removeAttribute('aria-label');
    root.setAttribute('data-size', currentProps.size ?? 'md');
    if (currentProps.name) root.setAttribute('data-icon', currentProps.name);
    if (currentProps.color) root.style.color = currentProps.color; else root.style.color = '';
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
    if (typeof currentProps.children === 'string') root.innerHTML = currentProps.children;
    else if (currentProps.children instanceof HTMLElement) { root.innerHTML = ''; root.appendChild(currentProps.children); }
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createIcon;
