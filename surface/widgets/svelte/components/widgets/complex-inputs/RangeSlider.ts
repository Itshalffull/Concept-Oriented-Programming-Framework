import { uid } from '../shared/uid.js';
export interface RangeSliderProps { value?: [number, number]; min?: number; max?: number; step?: number; disabled?: boolean; label?: string; onChange?: (value: [number, number]) => void; className?: string; }
export interface RangeSliderInstance { element: HTMLElement; update(props: Partial<RangeSliderProps>): void; destroy(): void; }
export function createRangeSlider(options: { target: HTMLElement; props: RangeSliderProps; }): RangeSliderInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'range-slider'); root.setAttribute('data-part', 'root');
  const labelEl = document.createElement('div'); labelEl.setAttribute('data-part', 'label'); root.appendChild(labelEl);
  const trackEl = document.createElement('div'); trackEl.setAttribute('data-part', 'track'); root.appendChild(trackEl);
  const fillEl = document.createElement('div'); fillEl.setAttribute('data-part', 'fill'); trackEl.appendChild(fillEl);
  const thumbStart = document.createElement('div'); thumbStart.setAttribute('data-part', 'thumb-start'); thumbStart.setAttribute('role', 'slider'); thumbStart.setAttribute('tabindex', '0'); trackEl.appendChild(thumbStart);
  const thumbEnd = document.createElement('div'); thumbEnd.setAttribute('data-part', 'thumb-end'); thumbEnd.setAttribute('role', 'slider'); thumbEnd.setAttribute('tabindex', '0'); trackEl.appendChild(thumbEnd);
  function getPcts() { const min = currentProps.min ?? 0; const max = currentProps.max ?? 100; const [s, e] = currentProps.value ?? [min, max]; return [(s-min)/(max-min)*100, (e-min)/(max-min)*100]; }
  function setVal(idx: number, v: number) {
    const min = currentProps.min ?? 0; const max = currentProps.max ?? 100; const step = currentProps.step ?? 1;
    v = Math.round(v / step) * step; v = Math.max(min, Math.min(max, v));
    const val = [...(currentProps.value ?? [min, max])] as [number, number];
    val[idx] = v; if (val[0] > val[1]) { if (idx === 0) val[0] = val[1]; else val[1] = val[0]; }
    currentProps.value = val; currentProps.onChange?.(val); sync();
  }
  [thumbStart, thumbEnd].forEach((thumb, idx) => {
    thumb.addEventListener('keydown', ((e: KeyboardEvent) => {
      if (currentProps.disabled) return; const step = currentProps.step ?? 1; const v = (currentProps.value ?? [0, 100])[idx];
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setVal(idx, v + step); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setVal(idx, v - step); }
    }) as EventListener);
  });
  trackEl.addEventListener('click', (e) => {
    if (currentProps.disabled) return; const rect = trackEl.getBoundingClientRect(); const pct = (e.clientX - rect.left) / rect.width;
    const min = currentProps.min ?? 0; const max = currentProps.max ?? 100; const v = min + pct * (max - min);
    const [s, en] = currentProps.value ?? [min, max];
    if (Math.abs(v - s) < Math.abs(v - en)) setVal(0, v); else setVal(1, v);
  });
  function sync() {
    const [pctS, pctE] = getPcts(); const [s, e] = currentProps.value ?? [0, 100];
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    fillEl.style.left = pctS + '%'; fillEl.style.width = (pctE - pctS) + '%';
    thumbStart.style.left = pctS + '%'; thumbEnd.style.left = pctE + '%';
    thumbStart.setAttribute('aria-valuenow', String(s)); thumbEnd.setAttribute('aria-valuenow', String(e));
    labelEl.textContent = currentProps.label ?? ''; labelEl.style.display = currentProps.label ? '' : 'none';
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createRangeSlider;
