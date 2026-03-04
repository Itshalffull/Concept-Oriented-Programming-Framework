import { uid } from '../shared/uid.js';

export interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  decorative?: boolean;
  className?: string;
}

export interface SeparatorInstance {
  element: HTMLElement;
  update(props: Partial<SeparatorProps>): void;
  destroy(): void;
}

export function createSeparator(options: {
  target: HTMLElement;
  props: SeparatorProps;
}): SeparatorInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'separator');
  root.setAttribute('data-part', 'root');

  function sync() {
    const o = currentProps.orientation ?? 'horizontal';
    const d = currentProps.decorative ?? false;
    root.setAttribute('role', d ? 'none' : 'separator');
    root.setAttribute('aria-orientation', o);
    root.setAttribute('data-orientation', o);
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

export default createSeparator;
