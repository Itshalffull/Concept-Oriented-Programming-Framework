import { uid } from '../shared/uid.js';

export interface ProgressBarProps {
  value?: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  indeterminate?: boolean;
  className?: string;
}

export interface ProgressBarInstance {
  element: HTMLElement;
  update(props: Partial<ProgressBarProps>): void;
  destroy(): void;
}

export function createProgressBar(options: {
  target: HTMLElement;
  props: ProgressBarProps;
}): ProgressBarInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'progress-bar');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'progressbar');

  const labelEl = document.createElement('div');
  labelEl.setAttribute('data-part', 'label');
  root.appendChild(labelEl);

  const trackEl = document.createElement('div');
  trackEl.setAttribute('data-part', 'track');
  root.appendChild(trackEl);

  const fillEl = document.createElement('div');
  fillEl.setAttribute('data-part', 'fill');
  trackEl.appendChild(fillEl);

  const valueEl = document.createElement('span');
  valueEl.setAttribute('data-part', 'value-text');
  root.appendChild(valueEl);

  function sync() {
    const max = currentProps.max ?? 100;
    const val = Math.min(currentProps.value ?? 0, max);
    const pct = max > 0 ? (val / max) * 100 : 0;

    root.setAttribute('data-variant', currentProps.variant ?? 'default');
    root.setAttribute('data-size', currentProps.size ?? 'md');
    root.setAttribute('data-indeterminate', currentProps.indeterminate ? 'true' : 'false');

    if (currentProps.indeterminate) {
      root.removeAttribute('aria-valuenow');
    } else {
      root.setAttribute('aria-valuenow', String(val));
      root.setAttribute('aria-valuemin', '0');
      root.setAttribute('aria-valuemax', String(max));
    }

    if (currentProps.label) root.setAttribute('aria-label', currentProps.label);
    labelEl.textContent = currentProps.label ?? '';
    labelEl.style.display = currentProps.label ? '' : 'none';

    fillEl.style.width = currentProps.indeterminate ? '50%' : pct + '%';
    valueEl.textContent = currentProps.showValue ? Math.round(pct) + '%' : '';
    valueEl.style.display = currentProps.showValue ? '' : 'none';

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

export default createProgressBar;
