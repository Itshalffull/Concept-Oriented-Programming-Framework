import { uid } from '../shared/uid.js';

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  closable?: boolean;
  title?: string | HTMLElement;
  description?: string | HTMLElement;
  icon?: string | HTMLElement;
  onDismiss?: () => void;
  children?: string | HTMLElement;
  className?: string;
}

export interface AlertInstance {
  element: HTMLElement;
  update(props: Partial<AlertProps>): void;
  destroy(): void;
}

export function createAlert(options: {
  target: HTMLElement;
  props: AlertProps;
}): AlertInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'alert');
  root.setAttribute('data-part', 'root');

  const iconEl = document.createElement('span');
  iconEl.setAttribute('data-part', 'icon');
  iconEl.setAttribute('aria-hidden', 'true');
  root.appendChild(iconEl);

  const contentEl = document.createElement('div');
  contentEl.setAttribute('data-part', 'content');
  root.appendChild(contentEl);

  const titleEl = document.createElement('div');
  titleEl.setAttribute('data-part', 'title');
  contentEl.appendChild(titleEl);

  const descEl = document.createElement('div');
  descEl.setAttribute('data-part', 'description');
  contentEl.appendChild(descEl);

  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('data-part', 'close-trigger');
  closeBtn.setAttribute('type', 'button');
  closeBtn.setAttribute('aria-label', 'Dismiss alert');
  closeBtn.textContent = '\u00d7';
  root.appendChild(closeBtn);

  closeBtn.addEventListener('click', () => { currentProps.onDismiss?.(); });

  function setSlot(el: HTMLElement, c?: string | HTMLElement) {
    el.innerHTML = '';
    if (typeof c === 'string') el.textContent = c;
    else if (c instanceof HTMLElement) el.appendChild(c);
  }

  function sync() {
    const variant = currentProps.variant ?? 'info';
    root.setAttribute('data-variant', variant);
    root.setAttribute('role', variant === 'error' ? 'alert' : 'status');
    root.setAttribute('aria-live', variant === 'error' ? 'assertive' : 'polite');

    setSlot(titleEl, currentProps.title);
    titleEl.style.display = currentProps.title ? '' : 'none';
    setSlot(descEl, currentProps.description);
    descEl.style.display = currentProps.description ? '' : 'none';
    setSlot(iconEl, currentProps.icon);
    closeBtn.style.display = currentProps.closable ? '' : 'none';
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

export default createAlert;
