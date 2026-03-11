import { uid } from '../shared/uid.js';

export interface PortalProps {
  target?: string | HTMLElement;
  children?: HTMLElement;
  disabled?: boolean;
  className?: string;
}

export interface PortalInstance {
  element: HTMLElement;
  update(props: Partial<PortalProps>): void;
  destroy(): void;
}

export function createPortal(options: {
  target: HTMLElement;
  props: PortalProps;
}): PortalInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const container = document.createElement('div');
  container.setAttribute('data-surface-widget', '');
  container.setAttribute('data-widget-name', 'portal');
  container.setAttribute('data-part', 'root');
  container.setAttribute('data-portal', id);

  function getPortalTarget(): HTMLElement {
    if (currentProps.disabled) return target;
    if (currentProps.target instanceof HTMLElement) return currentProps.target;
    if (typeof currentProps.target === 'string') {
      const el = document.querySelector<HTMLElement>(currentProps.target);
      if (el) return el;
    }
    return document.body;
  }

  function mount() {
    const dest = getPortalTarget();
    if (currentProps.children) container.appendChild(currentProps.children);
    dest.appendChild(container);
  }

  function sync() {
    if (currentProps.className) container.className = currentProps.className; else container.className = '';
  }

  sync();
  mount();

  return {
    element: container,
    update(next) {
      const tc = next.target !== undefined;
      Object.assign(currentProps, next);
      sync();
      if (tc) { container.remove(); mount(); }
    },
    destroy() { cleanups.forEach(fn => fn()); container.remove(); },
  };
}

export default createPortal;
