import { uid } from '../shared/uid.js';

export interface SegmentedControlProps {
  value?: string;
  options?: Array<{ label: string; value: string; disabled?: boolean; icon?: string }>;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  fullWidth?: boolean;
  onChange?: (value: string) => void;
  className?: string;
}

export interface SegmentedControlInstance {
  element: HTMLElement;
  update(props: Partial<SegmentedControlProps>): void;
  destroy(): void;
}

export function createSegmentedControl(options: {
  target: HTMLElement;
  props: SegmentedControlProps;
}): SegmentedControlInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'segmented-control');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'tablist');

  const indicatorEl = document.createElement('div');
  indicatorEl.setAttribute('data-part', 'indicator');
  root.appendChild(indicatorEl);

  function sync() {
    const opts = currentProps.options ?? [];
    root.setAttribute('data-size', currentProps.size ?? 'md');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    root.setAttribute('data-full-width', currentProps.fullWidth ? 'true' : 'false');

    /* Remove old buttons but keep indicator */
    Array.from(root.children).forEach(c => { if (c !== indicatorEl) c.remove(); });
    cleanups.length = 0;

    opts.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.setAttribute('data-part', 'segment');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-selected', currentProps.value === opt.value ? 'true' : 'false');
      btn.setAttribute('data-selected', currentProps.value === opt.value ? 'true' : 'false');
      btn.setAttribute('tabindex', currentProps.value === opt.value ? '0' : '-1');
      btn.disabled = opt.disabled || currentProps.disabled || false;
      btn.textContent = opt.label;

      const handler = () => { if (!opt.disabled && !currentProps.disabled) { currentProps.value = opt.value; currentProps.onChange?.(opt.value); sync(); } };
      btn.addEventListener('click', handler);
      cleanups.push(() => btn.removeEventListener('click', handler));

      const kd = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          const next = (i + 1) % opts.length;
          (root.children[next + 1] as HTMLElement)?.focus();
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = (i - 1 + opts.length) % opts.length;
          (root.children[prev + 1] as HTMLElement)?.focus();
        }
      };
      btn.addEventListener('keydown', kd as EventListener);
      cleanups.push(() => btn.removeEventListener('keydown', kd as EventListener));

      root.appendChild(btn);
    });

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

export default createSegmentedControl;
