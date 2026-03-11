import { uid } from '../shared/uid.js';
export interface DataListProps { items?: Array<{ label: string; value: string }>; orientation?: 'horizontal'|'vertical'; className?: string; }
export interface DataListInstance { element: HTMLElement; update(props: Partial<DataListProps>): void; destroy(): void; }
export function createDataList(options: { target: HTMLElement; props: DataListProps; }): DataListInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  const root = document.createElement('dl'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'data-list'); root.setAttribute('data-part', 'root');
  function sync() {
    root.setAttribute('data-orientation', currentProps.orientation ?? 'vertical');
    root.innerHTML = '';
    (currentProps.items ?? []).forEach(item => {
      const dt = document.createElement('dt'); dt.setAttribute('data-part', 'label'); dt.textContent = item.label; root.appendChild(dt);
      const dd = document.createElement('dd'); dd.setAttribute('data-part', 'value'); dd.textContent = item.value; root.appendChild(dd);
    });
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createDataList;
