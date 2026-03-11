import { uid } from '../shared/uid.js';
export interface CardGridProps { columns?: number; gap?: 'sm'|'md'|'lg'; children?: HTMLElement[]; className?: string; }
export interface CardGridInstance { element: HTMLElement; update(props: Partial<CardGridProps>): void; destroy(): void; }
export function createCardGrid(options: { target: HTMLElement; props: CardGridProps; }): CardGridInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'card-grid'); root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'list');
  function sync() {
    root.setAttribute('data-columns', String(currentProps.columns ?? 3)); root.setAttribute('data-gap', currentProps.gap ?? 'md');
    root.style.display = 'grid'; root.style.gridTemplateColumns = 'repeat(' + (currentProps.columns ?? 3) + ', 1fr)';
    root.innerHTML = '';
    (currentProps.children ?? []).forEach(child => { const wrapper = document.createElement('div'); wrapper.setAttribute('role', 'listitem'); wrapper.appendChild(child); root.appendChild(wrapper); });
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createCardGrid;
