import { uid } from '../shared/uid.js';

export interface SliderProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label?: string;
  showValue?: boolean;
  orientation?: 'horizontal' | 'vertical';
  onChange?: (value: number) => void;
  className?: string;
}

export interface SliderInstance {
  element: HTMLElement;
  update(props: Partial<SliderProps>): void;
  destroy(): void;
}

export function createSlider(options: {
  target: HTMLElement;
  props: SliderProps;
}): SliderInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'slider');
  root.setAttribute('data-part', 'root');

  const labelEl = document.createElement('label');
  labelEl.setAttribute('data-part', 'label');
  root.appendChild(labelEl);

  const trackEl = document.createElement('div');
  trackEl.setAttribute('data-part', 'track');
  root.appendChild(trackEl);

  const fillEl = document.createElement('div');
  fillEl.setAttribute('data-part', 'fill');
  trackEl.appendChild(fillEl);

  const thumbEl = document.createElement('div');
  thumbEl.setAttribute('data-part', 'thumb');
  thumbEl.setAttribute('role', 'slider');
  thumbEl.setAttribute('tabindex', '0');
  thumbEl.id = id;
  trackEl.appendChild(thumbEl);

  const valueEl = document.createElement('span');
  valueEl.setAttribute('data-part', 'value-text');
  root.appendChild(valueEl);

  function getPercent(): number {
    const min = currentProps.min ?? 0;
    const max = currentProps.max ?? 100;
    const val = currentProps.value ?? min;
    return max > min ? ((val - min) / (max - min)) * 100 : 0;
  }

  function setValue(v: number) {
    const min = currentProps.min ?? 0;
    const max = currentProps.max ?? 100;
    const step = currentProps.step ?? 1;
    v = Math.round(v / step) * step;
    v = Math.max(min, Math.min(max, v));
    currentProps.value = v;
    currentProps.onChange?.(v);
    sync();
  }

  thumbEl.addEventListener('keydown', ((e: KeyboardEvent) => {
    if (currentProps.disabled) return;
    const step = currentProps.step ?? 1;
    const v = currentProps.value ?? (currentProps.min ?? 0);
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setValue(v + step); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setValue(v - step); }
    if (e.key === 'Home') { e.preventDefault(); setValue(currentProps.min ?? 0); }
    if (e.key === 'End') { e.preventDefault(); setValue(currentProps.max ?? 100); }
  }) as EventListener);

  function handleTrackClick(e: MouseEvent) {
    if (currentProps.disabled) return;
    const rect = trackEl.getBoundingClientRect();
    const min = currentProps.min ?? 0;
    const max = currentProps.max ?? 100;
    const pct = (e.clientX - rect.left) / rect.width;
    setValue(min + pct * (max - min));
  }
  trackEl.addEventListener('click', handleTrackClick);
  cleanups.push(() => trackEl.removeEventListener('click', handleTrackClick));

  function sync() {
    const pct = getPercent();
    root.setAttribute('data-orientation', currentProps.orientation ?? 'horizontal');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    thumbEl.setAttribute('aria-valuenow', String(currentProps.value ?? 0));
    thumbEl.setAttribute('aria-valuemin', String(currentProps.min ?? 0));
    thumbEl.setAttribute('aria-valuemax', String(currentProps.max ?? 100));
    if (currentProps.disabled) thumbEl.removeAttribute('tabindex'); else thumbEl.setAttribute('tabindex', '0');
    fillEl.style.width = pct + '%';
    thumbEl.style.left = pct + '%';
    labelEl.textContent = currentProps.label ?? '';
    labelEl.style.display = currentProps.label ? '' : 'none';
    valueEl.textContent = currentProps.showValue ? String(currentProps.value ?? 0) : '';
    valueEl.style.display = currentProps.showValue ? '' : 'none';
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

export default createSlider;
