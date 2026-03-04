import { uid } from '../shared/uid.js';

export interface ScrollLockProps {
  active?: boolean;
  preserveScrollbarGap?: boolean;
  className?: string;
}

export interface ScrollLockInstance {
  element: HTMLElement;
  update(props: Partial<ScrollLockProps>): void;
  destroy(): void;
}

export function createScrollLock(options: {
  target: HTMLElement;
  props: ScrollLockProps;
}): ScrollLockInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const cleanups: (() => void)[] = [];
  let savedOverflow = '';
  let savedPR = '';

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'scroll-lock');
  root.setAttribute('data-part', 'root');

  function lock() {
    savedOverflow = document.body.style.overflow;
    savedPR = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (currentProps.preserveScrollbarGap) {
      document.body.style.paddingRight = (window.innerWidth - document.documentElement.clientWidth) + 'px';
    }
  }

  function unlock() {
    document.body.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPR;
  }

  function sync() {
    root.setAttribute('data-active', currentProps.active ? 'true' : 'false');
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }

  sync();
  if (currentProps.active) lock();
  target.appendChild(root);

  return {
    element: root,
    update(next) {
      const was = currentProps.active;
      Object.assign(currentProps, next);
      sync();
      if (!was && currentProps.active) lock();
      else if (was && !currentProps.active) unlock();
    },
    destroy() { if (currentProps.active) unlock(); cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createScrollLock;
