import { uid } from '../shared/uid.js';
export interface GaugeProps { value?: number; min?: number; max?: number; label?: string; unit?: string; size?: 'sm'|'md'|'lg'; variant?: 'default'|'success'|'warning'|'error'; className?: string; }
export interface GaugeInstance { element: HTMLElement; update(props: Partial<GaugeProps>): void; destroy(): void; }
export function createGauge(options: { target: HTMLElement; props: GaugeProps; }): GaugeInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'gauge'); root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'meter');
  const trackEl = document.createElement('div'); trackEl.setAttribute('data-part', 'track'); root.appendChild(trackEl);
  const fillEl = document.createElement('div'); fillEl.setAttribute('data-part', 'fill'); trackEl.appendChild(fillEl);
  const labelEl = document.createElement('div'); labelEl.setAttribute('data-part', 'label'); root.appendChild(labelEl);
  const valueEl = document.createElement('div'); valueEl.setAttribute('data-part', 'value-text'); root.appendChild(valueEl);
  function sync() {
    const min = currentProps.min ?? 0; const max = currentProps.max ?? 100; const val = currentProps.value ?? 0;
    const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
    root.setAttribute('data-size', currentProps.size ?? 'md'); root.setAttribute('data-variant', currentProps.variant ?? 'default');
    root.setAttribute('aria-valuenow', String(val)); root.setAttribute('aria-valuemin', String(min)); root.setAttribute('aria-valuemax', String(max));
    if (currentProps.label) root.setAttribute('aria-label', currentProps.label);
    fillEl.style.width = pct + '%';
    labelEl.textContent = currentProps.label ?? ''; labelEl.style.display = currentProps.label ? '' : 'none';
    valueEl.textContent = val + (currentProps.unit ?? '');
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createGauge;
