import { uid } from '../shared/uid.js';

export interface BadgeProps {
  count?: number;
  max?: number;
  dot?: boolean;
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  showZero?: boolean;
  children?: HTMLElement;
  className?: string;
}

export interface BadgeInstance {
  element: HTMLElement;
  update(props: Partial<BadgeProps>): void;
  destroy(): void;
}

export function createBadge(options: {
  target: HTMLElement;
  props: BadgeProps;
}): BadgeInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'badge');
  root.setAttribute('data-part', 'root');

  const contentEl = document.createElement('div');
  contentEl.setAttribute('data-part', 'content');
  root.appendChild(contentEl);

  const badgeEl = document.createElement('span');
  badgeEl.setAttribute('data-part', 'badge');
  badgeEl.setAttribute('aria-live', 'polite');
  root.appendChild(badgeEl);

  function sync() {
    const count = currentProps.count ?? 0;
    const max = currentProps.max ?? 99;
    const dot = currentProps.dot ?? false;
    const show = count > 0 || currentProps.showZero;

    root.setAttribute('data-variant', currentProps.variant ?? 'default');
    root.setAttribute('data-size', currentProps.size ?? 'md');
    root.setAttribute('data-dot', dot ? 'true' : 'false');

    if (dot) {
      badgeEl.textContent = '';
      badgeEl.style.display = show ? '' : 'none';
    } else {
      badgeEl.textContent = count > max ? max + '+' : String(count);
      badgeEl.style.display = show ? '' : 'none';
    }

    if (currentProps.children && !contentEl.contains(currentProps.children)) {
      contentEl.innerHTML = '';
      contentEl.appendChild(currentProps.children);
    }
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

export default createBadge;
