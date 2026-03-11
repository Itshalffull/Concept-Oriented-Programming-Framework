import { uid } from '../shared/uid.js';
export interface ChartProps { type?: 'bar'|'line'|'pie'|'area'; data?: Array<{ label: string; value: number; color?: string }>; title?: string; width?: number; height?: number; showLegend?: boolean; className?: string; }
export interface ChartInstance { element: HTMLElement; update(props: Partial<ChartProps>): void; destroy(): void; }
export function createChart(options: { target: HTMLElement; props: ChartProps; }): ChartInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'chart'); root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'img');
  const titleEl = document.createElement('div'); titleEl.setAttribute('data-part', 'title'); root.appendChild(titleEl);
  const canvasEl = document.createElement('div'); canvasEl.setAttribute('data-part', 'canvas'); root.appendChild(canvasEl);
  const legendEl = document.createElement('div'); legendEl.setAttribute('data-part', 'legend'); root.appendChild(legendEl);
  function sync() {
    const data = currentProps.data ?? []; const maxVal = Math.max(...data.map(d => d.value), 1);
    root.setAttribute('data-type', currentProps.type ?? 'bar');
    titleEl.textContent = currentProps.title ?? ''; titleEl.style.display = currentProps.title ? '' : 'none';
    root.setAttribute('aria-label', currentProps.title ?? 'Chart');
    canvasEl.innerHTML = '';
    if (currentProps.type === 'bar' || !currentProps.type) {
      canvasEl.style.display = 'flex'; canvasEl.style.alignItems = 'flex-end'; canvasEl.style.height = (currentProps.height ?? 200) + 'px';
      data.forEach(d => {
        const bar = document.createElement('div'); bar.setAttribute('data-part', 'bar');
        bar.style.height = (d.value / maxVal * 100) + '%'; bar.style.flex = '1';
        if (d.color) bar.style.backgroundColor = d.color;
        bar.setAttribute('aria-label', d.label + ': ' + d.value);
        canvasEl.appendChild(bar);
      });
    }
    legendEl.innerHTML = '';
    if (currentProps.showLegend) {
      data.forEach(d => { const item = document.createElement('span'); item.setAttribute('data-part', 'legend-item'); item.textContent = d.label; legendEl.appendChild(item); });
    }
    legendEl.style.display = currentProps.showLegend ? '' : 'none';
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createChart;
