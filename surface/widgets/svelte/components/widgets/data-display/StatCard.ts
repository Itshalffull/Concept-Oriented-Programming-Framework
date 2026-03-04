import { uid } from '../shared/uid.js';
export interface StatCardProps { label?: string; value?: string|number; change?: number; changeLabel?: string; icon?: string|HTMLElement; variant?: 'default'|'success'|'warning'|'error'; className?: string; }
export interface StatCardInstance { element: HTMLElement; update(props: Partial<StatCardProps>): void; destroy(): void; }
export function createStatCard(options: { target: HTMLElement; props: StatCardProps; }): StatCardInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'stat-card'); root.setAttribute('data-part', 'root');
  const iconEl = document.createElement('div'); iconEl.setAttribute('data-part', 'icon'); root.appendChild(iconEl);
  const contentEl = document.createElement('div'); contentEl.setAttribute('data-part', 'content'); root.appendChild(contentEl);
  const labelEl = document.createElement('div'); labelEl.setAttribute('data-part', 'label'); contentEl.appendChild(labelEl);
  const valueEl = document.createElement('div'); valueEl.setAttribute('data-part', 'value'); contentEl.appendChild(valueEl);
  const changeEl = document.createElement('div'); changeEl.setAttribute('data-part', 'change'); contentEl.appendChild(changeEl);
  function sync() {
    root.setAttribute('data-variant', currentProps.variant ?? 'default');
    labelEl.textContent = currentProps.label ?? ''; valueEl.textContent = String(currentProps.value ?? '');
    if (currentProps.change !== undefined) {
      changeEl.textContent = (currentProps.change >= 0 ? '+' : '') + currentProps.change + '%' + (currentProps.changeLabel ? ' ' + currentProps.changeLabel : '');
      changeEl.setAttribute('data-trend', currentProps.change >= 0 ? 'up' : 'down');
      changeEl.style.display = '';
    } else { changeEl.style.display = 'none'; }
    iconEl.innerHTML = ''; if (typeof currentProps.icon === 'string') iconEl.textContent = currentProps.icon; else if (currentProps.icon instanceof HTMLElement) iconEl.appendChild(currentProps.icon);
    iconEl.style.display = currentProps.icon ? '' : 'none';
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createStatCard;
