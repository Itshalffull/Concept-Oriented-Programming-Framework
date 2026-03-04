import { uid } from '../shared/uid.js';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  trackVisible?: boolean;
  className?: string;
}

export interface SpinnerInstance {
  element: HTMLElement;
  update(props: Partial<SpinnerProps>): void;
  destroy(): void;
}

export function createSpinner(options: {
  target: HTMLElement;
  props: SpinnerProps;
}): SpinnerInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'spinner');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'progressbar');
  root.setAttribute('aria-busy', 'true');

  const trackEl = document.createElement('span');
  trackEl.setAttribute('data-part', 'track');
  trackEl.setAttribute('aria-hidden', 'true');
  root.appendChild(trackEl);

  const indicatorEl = document.createElement('span');
  indicatorEl.setAttribute('data-part', 'indicator');
  indicatorEl.setAttribute('aria-hidden', 'true');
  root.appendChild(indicatorEl);

  const labelEl = document.createElement('span');
  labelEl.setAttribute('data-part', 'label');
  root.appendChild(labelEl);

  function sync() {
    root.setAttribute('data-size', currentProps.size ?? 'md');
    const l = currentProps.label ?? 'Loading';
    root.setAttribute('aria-label', l);
    labelEl.textContent = l;
    trackEl.style.display = currentProps.trackVisible === false ? 'none' : '';
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

export default createSpinner;
